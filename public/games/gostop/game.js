// 고스톱 게임 플레이 UI — 서버에서 받은 view 를 렌더하고 액션 전송
(function () {
  'use strict';
  const $ = function (id) { return document.getElementById(id); };

  let VIEW = null;            // 서버가 보내준 내 시점 뷰
  let PREV_VIEW = null;        // 직전 뷰 — diff 로 애니메이션 트리거
  let PENDING_HAND_CARD = null; // 선택해 둔 손패 카드 id (멀티매칭 선택 중)
  let _autoFlipPending = false; // 자동 뒤집기 중복 호출 방지 플래그

  function socket() { return window.GostopSocket; }

  function start(payload) {
    // 게임이 막 시작됨. 서버가 곧 game:view 를 보내줄 것
    const board = $('gameBoard');
    if (board) board.innerHTML = '';
    const hand = $('gameHand');
    if (hand) hand.innerHTML = '';
    const log = $('gameLog');
    if (log) log.innerHTML = '';
    const status = $('gameStatus');
    if (status) status.textContent = '게임이 시작됐어요. 덱을 나누는 중…';
    PENDING_HAND_CARD = null;
  }

  function onView(view) {
    PREV_VIEW = VIEW;
    VIEW = view;
    render();
    // 변경점 기반 피드백: 토스트 · 점수 팝업
    fireDiffEffects();
  }

  function fireDiffEffects() {
    if (!PREV_VIEW || !VIEW) return;
    const me = VIEW.myIndex;
    const SFX = window.GostopSFX ? window.GostopSFX.sfx : null;
    // 새 카드 등장 — 출처에 따라 효과음
    const prevBoardIds = new Set(PREV_VIEW.board.map(function (c) { return c.id; }));
    const newBoardCount = VIEW.board.filter(function (c) { return !prevBoardIds.has(c.id); }).length;
    if (newBoardCount > 0 && SFX) {
      const stockDropped = PREV_VIEW.stockCount > VIEW.stockCount;
      if (stockDropped) SFX.flip();
      else SFX.slap();
    }
    // 캡처 발생 — ching
    const prevTotal = PREV_VIEW.board.length;
    const curTotal = VIEW.board.length;
    const captured = PREV_VIEW.board.filter(function (c) { return !VIEW.board.find(function (b) { return b.id === c.id; }); });
    if (captured.length && SFX) SFX.ching();
    // 내 차례로 바뀌었으면 알림 삐
    if (PREV_VIEW.turn !== VIEW.turn && VIEW.turn === me && !VIEW.finished && SFX) SFX.myturn();
    // 1) 최근 로그가 바뀌었으면 토스트
    const newLog = VIEW.log && VIEW.log.length ? VIEW.log[VIEW.log.length - 1] : null;
    const oldLog = PREV_VIEW.log && PREV_VIEW.log.length ? PREV_VIEW.log[PREV_VIEW.log.length - 1] : null;
    if (newLog && (!oldLog || newLog.ts !== oldLog.ts)) {
      showToast(newLog.msg);
      // 2-1) 고/스톱 로그 감지 → 중앙 콜아웃
      if (/고!\s*계속/.test(newLog.msg)) bigCallout('고!', 'go');
      else if (/스톱!/.test(newLog.msg) || /승리/.test(newLog.msg)) {
        // 스톱/승리는 게임 종료에서 처리
      } else if (/먹었어요/.test(newLog.msg)) {
        // 먹은 플레이어가 나인지에 따라 톤 조절
        if (newLog.msg.indexOf(VIEW.players[me].name) === 0) bigCallout('먹었다!', 'good');
      }
    }
    // 2) 점수 임계치 크로싱 (3·5·7·10)
    const THRESHOLDS = [3, 5, 7, 10];
    const before = (PREV_VIEW.scores && PREV_VIEW.scores[me]) || 0;
    const after  = (VIEW.scores && VIEW.scores[me]) || 0;
    if (after > before) {
      popScore('+' + (after - before) + '점', 'me');
      const crossed = THRESHOLDS.find(function (t) { return before < t && after >= t; });
      if (crossed) bigCallout(crossed + '점 달성!', 'gold');
    }
    // 상대 점수 상승 플로터
    VIEW.players.forEach(function (_, i) {
      if (i === me) return;
      const b = (PREV_VIEW.scores && PREV_VIEW.scores[i]) || 0;
      const a = (VIEW.scores && VIEW.scores[i]) || 0;
      if (a > b) popScore('+' + (a - b) + '점', 'opp-' + i);
    });
    // 3) 게임 종료 감지 — 큰 승/패 스크린 + 결과 오버레이
    if (VIEW.finished && !PREV_VIEW.finished) {
      const winner = VIEW.winner;
      if (winner === me) {
        bigCallout('승리!', 'victory', 2500);
        fireConfetti();
        if (SFX) SFX.fanfare();
      } else if (winner != null) {
        bigCallout(VIEW.players[winner].name + '님 승', 'defeat', 2500);
        if (SFX) SFX.lose();
      } else {
        bigCallout('무승부', 'neutral', 2000);
      }
      // 2.5초 뒤 결과 오버레이 표시
      setTimeout(function () { showEndDialog(); }, 2000);
    }
    // 뻑 / 뻑먹기 / 고 감지
    if (newLog && (!oldLog || newLog.ts !== oldLog.ts)) {
      if (/^뻑!/.test(newLog.msg)) {
        bigCallout('뻑!', 'go', 1600);
        if (SFX) SFX.gong();
      } else if (/뻑 먹기|뻑 싹쓸이|뻑먹기/.test(newLog.msg)) {
        bigCallout('싹쓸이!', 'gold', 1800);
        if (SFX) SFX.fanfare();
      }
      const goMatch = newLog.msg.match(/(\d+)고!\s*계속/);
      if (goMatch && SFX) {
        const n = Number(goMatch[1]);
        bigCallout(n + '고!', 'go', 1600);
        SFX.gong();
      }
    }
  }

  function showEndDialog() {
    if (!VIEW || !VIEW.finished) return;
    const me = VIEW.myIndex;
    const dlg = $('endDialog');
    const crown = $('endCrown');
    const title = $('endTitle');
    const sub = $('endSub');
    const list = $('endScoreList');
    const winner = VIEW.winner;
    if (winner === me) {
      crown.textContent = '🏆';
      title.textContent = '승리!';
      title.style.color = '#C67200';
    } else if (winner != null) {
      crown.textContent = '🙃';
      title.textContent = VIEW.players[winner].name + '님 승';
      title.style.color = '#374151';
    } else {
      crown.textContent = '🤝';
      title.textContent = '무승부';
      title.style.color = '#7C3AED';
    }
    // 박 플래그가 있으면 설명 추가
    const roundN = VIEW.gameRound || 1;
    const bakHtml = VIEW.bakFlags && VIEW.bakFlags.length
      ? ' · <span class="g-end-bak">' + VIEW.bakFlags.map(escapeHtml).join(' · ') + '</span>'
      : '';
    sub.innerHTML = roundN + '번째 판 최종 점수' + bakHtml;
    // 점수 정렬 (내림차순)
    const ranked = VIEW.players.map(function (p, i) { return { name: p.name, score: VIEW.scores[i] || 0, idx: i }; });
    ranked.sort(function (a, b) { return b.score - a.score; });
    // 누적 점수 맵 (userId → total)
    const cumMap = {};
    (VIEW.cumScores || []).forEach(function (cs) { cumMap[cs.userId] = cs.total; });

    list.innerHTML = ranked.map(function (r, rank) {
      const isMe = r.idx === me;
      const isWinner = r.idx === winner;
      const userId = VIEW.players[r.idx].userId;
      const cum = cumMap[userId] || 0;
      const cumHtml = cum > 0
        ? '<span class="g-end-cum">누적 ' + cum + '점</span>'
        : '';
      return '<li class="g-end-row' + (isMe ? ' is-me' : '') + (isWinner ? ' is-winner' : '') + '">' +
        '<span class="g-end-rank">' + (rank + 1) + '</span>' +
        '<span class="g-end-name">' + escapeHtml(r.name) + (isMe ? ' (나)' : '') + cumHtml + '</span>' +
        '<span class="g-end-score">' + r.score + '점</span>' +
        '</li>';
    }).join('');
    dlg.classList.remove('hidden');
    dlg.style.display = 'flex';
  }

  // 결과 오버레이 버튼
  $('btnRematch').addEventListener('click', function () {
    socket().emit('game:rematch', null, function (res) {
      if (!res || !res.ok) return alert('재대결 시작 실패: ' + (res && res.error));
      $('endDialog').style.display = 'none';
      $('endDialog').classList.add('hidden');
      PREV_VIEW = null;
    });
  });
  $('btnEndExit').addEventListener('click', function () {
    $('endDialog').style.display = 'none';
    $('endDialog').classList.add('hidden');
    socket().emit('room:leave', null, function () {});
    $('game').classList.add('hidden');
    $('lobby').classList.remove('hidden');
    VIEW = null; PREV_VIEW = null;
  });

  // 중앙 큰 콜아웃 — "먹었다!" "3점 달성!" "고!" "승리!"
  function bigCallout(text, tone, duration) {
    duration = duration || 1400;
    const el = document.createElement('div');
    el.className = 'g-big-callout g-callout-' + (tone || 'good');
    el.textContent = text;
    document.body.appendChild(el);
    setTimeout(function () { el.remove(); }, duration);
  }

  // 승리 시 컨페티 — 짧은 CSS 애니 파티클
  function fireConfetti() {
    const colors = ['#FFD84D', '#F87171', '#60A5FA', '#34D399', '#A78BFA', '#FB923C'];
    for (let i = 0; i < 40; i++) {
      const p = document.createElement('span');
      p.className = 'g-confetti';
      p.style.left = (Math.random() * 100) + 'vw';
      p.style.background = colors[Math.floor(Math.random() * colors.length)];
      p.style.animationDelay = (Math.random() * 0.3) + 's';
      p.style.animationDuration = (2 + Math.random() * 1.5) + 's';
      document.body.appendChild(p);
      setTimeout(function (el) { return function () { el.remove(); }; }(p), 4000);
    }
  }

  function iconEmoji(code) {
    const m = { star: '⭐', cat: '🐱', dog: '🐶', heart: '❤️', flower: '🌸', sun: '☀️', moon: '🌙' };
    return m[code] || '⭐';
  }

  // 상대 박스 탭 시 큰 획득 요약 오버레이 (4인 모드에서 유용)
  function showOpponentDetail(idx) {
    if (!VIEW) return;
    const p = VIEW.players[idx];
    const cap = VIEW.captured[idx];
    if (!p || !cap) return;
    let dlg = $('oppDetailDlg');
    if (!dlg) {
      dlg = document.createElement('div');
      dlg.id = 'oppDetailDlg';
      dlg.className = 'g-opp-detail-backdrop';
      dlg.addEventListener('click', function (e) {
        if (e.target === dlg) dlg.remove();
      });
      document.body.appendChild(dlg);
    }
    const goN = (VIEW.goCounts && VIEW.goCounts[idx]) || 0;
    const avatarHtml = p.photoUrl
      ? '<img src="' + escapeHtml(p.photoUrl) + '" alt="" />'
      : iconEmoji(p.icon);
    dlg.innerHTML =
      '<div class="g-opp-detail">' +
        '<div class="g-opp-detail-head">' +
          '<span class="g-pl-avatar g-opp-avatar">' + avatarHtml + '</span>' +
          '<span class="g-opp-detail-name">' + escapeHtml(p.name) + '</span>' +
          '<span class="g-opp-detail-score">' + (VIEW.scores[idx] || 0) + '점</span>' +
          (goN > 0 ? '<span class="g-go-badge">' + goN + '고</span>' : '') +
          '<button class="g-opp-detail-close">✕</button>' +
        '</div>' +
        '<div class="g-opp-detail-cap" id="oppDetailCap"></div>' +
      '</div>';
    dlg.querySelector('.g-opp-detail-close').onclick = function () { dlg.remove(); };
    renderCapturedPeek(cap, 'oppDetailCap');
    // 3초 자동 닫힘
    clearTimeout(dlg._timer);
    dlg._timer = setTimeout(function () { if (document.body.contains(dlg)) dlg.remove(); }, 4000);
  }

  // 점수 브레이크다운 팝업 — 현재 획득 카드로 점수가 어떻게 구성됐는지
  function showScoreBreakdown(playerIdx) {
    if (!VIEW) return;
    const p = VIEW.players[playerIdx];
    const cap = VIEW.captured[playerIdx];
    if (!p || !cap || !window.GostopEngine || !window.GostopEngine.scoreBreakdown) return;
    const bd = window.GostopEngine.scoreBreakdown(cap);
    const goN = (VIEW.goCounts && VIEW.goCounts[playerIdx]) || 0;
    const goMult = Math.pow(2, goN);
    let dlg = $('scoreBdDlg');
    if (!dlg) {
      dlg = document.createElement('div');
      dlg.id = 'scoreBdDlg';
      dlg.className = 'g-score-bd-backdrop';
      dlg.addEventListener('click', function (e) { if (e.target === dlg) dlg.remove(); });
      document.body.appendChild(dlg);
    }
    const rowsHtml = bd.parts.map(function (part) {
      const hasPts = part.pts > 0;
      return '<li class="g-bd-row' + (hasPts ? ' is-active' : ' is-pending') + '">' +
        '<span class="g-bd-label">' + escapeHtml(part.label) + '</span>' +
        (hasPts
          ? '<span class="g-bd-pts">+' + part.pts + '점</span>'
          : '<span class="g-bd-pending">' + escapeHtml(part.pending || '-') + '</span>') +
        '</li>';
    }).join('');
    const baseTotal = bd.total;
    const finalTotal = baseTotal * goMult;
    dlg.innerHTML =
      '<div class="g-score-bd">' +
        '<div class="g-score-bd-head">' +
          '<b>' + escapeHtml(p.name) + '</b> 점수 계산' +
          '<button class="g-score-bd-close" aria-label="닫기">✕</button>' +
        '</div>' +
        '<ul class="g-bd-list">' + (rowsHtml || '<li class="g-bd-empty">아직 득점 없음</li>') + '</ul>' +
        '<div class="g-bd-total">' +
          '<span>합계</span>' +
          '<b>' + baseTotal + '점</b>' +
          (goN > 0 ? ' <span class="g-bd-mult">× ' + goMult + ' = <b>' + finalTotal + '점</b></span>' : '') +
        '</div>' +
      '</div>';
    dlg.querySelector('.g-score-bd-close').onclick = function () { dlg.remove(); };
  }

  function bumpBounce(el) {
    if (!el) return;
    el.classList.remove('g-bump');
    void el.offsetWidth;
    el.classList.add('g-bump');
  }

  function showToast(msg) {
    let t = $('gameToast');
    if (!t) {
      t = document.createElement('div');
      t.id = 'gameToast';
      t.className = 'g-toast';
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.classList.remove('hidden', 'show');
    // reflow 강제해 애니메이션 재시작
    void t.offsetWidth;
    t.classList.add('show');
    clearTimeout(t._hideTimer);
    t._hideTimer = setTimeout(function () {
      t.classList.remove('show');
    }, 2400);
  }

  function popScore(text, slot) {
    const holder = document.createElement('div');
    holder.className = 'g-score-pop g-score-pop--' + slot;
    holder.textContent = text;
    document.body.appendChild(holder);
    // 위치 계산 — slot='me' 이면 내 점수 옆, 'opp-i' 면 상대 박스 옆
    let anchor;
    if (slot === 'me') anchor = $('gameMyScore');
    else {
      const idx = Number(slot.split('-')[1]);
      const boxes = document.querySelectorAll('.g-opp');
      anchor = boxes[idx] || null;
    }
    if (anchor) {
      const rect = anchor.getBoundingClientRect();
      holder.style.left = (rect.left + rect.width / 2) + 'px';
      holder.style.top  = (rect.top - 4) + 'px';
    } else {
      holder.style.left = '50%';
      holder.style.top  = '30%';
    }
    setTimeout(function () { holder.remove(); }, 1400);
  }

  function render() {
    if (!VIEW) return;
    const me = VIEW.myIndex;
    const isMyTurn = VIEW.turn === me && !VIEW.finished;
    // 상태 표시
    const turnName = VIEW.players[VIEW.turn] ? VIEW.players[VIEW.turn].name : '?';
    const phaseLabel = {
      'play-hand': '패 내기',
      'choose-hand-match': '같은 달 선택',
      'flip-stock': '덱 뒤집기',
      'choose-flip-match': '같은 달 선택',
      'choose-go-stop': '고 · 스톱',
    }[VIEW.phase] || VIEW.phase;
    const statusEl = $('gameStatus');
    if (VIEW.finished) {
      const winName = VIEW.winner != null && VIEW.players[VIEW.winner] ? VIEW.players[VIEW.winner].name : '';
      statusEl.innerHTML = '<span class="g-status-end">' + (winName ? (winName + '님 승리!') : '무승부') + ' · 최종 ' + VIEW.scores.join(' : ') + '점</span>';
    } else {
      const roundNum = VIEW.gameRound || 1;
      statusEl.innerHTML =
        '<span class="g-status-turn' + (isMyTurn ? ' is-me' : '') + '">' +
          (isMyTurn ? '내 차례' : (turnName + '님 차례')) +
        '</span>' +
        '<span class="g-status-phase">' + phaseLabel + '</span>' +
        (roundNum > 1 ? '<span class="g-status-round">' + roundNum + '판</span>' : '') +
        '<span class="g-status-stock">덱 ' + VIEW.stockCount + '장</span>';
    }

    // 선택이 필요한 단계에선 도움말 배너를 상단에 추가
    const helpBanner = $('gameHelp');
    if (isMyTurn && (VIEW.phase === 'choose-hand-match' || VIEW.phase === 'choose-flip-match')) {
      helpBanner.innerHTML = '👉 바닥에서 <b>같은 달 카드(노랗게 빛나는)</b> 한 장을 탭해 주세요';
      helpBanner.classList.remove('hidden');
      helpBanner.style.display = 'block';
    } else {
      helpBanner.classList.add('hidden');
      helpBanner.style.display = 'none';
    }

    // 상대 정보 — 아바타 + 이름/점수 + 손패 스택 + 턴 화살표
    const oppEl = $('gameOpponents');
    oppEl.innerHTML = '';
    const oppCount = VIEW.playerCount - 1;
    oppEl.className = 'g-opp-wrap g-opp-wrap-' + oppCount; // 1/2/3 에 따라 다른 레이아웃
    VIEW.players.forEach(function (p, i) {
      if (i === me) return;
      const box = document.createElement('div');
      const isTurn = VIEW.turn === i && !VIEW.finished;
      box.className = 'g-opp' + (isTurn ? ' is-turn' : '');
      const handCount = VIEW.opponentHandCounts[i] || 0;
      const score = VIEW.scores[i] || 0;
      const shown = Math.min(handCount, 10);
      let cardsHtml = '';
      for (let k = 0; k < shown; k++) {
        cardsHtml += '<span class="g-opp-card" style="left:' + (k * 8) + 'px">' + GostopCards.faceDownSvg() + '</span>';
      }
      const avatarHtml = p.photoUrl
        ? '<img src="' + escapeHtml(p.photoUrl) + '" alt="" />'
        : iconEmoji(p.icon);
      const turnArrow = isTurn ? '<span class="g-turn-arrow" aria-hidden="true">▼</span>' : '';
      const goCount = (VIEW.goCounts && VIEW.goCounts[i]) || 0;
      const goBadge = goCount > 0 ? '<span class="g-go-badge">' + goCount + '고</span>' : '';
      box.innerHTML =
        '<div class="g-opp-inner">' +
          '<span class="g-pl-avatar g-opp-avatar">' + avatarHtml + '</span>' +
          '<div class="g-opp-body">' +
            '<div class="g-opp-head"><span>' + escapeHtml(p.name) + goBadge + '</span><span>' + score + '점 · 손패 ' + handCount + '</span></div>' +
            '<div class="g-opp-hand">' + cardsHtml + '</div>' +
            '<div class="g-opp-captured">' + renderCapturedSummary(VIEW.captured[i]) + '</div>' +
          '</div>' +
        '</div>' +
        turnArrow;
      // 컴팩트(3인/4인) 모드에서 상대 박스 탭 → 획득 요약 오버레이 토글
      box.dataset.playerIdx = String(i);
      box.addEventListener('click', function (e) {
        e.stopPropagation();
        showOpponentDetail(i);
      });
      oppEl.appendChild(box);
    });

    // 바닥 — 이전 렌더와 비교해 새 카드는 카테고리별 애니메이션
    // (A) 덱에서 뒤집힌 카드: stock 감소 + 해당 카드가 새로 등장 → flip 애니
    // (B) 플레이어 손패에서 낸 카드: 손패 감소 + 새 카드 등장 → 슬라이드 애니
    const boardEl = $('gameBoard');
    boardEl.innerHTML = '';
    const highlightIds = VIEW.pending && VIEW.pending.choices ? new Set(VIEW.pending.choices) : new Set();
    const prevBoardIds = new Set((PREV_VIEW && PREV_VIEW.board ? PREV_VIEW.board : []).map(function (c) { return c.id; }));
    const prevStock = PREV_VIEW ? PREV_VIEW.stockCount : 0;
    const curStock = VIEW.stockCount || 0;
    const stockDropped = PREV_VIEW && (prevStock - curStock) > 0;
    // 어떤 플레이어의 손패 수가 줄었는지 — 손패에서 낸 카드 추적
    let handDropFromIdx = -1;
    if (PREV_VIEW) {
      const prevMyHandLen = (PREV_VIEW.myHand || []).length;
      const curMyHandLen = (VIEW.myHand || []).length;
      if (VIEW.myIndex === me && curMyHandLen < prevMyHandLen) {
        handDropFromIdx = me;
      } else {
        VIEW.players.forEach(function (_, i) {
          if (i === me) return;
          const pH = (PREV_VIEW.opponentHandCounts && PREV_VIEW.opponentHandCounts[i]) || 0;
          const cH = (VIEW.opponentHandCounts && VIEW.opponentHandCounts[i]) || 0;
          if (cH < pH) handDropFromIdx = i;
        });
      }
    }

    // 뻑 그룹 월 셋
    const bbukMonths = new Set((VIEW.bbukGroups || []).map(function (g) { return g.month; }));
    VIEW.board.forEach(function (c, idx) {
      const wrap = GostopCards.renderCard(c, { highlight: highlightIds.has(c.id) });
      if (bbukMonths.has(c.month)) wrap.classList.add('is-bbuk');
      if (!prevBoardIds.has(c.id)) {
        // 새 등장
        if (stockDropped && handDropFromIdx < 0) {
          wrap.classList.add('is-flipped-in'); // 덱 → 바닥 (플립)
        } else if (handDropFromIdx === me) {
          wrap.classList.add('is-from-me');    // 내 손패 → 바닥 (아래서 위로)
        } else if (handDropFromIdx >= 0) {
          wrap.classList.add('is-from-opp');   // 상대 손패 → 바닥 (위에서 아래로)
        } else {
          wrap.classList.add('is-new');
        }
        // 스팟라이트 글로우 (모든 새 카드 공통)
        wrap.classList.add('is-spotlight');
        // 3초 뒤 스팟라이트 제거
        setTimeout(function (el) {
          return function () { el.classList.remove('is-spotlight'); };
        }(wrap), 2800);
      }
      if ((VIEW.phase === 'choose-hand-match' || VIEW.phase === 'choose-flip-match') && highlightIds.has(c.id) && isMyTurn) {
        wrap.onclick = function () { chooseMatch(c.id); };
      }
      boardEl.appendChild(wrap);
    });

    // 획득이 발생했으면(board 카드가 사라졌으면) 캡처러의 획득 영역 bounce
    if (PREV_VIEW) {
      const prevBoardSet = new Set(PREV_VIEW.board.map(function (c) { return c.id; }));
      const capturedIds = [];
      PREV_VIEW.board.forEach(function (c) {
        if (!VIEW.board.find(function (b) { return b.id === c.id; })) capturedIds.push(c.id);
      });
      if (capturedIds.length) {
        // 현재 턴 플레이어가 캡처자
        const captorIdx = PREV_VIEW.turn;
        if (captorIdx === me) {
          const peek = $('gameMyCapturedPeek');
          if (peek) bumpBounce(peek);
        } else {
          const boxes = document.querySelectorAll('.g-opp');
          if (boxes[captorIdx]) bumpBounce(boxes[captorIdx].querySelector('.g-opp-captured') || boxes[captorIdx]);
        }
      }
    }

    // 내 손패
    const handEl = $('gameHand');
    handEl.innerHTML = '';
    VIEW.myHand.forEach(function (c) {
      const opts = { selected: PENDING_HAND_CARD === c.id };
      const wrap = GostopCards.renderCard(c, opts);
      if (isMyTurn && VIEW.phase === 'play-hand') {
        wrap.onclick = function () { playCard(c.id); };
      }
      handEl.appendChild(wrap);
    });

    // 내 획득 카드 — 요약(칩) + 카드 스택 피크
    const capEl = $('gameMyCaptured');
    if (capEl) capEl.innerHTML = renderCapturedSummary(VIEW.captured[me]);
    renderCapturedPeek(VIEW.captured[me], 'gameMyCapturedPeek');
    const myScoreEl = $('gameMyScore');
    if (myScoreEl) {
      myScoreEl.textContent = (VIEW.scores[me] || 0) + '점';
      myScoreEl.classList.add('is-clickable-score');
      myScoreEl.onclick = function () { showScoreBreakdown(me); };
      myScoreEl.title = '점수 계산 보기';
    }
    const myNameEl = $('gameMyName');
    if (myNameEl) {
      const mgo = (VIEW.goCounts && VIEW.goCounts[me]) || 0;
      myNameEl.innerHTML = escapeHtml((VIEW.players[me] && VIEW.players[me].name) || '나') +
        (mgo > 0 ? ' <span class="g-go-badge">' + mgo + '고</span>' : '');
    }
    // 내 아바타
    const myAvatarEl = $('gameMyAvatar');
    if (myAvatarEl) {
      const mp = VIEW.players[me] || {};
      myAvatarEl.innerHTML = mp.photoUrl
        ? '<img src="' + escapeHtml(mp.photoUrl) + '" alt="" />'
        : iconEmoji(mp.icon);
    }
    // 내 차례면 me-wrap 강조
    const meWrap = document.querySelector('.g-me-wrap');
    if (meWrap) meWrap.classList.toggle('is-turn', VIEW.turn === me && !VIEW.finished);
    // 덱 카운트
    const deckCount = $('gameDeckCount');
    if (deckCount) deckCount.textContent = String(VIEW.stockCount || 0);
    const deckEl = $('gameDeck');
    if (deckEl) deckEl.classList.toggle('is-empty', (VIEW.stockCount || 0) === 0);

    // 덱 뒤집기는 자동 실행 — 손패 낸 뒤 900ms 지연 후 서버에 game:flip 전송
    // (사용자가 방금 낸 카드 결과를 볼 시간 확보 + 연속 호출 방지)
    const btnFlip = $('btnFlip');
    btnFlip.classList.add('hidden'); // 버튼은 숨김 (필요 시 수동 백업용)
    if (isMyTurn && VIEW.phase === 'flip-stock' && !_autoFlipPending) {
      _autoFlipPending = true;
      setTimeout(function () {
        _autoFlipPending = false;
        socket().emit('game:flip', null, function () {});
      }, 900);
    }

    // 고/스톱 다이얼로그 — 배수 프리뷰 포함
    const gsDlg = $('goStopDialog');
    if (VIEW.phase === 'choose-go-stop' && isMyTurn) {
      gsDlg.classList.remove('hidden');
      gsDlg.style.display = 'flex';
      const myGo = (VIEW.goCounts && VIEW.goCounts[me]) || 0;
      const currentMult = Math.pow(2, myGo);
      const nextMult = Math.pow(2, myGo + 1);
      const baseScore = VIEW.scores[me];
      $('gsScore').innerHTML = baseScore + '점' +
        (myGo >= 1 ? ' × ' + currentMult + ' = <b>' + (baseScore * currentMult) + '점</b>' : '');
      const goBtn = $('btnGo');
      if (goBtn) goBtn.textContent = '고! (다음 스톱 ×' + nextMult + ')';
    } else {
      gsDlg.classList.add('hidden');
      gsDlg.style.display = 'none';
    }

    // 로그
    const logEl = $('gameLog');
    logEl.innerHTML = VIEW.log.map(function (l) {
      return '<li>' + escapeHtml(l.msg) + '</li>';
    }).join('');
    logEl.scrollTop = logEl.scrollHeight;

    // 턴 종료 / 게임 종료 시 pending 초기화
    if (VIEW.phase !== 'choose-hand-match') PENDING_HAND_CARD = null;
  }

  // 획득 카드 의미 그룹 분석 — 광·고도리·홍단·청단·초단·일반피
  const GODORI_LABELS = new Set(['매조 열끗', '흑싸리 열끗', '공산 열끗']);
  const HONGDAN_LABELS = new Set(['송학 홍단', '벚꽃 홍단', '매조 홍단']);
  const CHEONGDAN_LABELS = new Set(['모란 청단', '국화 청단', '단풍 청단']);
  const CHODAN_LABELS = new Set(['흑싸리 초단', '난초 초단', '홍싸리 초단']);

  function analyzeCaptured(cap) {
    if (!cap) return null;
    const a = cap.animal || [];
    const r = cap.ribbon || [];
    const godori = a.filter(function (c) { return GODORI_LABELS.has(c.label); }).length;
    const hongdan = r.filter(function (c) { return HONGDAN_LABELS.has(c.label); }).length;
    const cheongdan = r.filter(function (c) { return CHEONGDAN_LABELS.has(c.label); }).length;
    const chodan = r.filter(function (c) { return CHODAN_LABELS.has(c.label); }).length;
    const junk = (cap.junk || []).reduce(function (n, c) { return n + (c.doubleJunk ? 2 : 1); }, 0);
    return {
      light: (cap.light || []).length,
      animalAll: a.length,
      godori: godori,
      animalRegular: a.length - godori,
      ribbonAll: r.length,
      hongdan: hongdan,
      cheongdan: cheongdan,
      chodan: chodan,
      junk: junk,
    };
  }

  function renderCapturedSummary(cap) {
    const s = analyzeCaptured(cap);
    if (!s) return '';
    const row = function (label, count, total, cls) {
      const done = total && count >= total;
      return '<span class="g-cap-chip ' + cls + (done ? ' is-complete' : '') + '">' +
        label + ' ' + count + (total ? '/' + total : '') + '</span>';
    };
    let html = '';
    // 광은 수 그대로
    html += row('광', s.light, 0, 'cap-light');
    // 고도리 (3장 세트)
    if (s.godori > 0 || s.animalAll > 0) html += row('고도리', s.godori, 3, 'cap-godori');
    // 일반 열끗
    if (s.animalRegular > 0) html += row('열끗', s.animalRegular, 0, 'cap-animal');
    // 띠 단 세트
    if (s.hongdan > 0) html += row('홍단', s.hongdan, 3, 'cap-hongdan');
    if (s.cheongdan > 0) html += row('청단', s.cheongdan, 3, 'cap-cheongdan');
    if (s.chodan > 0) html += row('초단', s.chodan, 3, 'cap-chodan');
    // 일반 띠 (세트에 속하지 않는 — 비 띠)
    const regularRibbon = s.ribbonAll - s.hongdan - s.cheongdan - s.chodan;
    if (regularRibbon > 0) html += row('띠', regularRibbon, 0, 'cap-ribbon');
    // 피
    if (s.junk > 0) html += row('피', s.junk, 0, 'cap-junk');
    return html;
  }

  // 획득 카드 피크 — 그룹별로 가장 최근 몇 장을 작은 카드 스택으로 보여줌
  function renderCapturedPeek(cap, containerId) {
    const el = document.getElementById(containerId);
    if (!el) return;
    el.innerHTML = '';
    ['light', 'animal', 'ribbon', 'junk'].forEach(function (type) {
      const pile = cap[type];
      if (!pile || !pile.length) return;
      const group = document.createElement('div');
      group.className = 'g-cap-stack cap-stack-' + type;
      pile.slice(-4).forEach(function (c, i) {
        const mini = GostopCards.renderCard(c, {});
        mini.classList.add('g-cap-mini');
        mini.style.marginLeft = (i === 0 ? 0 : -12) + 'px';
        group.appendChild(mini);
      });
      if (pile.length > 4) {
        const more = document.createElement('span');
        more.className = 'g-cap-more';
        more.textContent = '+' + (pile.length - 4);
        group.appendChild(more);
      }
      el.appendChild(group);
    });
  }

  function playCard(cardId) {
    if (!VIEW) return;
    PENDING_HAND_CARD = cardId;
    socket().emit('game:play', { cardId: cardId }, function (res) {
      if (!res || !res.ok) alert(res && res.error || '못 냈어요');
    });
  }

  function chooseMatch(matchCardId) {
    socket().emit('game:match', { matchCardId: matchCardId }, function (res) {
      if (!res || !res.ok) alert(res && res.error || '선택 실패');
    });
  }

  $('btnFlip').addEventListener('click', function () {
    socket().emit('game:flip', null, function (res) {
      if (!res || !res.ok) alert(res && res.error || '뒤집기 실패');
    });
  });

  // 음소거 토글
  (function setupMute() {
    const btn = $('btnMute');
    if (!btn || !window.GostopSFX) return;
    const render = function () {
      const m = window.GostopSFX.isMuted();
      btn.textContent = m ? '🔇' : '🔊';
      btn.classList.toggle('is-muted', m);
    };
    render();
    btn.addEventListener('click', function () {
      window.GostopSFX.setMuted(!window.GostopSFX.isMuted());
      // 첫 제스처이므로 AudioContext resume
      window.GostopSFX.ensure && window.GostopSFX.ensure();
      render();
      // 음 켠 직후 짧은 확인 효과음
      if (!window.GostopSFX.isMuted()) window.GostopSFX.sfx.myturn();
    });
  })();
  $('btnGo').addEventListener('click', function () {
    socket().emit('game:gostop', { choice: 'go' }, function () {});
  });
  $('btnStop').addEventListener('click', function () {
    socket().emit('game:gostop', { choice: 'stop' }, function () {});
  });

  function escapeHtml(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]; }); }

  window.GostopGame = { start: start, onView: onView };
})();
