// 고스톱 로비 UI — 방 생성/입장/실시간 목록 갱신
import { buildDeck, shuffle } from './engine.js';
import { renderCard } from './cards-svg.js';

const $ = (id) => document.getElementById(id);

// socket.io 클라이언트는 /socket.io/socket.io.js 에서 전역 io 로드됨
const socket = io({ path: '/gostop/socket', withCredentials: true });

let SELECTED_PC = 2;
let CURRENT_ROOM = null;

// ---- 인원수 선택 ----
document.querySelectorAll('.g-pc-btn').forEach((b) => {
  b.addEventListener('click', () => {
    document.querySelectorAll('.g-pc-btn').forEach((x) => x.classList.remove('is-selected'));
    b.classList.add('is-selected');
    SELECTED_PC = Number(b.dataset.pc);
  });
});

// ---- 방 만들기 ----
$('btnCreate').addEventListener('click', () => {
  socket.emit('room:create', { playerCount: SELECTED_PC }, (res) => {
    if (!res?.ok) return alert('방 생성 실패');
    enterRoom(res.room);
  });
});

// ---- 코드로 입장 ----
$('btnJoin').addEventListener('click', () => {
  const code = ($('joinCode').value || '').trim().toUpperCase();
  if (!code) return;
  socket.emit('room:join', { roomId: code }, (res) => {
    if (!res?.ok) {
      const msg = {
        'not-found': '그 코드의 방을 찾을 수 없어요',
        'different-family': '다른 가족의 방이에요',
        'already-started': '이미 게임이 시작됐어요',
        'full': '방이 꽉 찼어요',
      }[res?.error] || '입장 실패';
      return alert(msg);
    }
    enterRoom(res.room);
  });
});

// ---- 방 목록 실시간 갱신 ----
function refreshRoomList() {
  socket.emit('room:list', null, (res) => {
    if (!res?.ok) return;
    renderRoomList(res.rooms);
  });
}
socket.on('rooms:update', renderRoomList);

function renderRoomList(rooms) {
  const ul = $('roomList');
  const empty = $('roomEmpty');
  ul.innerHTML = '';
  if (!rooms?.length) { empty.style.display = 'block'; return; }
  empty.style.display = 'none';
  for (const r of rooms) {
    const li = document.createElement('li');
    li.innerHTML = `
      <span class="g-rl-code">${r.id}</span>
      <span>${r.playerCount}인 · ${r.players.length}명 참여</span>
      <span class="g-rl-meta">${r.players.map((p) => p.name).join(', ')}</span>`;
    li.onclick = () => {
      socket.emit('room:join', { roomId: r.id }, (res) => {
        if (!res?.ok) return alert('입장 실패');
        enterRoom(res.room);
      });
    };
    ul.appendChild(li);
  }
}

// ---- 방 진입/업데이트 ----
function enterRoom(room) {
  CURRENT_ROOM = room;
  $('lobby').classList.add('hidden');
  $('room').classList.remove('hidden');
  $('game').classList.add('hidden');
  renderRoom(room);
}

function renderRoom(room) {
  CURRENT_ROOM = room;
  $('roomTitle').textContent = `${room.playerCount}인 방`;
  $('roomCode').textContent = room.id;
  $('bigCode').textContent = room.id;
  $('roomCount').textContent = `(${room.players.length}/${room.playerCount})`;
  const ul = $('playerList');
  ul.innerHTML = '';
  for (let i = 0; i < room.playerCount; i++) {
    const p = room.players[i];
    const li = document.createElement('li');
    if (p) {
      const avatarHtml = p.photoUrl
        ? `<img src="${p.photoUrl}" alt="" />`
        : iconEmoji(p.icon);
      li.innerHTML = `<span class="g-pl-avatar">${avatarHtml}</span>
        <span class="g-pl-name">${escape(p.name)}</span>
        ${p.userId === room.hostId ? '<span class="g-pl-host">방장</span>' : ''}`;
    } else {
      li.innerHTML = `<span class="g-pl-avatar">·</span>
        <span class="g-pl-waiting">빈 자리</span>`;
    }
    ul.appendChild(li);
  }
  // 방장인 경우에만 시작 버튼, 인원 충족 시 활성
  const me = getMeUserId();
  const isHost = me && room.hostId === me;
  const ready = room.players.length >= room.playerCount;
  $('btnStart').classList.toggle('hidden', !isHost);
  $('btnStart').disabled = !ready;
  $('btnStart').textContent = ready ? '게임 시작' : `${room.playerCount - room.players.length}명 더 필요해요`;
  $('waitingMsg').style.display = isHost ? 'none' : 'block';
}

