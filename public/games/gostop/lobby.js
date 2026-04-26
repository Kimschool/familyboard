// 고스톱 로비 — 방 생성/입장/실시간 목록 (전역 스크립트)
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

  document.querySelectorAll('.g-pc-btn').forEach(function (b) {
    b.addEventListener('click', function () {
      document.querySelectorAll('.g-pc-btn').forEach(function (x) { x.classList.remove('is-selected'); });
      b.classList.add('is-selected');
      SELECTED_PC = Number(b.dataset.pc);
    });
  });
  document.querySelectorAll('.g-ws-btn').forEach(function (b) {
    b.addEventListener('click', function () {
      document.querySelectorAll('.g-ws-btn').forEach(function (x) { x.classList.remove('is-selected'); });
      b.classList.add('is-selected');
      SELECTED_WS = Number(b.dataset.ws);
    });
  });

  $('btnCreate').addEventListener('click', function () {
    socket.emit('room:create', { playerCount: SELECTED_PC, winScoreMin: SELECTED_WS }, function (res) {
      if (!res || !res.ok) return alert('방 생성 실패');
      enterRoom(res.room);
    });
  });

  // 도움말 시트 토글
  $('btnHelp') && $('btnHelp').addEventListener('click', function () {
    const dlg = $('helpSheet');
    dlg.classList.remove('hidden');
    dlg.style.display = 'flex';
  });
  $('btnHelpClose') && $('btnHelpClose').addEventListener('click', function () {
    const dlg = $('helpSheet');
    dlg.classList.add('hidden');
    dlg.style.display = 'none';
  });
  $('helpSheet') && $('helpSheet').addEventListener('click', function (e) {
    if (e.target.id === 'helpSheet') {
      const dlg = $('helpSheet');
      dlg.classList.add('hidden');
      dlg.style.display = 'none';
    }
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
    const ws = (room.rules && room.rules.winScoreMin) || 3;
    $('roomTitle').textContent = room.playerCount + '인 방 · ' + ws + '점 승리';
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
  if ($('bigCode')) $('bigCode').addEventListener('click', copyRoomCode);
  $('btnQuit').addEventListener('click', function () {
    socket.emit('room:leave', null, function () {
      CURRENT_ROOM = null;
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
    // 서버가 handshake 때 내 user 정보를 별도 이벤트로 보내줌
    socket.emit('me', null, function (res) {
      if (res && res.user) {
        window.GostopMe = res.user;
        // race fix — me ack 가 늦게 도착했어도 현재 room 화면이면 host 판정 다시
        if (CURRENT_ROOM) renderRoom(CURRENT_ROOM);
      }
    });
    refreshRoomList();
    loadRanking();
    // URL 파라미터 자동 처리: /games/gostop/?autoCreate=1&pc=N 또는 ?join=CODE
    handleAutoIntent();
  });

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
  const SINGLE_KEY = 'gostop_single_progress_v2';
  // 레벨별 점당 (₩) — 1단계 10원에서 점진 상승
  function pointValue(level) { return 10 + (level - 1) * 10; }   // 10, 20, 30, ..., 200
  // 레벨별 시작 소지금 — 봇이 가진 금액 = 시작 소지금 (이걸 가져오면 클리어)
  // 점당이 오를수록 소지금도 늘어남 (한 판에 평균 3점 × pointValue 계산하면 적당)
  function startingMoney(level) {
    return pointValue(level) * 30;  // Lv1: 300, Lv5: 1,500, Lv10: 3,000, Lv20: 6,000
  }
  function loadSingleProgress() {
    try {
      const j = JSON.parse(localStorage.getItem(SINGLE_KEY) || '{}');
      const cleared = Array.isArray(j.cleared) ? j.cleared : [];
      const level = Number(j.level) || 1;
      const myMoney = (j.myMoney != null) ? Number(j.myMoney) : startingMoney(level);
      return {
        level: level,
        wins: Number(j.wins) || 0,
        losses: Number(j.losses) || 0,
        cleared: cleared,    // 깬 레벨 목록
        myMoney: myMoney,    // 누적 소지금
      };
    } catch { return { level: 1, wins: 0, losses: 0, cleared: [], myMoney: startingMoney(1) }; }
  }
  function saveSingleProgress(p) {
    try { localStorage.setItem(SINGLE_KEY, JSON.stringify(p)); } catch {}
  }
  function fmtMoney(n) {
    return Number(n || 0).toLocaleString('ko-KR') + '원';
  }
  function botNameFor(level) {
    if (level <= 3) return '🐣 새내기 봇 Lv.' + level;
    if (level <= 7) return '🤖 입문 봇 Lv.' + level;
    if (level <= 11) return '🎴 노련한 봇 Lv.' + level;
    if (level <= 15) return '🔥 고수 봇 Lv.' + level;
    if (level <= 18) return '👹 명인 봇 Lv.' + level;
    return '💀 마왕 Lv.' + level;
  }
  function showSinglePlay() {
    $('lobby').classList.add('hidden');
    $('single').classList.remove('hidden');
    renderSinglePlay();
  }
  // 외부(game.js)에서 게임 후 다시 싱글 화면 갱신용
  window.GostopRefreshSingle = renderSinglePlay;
  function renderSinglePlay() {
    const prog = loadSingleProgress();
    const lv = prog.level;
    const pv = pointValue(lv);
    const botMoney = startingMoney(lv);
    $('singleLvBadge').textContent = 'Lv.' + lv;
    $('singleNowName').textContent = botNameFor(lv);
    $('singleRecord').textContent =
      '전적: ' + prog.wins + '승 ' + prog.losses + '패  ·  내 소지금 ' + fmtMoney(prog.myMoney) +
      '  ·  Lv.' + lv + ' 판돈 ' + pv + '원/점 (봇 보유 ' + fmtMoney(botMoney) + ')';
    document.body.setAttribute('data-ai-level', String(lv));
    const grid = $('singleLevelGrid');
    if (grid) {
      grid.innerHTML = '';
      const maxOpen = (prog.cleared.length >= 0)
        ? (prog.cleared.length + 1) // 깬 단계 수 + 1단계까지 열림
        : 1;
      for (let i = 1; i <= 20; i++) {
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
        b.title = botNameFor(i) + ' · 판돈 ' + pointValue(i) + '원/점';
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
    saveSingleProgress({ level: 1, wins: 0, losses: 0 });
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
        // 레벨 클리어 — cleared 목록에 추가하고 다음 레벨 자동 진입
        if (prog.cleared.indexOf(lv) < 0) prog.cleared.push(lv);
        if (lv < 20) prog.level = lv + 1;
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
      saveSingleProgress(prog);
      // 결과 알림 — 다음 게임:view 가 아닌 endDialog 닫을 때 보여주려고 잠시 후 처리
      window._gostopSingleResult = {
        delta: delta,
        iWon: iWon,
        levelCleared: iWon,
        nextLevel: prog.level,
        myMoney: prog.myMoney,
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
