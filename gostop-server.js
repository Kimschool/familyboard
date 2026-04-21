// ============================================================================
// 고스톱 실시간 멀티플레이 — socket.io 기반 룸 매니저 (CommonJS)
// - 같은 가족(family_id) 멤버끼리만 같은 방에 참여
// - 서버 권위(authoritative): 게임 상태는 서버에만, 클라는 뷰만
// - MVP: 방 만들기·입장·퇴장·상태 브로드캐스트까지. 실제 게임 액션은 후속.
// ============================================================================

const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const path = require('path');
const { getPool } = require('./db');
const engine = require('./public/games/gostop/engine.js');

// 간단한 쿠키 파서 — fb_token 만 뽑으면 충분
function parseCookie(header) {
  const out = {};
  (header || '').split(';').forEach((p) => {
    const [k, ...v] = p.trim().split('=');
    if (k) out[k] = decodeURIComponent(v.join('='));
  });
  return out;
}

function getSecret() { return process.env.JWT_SECRET || 'dev-secret'; }

// 메모리 룸 저장소 — 컨테이너 재기동 시 초기화 (MVP 허용)
const ROOMS = new Map();

function newRoomId() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

function serializeRoom(room) {
  return {
    id: room.id,
    familyId: room.familyId,
    hostId: room.hostId,
    playerCount: room.playerCount,
    rules: room.rules || {},
    players: room.players.map((p) => ({
      userId: p.userId, name: p.name, icon: p.icon, photoUrl: p.photoUrl,
    })),
    state: room.game ? 'playing' : 'waiting',
    createdAt: room.createdAt,
  };
}

