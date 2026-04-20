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
    // 고/스톱 로그 감지 시 해당 사운드
    if (newLog && (!oldLog || newLog.ts !== oldLog.ts) && SFX) {
      if (/고!\s*계속/.test(newLog.msg)) SFX.gong();
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
    sub.textContent = '최종 점수';
    // 점수 정렬 (내림차순)
    const ranked = VIEW.players.map(function (p, i) { return { name: p.name, score: VIEW.scores[i] || 0, idx: i }; });
    ranked.sort(function (a, b) { return b.score - a.score; });
    list.innerHTML = ranked.map(function (r, rank) {
      const isMe = r.idx === me;
      const isWinner = r.idx === winner;
      return '<li class="g-end-row' + (isMe ? ' is-me' : '') + (isWinner ? ' is-winner' : '') + '">' +
        '<span class="g-end-rank">' + (rank + 1) + '</span>' +
        '<span class="g-end-name">' + escapeHtml(r.name) + (isMe ? ' (나)' : '') + '</span>' +
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
      statusEl.innerHTML =
        '<span class="g-status-turn' + (isMyTurn ? ' is-me' : '') + '">' +
          (isMyTurn ? '내 차례' : (turnName + '님 차례')) +
        '</span>' +
        '<span class="g-status-phase">' + phaseLabel + '</span>' +
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
      box.innerHTML =
        '<div class="g-opp-inner">' +
          '<span class="g-pl-avatar g-opp-avatar">' + avatarHtml + '</span>' +
          '<div class="g-opp-body">' +
            '<div class="g-opp-head"><span>' + escapeHtml(p.name) + '</span><span>' + score + '점 · 손패 ' + handCount + '</span></div>' +
            '<div class="g-opp-hand">' + cardsHtml + '</div>' +
            '<div class="g-opp-captured">' + renderCapturedSummary(VIEW.captured[i]) + '</div>' +
          '</div>' +
        '</div>' +
        turnArrow;
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

    VIEW.board.forEach(function (c, idx) {
      const wrap = GostopCards.renderCard(c, { highlight: highlightIds.has(c.id) });
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
    if (myScoreEl) myScoreEl.textContent = (VIEW.scores[me] || 0) + '점';
    const myNameEl = $('gameMyName');
    if (myNameEl) myNameEl.textContent = (VIEW.players[me] && VIEW.players[me].name) || '나';
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

    // 고/스톱 다이얼로그 — 인라인 style 도 함께 토글 (CSS 캐시 내성)
    const gsDlg = $('goStopDialog');
    if (VIEW.phase === 'choose-go-stop' && isMyTurn) {
      gsDlg.classList.remove('hidden');
      gsDlg.style.display = 'flex';
      $('gsScore').textContent = VIEW.scores[me] + '점';
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

  function renderCapturedSummary(cap) {
    if (!cap) return '';
    const counts = {
      light: cap.light.length,
      animal: cap.animal.length,
      ribbon: cap.ribbon.length,
      junk: cap.junk.reduce(function (n, c) { return n + (c.doubleJunk ? 2 : 1); }, 0),
    };
    return '' +
      '<span class="g-cap-chip cap-light">광 ' + counts.light + '</span>' +
      '<span class="g-cap-chip cap-animal">열끗 ' + counts.animal + '</span>' +
      '<span class="g-cap-chip cap-ribbon">띠 ' + counts.ribbon + '</span>' +
      '<span class="g-cap-chip cap-junk">피 ' + counts.junk + '</span>';
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
