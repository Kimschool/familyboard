// 고스톱 로비 — 방 생성/입장/실시간 목록 (전역 스크립트)
(function () {
  'use strict';
  const $ = function (id) { return document.getElementById(id); };

  const socket = io({ path: '/gostop/socket', withCredentials: true });
  window.GostopSocket = socket;

  let SELECTED_PC = 2;
  let CURRENT_ROOM = null;

  document.querySelectorAll('.g-pc-btn').forEach(function (b) {
    b.addEventListener('click', function () {
      document.querySelectorAll('.g-pc-btn').forEach(function (x) { x.classList.remove('is-selected'); });
      b.classList.add('is-selected');
      SELECTED_PC = Number(b.dataset.pc);
    });
  });

  $('btnCreate').addEventListener('click', function () {
    socket.emit('room:create', { playerCount: SELECTED_PC }, function (res) {
      if (!res || !res.ok) return alert('방 생성 실패');
      enterRoom(res.room);
    });
  });

  $('btnJoin').addEventListener('click', function () {
    const code = ($('joinCode').value || '').trim().toUpperCase();
    if (!code) return;
    socket.emit('room:join', { roomId: code }, function (res) {
      if (!res || !res.ok) {
        const msg = {
          'not-found': '그 코드의 방을 찾을 수 없어요',
          'different-family': '다른 가족의 방이에요',
          'already-started': '이미 게임이 시작됐어요',
          'full': '방이 꽉 찼어요',
        }[res && res.error] || '입장 실패';
        return alert(msg);
      }
      enterRoom(res.room);
    });
  });

  function refreshRoomList() {
    socket.emit('room:list', null, function (res) {
      if (!res || !res.ok) return;
      renderRoomList(res.rooms);
    });
  }
  socket.on('rooms:update', renderRoomList);

  function renderRoomList(rooms) {
    const ul = $('roomList');
    const empty = $('roomEmpty');
    ul.innerHTML = '';
    if (!rooms || !rooms.length) { empty.style.display = 'block'; return; }
    empty.style.display = 'none';
    rooms.forEach(function (r) {
      const li = document.createElement('li');
      li.innerHTML =
        '<span class="g-rl-code">' + r.id + '</span>' +
        '<span>' + r.playerCount + '인 · ' + r.players.length + '명 참여</span>' +
        '<span class="g-rl-meta">' + r.players.map(function (p) { return escapeHtml(p.name); }).join(', ') + '</span>';
      li.onclick = function () {
        socket.emit('room:join', { roomId: r.id }, function (res) {
          if (!res || !res.ok) return alert('입장 실패');
          enterRoom(res.room);
        });
      };
      ul.appendChild(li);
    });
  }

  function enterRoom(room) {
    CURRENT_ROOM = room;
    window.GostopCurrentRoom = room;
    $('lobby').classList.add('hidden');
    $('room').classList.remove('hidden');
    $('game').classList.add('hidden');
    renderRoom(room);
  }

  function renderRoom(room) {
    CURRENT_ROOM = room;
    window.GostopCurrentRoom = room;
    $('roomTitle').textContent = room.playerCount + '인 방';
    $('roomCode').textContent = room.id;
    $('bigCode').textContent = room.id;
    $('roomCount').textContent = '(' + room.players.length + '/' + room.playerCount + ')';
    const ul = $('playerList');
    ul.innerHTML = '';
    for (let i = 0; i < room.playerCount; i++) {
      const p = room.players[i];
      const li = document.createElement('li');
      if (p) {
        const avatarHtml = p.photoUrl
          ? '<img src="' + escapeHtml(p.photoUrl) + '" alt="" />'
          : iconEmoji(p.icon);
        li.innerHTML =
          '<span class="g-pl-avatar">' + avatarHtml + '</span>' +
          '<span class="g-pl-name">' + escapeHtml(p.name) + '</span>' +
          (p.userId === room.hostId ? '<span class="g-pl-host">방장</span>' : '');
      } else {
        li.innerHTML = '<span class="g-pl-avatar">·</span><span class="g-pl-waiting">빈 자리</span>';
      }
      ul.appendChild(li);
    }
    const me = window.GostopMe;
    const isHost = me && room.hostId === me.id;
    const ready = room.players.length >= room.playerCount;
    $('btnStart').classList.toggle('hidden', !isHost);
    $('btnStart').disabled = !ready;
    $('btnStart').textContent = ready ? '게임 시작' : ((room.playerCount - room.players.length) + '명 더 필요해요');
    $('waitingMsg').style.display = isHost ? 'none' : 'block';
  }

  socket.on('room:update', function (room) {
    if (CURRENT_ROOM && room.id === CURRENT_ROOM.id) renderRoom(room);
  });
  socket.on('game:started', function (payload) {
    if (CURRENT_ROOM && payload.room.id === CURRENT_ROOM.id) {
      $('room').classList.add('hidden');
      $('game').classList.remove('hidden');
      if (window.GostopGame && window.GostopGame.start) window.GostopGame.start(payload);
    }
  });
  socket.on('game:view', function (view) {
    if (window.GostopGame && window.GostopGame.onView) window.GostopGame.onView(view);
  });

  $('btnLeave').addEventListener('click', function () {
    socket.emit('room:leave', null, function () {
      CURRENT_ROOM = null;
      $('room').classList.add('hidden');
      $('lobby').classList.remove('hidden');
      refreshRoomList();
    });
  });
  $('btnStart').addEventListener('click', function () {
    socket.emit('game:start', null, function (res) {
      if (!res || !res.ok) alert('시작 실패: ' + (res && res.error));
    });
  });
  $('btnQuit').addEventListener('click', function () {
    socket.emit('room:leave', null, function () {
      CURRENT_ROOM = null;
      $('game').classList.add('hidden');
      $('lobby').classList.remove('hidden');
      refreshRoomList();
    });
  });

  socket.on('connect', function () {
    // 서버가 handshake 때 내 user 정보를 별도 이벤트로 보내줌
    socket.emit('me', null, function (res) {
      if (res && res.user) window.GostopMe = res.user;
    });
    refreshRoomList();
    loadRanking();
  });

  function loadRanking() {
    fetch('/api/gostop/stats', { credentials: 'same-origin' })
      .then(function (r) { return r.json(); })
      .then(function (list) {
        const ul = $('gostopRanking');
        const empty = $('gostopRankingEmpty');
        if (!ul) return;
        const played = list.filter(function (p) { return p.games > 0; });
        ul.innerHTML = '';
        if (!played.length) { empty.style.display = 'block'; return; }
        empty.style.display = 'none';
        played.sort(function (a, b) { return b.wins - a.wins || b.totalScore - a.totalScore; });
        played.forEach(function (p, rank) {
          const medal = rank === 0 ? '🥇' : rank === 1 ? '🥈' : rank === 2 ? '🥉' : '';
          const avatarHtml = p.photoUrl
            ? '<img src="' + p.photoUrl.replace(/"/g, '') + '" alt="" />'
            : iconEmoji(p.icon);
          const li = document.createElement('li');
          li.className = 'g-rank-row' + (rank === 0 ? ' is-top' : '');
          li.innerHTML =
            '<span class="g-rank-medal">' + (medal || ('#' + (rank + 1))) + '</span>' +
            '<span class="g-rank-avatar">' + avatarHtml + '</span>' +
            '<div class="g-rank-main">' +
              '<div class="g-rank-name">' + escapeHtml(p.name) + '</div>' +
              '<div class="g-rank-stats">' + p.wins + '승 · ' + p.games + '판 · 승률 ' + p.winRate + '%</div>' +
            '</div>' +
            '<div class="g-rank-score"><b>' + p.totalScore + '</b><span>총 점수</span></div>';
          ul.appendChild(li);
        });
      })
      .catch(function () {});
  }
  socket.on('connect_error', function (err) {
    if (err.message === 'unauthorized') {
      $('roomList').innerHTML = '';
      $('roomEmpty').textContent = '로그인이 필요해요. familyboard 에서 먼저 로그인해 주세요.';
      $('roomEmpty').style.display = 'block';
    }
  });

  function escapeHtml(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]; }); }
  function iconEmoji(code) {
    const m = { star: '⭐', cat: '🐱', dog: '🐶', heart: '❤️', flower: '🌸', sun: '☀️', moon: '🌙' };
    return m[code] || '⭐';
  }
})();