function attachGostopServer(httpServer) {
  const io = new Server(httpServer, {
    path: '/gostop/socket',
    cors: { origin: true, credentials: true },
  });

  // JWT 인증 — 쿠키에서 fb_token 꺼낸 뒤 DB 조회로 user 정보 채움
  io.use(async (socket, next) => {
    try {
      const cookies = parseCookie(socket.handshake.headers.cookie);
      const token = cookies.fb_token || socket.handshake.auth?.token;
      if (!token) return next(new Error('unauthorized'));
      const payload = jwt.verify(token, getSecret());
      const uid = payload.uid || payload.id;
      if (!uid) return next(new Error('unauthorized'));
      const [rows] = await getPool().query(
        `SELECT id, family_id, display_name, icon, photo_url
           FROM users WHERE id = ? LIMIT 1`, [uid]
      );
      const u = rows[0];
      if (!u || !u.family_id) return next(new Error('unauthorized'));
      socket.user = {
        id: u.id,
        familyId: u.family_id,
        name: u.display_name || '손님',
        icon: u.icon || 'star',
        photoUrl: u.photo_url || null,
      };
      next();
    } catch (e) {
      next(new Error('unauthorized'));
    }
  });

  function broadcastRooms(familyId) {
    const list = [...ROOMS.values()]
      .filter((r) => r.familyId === familyId && !r.game)
      .map(serializeRoom);
    io.to(`family:${familyId}`).emit('rooms:update', list);
  }

  io.on('connection', (socket) => {
    const me = socket.user;
    if (!me || !me.familyId) return socket.disconnect();

    // 가족 단위 로비 알림 수신용
    socket.join(`family:${me.familyId}`);

    socket.on('room:list', (_payload, ack) => {
      const list = [...ROOMS.values()]
        .filter((r) => r.familyId === me.familyId && !r.game)
        .map(serializeRoom);
      if (typeof ack === 'function') ack({ ok: true, rooms: list });
    });

    socket.on('room:create', (payload, ack) => {
      const pc = [2, 3, 4].includes(Number(payload?.playerCount)) ? Number(payload.playerCount) : 2;
      const winScoreMin = [3, 5, 7].includes(Number(payload?.winScoreMin)) ? Number(payload.winScoreMin) : 3;
      const id = newRoomId();
      const room = {
        id,
        familyId: me.familyId,
        hostId: me.id,
        playerCount: pc,
        rules: { winScoreMin: winScoreMin },
        players: [{
          userId: me.id, socketId: socket.id,
          name: me.name, icon: me.icon, photoUrl: me.photoUrl,
        }],
        game: null,
        createdAt: Date.now(),
      };
      ROOMS.set(id, room);
      socket.join(`room:${id}`);
      socket.data.roomId = id;
      if (typeof ack === 'function') ack({ ok: true, room: serializeRoom(room) });
      broadcastRooms(me.familyId);
    });

    socket.on('room:join', (payload, ack) => {
      const room = ROOMS.get(String(payload?.roomId || '').toUpperCase());
      if (!room) return typeof ack === 'function' && ack({ ok: false, error: 'not-found' });
      if (room.familyId !== me.familyId) return typeof ack === 'function' && ack({ ok: false, error: 'different-family' });
      if (room.game) return typeof ack === 'function' && ack({ ok: false, error: 'already-started' });
      if (room.players.length >= room.playerCount && !room.players.some((p) => p.userId === me.id)) {
        return typeof ack === 'function' && ack({ ok: false, error: 'full' });
      }
      const existing = room.players.find((p) => p.userId === me.id);
      if (existing) existing.socketId = socket.id;
      else room.players.push({
        userId: me.id, socketId: socket.id,
        name: me.name, icon: me.icon, photoUrl: me.photoUrl,
      });
      socket.join(`room:${room.id}`);
      socket.data.roomId = room.id;
      io.to(`room:${room.id}`).emit('room:update', serializeRoom(room));
      if (typeof ack === 'function') ack({ ok: true, room: serializeRoom(room) });
      broadcastRooms(me.familyId);
    });

    socket.on('room:leave', (_payload, ack) => {
      const roomId = socket.data.roomId;
      const room = ROOMS.get(roomId);
      if (!room) return typeof ack === 'function' && ack({ ok: true });
      leaveRoom(room, me.id, socket);
      if (typeof ack === 'function') ack({ ok: true });
    });

    // 게임 시작 — 엔진 상태 생성 후 각 플레이어에 맞춤 view 전송
    socket.on('game:start', (_payload, ack) => {
      const roomId = socket.data.roomId;
      const room = ROOMS.get(roomId);
      if (!room) return typeof ack === 'function' && ack({ ok: false, error: 'not-in-room' });
      if (room.hostId !== me.id) return typeof ack === 'function' && ack({ ok: false, error: 'not-host' });
      if (room.players.length < room.playerCount) return typeof ack === 'function' && ack({ ok: false, error: 'not-enough-players' });
      try {
        room.game = engine.createGame({
          players: room.players.map((p) => ({ userId: p.userId, name: p.name, icon: p.icon, photoUrl: p.photoUrl })),
          playerCount: room.playerCount,
          seed: Date.now(),
          rules: room.rules || {},
        });
        room.cumScores = room.cumScores || {};
        room.gameHistory = room.gameHistory || [];
        room.gameResultRecorded = false;
      } catch (e) {
        return typeof ack === 'function' && ack({ ok: false, error: e.message });
      }
      io.to(`room:${room.id}`).emit('game:started', { room: serializeRoom(room) });
      broadcastGameView(room);
      if (typeof ack === 'function') ack({ ok: true });
      broadcastRooms(me.familyId);
    });

    // 내 정보 조회 (클라가 host 판정 등에 사용)
    socket.on('me', (_payload, ack) => {
      if (typeof ack === 'function') ack({ user: { id: me.id, name: me.name, icon: me.icon, photoUrl: me.photoUrl } });
    });

    // 게임 액션: 손패 내기
    socket.on('game:play', (payload, ack) => {
      withGame(socket, ack, (room, playerIdx) => {
        const result = engine.playHandCard(room.game, playerIdx, Number(payload?.cardId), payload?.matchCardId ? Number(payload.matchCardId) : null);
        room.game = result.state;
        broadcastGameView(room);
        return { ok: true, needsMatchChoice: !!result.needsMatchChoice };
      });
    });

    // 게임 액션: 같은 달 2장 이상 — 매칭 선택 (손패 단계든 flip 단계든 공용)
    socket.on('game:match', (payload, ack) => {
      withGame(socket, ack, (room, playerIdx) => {
        const matchId = Number(payload?.matchCardId);
        let result;
        if (room.game.phase === 'choose-hand-match') {
          result = engine.resolveHandMatch(room.game, matchId);
          room.game = result.state;
          // 매칭 끝나면 flip-stock 단계로 넘어감 — 자동 진행하지 않음 (유저가 flip 버튼 눌러야)
        } else if (room.game.phase === 'choose-flip-match') {
          result = engine.resolveFlipMatch(room.game, matchId);
          room.game = result.state;
        } else {
          throw new Error('not in match-choose phase');
        }
        broadcastGameView(room);
        return { ok: true };
      });
    });

    // 게임 액션: 덱 뒤집기
    socket.on('game:flip', (_payload, ack) => {
      withGame(socket, ack, (room, playerIdx) => {
        const result = engine.flipStock(room.game, null);
        room.game = result.state;
        broadcastGameView(room);
        return { ok: true, needsMatchChoice: !!result.needsMatchChoice, needsGoStop: !!result.needsGoStop };
      });
    });

    // 게임 액션: 고 / 스톱
    socket.on('game:gostop', (payload, ack) => {
      withGame(socket, ack, (room, playerIdx) => {
        const choice = payload?.choice === 'stop' ? 'stop' : 'go';
        const result = engine.callGoStop(room.game, playerIdx, choice);
        room.game = result.state;
        broadcastGameView(room);
        return { ok: true };
      });
    });

    // 재대결 — 게임 끝난 방의 플레이어들에게 새 게임 생성
    socket.on('game:rematch', (_payload, ack) => {
      try {
        const roomId = socket.data.roomId;
        const room = ROOMS.get(roomId);
        if (!room) throw new Error('not-in-room');
        if (!room.game || !room.game.finished) throw new Error('game-not-finished');
        // 새 게임 생성 — 누적점수/히스토리/rules 유지, gameResultRecorded 만 리셋
        room.game = engine.createGame({
          players: room.players.map((p) => ({ userId: p.userId, name: p.name, icon: p.icon, photoUrl: p.photoUrl })),
          playerCount: room.playerCount,
          seed: Date.now(),
          rules: room.rules || {},
        });
        room.gameResultRecorded = false;
        io.to(`room:${room.id}`).emit('game:started', { room: serializeRoom(room) });
        broadcastGameView(room);
        if (typeof ack === 'function') ack({ ok: true });
      } catch (e) {
        if (typeof ack === 'function') ack({ ok: false, error: e.message });
      }
    });

    socket.on('disconnect', () => {
      const roomId = socket.data.roomId;
      const room = ROOMS.get(roomId);
      if (room) leaveRoom(room, me.id, socket);
    });
  });

  // 헬퍼: 게임 액션 공통 에러 처리 + 턴 검증
  function withGame(socket, ack, fn) {
    try {
      const roomId = socket.data.roomId;
      const room = ROOMS.get(roomId);
      if (!room || !room.game) throw new Error('not-in-game');
      const playerIdx = room.game.players.findIndex((p) => p.userId === socket.user.id);
      if (playerIdx < 0) throw new Error('not-a-player');
      if (room.game.turn !== playerIdx && !['choose-hand-match', 'choose-flip-match', 'choose-go-stop'].includes(room.game.phase)) {
        // 턴 검증은 phase 에 따라 엔진이 추가로 검증
      }
      const res = fn(room, playerIdx);
      if (typeof ack === 'function') ack(res || { ok: true });
    } catch (e) {
      if (typeof ack === 'function') ack({ ok: false, error: e.message });
    }
  }

  // 각 플레이어에게 본인 시점의 view 만 보내고, 룸 전체엔 공통 이벤트 알림.
  // 게임이 방금 끝났으면 누적 점수도 업데이트.
  function broadcastGameView(room) {
    const game = room.game;
    if (!game) return;
    // 게임 종료 시 1회만 누적 점수 기록 + DB 기록
    if (game.finished && !room.gameResultRecorded) {
      room.gameResultRecorded = true;
      room.cumScores = room.cumScores || {};
      const w = game.winner;
      if (w != null) {
        const winnerUserId = game.players[w].userId;
        const winPts = game.scores[w] || 0;
        room.cumScores[winnerUserId] = (room.cumScores[winnerUserId] || 0) + winPts;
        room.gameHistory = room.gameHistory || [];
        room.gameHistory.push({
          winnerUserId: winnerUserId,
          winnerName: game.players[w].name,
          score: winPts,
          endedAt: Date.now(),
        });
        // DB 비동기 기록 — 실패해도 게임 흐름엔 영향 없음
        recordGameResult(room, game).catch(function (e) {
          console.warn('[gostop] recordGameResult failed:', e.message);
        });
      }
    }
    const cumScoresArr = room.players.map((p) => ({
      userId: p.userId,
      name: p.name,
      total: (room.cumScores && room.cumScores[p.userId]) || 0,
    }));
    room.players.forEach((p) => {
      const playerIdx = game.players.findIndex((gp) => gp.userId === p.userId);
      if (playerIdx < 0) return;
      const view = engine.viewFor(game, playerIdx);
      view.cumScores = cumScoresArr;
      view.gameRound = (room.gameHistory && room.gameHistory.length + (game.finished ? 0 : 1)) || 1;
      io.to(p.socketId).emit('game:view', view);
    });
  }

  function leaveRoom(room, userId, socket) {
    room.players = room.players.filter((p) => p.userId !== userId);
    socket.leave(`room:${room.id}`);
    socket.data.roomId = null;
    if (!room.players.length) {
      ROOMS.delete(room.id);
    } else {
      if (room.hostId === userId) room.hostId = room.players[0].userId;
      io.to(`room:${room.id}`).emit('room:update', serializeRoom(room));
    }
    broadcastRooms(room.familyId);
  }

  async function recordGameResult(room, game) {
    const winnerIdx = game.winner;
    const winnerUserId = winnerIdx != null ? game.players[winnerIdx].userId : null;
    const [r] = await getPool().query(
      'INSERT INTO gostop_games (family_id, player_count, winner_user_id, winner_score) VALUES (?, ?, ?, ?)',
      [room.familyId, room.playerCount, winnerUserId, (winnerIdx != null ? game.scores[winnerIdx] : 0)]
    );
    const gameId = r.insertId;
    // 각 플레이어 결과
    for (let i = 0; i < game.players.length; i++) {
      await getPool().query(
        'INSERT IGNORE INTO gostop_results (game_id, user_id, score, is_winner) VALUES (?, ?, ?, ?)',
        [gameId, game.players[i].userId, game.scores[i] || 0, i === winnerIdx ? 1 : 0]
      );
    }
  }

  console.log('[gostop] socket.io mounted at /gostop/socket');
  return io;
}

module.exports = { attachGostopServer };