socket.on('room:update', (room) => {
  if (CURRENT_ROOM && room.id === CURRENT_ROOM.id) renderRoom(room);
});
socket.on('game:started', ({ room, game }) => {
  if (CURRENT_ROOM && room.id === CURRENT_ROOM.id) {
    $('room').classList.add('hidden');
    $('game').classList.remove('hidden');
    // 데모: 서버 권위 덱을 클라에서 임시로 보여주기 (실제 게임 플로우는 다음 라운드)
    demoDealDisplay(room.playerCount);
  }
});

// ---- 나가기 ----
$('btnLeave').addEventListener('click', () => {
  socket.emit('room:leave', null, () => {
    CURRENT_ROOM = null;
    $('room').classList.add('hidden');
    $('lobby').classList.remove('hidden');
    refreshRoomList();
  });
});
$('btnStart').addEventListener('click', () => {
  socket.emit('game:start', null, (res) => {
    if (!res?.ok) alert('시작 실패: ' + res?.error);
  });
});
$('btnQuit').addEventListener('click', () => {
  socket.emit('room:leave', null, () => {
    CURRENT_ROOM = null;
    $('game').classList.add('hidden');
    $('lobby').classList.remove('hidden');
    refreshRoomList();
  });
});

// ---- 연결/초기 로드 ----
socket.on('connect', () => {
  refreshRoomList();
});
socket.on('connect_error', (err) => {
  console.warn('[gostop] connect_error', err.message);
  if (err.message === 'unauthorized') {
    // familyboard 로그인 필요
    $('roomList').innerHTML = '';
    $('roomEmpty').textContent = '로그인이 필요해요. familyboard 에서 먼저 로그인해 주세요.';
    $('roomEmpty').style.display = 'block';
  }
});

// ---- 유틸 ----
function escape(s) { return String(s).replace(/[&<>"']/g, (c) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c])); }
function getMeUserId() {
  // socket.io 의 auth 데이터에서 내 id 를 얻기 — 서버가 handshake 에 실었을 것. 간이: socket.id 사용 안 함.
  // 대신 방 멤버 중 socketId 가 내 socket.id 와 매칭되는 사람을 찾아서 반환 (로컬용)
  if (!CURRENT_ROOM) return null;
  // 서버가 players 에 socketId 를 포함시키지 않으므로, 방장 판정은 서버 hostId 와 비교가 필요
  // 임시: window.__FB_ME 가 있으면 그 userId 사용 (미래에 주입)
  return window.__FB_ME?.id || null;
}
function iconEmoji(code) {
  const m = { star: '⭐', cat: '🐱', dog: '🐶', heart: '❤️', flower: '🌸', sun: '☀️', moon: '🌙' };
  return m[code] || '⭐';
}

// ---- 데모: 카드 분배 미리보기 ----
function demoDealDisplay(pc) {
  const deck = shuffle(buildDeck(), Date.now());
  const handSize = pc === 2 ? 10 : pc === 3 ? 7 : 6;
  const hand = deck.slice(0, handSize);
  const grid = $('demoHand');
  grid.innerHTML = '';
  for (const c of hand) grid.appendChild(renderCard(c));
}
