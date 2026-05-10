// 고스톱 로비 — 방 생성/입장/실시간 목록 (전역 스크립트)

// ===== 로비 탭 전환 =====
(function setupLobbyTabs() {
  document.querySelectorAll('.g-lobby-tab').forEach(function (tab) {
    tab.addEventListener('click', function () {
      document.querySelectorAll('.g-lobby-tab').forEach(function (t) {
        t.classList.remove('is-active');
        t.setAttribute('aria-selected', 'false');
      });
      this.classList.add('is-active');
      this.setAttribute('aria-selected', 'true');
      var target = this.dataset.tab;
      var battle = document.getElementById('lobbyTabBattle');
      var tools = document.getElementById('lobbyTabTools');
      if (target === 'battle') {
        if (battle) battle.hidden = false;
        if (tools) tools.hidden = true;
      } else {
        if (battle) battle.hidden = true;
        if (tools) tools.hidden = false;
        if (window.GostopTarot) window.GostopTarot.init(document.getElementById('tarotSection'));
      }
    });
  });
})();

(function () {
  'use strict';
  const $ = function (id) { return document.getElementById(id); };

  // socket.io 클라이언트가 로드 안 됐으면 (네트워크 문제·서버 다운) 안내 후 중단
  if (typeof io === 'undefined') {
    const empty = $('roomEmpty');
    if (empty) {
      empty.textContent = '⚠️ 서버에 연결할 수 없어요. 잠시 후 새로고침해 주세요.';
      empty.style.display = 'block';
    }
    const lobby = $('lobby');
    if (lobby) lobby.style.visibility = '';
    return;
  }

  const socket = io({ path: '/gostop/socket', withCredentials: true });
  window.GostopSocket = socket;

  let SELECTED_PC = 2;
  let SELECTED_WS = 3;
  let CURRENT_ROOM = null;

  function syncPickerAria() {
    document.querySelectorAll('.g-pc-btn').forEach(function (x) {
      x.setAttribute('aria-pressed', x.classList.contains('is-selected') ? 'true' : 'false');
    });
    document.querySelectorAll('.g-ws-btn').forEach(function (x) {
      x.setAttribute('aria-pressed', x.classList.contains('is-selected') ? 'true' : 'false');
    });
  }
  syncPickerAria();

  function setLobbyConn(msg, isBad) {
    const el = $('lobbyConnStatus');
    if (!el) return;
    if (!msg) {
      el.hidden = true;
      el.textContent = '';
      el.classList.remove('is-bad', 'is-ok');
      return;
    }
    el.hidden = false;
    el.textContent = msg;
    el.classList.toggle('is-bad', !!isBad);
    el.classList.toggle('is-ok', !isBad);
  }

  document.querySelectorAll('.g-pc-btn').forEach(function (b) {
    b.addEventListener('click', function () {
      document.querySelectorAll('.g-pc-btn').forEach(function (x) { x.classList.remove('is-selected'); });
      b.classList.add('is-selected');
      SELECTED_PC = Number(b.dataset.pc);
      syncPickerAria();
    });
  });
  document.querySelectorAll('.g-ws-btn').forEach(function (b) {
    b.addEventListener('click', function () {
      document.querySelectorAll('.g-ws-btn').forEach(function (x) { x.classList.remove('is-selected'); });
      b.classList.add('is-selected');
      SELECTED_WS = Number(b.dataset.ws);
      syncPickerAria();
    });
  });

  $('btnCreate').addEventListener('click', function () {
    const btn = $('btnCreate');
    const prevLabel = btn.textContent;
    btn.disabled = true;
    btn.setAttribute('aria-busy', 'true');
    btn.textContent = '만드는 중…';
    socket.emit('room:create', { playerCount: SELECTED_PC, winScoreMin: SELECTED_WS }, function (res) {
      btn.disabled = false;
      btn.removeAttribute('aria-busy');
      btn.textContent = prevLabel;
      if (!res || !res.ok) return alert('방 생성 실패');
      enterRoom(res.room);
    });
  });

  // 도움말 시트 토글
  function openHelpSheet() {
    if (typeof window.GostopOpenHelp === 'function') {
      window.GostopOpenHelp();
    } else {
      const dlg = $('helpSheet');
      if (!dlg) return;
      dlg.classList.remove('hidden');
      dlg.style.display = 'flex';
      dlg.setAttribute('aria-hidden', 'false');
      setTimeout(function () { const c = $('btnHelpClose'); if (c) c.focus({ preventScroll: true }); }, 0);
    }
  }
  $('btnHelp') && $('btnHelp').addEventListener('click', openHelpSheet);
  function closeHelpSheet() {
    const dlg = $('helpSheet');
    if (!dlg) return;
    dlg.classList.add('hidden');
    dlg.style.display = 'none';
    dlg.setAttribute('aria-hidden', 'true');
    const b = $('btnHelp');
    if (b) b.focus({ preventScroll: true });
  }
  window.GostopCloseHelp = closeHelpSheet;
  $('btnHelpClose') && $('btnHelpClose').addEventListener('click', closeHelpSheet);
  $('helpSheet') && $('helpSheet').addEventListener('click', function (e) {
    if (e.target.id === 'helpSheet') closeHelpSheet();
  });
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    const dlg = $('helpSheet');
    if (!dlg || dlg.classList.contains('hidden') || dlg.style.display === 'none') return;
    e.preventDefault();
    closeHelpSheet();
  });

  function refreshRoomList() {
    socket.emit('room:list', null, function (res) {
      if (!res || !res.ok) return;
      renderRoomList(res.rooms);
    });
  }
  socket.on('rooms:update', renderRoomList);

  function roomHostName(r) {
    const pl = r.players || [];
    for (var i = 0; i < pl.length; i++) {
      if (pl[i].userId === r.hostId) return pl[i].name;
    }
    return '—';
  }

  function joinRoomById(roomId) {
    socket.emit('room:join', { roomId: roomId }, function (res) {
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
  }

  function renderRoomList(rooms) {
    const ul = $('roomList');
    const empty = $('roomEmpty');
    ul.innerHTML = '';
    if (!rooms || !rooms.length) {
      empty.style.display = 'block';
      empty.textContent = '아직 열려 있는 방이 없어요. 위에서 방을 만들 수 있어요.';
      return;
    }
    empty.style.display = 'none';
    const me = window.GostopMe;
    rooms.forEach(function (r) {
      const li = document.createElement('li');
      const ws = (r.rules && r.rules.winScoreMin != null) ? r.rules.winScoreMin : 3;
      const hostN = roomHostName(r);
      const plist = r.players || [];
      var im = false;
      if (me) {
        for (var j = 0; j < plist.length; j++) {
          if (plist[j].userId === me.id) { im = true; break; }
        }
      }
      if (im) li.classList.add('is-me-in-room');
      li.setAttribute('role', 'button');
      li.setAttribute('tabindex', '0');
      li.setAttribute('aria-label',
        r.id + ' 방, ' + r.playerCount + '인, ' + ws + '점 승리, 방장 ' + hostN + ', ' + (r.players || []).length + '명 참가. 눌러 입장');
      const names = (r.players || []).map(function (p) { return escapeHtml(p.name); }).join(', ') || '—';
      li.innerHTML =
        '<div class="g-rl-left">' +
          '<span class="g-rl-code">' + r.id + '</span>' +
          '<div class="g-rl-line2">' +
            '<span class="g-rl-pill">' + r.playerCount + '인</span>' +
            '<span class="g-rl-dot">·</span>' +
            '<span class="g-rl-pill">' + ws + '점</span>' +
            '<span class="g-rl-dot">·</span>' +
            '<span class="g-rl-host">' + escapeHtml(hostN) + '</span>' +
          '</div>' +
        '</div>' +
        '<div class="g-rl-right">' +
          (im ? '<span class="g-rl-joined">참가 중</span>' : '') +
          '<span class="g-rl-meta">' + names + '</span>' +
        '</div>';
      li.onclick = function () { joinRoomById(r.id); };
      li.onkeydown = function (e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          joinRoomById(r.id);
        }
      };
      ul.appendChild(li);
    });
  }

  function buildJoinUrl(code) {
    return window.location.origin + '/games/gostop/?join=' + encodeURIComponent(code) + '&mode=multi';
  }

  function enterRoom(room) {
    CURRENT_ROOM = room;
    window.GostopCurrentRoom = room;
    try { document.title = '고스톱 방 ' + room.id + ' — familyboard'; } catch (_) {}
    $('lobby').classList.add('hidden');
    $('room').classList.remove('hidden');
    $('game').classList.add('hidden');
    renderRoom(room);
  }

  function renderRoom(room) {
    CURRENT_ROOM = room;
    window.GostopCurrentRoom = room;
    const ws = (room.rules && room.rules.winScoreMin) || 3;
    $('roomTitle').textContent = room.playerCount + '인 방 · ' + ws + '점 승리';
    $('roomCode').textContent = room.id;
    const bc = $('bigCode');
    if (bc) {
      bc.textContent = room.id;
      bc.setAttribute('aria-label', '방 코드 ' + room.id + ' 복사하려면 탭');
    }
    const jurl = buildJoinUrl(room.id);
    const joinEl = $('roomJoinUrl');
    if (joinEl) {
      joinEl.textContent = jurl;
      joinEl.setAttribute('aria-label', '초대 링크 전체, 복사하려면 탭');
    }
    const sh = $('btnShareRoom');
    if (sh) {
      sh.hidden = !navigator.share;
      sh.onclick = function () {
        if (!navigator.share) return;
        navigator.share({ title: '고스톱 방', text: '같이 고스톱 할래? 코드: ' + room.id, url: jurl })
          .catch(function () {});
      };
    }
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
        li.innerHTML = '<span class="g-pl-avatar" aria-hidden="true">·</span><span class="g-pl-waiting">빈 자리 (초대 링크로 들어올 수 있어요)</span>';
      }
      ul.appendChild(li);
    }
    const me = window.GostopMe;
    const isHost = me && room.hostId === me.id;
    const ready = room.players.length >= room.playerCount;
    const needN = room.playerCount - room.players.length;
    const st = $('btnStart');
    if (st) {
      st.classList.toggle('hidden', !isHost);
      st.disabled = !ready;
      st.textContent = ready ? '게임 시작' : (needN + '명 더 필요해요');
      st.setAttribute('aria-disabled', (!ready) ? 'true' : 'false');
      st.title = ready
        ? '모인 인원으로 바로 대전을 시작해요'
        : ('아직 ' + needN + '명의 자리가 비어 있어요');
    }
    const wm = $('waitingMsg');
    if (wm) {
      if (isHost) {
        wm.textContent = needN > 0
          ? (needN + '명을 더 기다리고 있어요. (아래 링크로 가족을 부르세요.)')
          : '모든 인원이 모였어요! 게임 시작을 누르세요.';
        wm.style.display = 'block';
      } else {
        wm.textContent = needN > 0
          ? (needN + '명이 더 들어와야 방장이 시작할 수 있어요.')
          : '방장이 곧 게임을 시작해요. 잠시만 기다려 주세요.';
        wm.style.display = 'block';
      }
    }
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
  // 새로고침 / 짧은 끊김 후 자동 복귀 — 서버가 active room 발견 시 푸시
  socket.on('game:resumed', function (payload) {
    CURRENT_ROOM = payload.room;
    window.GostopCurrentRoom = payload.room;
    // 싱글모드인지 표시 (lobby URL mode 와 무관 — 서버 권위)
    if (payload.room && payload.room.players && payload.room.players.some(function (p) { return p.userId < 0; })) {
      window._gostopSingleActive = true;
    }
    $('lobby').classList.add('hidden');
    $('single').classList.add('hidden');
    $('room').classList.add('hidden');
    $('game').classList.remove('hidden');
    if (window.GostopGame && window.GostopGame.start) window.GostopGame.start(payload);
  });
  socket.on('game:view', function (view) {
    if (window.GostopGame && window.GostopGame.onView) window.GostopGame.onView(view);
  });

  $('btnLeave').addEventListener('click', function () {
    socket.emit('room:leave', null, function () {
      CURRENT_ROOM = null;
      try { document.title = '고스톱 (테스트) — familyboard'; } catch (_) {}
      $('room').classList.add('hidden');
      $('lobby').classList.remove('hidden');
      refreshRoomList();
    });
  });
  $('btnStart').addEventListener('click', function () {
    const st = $('btnStart');
    if (st) {
      st.disabled = true;
      st.setAttribute('aria-busy', 'true');
      st.textContent = '시작하는 중…';
    }
    socket.emit('game:start', null, function (res) {
      if (st) st.removeAttribute('aria-busy');
      if (!res || !res.ok) {
        alert('시작 실패: ' + (res && res.error));
        if (CURRENT_ROOM) renderRoom(CURRENT_ROOM);
        return;
      }
    });
  });
  if ($('btnRefreshRooms')) {
    $('btnRefreshRooms').addEventListener('click', function () {
      const b = $('btnRefreshRooms');
      if (b) b.classList.add('is-spin');
      refreshRoomList();
      setTimeout(function () { if (b) b.classList.remove('is-spin'); }, 600);
    });
  }
  // 방 코드 복사 — 클립보드 + bigCode 도 클릭 시 복사
  function copyRoomCode() {
    const code = ($('bigCode') && $('bigCode').textContent || '').trim();
    if (!code || code === '—') return;
    const showCopied = function () {
      const btn = $('btnCopyCode');
      if (btn) {
        const orig = btn.textContent;
        btn.textContent = '✓ 복사됨!';
        btn.disabled = true;
        setTimeout(function () { btn.textContent = orig; btn.disabled = false; }, 1400);
      }
      const big = $('bigCode');
      if (big) {
        big.classList.remove('is-copy-flash');
        void big.offsetWidth;
        big.classList.add('is-copy-flash');
      }
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(code).then(showCopied).catch(function () {
        // fallback
        try {
          const ta = document.createElement('textarea');
          ta.value = code; document.body.appendChild(ta);
          ta.select(); document.execCommand('copy'); document.body.removeChild(ta);
          showCopied();
        } catch {}
      });
    } else {
      try {
        const ta = document.createElement('textarea');
        ta.value = code; document.body.appendChild(ta);
        ta.select(); document.execCommand('copy'); document.body.removeChild(ta);
        showCopied();
      } catch {}
    }
  }
  if ($('btnCopyCode')) $('btnCopyCode').addEventListener('click', copyRoomCode);
  if ($('bigCode')) {
    $('bigCode').addEventListener('click', copyRoomCode);
    $('bigCode').addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); copyRoomCode(); }
    });
  }
  function copyJoinUrl() {
    const u = ($('roomJoinUrl') && $('roomJoinUrl').textContent || '').trim();
    if (!u || u === '—') return;
    const showJ = function () {
      const btn = $('btnCopyJoinUrl');
      if (btn) {
        const o = btn.textContent;
        btn.textContent = '✓ 링크 복사됨';
        btn.disabled = true;
        setTimeout(function () { btn.textContent = o; btn.disabled = false; }, 1400);
      }
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(u).then(showJ).catch(function () {
        try {
          const ta = document.createElement('textarea');
          ta.value = u; document.body.appendChild(ta);
          ta.select(); document.execCommand('copy'); document.body.removeChild(ta);
          showJ();
        } catch {}
      });
    } else {
      try {
        const ta = document.createElement('textarea');
        ta.value = u; document.body.appendChild(ta);
        ta.select(); document.execCommand('copy'); document.body.removeChild(ta);
        showJ();
      } catch {}
    }
  }
  if ($('btnCopyJoinUrl')) $('btnCopyJoinUrl').addEventListener('click', copyJoinUrl);
  if ($('roomJoinUrl')) {
    $('roomJoinUrl').addEventListener('click', copyJoinUrl);
    $('roomJoinUrl').addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); copyJoinUrl(); }
    });
  }
  $('btnQuit').addEventListener('click', function () {
    socket.emit('room:leave', null, function () {
      CURRENT_ROOM = null;
      try { document.title = '고스톱 (테스트) — familyboard'; } catch (_) {}
      $('game').classList.add('hidden');
      // 싱글모드에서 나가기 → 싱글 화면으로 / 멀티모드에서 나가기 → 로비
      if (window._gostopSingleActive || window._gostopSingleResult) {
        window._gostopSingleActive = false;
        window._gostopSingleHandled = false;
        const single = $('single');
        if (single) {
          single.classList.remove('hidden');
          if (window.GostopRefreshSingle) window.GostopRefreshSingle();
        }
      } else {
        $('lobby').classList.remove('hidden');
        refreshRoomList();
      }
    });
  });

  socket.on('connect', function () {
    setLobbyConn('');
    // 서버가 handshake 때 내 user 정보를 별도 이벤트로 보내줌
    socket.emit('me', null, function (res) {
      if (res && res.user) {
        window.GostopMe = res.user;
        if (CURRENT_ROOM) renderRoom(CURRENT_ROOM);
      }
    });
    refreshRoomList();
    loadRanking();
    handleAutoIntent();
  });
  socket.on('disconnect', function (reason) {
    setLobbyConn('서버와 잠시 연결이 끊겼어요. 자동으로 다시 붙는 중…', true);
  });
  try {
    if (socket.io && typeof socket.io.on === 'function') {
      socket.io.on('reconnect', function () {
        setLobbyConn('다시 연결됐어요. 방 목록을 불러올게요.', false);
        setTimeout(function () { setLobbyConn(''); }, 3200);
        refreshRoomList();
      });
    }
  } catch (_) {}

  function handleAutoIntent() {
    try {
      const params = new URLSearchParams(window.location.search);
      const autoCreate = params.get('autoCreate');
      const join = params.get('join');
      const urlMode = params.get('mode');
      const pc = Number(params.get('pc')) || 2;
      // mode 가 URL 에 있으면 localStorage 에 기억 (F5 후에도 그 모드 유지)
      if (urlMode === 'single' || urlMode === 'multi') {
        try { localStorage.setItem('gostop_last_mode', urlMode); } catch {}
      }
      // mode 가 URL 에 없으면 localStorage 에서 복원
      const lastMode = (function () {
        try { return localStorage.getItem('gostop_last_mode'); } catch { return null; }
      })();
      const mode = urlMode || (autoCreate || join ? null : lastMode);
      // autoCreate/join 만 URL 에서 제거 (한 번만 실행) — mode 는 유지
      if (autoCreate || join) {
        const keep = mode ? ('?mode=' + encodeURIComponent(mode)) : '';
        history.replaceState(null, '', '/games/gostop/' + keep);
      } else if (urlMode && !window.location.search.includes('mode=')) {
        // 정합성 체크용 noop
      } else if (!urlMode && lastMode === 'single') {
        // 빈 URL 인데 마지막 모드가 single 이면 URL 에 mode 도 박아 둠
        history.replaceState(null, '', '/games/gostop/?mode=single');
      }
      if (mode === 'single') {
        showSinglePlay();
        return;
      }
      // 멀티 모드 — lobby 보이게 + localStorage 에 기록
      try { localStorage.setItem('gostop_last_mode', 'multi'); } catch {}
      $('lobby').style.visibility = '';
      if (autoCreate === '1') {
        const validPc = pc === 3 || pc === 4 ? pc : 2;
        socket.emit('room:create', { playerCount: validPc, winScoreMin: SELECTED_WS }, function (res) {
          if (!res || !res.ok) return alert('방 생성 실패');
          enterRoom(res.room);
          // 채팅에 카드 게시
          fetch('/api/chat', {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: '/gostop-game/' + res.room.id }),
          }).catch(function () {});
        });
        return;
      }
      if (join) {
        const code = join.toUpperCase();
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
      }
    } catch {}
  }

  function showStatsDetail(player) {
    let dlg = $('statsDetailDlg');
    if (!dlg) {
      dlg = document.createElement('div');
      dlg.id = 'statsDetailDlg';
      dlg.className = 'g-stats-backdrop';
      dlg.addEventListener('click', function (e) { if (e.target === dlg) dlg.remove(); });
      document.body.appendChild(dlg);
    }
    dlg.innerHTML = '<div class="g-stats-card"><p class="g-stats-loading">불러오는 중…</p></div>';
    fetch('/api/gostop/stats/' + player.userId, { credentials: 'same-origin' })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (!d || !d.user) throw new Error('bad');
        const recent = d.recentGames || [];
        const recentHtml = recent.length
          ? recent.slice(0, 10).map(function (g) {
              const when = new Date(g.endedAt);
              const d2 = when.getMonth() + 1 + '/' + when.getDate();
              return '<li class="g-stat-game' + (g.isWinner ? ' is-win' : '') + '">' +
                '<span>' + d2 + '</span>' +
                '<span>' + g.playerCount + '인</span>' +
                '<span>' + (g.isWinner ? '승' : '·') + '</span>' +
                '<span>' + g.score + '점</span>' +
                '</li>';
            }).join('')
          : '<li class="g-empty">기록 없음</li>';
        const avatarHtml = d.user.photoUrl
          ? '<img src="' + d.user.photoUrl.replace(/"/g, '') + '" alt="" />'
          : iconEmoji(d.user.icon);
        dlg.innerHTML =
          '<div class="g-stats-card">' +
            '<div class="g-stats-head">' +
              '<span class="g-rank-avatar">' + avatarHtml + '</span>' +
              '<div class="g-stats-name">' + escapeHtml(d.user.name) + ' 의 기록</div>' +
              '<button class="g-stats-close" aria-label="닫기">✕</button>' +
            '</div>' +
            '<div class="g-stats-grid">' +
              '<div class="g-stats-cell"><b>' + player.wins + '</b><span>총 승수</span></div>' +
              '<div class="g-stats-cell"><b>' + player.winRate + '%</b><span>승률</span></div>' +
              '<div class="g-stats-cell"><b>' + player.bestScore + '</b><span>최고 점수</span></div>' +
              '<div class="g-stats-cell"><b>' + (d.currentStreak || 0) + '연승</b><span>현재 연승</span></div>' +
              '<div class="g-stats-cell"><b>' + (d.maxStreak || 0) + '연승</b><span>역대 최고</span></div>' +
              '<div class="g-stats-cell"><b>' + player.games + '</b><span>총 판수</span></div>' +
            '</div>' +
            '<h4 class="g-stats-sub">최근 10판</h4>' +
            '<ul class="g-stat-list">' + recentHtml + '</ul>' +
          '</div>';
        dlg.querySelector('.g-stats-close').onclick = function () { dlg.remove(); };
      })
      .catch(function () { dlg.remove(); alert('기록 불러오기 실패'); });
  }

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
          li.onclick = function () { showStatsDetail(p); };
          li.style.cursor = 'pointer';
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

  // ===== 싱글모드 =====
  const SINGLE_KEY = 'gostop_single_progress_v5';
  const SINGLE_KEY_V4 = 'gostop_single_progress_v4';
  const SINGLE_KEY_V3 = 'gostop_single_progress_v3';
  // ★ 레벨별 점당(₩) — 1단계 100원, 단계마다 1.2배 (완만한 지수 상승)
  //    이전엔 5배 → Lv.40 에서 점당 1.16×10²³ 원 (3.5×10²⁷ 원 시작금) 비현실적.
  //    1.2배: Lv.40 점당 약 14.7만원, 시작금 약 4400만원 — 현실적인 곡선.
  //    Lv.1=100, Lv.10=516, Lv.20=3180, Lv.30=19,627, Lv.40=146,977.
  function pointValue(level) {
    const L = Math.max(1, Math.min(40, level | 0));
    return Math.round(100 * Math.pow(1.2, L - 1));
  }
  // 레벨별 시작(나·봇) 소지금 — 점당 × 300
  function startingMoney(level) {
    return pointValue(level) * 300;
  }
  // 마이그레이션: v3/v4 → v5. 전적·레벨은 유지, 소지금은 새 공식으로 재계산.
  function migrateSingleProgress() {
    try {
      if (localStorage.getItem(SINGLE_KEY)) return;
      const legV4 = localStorage.getItem(SINGLE_KEY_V4);
      const legV3 = localStorage.getItem(SINGLE_KEY_V3);
      const leg = legV4 || legV3;
      if (!leg) return;
      const j = JSON.parse(leg);
      const level = Math.max(1, Math.min(40, Number(j.level) || 1));
      const p = {
        level: level,
        wins: Number(j.wins) || 0,
        losses: Number(j.losses) || 0,
        cleared: Array.isArray(j.cleared) ? j.cleared : [],
        myMoney: startingMoney(level), // 새 공식으로 초기화 (이전 천문학적 금액 폐기)
      };
      localStorage.setItem(SINGLE_KEY, JSON.stringify(p));
    } catch { /* empty */ }
  }
  function loadSingleProgress() {
    try {
      migrateSingleProgress();
      const j = JSON.parse(localStorage.getItem(SINGLE_KEY) || '{}');
      const cleared = Array.isArray(j.cleared) ? j.cleared : [];
      const level = Math.max(1, Math.min(40, Number(j.level) || 1));
      let myMoney = (j.myMoney != null) ? Number(j.myMoney) : startingMoney(level);
      // ★ 안전장치: myMoney 가 새 곡선 기준으로 비현실적 (>= 다음 레벨 시작금 × 100)
      //    이면 현재 레벨 시작금으로 리셋. 이전 5배 곡선 시절 누적된 천문학적 잔고 정리.
      const cap = startingMoney(Math.min(40, level + 1)) * 100;
      if (myMoney > cap) myMoney = startingMoney(level);
      return {
        level: level,
        wins: Number(j.wins) || 0,
        losses: Number(j.losses) || 0,
        cleared: cleared,
        myMoney: myMoney,
      };
    } catch { return { level: 1, wins: 0, losses: 0, cleared: [], myMoney: startingMoney(1) }; }
  }
  window.GostopEcon = { pointValue: pointValue, startingMoney: startingMoney, singleStorageKey: SINGLE_KEY };
  function saveSingleProgress(p) {
    try { localStorage.setItem(SINGLE_KEY, JSON.stringify(p)); } catch {}
  }
  function fmtMoney(n) {
    return Number(n || 0).toLocaleString('ko-KR') + '원';
  }
  function singleTierLine(level) {
    const L = Math.max(1, Math.min(40, level | 0));
    if (L <= 3)  return '티어: 새내기(1~3) — 실수가 많고 연습에 좋은 구간';
    if (L <= 7)  return '티어: 입문(4~7) — 맞춤·먹기가 꽤 정확해집니다';
    if (L <= 11) return '티어: 노련(8~11) — 세트·견제가 눈에 띕니다';
    if (L <= 15) return '티어: 고수(12~15) — 고/스톱·압박이 거칩니다';
    if (L <= 20) return '티어: 명인(16~20) — 한두 실수가 크게 느껴질 수 있어요';
    if (L <= 27) return '티어: 마왕(21~27) — 거의 망설임 없이 최선 수를 둡니다';
    if (L <= 33) return '티어: 전설(28~33) — 수비·세트 계산이 매우 정밀해요';
    return '티어: 패왕(34~40) — 완전 결정론적, 최고 난이도';
  }
  function botNameFor(level) {
    if (typeof GostopAI !== 'undefined' && GostopAI && typeof GostopAI.botNameFor === 'function') {
      return GostopAI.botNameFor(level);
    }
    const L = Math.max(1, Math.min(40, +level || 1));
    if (L <= 3) return '🐣 새내기 봇 Lv.' + L;
    if (L <= 7) return '🤖 입문 봇 Lv.' + L;
    if (L <= 11) return '🎴 노련한 봇 Lv.' + L;
    if (L <= 15) return '🔥 고수 봇 Lv.' + L;
    if (L <= 20) return '👹 명인 봇 Lv.' + L;
    if (L <= 27) return '💀 마왕 Lv.' + L;
    if (L <= 33) return '🌟 전설 봇 Lv.' + L;
    return '👑 패왕 Lv.' + L;
  }
  function showSinglePlay() {
    $('lobby').classList.add('hidden');
    $('single').classList.remove('hidden');
    renderSinglePlay();
  }
  // 외부(game.js)에서 게임 후 다시 싱글 화면 갱신용
  window.GostopRefreshSingle = renderSinglePlay;

  function aiPhotoUrl(level) {
    return 'assets/ai-photo-' + level + '.png';
  }

  function makeAiImgHtml(level, fallbackEmoji) {
    return '<img src="' + aiPhotoUrl(level) + '" alt="AI" style="width:100%;height:100%;object-fit:contain;display:block;"' +
      ' onerror="this.outerHTML=\'' + (fallbackEmoji || '🤖') + '\'">';
  }

  function loadTarotCard(level) {
    const wrap = $('singleTarotWrap');
    const img = $('singleTarotImg');
    if (!wrap || !img) return;
    const url = 'assets/tarot-' + level + '.png';
    const probe = new Image();
    probe.onload = function () {
      img.src = url;
      wrap.style.display = '';
    };
    probe.onerror = function () {
      wrap.style.display = 'none';
    };
    probe.src = url;
  }

  function renderSinglePlay() {
    const prog = loadSingleProgress();
    const lv = prog.level;
    const pv = pointValue(lv);
    const botMoney = startingMoney(lv);
    $('singleLvBadge').textContent = 'Lv.' + lv;
    $('singleNowName').textContent = botNameFor(lv);
    $('singleRecord').textContent =
      '전적: ' + prog.wins + '승 ' + prog.losses + '패  ·  내 소지금 ' + fmtMoney(prog.myMoney) +
      '  ·  Lv.' + lv + ' 점당 ' + fmtMoney(pv) + ' · 봇 상금 ' + fmtMoney(botMoney);
    document.body.setAttribute('data-ai-level', String(lv));
    loadTarotCard(lv);
    const av = $('singleAiAvatar');
    const pill = $('singleAiPill');
    const tline = $('singleAiTier');
    const hint = $('singleAiHint');
    const econ = $('singleEconLine');
    if (GostopAI && typeof GostopAI.personaMeta === 'function') {
      const meta = GostopAI.personaMeta(lv);
      if (av) {
        av.innerHTML = makeAiImgHtml(lv, meta.emoji || '🤖');
        av.setAttribute('data-persona', meta.id || 'bal');
        av.setAttribute('aria-label', (meta.short || '봇') + ' 타입');
      }
      if (pill) pill.textContent = (meta.short || '균형') + ' · 이번 상대';
      if (hint) hint.textContent = meta.hint || '';
    } else {
      if (av) {
        av.innerHTML = makeAiImgHtml(lv, '🤖');
        av.setAttribute('data-persona', 'bal');
      }
      if (pill) pill.textContent = 'AI · 이번 상대';
      if (hint) hint.textContent = '단계가 오를수록 봇은 수가 점차 단단해집니다.';
    }
    if (tline) tline.textContent = singleTierLine(lv);
    if (econ) {
      econ.textContent =
        '이 단계 시작(나·봇) ' + fmtMoney(startingMoney(lv)) + ' · 점당 ' + fmtMoney(pv) +
        ' · 이기면 (내 점×점당)을 가져가되, 봇이 가진 금액을 넘길 수 없어요. 지면 (봇 점×점당)을 잃고, 낼 돈이 없으면 잃는 만큼만요. ' +
        '다음 단계로 갈수록 점당·소지금이 5배씩 커집니다.';
    }
    const grid = $('singleLevelGrid');
    if (grid) {
      grid.innerHTML = '';
      const maxOpen = (prog.cleared.length >= 0)
        ? (prog.cleared.length + 1) // 깬 단계 수 + 1단계까지 열림
        : 1;
      for (let i = 1; i <= 40; i++) {
        const b = document.createElement('button');
        b.type = 'button';
        const isCleared = prog.cleared.indexOf(i) >= 0;
        const isOpen = i <= maxOpen || isCleared;
        const isCurrent = i === lv;
        b.className = 'g-single-cell'
          + (isCurrent ? ' is-now' : '')
          + (isCleared ? ' is-cleared' : '')
          + (!isOpen ? ' is-locked' : '');
        b.textContent = isOpen ? String(i) : '🔒';
        b.title = botNameFor(i) + ' · 점당 ' + fmtMoney(pointValue(i));
        b.disabled = !isOpen;
        b.onclick = function () {
          if (b.disabled) return;
          const np = loadSingleProgress(); np.level = i; saveSingleProgress(np);
          renderSinglePlay();
        };
        grid.appendChild(b);
      }
    }
  }
  $('btnSingleStart') && $('btnSingleStart').addEventListener('click', function () {
    const prog = loadSingleProgress();
    socket.emit('single:start', { level: prog.level }, function (res) {
      if (!res || !res.ok) return alert('싱글 시작 실패: ' + (res && res.error));
      // game:started 이벤트가 도착하면 game 화면으로 전환
      CURRENT_ROOM = res.room;
      window.GostopCurrentRoom = res.room;
      window._gostopSingleActive = true;
      window._gostopSingleHandled = false;
      $('single').classList.add('hidden');
      $('game').classList.remove('hidden');
    });
  });
  $('btnSingleReset') && $('btnSingleReset').addEventListener('click', function () {
    if (!confirm('진행 기록을 초기화할까요? Lv.1부터 다시 시작합니다.')) return;
    saveSingleProgress({ level: 1, wins: 0, losses: 0, cleared: [], myMoney: startingMoney(1) });
    renderSinglePlay();
  });

  // 싱글모드 게임 종료 시 — 진행 기록 갱신 (점당 × 점수만큼 소지금 이동)
  socket.on('game:view', function (view) {
    if (!window._gostopSingleActive) return;
    if (view && view.finished && !window._gostopSingleHandled) {
      window._gostopSingleHandled = true;
      const prog = loadSingleProgress();
      const lv = prog.level;
      const pv = pointValue(lv);
      const botMoneyAtStart = startingMoney(lv);
      // 서버가 채워준 view.myIndex 우선 — GostopMe race 가 발생해도 안전
      const myIdx = (typeof view.myIndex === 'number' && view.myIndex >= 0)
        ? view.myIndex
        : view.players.findIndex(function (p) { return p.userId === (window.GostopMe && window.GostopMe.id); });
      const myScore = (view.scores && view.scores[myIdx]) || 0;
      const botIdx = myIdx === 0 ? 1 : 0;
      const botScore = (view.scores && view.scores[botIdx]) || 0;
      const iWon = view.winner === myIdx;
      // 점당 환산 — 이긴 사람 점수만 받음 (고스톱 룰)
      let delta = 0;
      if (iWon) {
        // 봇이 가진 만큼만 받을 수 있음
        delta = Math.min(myScore * pv, botMoneyAtStart);
        prog.wins += 1;
      } else if (view.winner === botIdx) {
        // 봇이 이김 — 내 소지금 차감
        delta = -Math.min(botScore * pv, prog.myMoney);
        prog.losses += 1;
      }
      prog.myMoney += delta;
      if (prog.myMoney < 0) prog.myMoney = 0;
      // 소지금 0 이면 게임오버 안내 — 이번 레벨 시작 소지금만큼 보충 (선택)
      if (prog.myMoney === 0) {
        prog.myMoney = startingMoney(prog.level);
      }
      // ★ 레벨 해금 조건: 한 판 이김 ❌ → 소지금이 다음 레벨 시작금 도달 시 ✅
      //   이전 코드는 한 판만 이겨도 자동 다음 레벨로 가버려 사용자 제보 발생.
      //   소지금 기반으로 자연스럽게 진척되도록 변경.
      const wasClearedBefore = prog.cleared.indexOf(lv) >= 0;
      let justCleared = false;
      if (lv < 40) {
        const nextLevelMoney = startingMoney(lv + 1);
        if (prog.myMoney >= nextLevelMoney) {
          if (!wasClearedBefore) {
            prog.cleared.push(lv);
            justCleared = true;
          }
          prog.level = lv + 1;
        }
      }
      saveSingleProgress(prog);
      // 결과 알림 — 다음 게임:view 가 아닌 endDialog 닫을 때 보여주려고 잠시 후 처리
      window._gostopSingleResult = {
        delta: delta,
        iWon: iWon,
        levelCleared: justCleared,
        nextLevel: prog.level,
        myMoney: prog.myMoney,
        nextLevelNeeded: lv < 40 ? startingMoney(lv + 1) : null,
      };
      setTimeout(function () {
        window._gostopSingleActive = false;
        window._gostopSingleHandled = false;
      }, 1500);
    }
  });

  function escapeHtml(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]; }); }
  function iconEmoji(code) {
    const m = { star: '⭐', cat: '🐱', dog: '🐶', heart: '❤️', flower: '🌸', sun: '☀️', moon: '🌙' };
    return m[code] || '⭐';
  }
})();
