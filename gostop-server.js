// ============================================================================
// 고스톱 실시간 멀티플레이 — socket.io 기반 룸 매니저 (CommonJS)
// - 같은 가족(family_id) 멤버끼리만 같은 방에 참여
// - 서버 권위(authoritative): 게임 상태는 서버에만, 클라는 뷰만
// - MVP: 방 만들기·입장·퇴장·상태 브로드캐스트까지. 실제 게임 액션은 후속.
// ============================================================================

const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const { getPool } = require('./db');

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
      const id = newRoomId();
      const room = {
        id,
        familyId: me.familyId,
        hostId: me.id,
        playerCount: pc,
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

    socket.on('game:start', (_payload, ack) => {
      const roomId = socket.data.roomId;
      const room = ROOMS.get(roomId);
      if (!room) return typeof ack === 'function' && ack({ ok: false, error: 'not-in-room' });
      if (room.hostId !== me.id) return typeof ack === 'function' && ack({ ok: false, error: 'not-host' });
      if (room.players.length < room.playerCount) return typeof ack === 'function' && ack({ ok: false, error: 'not-enough-players' });
      // TODO: engine.createGame 호출 → 실제 덱·배분·턴 상태
      room.game = {
        startedAt: Date.now(),
        playerCount: room.playerCount,
        players: room.players.map((p) => ({ userId: p.userId, name: p.name })),
      };
      io.to(`room:${room.id}`).emit('game:started', { room: serializeRoom(room), game: room.game });
      if (typeof ack === 'function') ack({ ok: true });
      broadcastRooms(me.familyId);
    });

    socket.on('disconnect', () => {
      const roomId = socket.data.roomId;
      const room = ROOMS.get(roomId);
      if (room) leaveRoom(room, me.id, socket);
    });
  });

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

  console.log('[gostop] socket.io mounted at /gostop/socket');
  return io;
}

module.exports = { attachGostopServer };
