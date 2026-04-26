// 고스톱 게임 플레이 UI — 서버에서 받은 view 를 렌더하고 액션 전송
(function () {
  'use strict';
  const $ = function (id) { return document.getElementById(id); };

  let VIEW = null;            // 서버가 보내준 내 시점 뷰
  let PREV_VIEW = null;        // 직전 뷰 — diff 로 애니메이션 트리거
  let PENDING_HAND_CARD = null; // 선택해 둔 손패 카드 id (멀티매칭 선택 중)
  let HAND_PRESELECT_ID = null; // play-hand: 첫 탭으로 살짝 든 카드(두 번째 탭에 실제 냄)
  let _autoFlipPending = false; // 자동 뒤집기 중복 호출 방지 플래그
  let TURN_TIMER_START = 0;    // 현재 턴이 시작된 시각 (클라 기준)
  let TURN_TIMER_ID = null;    // setInterval 핸들
  const TURN_LIMIT_MS = 30000; // 30 초 제한
  // 바닥 카드 슬롯 영속화 — month 한 번 등장하면 그 슬롯 그대로 유지 (사용자 시야 안정)
  let BOARD_SLOT_FOR_MONTH = {};         // month → slot index (0..15)
  let BOARD_SLOT_USED = new Array(16).fill(false);

  function socket() { return window.GostopSocket; }

  function start(payload) {
    // 게임이 막 시작됨 (또는 reconnect 으로 복귀). 서버가 곧 game:view 를 보내줄 것.
    // ★ 짧은 백그라운드 재연결 시 stale PREV_VIEW 로 잘못된 diff effects 방지 — 모든 상태 초기화.
    const board = $('gameBoard');
    if (board) board.innerHTML = '';
    const hand = $('gameHand');
    if (hand) hand.innerHTML = '';
    const log = $('gameLog');
    if (log) log.innerHTML = '';
    const status = $('gameStatus');
    if (status) status.textContent = '게임이 시작됐어요. 덱을 나누는 중…';
    PENDING_HAND_CARD = null;
    HAND_PRESELECT_ID = null;
    VIEW = null;
    PREV_VIEW = null;
    VIEW_QUEUE = [];
    VIEW_PROCESSING = false;
    CARD_EVENT_QUEUE = [];
    CARD_EVENT_RUNNING = false;
    _autoFlipPending = false;
    TURN_TIMER_START = 0;
    stopTurnTimer();
    BOARD_SLOT_FOR_MONTH = {};
    BOARD_SLOT_USED = new Array(16).fill(false);
    // 새 게임 시작 — 이전 게임의 손패 reorder 잔존 제거. 카드 ID 같아도 새 게임은 새 정렬부터.
    window.HAND_CUSTOM_ORDER = [];
    if (_scoreAnimHandle) { cancelAnimationFrame(_scoreAnimHandle); _scoreAnimHandle = 0; }
  }

  // ★ view queue — centerpiece 애니가 끝나기 전에 다음 view 를 받지 않도록 직렬화
  // 이전엔 server view 가 빠르게 연속 도착하면 board 만 먼저 update 되고 centerpiece 는
  // 뒤늦게 따라가서 싱크가 박살남. 이제 centerpiece 큐 비고 + 220ms 렌더 끝난 다음에 다음 view 처리.
  let VIEW_QUEUE = [];
  let VIEW_PROCESSING = false;
  function onView(view) {
    VIEW_QUEUE.push(view);
    if (!VIEW_PROCESSING) processNextView();
  }
  function processNextView() {
    if (!VIEW_QUEUE.length) { VIEW_PROCESSING = false; return; }
    VIEW_PROCESSING = true;
    const view = VIEW_QUEUE.shift();
    PREV_VIEW = VIEW;
    VIEW = view;
    if (!PREV_VIEW || PREV_VIEW.turn !== view.turn || !TURN_TIMER_START) {
      TURN_TIMER_START = Date.now();
    }
    // 새 카드가 board 에 등장했는지 사전 감지
    let hasBoardChange = false;
    if (PREV_VIEW) {
      const stockDropped = PREV_VIEW.stockCount > view.stockCount;
      const prevBoardIds = new Set(PREV_VIEW.board.map(function (c) { return c.id; }));
      const newBoardCount = view.board.filter(function (c) { return !prevBoardIds.has(c.id); }).length;
      const captured = PREV_VIEW.board.filter(function (c) { return !view.board.find(function (b) { return b.id === c.id; }); });
      if (stockDropped || newBoardCount > 0 || captured.length > 0) hasBoardChange = true;
    }
    if (hasBoardChange) {
      // 1) centerpiece + 사운드 먼저 (보드는 아직 옛 상태)
      fireDiffEffects();
      // 2) 카드 가운데 도달 시점(220ms)에 보드 update
      setTimeout(function () {
        render();
        startTurnTimer();
        // 3) centerpiece 큐가 다 비면 다음 view 처리. 큐가 남아있으면
        //    processCardEventQueue() done 콜백이 호출함 (아래 maybeProcessNextView)
        maybeProcessNextView();
      }, 220);
    } else {
      render();
      fireDiffEffects();
      startTurnTimer();
      maybeProcessNextView();
    }
  }
  function maybeProcessNextView() {
    // centerpiece 가 진행 중이면 잠시 기다림 — 큐 끝나면 알아서 dequeue
    if (CARD_EVENT_QUEUE.length === 0 && !CARD_EVENT_RUNNING) {
      processNextView();
    }
  }

  function startTurnTimer() {
    stopTurnTimer();
    if (!VIEW || VIEW.finished) return;
    TURN_TIMER_ID = setInterval(tickTurnTimer, 500);
    tickTurnTimer();
  }
  function stopTurnTimer() {
    if (TURN_TIMER_ID) { clearInterval(TURN_TIMER_ID); TURN_TIMER_ID = null; }
  }
  let _lastUrgentSec = -1;
  function tickTurnTimer() {
    if (!VIEW || VIEW.finished) { stopTurnTimer(); return; }
    const el = $('turnTimer');
    if (!el) return;
    const elapsed = Date.now() - TURN_TIMER_START;
    const remaining = Math.max(0, TURN_LIMIT_MS - elapsed);
    const sec = Math.ceil(remaining / 1000);
    el.textContent = sec + 's';
    el.classList.toggle('is-warning', sec <= 10 && sec > 0);
    el.classList.toggle('is-expired', sec === 0);
    // 자동 패 — 내 차례에만, play-hand 또는 choose-go-stop 에서 시간 초과 시
    const me = VIEW.myIndex;
    const isMyTurn = VIEW.turn === me;
    // 5초 이하 큰 카운트다운 + 진동 + tick 사운드 (내 차례에만)
    if (isMyTurn && sec <= 5 && sec > 0 && sec !== _lastUrgentSec) {
      _lastUrgentSec = sec;
      showUrgentCountdown(sec);
      if (navigator.vibrate) { try { navigator.vibrate(40); } catch {} }
      const SFX = window.GostopSFX ? window.GostopSFX.sfx : null;
      if (SFX) { sec === 1 ? SFX.tickFinal() : SFX.tick(); }
    } else if (!isMyTurn || sec > 5 || sec === 0) {
      _lastUrgentSec = -1;
    }
    if (sec === 0 && isMyTurn) {
      // 한 번만 자동 실행
      if (el.dataset.autoPlayed === '1') return;
      el.dataset.autoPlayed = '1';
      autoPlayFallback();
    } else {
      el.dataset.autoPlayed = '0';
    }
  }

  function showUrgentCountdown(sec) {
    let el = document.getElementById('urgentCountdown');
    if (!el) {
      el = document.createElement('div');
      el.id = 'urgentCountdown';
      el.className = 'g-urgent-cd';
      document.body.appendChild(el);
    }
    el.textContent = String(sec);
    el.classList.remove('is-show');
    void el.offsetWidth;
    el.classList.add('is-show');
  }
  function autoPlayFallback() {
    if (!VIEW) return;
    const me = VIEW.myIndex;
    if (VIEW.phase === 'declare-shake') {
      // 자동: 거부 (안전 선택)
      socket().emit('game:declareShake', { accept: false }, function () {});
      showToast('⏰ 시간 초과! 흔들기 패스');
    } else if (VIEW.phase === 'play-hand' && VIEW.myHand.length) {
      HAND_PRESELECT_ID = null;
      const c = VIEW.myHand[Math.floor(Math.random() * VIEW.myHand.length)];
      socket().emit('game:play', { cardId: c.id }, function () {});
      showToast('⏰ 시간 초과! 자동으로 냈어요');
    } else if (VIEW.phase === 'choose-hand-match' && VIEW.pending && VIEW.pending.choices && VIEW.pending.choices.length) {
      const m = VIEW.pending.choices[0];
      socket().emit('game:match', { matchCardId: m }, function () {});
    } else if (VIEW.phase === 'choose-flip-match' && VIEW.pending && VIEW.pending.choices && VIEW.pending.choices.length) {
      const m = VIEW.pending.choices[0];
      socket().emit('game:match', { matchCardId: m }, function () {});
    } else if (VIEW.phase === 'choose-go-stop') {
      // 자동으로 '스톱' (안전 선택)
      socket().emit('game:gostop', { choice: 'stop' }, function () {});
      showToast('⏰ 시간 초과! 자동 스톱');
    }
  }

  function fireDiffEffects() {
    if (!PREV_VIEW || !VIEW) return;
    const me = VIEW.myIndex;
    const SFX = window.GostopSFX ? window.GostopSFX.sfx : null;
    // 새 카드 등장 / 캡처 — 결과에 따라 효과음 + 가운데 카드 이벤트 분기
    const prevBoardIds = new Set(PREV_VIEW.board.map(function (c) { return c.id; }));
    const newBoardCards = VIEW.board.filter(function (c) { return !prevBoardIds.has(c.id); });
    const newBoardCount = newBoardCards.length;
    const stockDropped = PREV_VIEW.stockCount > VIEW.stockCount;
    // 덱 뒤집기 swish — centerpiece 등장과 동시에
    if (stockDropped && SFX) SFX.flip();
    const captured = PREV_VIEW.board.filter(function (c) { return !VIEW.board.find(function (b) { return b.id === c.id; }); });
    // ★ 가운데 카드 이벤트 — 손에서 낸 패 / 덱에서 뒤집힌 패를 명확히 식별해서 표시
    const playerActed = (PREV_VIEW.turn != null) ? PREV_VIEW.turn : VIEW.turn;
    const isMyAct = playerActed === me;
    const actorName = (VIEW.players[playerActed] && VIEW.players[playerActed].name) || '';
    const matched = captured.length > 0;
    // ★ 매치된 바닥 카드 잠깐 빛나는 효과 (render() 가 220ms 뒤 제거하기 전)
    captured.forEach(function (capCard) {
      const boardCardEl = document.querySelector('#gameBoard [data-id="' + capCard.id + '"]');
      if (boardCardEl) {
        boardCardEl.style.transition = 'filter 0.18s ease, box-shadow 0.2s ease, opacity 0.2s ease';
        boardCardEl.style.filter = 'brightness(1.55) saturate(1.4)';
        boardCardEl.style.boxShadow = '0 0 22px 6px rgba(255,230,100,0.85)';
        boardCardEl.style.zIndex = '20';
      }
    });
    if (stockDropped) {
      let flipCard = null;
      if (newBoardCount > 0) flipCard = newBoardCards[newBoardCount - 1];
      else if (matched) flipCard = captured[captured.length - 1];
      const deckEl = $('gameDeck');
      // ★ 덱이 카드 뽑히는 듯한 살짝 들썩 — flip 사운드와 같이 발화 (CSS keyframe 재시작)
      if (deckEl) {
        deckEl.classList.remove('is-pulling');
        void deckEl.offsetWidth;
        deckEl.classList.add('is-pulling');
        setTimeout(function () { deckEl.classList.remove('is-pulling'); }, 360);
      }
      if (flipCard) {
        const deckRect = deckEl ? deckEl.getBoundingClientRect() : null;
        queueCardEvent(flipCard, matched ? 'flip-match' : 'flip-nomatch', null, deckRect);
      }
    } else {
      let playCardEv = null;
      let startRect = null;
      if (isMyAct && PREV_VIEW.myHand && VIEW.myHand) {
        const curIds = new Set(VIEW.myHand.map(function (c) { return c.id; }));
        const removed = PREV_VIEW.myHand.filter(function (c) { return !curIds.has(c.id); });
        if (removed.length > 0) {
          playCardEv = removed[0];
          // 내 손에 있는 카드 DOM 위치 캡처 (render 지연 덕에 아직 화면에 있음)
          const handEl = document.querySelector('#gameHand .hwa-card-wrap[data-card-id="' + playCardEv.id + '"]');
          if (handEl) {
            startRect = handEl.getBoundingClientRect();
            // ★ 손패 자리 즉시 페이드 — centerpiece 가 손에서 나오는 듯한 일체감
            // (220ms 뒤 render() 가 손패 전체를 다시 그리므로 일시적 효과)
            handEl.style.transition = 'opacity 0.18s ease, transform 0.18s ease';
            handEl.style.opacity = '0';
            handEl.style.transform = 'scale(0.85)';
          }
        }
      }
      if (!playCardEv) {
        if (newBoardCount > 0) playCardEv = newBoardCards[0];
        else if (matched) playCardEv = captured[0];
        // 상대가 낸 패 — 상대 영역에서 나오는 것처럼
        if (!isMyAct) {
          const oppBox = document.querySelector('#gameOpponents .g-opp[data-player-idx="' + playerActed + '"]');
          if (oppBox) startRect = oppBox.getBoundingClientRect();
        }
      }
      if (playCardEv) queueCardEvent(playCardEv, matched ? 'play-match' : 'play-nomatch', isMyAct ? 'me' : actorName, startRect);
    }
    // ★ 사운드 — centerpiece 카드 안착 시점(280ms) 과 정렬
    // 매치 시 cardPlace (탁), 매치 실패 시 cardSlide (가벼운 sliding)
    if (SFX) {
      if (matched) setTimeout(function () { SFX.clack(); }, 275);
      else if (newBoardCount > 0) setTimeout(function () { SFX.ching(); }, 275);
    }
    // 매치 햅틱 — 카드 임팩트 피크(280ms)에 진동
    if (matched && navigator.vibrate) {
      setTimeout(function () { try { navigator.vibrate([18, 24, 18]); } catch {} }, 280);
    }
    // 내 차례로 바뀌었으면 알림 삐
    // 내 차례로 바뀌었으면 종소리 — 단, centerpiece + clack/ching 사운드와 겹치지 않게 지연
    // (상대 카드 시각화가 끝난 직후 ~700ms 시점에 종소리. 이전엔 0ms 발사로 swish 와 겹침)
    if (PREV_VIEW.turn !== VIEW.turn && VIEW.turn === me && !VIEW.finished && SFX) {
      const turnSoundDelay = stockDropped || matched || newBoardCount > 0 ? 720 : 0;
      setTimeout(function () { SFX.myturn(); }, turnSoundDelay);
    }
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
      if (crossed) {
        bigCallout(crossed + '점 달성!', 'gold');
        if (SFX) setTimeout(function () { SFX.fanfare(); }, 480);
      }
    }
    // 상대 점수 상승 플로터
    VIEW.players.forEach(function (_, i) {
      if (i === me) return;
      const b = (PREV_VIEW.scores && PREV_VIEW.scores[i]) || 0;
      const a = (VIEW.scores && VIEW.scores[i]) || 0;
      if (a > b) popScore('+' + (a - b) + '점', 'opp-' + i);
    });
    // 2-b) 세트 완성·임박 감지 — 내 획득 카드만 (상대는 과도한 알림 방지)
    const myCap = VIEW.captured && VIEW.captured[me];
    const myCapPrev = PREV_VIEW.captured && PREV_VIEW.captured[me];
    if (myCap && myCapPrev) {
      const prevS = analyzeCaptured(myCapPrev);
      const curS = analyzeCaptured(myCap);
      if (prevS && curS) {
        // 세트별 3/3 완성 감지
        const setDefs = [
          { key: 'godori',    name: '고도리', pts: 5 },
          { key: 'hongdan',   name: '홍단',   pts: 3 },
          { key: 'cheongdan', name: '청단',   pts: 3 },
          { key: 'chodan',    name: '초단',   pts: 3 },
        ];
        setDefs.forEach(function (def) {
          const p = prevS[def.key] || 0, c = curS[def.key] || 0;
          if (p < 3 && c >= 3) {
            bigCallout(def.name + ' 완성! +' + def.pts + '점', 'gold', 1800);
            if (SFX) setTimeout(function () { SFX.fanfare(); }, 380);
          } else if (p < 2 && c === 2) {
            showToast(def.name + ' 2/3 — 한 장만 더!');
          }
        });
        // 광 3장 최초 달성
        if (prevS.light < 3 && curS.light >= 3) {
          bigCallout('광 ' + curS.light + '장! +' + curS.light + '점', 'gold', 1700);
          if (SFX) setTimeout(function () { SFX.fanfare(); }, 380);
        }
      }
    }

    // 3) 게임 종료 감지 — 큰 승/패 스크린 + 결과 오버레이
    if (VIEW.finished && !PREV_VIEW.finished) {
      if (VIEW.winner === me) {
        fireConfetti();
        if (SFX) setTimeout(function () { SFX.fanfare(); }, 200);
      } else if (VIEW.winner != null && SFX) {
        setTimeout(function () { SFX.lose(); }, 200);
      }
      // 짧은 지연 후 정중앙 결과 오버레이
      setTimeout(function () { showEndDialog(); }, 700);
    }
    // R26: choose-hand-match phase 진입 시 부드러운 안내 비프 (1회) — §3 결합
    // 내 차례에서 같은 달 카드 선택을 요구받는 순간 인지 보조 (UX 시각 강화는 별도 후속)
    if (PREV_VIEW.phase !== 'choose-hand-match' && VIEW.phase === 'choose-hand-match'
        && VIEW.turn === me && SFX) {
      // myTurn 알림과 시간 차 두고 발사 (myTurn 720ms 뒤 → +260ms ≈ 980ms 시점)
      setTimeout(function () { SFX.chooseHint(); }, 980);
    }
    // 뻑 / 뻑먹기 / 고 감지 — 사운드 + 시각
    if (newLog && (!oldLog || newLog.ts !== oldLog.ts)) {
      if (/^뻑!/.test(newLog.msg)) {
        bigCallout('뻑!', 'go', 1600);
        if (SFX) setTimeout(function () { SFX.gong(); }, 280);
      } else if (/뻑 먹기|뻑 싹쓸이|뻑먹기/.test(newLog.msg)) {
        bigCallout('싹쓸이!', 'gold', 1800);
        if (SFX) setTimeout(function () { SFX.fanfare(); }, 320);
      }
      const goMatch = newLog.msg.match(/(\d+)고!\s*계속/);
      if (goMatch) {
        const n = Number(goMatch[1]);
        bigCallout(n + '고!', 'go', 1600);
        if (SFX) setTimeout(function () { SFX.gong(); }, 280);
      }
    }
    // R26: 신규 룰 이벤트 자동 결선 — SFX + 토스트 (PREV/CURR diff 기준)
    // events 큐에서 prev 마지막 ts 이후 새 이벤트만 발화. SFX 키는 type 과 동일.
    if (Array.isArray(VIEW.events)) {
      const prevEvts = (PREV_VIEW && Array.isArray(PREV_VIEW.events)) ? PREV_VIEW.events : [];
      const lastPrevTs = prevEvts.length ? prevEvts[prevEvts.length - 1].ts : 0;
      VIEW.events.forEach(function (ev) {
        if (!ev || ev.ts <= lastPrevTs) return;
        if (SFX && typeof SFX[ev.type] === 'function') {
          try { SFX[ev.type](); } catch (_) {}
        }
      });
    }
    // 신규 이벤트 토스트 오버레이 (SFX 와 같은 프레임에 정렬)
    renderEventOverlays();
  }

  // 종료 다이얼로그 — winner 의 captured 분석해 가장 굵직한 콤보 1개 추출
  function pickMvpCombo(cap) {
    if (!cap || !window.GostopEngine || !window.GostopEngine.scoreBreakdown) return null;
    const bd = window.GostopEngine.scoreBreakdown(cap);
    const active = (bd.parts || []).filter(function (p) { return p.pts > 0; });
    if (!active.length) return null;
    // 가장 점수 높은 1개. 동점이면 등장 순서 우선.
    active.sort(function (a, b) { return b.pts - a.pts; });
    const top = active[0];
    return top.label + ' (+' + top.pts + '점)';
  }

  function showEndDialog() {
    if (!VIEW || !VIEW.finished) return;
    const me = VIEW.myIndex;
    const dlg = $('endDialog');
    // ★ 강제 화면 정중앙 풀스크린 + 진한 불투명 배경
    dlg.style.cssText = 'display:flex !important;position:fixed !important;' +
      'top:0 !important;left:0 !important;right:0 !important;bottom:0 !important;' +
      'z-index:10000 !important;align-items:center !important;justify-content:center !important;' +
      'background:linear-gradient(135deg, #1F1A2E 0%, #4A3520 100%) !important;' +
      'padding:20px !important;';
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
    // MVP 콤보 — winner 의 결정적 점수 콤보 한 줄
    let mvpHtml = '';
    if (winner != null) {
      const mvp = pickMvpCombo(VIEW.captured[winner]);
      if (mvp) mvpHtml = '<div class="g-end-mvp">✨ ' + escapeHtml(mvp) + '</div>';
    }
    sub.innerHTML = roundN + '번째 판 최종 점수' + bakHtml + mvpHtml;
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
      if (!res || !res.ok) return showToast('⚠️ 재대결 시작 실패: ' + (res && res.error));
      $('endDialog').style.display = 'none';
      $('endDialog').classList.add('hidden');
      PREV_VIEW = null;
    });
  });
  $('btnEndExit').addEventListener('click', function () {
    $('endDialog').style.display = 'none';
    $('endDialog').classList.add('hidden');
    const wasSingle = !!window._gostopSingleActive || !!window._gostopSingleResult;
    socket().emit('room:leave', null, function () {});
    $('game').classList.add('hidden');
    if (wasSingle) {
      const single = document.getElementById('single');
      if (single) {
        single.classList.remove('hidden');
        if (window.GostopRefreshSingle) window.GostopRefreshSingle();
        // 결과 알림 (소지금 변화 + 레벨 진급)
        const r = window._gostopSingleResult;
        if (r) {
          const sign = r.delta >= 0 ? '+' : '';
          let msg;
          if (r.iWon && r.levelCleared) {
            msg = '🏆 클리어! 봇으로부터 ' + sign + Number(r.delta).toLocaleString('ko-KR') + '원 획득\n' +
                  '다음 단계 Lv.' + r.nextLevel + ' 해금되었어요\n소지금: ' + Number(r.myMoney).toLocaleString('ko-KR') + '원';
          } else if (r.delta < 0) {
            msg = '💸 패배. ' + Number(r.delta).toLocaleString('ko-KR') + '원 차감\n현재 소지금: ' + Number(r.myMoney).toLocaleString('ko-KR') + '원';
          } else {
            msg = '비겼어요. 소지금 변화 없음';
          }
          setTimeout(function () { alert(msg); }, 100);
          window._gostopSingleResult = null;
        }
      }
    } else {
      $('lobby').classList.remove('hidden');
    }
    VIEW = null; PREV_VIEW = null;
  });

  // 중앙 큰 콜아웃 — "먹었다!" "3점 달성!" "고!" "승리!"
  // ===== 속도 시스템 =====
  // 'fast' / 'normal' / 'slow' (localStorage)
  function getSpeedKey() {
    try { return localStorage.getItem('gostop_speed') || 'normal'; } catch { return 'normal'; }
  }
  function getSpeedMultiplier() {
    const k = getSpeedKey();
    return k === 'fast' ? 0.6 : k === 'slow' ? 1.7 : 1.0;
  }
  function getSpeedLabel() {
    const k = getSpeedKey();
    return k === 'fast' ? '⚡상' : k === 'slow' ? '⚡하' : '⚡중';
  }
  function cycleSpeed() {
    const cur = getSpeedKey();
    const next = cur === 'fast' ? 'normal' : cur === 'normal' ? 'slow' : 'fast';
    try { localStorage.setItem('gostop_speed', next); } catch {}
    const btn = $('btnSpeed');
    if (btn) btn.textContent = getSpeedLabel();
  }

  // ===== 가운데 카드 이벤트 오버레이 =====
  // kind: 'play-match' | 'play-nomatch' | 'flip-match' | 'flip-nomatch'
  // who: 'me' | name string | null
  let CARD_EVENT_QUEUE = [];
  let CARD_EVENT_RUNNING = false;
  function queueCardEvent(card, kind, who, startRect) {
    CARD_EVENT_QUEUE.push({ card: card, kind: kind, who: who, startRect: startRect });
    if (!CARD_EVENT_RUNNING) processCardEventQueue();
  }
  function processCardEventQueue() {
    if (!CARD_EVENT_QUEUE.length) {
      CARD_EVENT_RUNNING = false;
      // ★ centerpiece 가 다 끝났으면 — 대기 view 가 있으면 60ms 후 진행, 없으면 lock 풀기
      if (typeof VIEW_QUEUE !== 'undefined' && VIEW_QUEUE.length > 0) {
        setTimeout(function () { processNextView(); }, 60);
      } else if (typeof VIEW_PROCESSING !== 'undefined') {
        VIEW_PROCESSING = false;
      }
      return;
    }
    CARD_EVENT_RUNNING = true;
    const item = CARD_EVENT_QUEUE.shift();
    showCardEventOverlay(item.card, item.kind, item.who, item.startRect, function () {
      processCardEventQueue();
    });
  }
  function showCardEventOverlay(card, kind, who, startRect, done) {
    if (!card) { if (done) done(); return; }
    const mult = getSpeedMultiplier();
    // ★ reduced-motion 사용자 — slide/scale 모션 단축. 카드는 짧게 비치고 사라짐.
    const _rm = isReducedMotion();
    const inMs = _rm ? 0 : 280; // 시작 → 중앙 슬라이드 시간
    const holdMs = _rm ? Math.round(350 * mult) : Math.round(500 * mult);
    const outMs = _rm ? 80 : 240;
    const isMatch = kind === 'play-match' || kind === 'flip-match';

    // 시작 위치 — startRect 가 있으면 거기서, 없으면 화면 중앙(작게)
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let offX = 0, offY = 0, startScale = 0.4, startRot = -10;
    if (startRect && startRect.width > 0) {
      offX = (startRect.left + startRect.width / 2) - vw / 2;
      offY = (startRect.top + startRect.height / 2) - vh / 2;
      startScale = startRect.width / 120;  // 손 카드 크기에 맞춤
      startRot = 0; // 손에서 나오는 거니까 회전 X
    }

    const cardEl = GostopCards.renderCard(card, {});
    const initTransform = 'translate(calc(-50% + ' + offX + 'px), calc(-50% + ' + offY + 'px)) ' +
                          'scale(' + startScale + ') rotate(' + startRot + 'deg)';
    cardEl.style.cssText =
      'position:fixed;top:50%;left:50%;' +
      'width:120px !important;height:192px !important;flex:none !important;' +
      'transform:' + initTransform + ';opacity:' + (startRect ? '1' : '0') + ';' +
      'z-index:9999;pointer-events:none;border-radius:8px;' +
      'box-shadow:0 24px 60px rgba(0,0,0,0.55)' + (isMatch ? ', 0 0 70px rgba(52,211,153,0.75)' : '') + ';' +
      'transition:transform 0.28s cubic-bezier(.34,1.56,.64,1), opacity 0.2s ease, box-shadow 0.2s ease;';
    const innerImg = cardEl.querySelector('img, .hwa-img, .hwa-card');
    if (innerImg) innerImg.style.cssText = 'width:100% !important;height:100% !important;display:block;border-radius:8px;';
    document.body.appendChild(cardEl);
    // 등장 — 정중앙으로 슬라이드 + 확대
    setTimeout(function () {
      cardEl.style.transform = 'translate(-50%, -50%) scale(1) rotate(0deg)';
      cardEl.style.opacity = '1';
    }, 20);
    // 매치 살짝 임팩트 (피크에서 1.1× pop)
    if (isMatch) {
      setTimeout(function () {
        cardEl.style.transform = 'translate(-50%, -50%) scale(1.1) rotate(2deg)';
      }, inMs);
      setTimeout(function () {
        cardEl.style.transform = 'translate(-50%, -50%) scale(1) rotate(0deg)';
      }, inMs + 120);
    }
    setTimeout(function () {
      cardEl.style.transform = isMatch
        ? 'translate(-50%, -50%) scale(1.15) rotate(8deg)'
        : 'translate(-50%, -50%) scale(0.6)';
      cardEl.style.opacity = '0';
      setTimeout(function () { cardEl.remove(); if (done) done(); }, outMs);
    }, inMs + holdMs);
  }

  function bigCallout(text, tone, duration) {
    duration = duration || 1400;
    const el = document.createElement('div');
    el.className = 'g-big-callout g-callout-' + (tone || 'good');
    el.textContent = text;
    document.body.appendChild(el);
    setTimeout(function () { el.remove(); }, duration);
  }

  // ★ 모션 감소 사용자 검사 — JS 측 강한 모션(컨페티·딜링 stagger 등) 비활성화 분기
  const _reducedMotionMQ = (typeof window !== 'undefined' && window.matchMedia)
    ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
  function isReducedMotion() {
    return !!(_reducedMotionMQ && _reducedMotionMQ.matches);
  }

  // 승리 시 컨페티 — 짧은 CSS 애니 파티클 (reduced-motion 사용자에겐 생략)
  function fireConfetti() {
    if (isReducedMotion()) return;     // 모션 감소 모드 — 컨페티 자체 생성 안 함 (CPU 절약 + 산만함 제거)
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

  let _scoreAnimHandle = 0;
  function animateScoreCount(el, from, to) {
    // 이전 애니가 진행 중이면 cancel — 짧은 시간 내 두 번 점수 변화 시 깜빡 방지
    if (_scoreAnimHandle) { cancelAnimationFrame(_scoreAnimHandle); _scoreAnimHandle = 0; }
    // ★ 모션 감소 사용자 — 카운트업 생략, 즉시 표시
    if (isReducedMotion()) { el.textContent = to + '점'; return; }
    const duration = 650;
    const start = performance.now();
    const diff = to - from;
    function tick(now) {
      const t = Math.min(1, (now - start) / duration);
      // easeOutCubic
      const eased = 1 - Math.pow(1 - t, 3);
      const cur = Math.round(from + diff * eased);
      el.textContent = cur + '점';
      if (t < 1) _scoreAnimHandle = requestAnimationFrame(tick);
      else _scoreAnimHandle = 0;
    }
    _scoreAnimHandle = requestAnimationFrame(tick);
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

  // ─────────────────────────────────────────────────────────────────
  // R26 신규 phase UI — 흔들기 모달, 폭탄 FAB, 이벤트 토스트, 보너스 배지
  // ─────────────────────────────────────────────────────────────────

  // 이벤트 타입별 라벨 (한국어 + 아이콘)
  const EVENT_DEF = {
    shake:    { icon: '🌀', label: '흔들기 선언!', tone: 'gold' },
    bomb:     { icon: '💥', label: '폭탄!',         tone: 'go' },
    ttadak:   { icon: '👏', label: '따닥!',         tone: 'gold' },
    jaBbuk:   { icon: '✨', label: '자뻑!',         tone: 'gold' },
    bbukMeok: { icon: '🍯', label: '뻑 먹기!',      tone: 'gold' },
    sseul:    { icon: '🧹', label: '싹쓸이!',       tone: 'gold' },
  };

  // 손패에서 특정 월 카드를 모아 미니 카드 3장 SVG/IMG 묶음 반환
  function buildShakeMonthPreview(monthArr) {
    if (!VIEW || !VIEW.myHand || !monthArr || !monthArr.length) return '';
    // 첫 번째 가능 월의 3장
    const m = monthArr[0];
    const cards = VIEW.myHand.filter(function (c) { return c.month === m; }).slice(0, 3);
    if (!cards.length) return '';
    let html = '<div class="g-shake-preview" aria-label="' + m + '월 3장">';
    cards.forEach(function (c) {
      const wrap = GostopCards.renderCard(c, {});
      wrap.classList.add('g-shake-preview-card');
      // 임시 div 로 outerHTML 추출
      const tmp = document.createElement('div');
      tmp.appendChild(wrap);
      html += tmp.innerHTML;
    });
    html += '</div>';
    return html;
  }

  function renderShakeModal(isMyTurn) {
    let dlg = $('shakeDlg');
    const shouldShow = isMyTurn && VIEW && VIEW.phase === 'declare-shake'
                       && VIEW.shakeAvailable && VIEW.shakeAvailable.months
                       && VIEW.shakeAvailable.months.length > 0;
    if (!shouldShow) {
      if (dlg) dlg.remove();
      return;
    }
    if (dlg) return; // 이미 떠 있으면 그대로 유지 (중복 생성 방지)
    const months = VIEW.shakeAvailable.months;
    const monthsTxt = months.join(',') + '월';
    const previewHtml = buildShakeMonthPreview(months);
    dlg = document.createElement('div');
    dlg.id = 'shakeDlg';
    dlg.className = 'g-dlg-backdrop g-shake-backdrop';
    dlg.setAttribute('role', 'dialog');
    dlg.setAttribute('aria-labelledby', 'shakeDlgTitle');
    dlg.innerHTML =
      '<div class="g-dlg g-shake-dlg" role="document">' +
        '<button class="g-shake-close" aria-label="닫기 (패스)">✕</button>' +
        '<div class="g-shake-emoji" aria-hidden="true">🌀</div>' +
        '<h2 id="shakeDlgTitle" class="g-shake-title">흔들기 가능!</h2>' +
        '<p class="g-shake-sub"><b>' + monthsTxt + '</b> 같은 달 3장을 모았어요.<br>' +
          '선언하면 이번 라운드 점수가 <b>×2</b>로 곱해집니다.</p>' +
        previewHtml +
        '<div class="g-shake-actions">' +
          '<button id="btnShakeYes" class="g-shake-btn g-shake-btn-yes" type="button">' +
            '🌀 흔들기!' +
          '</button>' +
          '<button id="btnShakeNo" class="g-shake-btn g-shake-btn-no" type="button">' +
            '건너뛰기' +
          '</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(dlg);
    function closeDlg() {
      const el = $('shakeDlg');
      if (el) el.remove();
    }
    dlg.querySelector('.g-shake-close').onclick = function () {
      socket().emit('game:declareShake', { accept: false }, function () {});
      closeDlg();
    };
    document.getElementById('btnShakeYes').onclick = function () {
      socket().emit('game:declareShake', { accept: true }, function () {});
      closeDlg();
    };
    document.getElementById('btnShakeNo').onclick = function () {
      socket().emit('game:declareShake', { accept: false }, function () {});
      closeDlg();
    };
    // ESC = 패스
    dlg.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        socket().emit('game:declareShake', { accept: false }, function () {});
        closeDlg();
      }
    });
    // 진입 사운드 — chooseHint 1회 (R26: chooseHint는 declare 결정 보조에 적합)
    if (window.GostopSFX && window.GostopSFX.sfx && window.GostopSFX.sfx.chooseHint) {
      try { window.GostopSFX.sfx.chooseHint(); } catch (_) {}
    }
    // 첫 yes 버튼에 포커스
    setTimeout(function () {
      const yes = document.getElementById('btnShakeYes');
      if (yes) yes.focus();
    }, 30);
  }

  function renderBombFab(isMyTurn) {
    let fab = $('bombFab');
    const opts = (VIEW && Array.isArray(VIEW.bombOptions)) ? VIEW.bombOptions : [];
    const shouldShow = isMyTurn && VIEW && VIEW.phase === 'play-hand' && opts.length > 0;
    if (!shouldShow) {
      if (fab) fab.remove();
      return;
    }
    const m = opts[0];
    if (fab) {
      // 이미 있으면 라벨/핸들러만 갱신 (월 변동 가능)
      const lbl = fab.querySelector('.g-bomb-fab-month');
      if (lbl) lbl.textContent = m + '월';
      fab.dataset.month = String(m);
      return;
    }
    fab = document.createElement('button');
    fab.id = 'bombFab';
    fab.className = 'g-bomb-fab';
    fab.type = 'button';
    fab.dataset.month = String(m);
    fab.setAttribute('aria-label', m + '월 폭탄 (4장 한 번에 — 점수 ×2)');
    fab.innerHTML =
      '<span class="g-bomb-fab-icon" aria-hidden="true">💣</span>' +
      '<span class="g-bomb-fab-text">폭탄!</span>' +
      '<span class="g-bomb-fab-month">' + m + '월</span>';
    fab.onclick = function () {
      const month = Number(fab.dataset.month || m);
      // 햅틱
      if (navigator.vibrate) { try { navigator.vibrate([12, 30, 12]); } catch (_) {} }
      socket().emit('game:playBomb', { month: month }, function (res) {
        if (!res || !res.ok) showToast('⚠️ 폭탄 실패: ' + (res && res.error || ''));
      });
    };
    document.body.appendChild(fab);
  }

  // 점수 옆 보너스 곱셈 배지 (×2 / ×4 …) — bonuses[me].shake/bomb/jaBbuk 합으로 계산
  function renderBonusBadges() {
    const me = VIEW && VIEW.myIndex;
    if (me == null) return;
    const b = (VIEW && VIEW.bonuses && VIEW.bonuses[me]) || null;
    const total = b ? (Number(b.shake || 0) + Number(b.bomb || 0) + Number(b.jaBbuk || 0)) : 0;
    const pill = $('gameMyMetaPill');
    if (!pill) return;
    let badge = pill.querySelector('.g-bonus-badge');
    if (total <= 0) {
      if (badge) badge.remove();
      return;
    }
    const mult = Math.pow(2, total);
    const parts = [];
    if (b.shake)   parts.push('🌀×' + b.shake);
    if (b.bomb)    parts.push('💣×' + b.bomb);
    if (b.jaBbuk)  parts.push('✨×' + b.jaBbuk);
    const tip = parts.join(' · ');
    if (!badge) {
      badge = document.createElement('span');
      badge.className = 'g-bonus-badge';
      pill.appendChild(badge);
    }
    badge.textContent = '×' + mult;
    badge.title = tip + ' → 합산 점수 ×' + mult;
    badge.setAttribute('aria-label', '보너스 ' + tip + ' 점수 ' + mult + '배');
  }

  // 새 이벤트 토스트 — PREV_VIEW.events 와 비교, 새로 들어온 항목만 잠깐 표시
  let _lastEventTs = 0;
  function renderEventOverlays() {
    if (!VIEW || !Array.isArray(VIEW.events)) return;
    const newOnes = VIEW.events.filter(function (e) { return e && e.ts > _lastEventTs; });
    if (!newOnes.length) return;
    _lastEventTs = newOnes[newOnes.length - 1].ts;
    const reduced = isReducedMotion();
    const me = VIEW.myIndex;
    newOnes.forEach(function (ev, idx) {
      const def = EVENT_DEF[ev.type];
      if (!def) return;
      const isMe = ev.playerIdx === me;
      const actorName = (ev.playerIdx != null && VIEW.players[ev.playerIdx])
                       ? VIEW.players[ev.playerIdx].name : '';
      // 토스트 엘리먼트
      const el = document.createElement('div');
      el.className = 'g-event-toast g-event-' + ev.type + (isMe ? ' is-me' : ' is-opp');
      el.setAttribute('role', 'status');
      el.setAttribute('aria-live', 'polite');
      const sub = isMe ? '내가!' : escapeHtml(actorName);
      el.innerHTML =
        '<span class="g-event-toast-icon" aria-hidden="true">' + def.icon + '</span>' +
        '<span class="g-event-toast-body">' +
          '<span class="g-event-toast-label">' + def.label + '</span>' +
          '<span class="g-event-toast-actor">' + sub + '</span>' +
        '</span>';
      // 여러 이벤트 동시 발생 시 살짝 stagger (위로 쌓임)
      const stackOffset = idx * 6;
      el.style.setProperty('--g-event-stack', stackOffset + 'px');
      document.body.appendChild(el);
      // 등장
      requestAnimationFrame(function () { el.classList.add('is-show'); });
      const showMs = reduced ? 1100 : 850;
      setTimeout(function () { el.classList.add('is-out'); }, showMs);
      setTimeout(function () { if (el.parentNode) el.remove(); }, showMs + (reduced ? 100 : 320));
    });
  }

  // 고/스톱 다이얼로그에 점수 브레이크다운 인라인 — 사용자 결정 보조
  function injectGoStopBreakdown(innerEl, playerIdx) {
    if (!innerEl || !VIEW || !window.GostopEngine || !window.GostopEngine.scoreBreakdown) return;
    const cap = VIEW.captured[playerIdx];
    if (!cap) return;
    const bd = window.GostopEngine.scoreBreakdown(cap);
    let bdEl = innerEl.querySelector('.g-gostop-bd');
    if (!bdEl) {
      bdEl = document.createElement('div');
      bdEl.className = 'g-gostop-bd';
      const actions = innerEl.querySelector('.g-gostop-actions');
      if (actions) innerEl.insertBefore(bdEl, actions);
      else innerEl.appendChild(bdEl);
    }
    const rowsHtml = bd.parts.map(function (part) {
      const has = part.pts > 0;
      return '<li class="g-gostop-bd-row' + (has ? ' is-active' : '') + '">' +
        '<span class="g-gostop-bd-label">' + escapeHtml(part.label) + '</span>' +
        (has ? '<span class="g-gostop-bd-pts">+' + part.pts + '</span>'
             : '<span class="g-gostop-bd-pending">' + escapeHtml(part.pending || '-') + '</span>') +
        '</li>';
    }).join('');
    bdEl.innerHTML = '<div class="g-gostop-bd-head">📋 점수 구성</div>' +
      '<ul class="g-gostop-bd-list">' + (rowsHtml || '<li class="g-gostop-bd-empty">아직 득점 카드 없음</li>') + '</ul>';
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
      // 'opp-i' 의 i 는 absolute player idx — boxes 는 me 빼고 N-1 개라
      // boxes[i] 직접 인덱싱은 잘못된 박스로 감. data-player-idx 로 정확히.
      const idx = Number(slot.split('-')[1]);
      anchor = document.querySelector('.g-opp[data-player-idx="' + idx + '"]') || null;
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
      'declare-shake': '흔들기 결정',
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
    // R26: 신규 phase UI — 흔들기 모달 + 폭탄 floating 버튼 (정식 UI)
    renderShakeModal(isMyTurn);
    renderBombFab(isMyTurn);

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
      // ★ 봇/상대 turn 시 "생각중" 점점점 — 게임 멈춘 줄 알지 않도록
      const thinkingDots = isTurn
        ? '<span class="g-opp-thinking" aria-label="생각중"><span></span><span></span><span></span></span>'
        : '';
      const oppCapId = 'oppCapPeek-' + i;
      box.innerHTML =
        '<div class="g-opp-inner">' +
          '<span class="g-pl-avatar g-opp-avatar">' + avatarHtml + '</span>' +
          '<div class="g-opp-body">' +
            '<div class="g-opp-head"><span>' + escapeHtml(p.name) + goBadge + thinkingDots + '</span><span>' + score + '점 · 손패 ' + handCount + '</span></div>' +
            '<div class="g-opp-hand">' + cardsHtml + '</div>' +
            '<div class="g-opp-captured-peek" id="' + oppCapId + '"></div>' +
          '</div>' +
        '</div>' +
        turnArrow;
      box.dataset.playerIdx = String(i);
      box.addEventListener('click', function (e) {
        e.stopPropagation();
        showOpponentDetail(i);
      });
      oppEl.appendChild(box);
      // 상대방 잡은 패 시각 표시 — 내 잡은 패와 같은 형식 (그룹별 부채 펼침)
      renderCapturedPeek(VIEW.captured[i], oppCapId);
    });

    // 바닥 — 같은 월끼리 붙어 보이게 정렬, 같은 월은 한 슬롯에 stack (뻑 3장은 부채꼴)
    VIEW.board.sort(function (a, b) {
      if (a.month !== b.month) return a.month - b.month;
      return a.id - b.id;
    });
    const monthGroups = {};
    const monthOrder = []; // sort 후 등장한 월 순서 — 각 월에 layout slot 1개씩 할당
    VIEW.board.forEach(function (c) {
      if (!monthGroups[c.month]) {
        monthGroups[c.month] = [];
        monthOrder.push(c.month);
      }
      monthGroups[c.month].push(c);
    });
    const monthCounts = {};
    monthOrder.forEach(function (m) { monthCounts[m] = monthGroups[m].length; });
    // ★ 슬롯 영속화 — 사라진 month 의 슬롯을 free, 새 month 만 빈 슬롯에 신규 부여.
    // 이전엔 매 render 마다 monthOrder 인덱스 = slot 이라 카드 추가/제거 시 기존 패도 위치 점프 → "왜 자꾸 바뀌지?" 버그.
    const currentMonthsSet = new Set(monthOrder);
    Object.keys(BOARD_SLOT_FOR_MONTH).forEach(function (mKey) {
      const m = Number(mKey);
      if (!currentMonthsSet.has(m)) {
        const freed = BOARD_SLOT_FOR_MONTH[m];
        if (typeof freed === 'number' && freed >= 0 && freed < BOARD_SLOT_USED.length) {
          BOARD_SLOT_USED[freed] = false;
        }
        delete BOARD_SLOT_FOR_MONTH[m];
      }
    });
    monthOrder.forEach(function (m) {
      if (BOARD_SLOT_FOR_MONTH[m] == null) {
        const freeIdx = BOARD_SLOT_USED.indexOf(false);
        const slotIdx = freeIdx >= 0 ? freeIdx : (monthOrder.indexOf(m) % 16);
        BOARD_SLOT_FOR_MONTH[m] = slotIdx;
        if (slotIdx < BOARD_SLOT_USED.length) BOARD_SLOT_USED[slotIdx] = true;
      }
    });
    const monthSlot = {};
    monthOrder.forEach(function (m) {
      monthSlot[m] = boardCardPosition(BOARD_SLOT_FOR_MONTH[m], 16);
    });
    // 이전 렌더와 비교해 새 카드는 카테고리별 애니메이션
    // (A) 덱에서 뒤집힌 카드: stock 감소 + 해당 카드가 새로 등장 → flip 애니
    // (B) 플레이어 손패에서 낸 카드: 손패 감소 + 새 카드 등장 → 슬라이드 애니
    const boardEl = $('gameBoard');
    boardEl.innerHTML = '';
    // ★ 바닥 — 덱을 정중앙에 두고 카드는 주위로 자연스럽게 분산 (절대 위치)
    boardEl.style.cssText = 'position:relative !important;width:100% !important;' +
      'min-height:240px;height:100%;padding:0;margin:0;display:block;';
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
      if (monthCounts[c.month] >= 2) wrap.classList.add('has-month-mate');
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
      // ★ 같은 달은 같은 slot 위에 stack — 뻑 3장은 부채꼴, 나머지는 살짝 어긋난 stack
      const slot = monthSlot[c.month];
      const groupArr = monthGroups[c.month];
      const indexInGroup = groupArr.indexOf(c);
      const groupSize = groupArr.length;
      const isBbukCard = bbukMonths.has(c.month);
      // ★ stack offset — 카드가 확실히 *겹친 채로 보이도록* 충분히 펼침
      // 카드 너비 52px, 면적 35~42% 시인 가능하게 ±18~22px 사용.
      let stackX, stackY, tilt;
      if (groupSize === 1) {
        stackX = 0; stackY = 0;
        tilt = ((c.id * 13) % 9) - 4;
      } else if (isBbukCard && groupSize === 3) {
        // 뻑 3장 — 일본/한국 온라인 맞고 풍 부채꼴 (펼침 크게)
        const fan = [{ x: -20, y: 6, r: -12 }, { x: 0, y: -2, r: 0 }, { x: 20, y: 6, r: 12 }];
        const o = fan[indexInGroup] || fan[1];
        stackX = o.x; stackY = o.y; tilt = o.r;
        // 뻑 owner 배지 — 가운데 카드(idx=1)에만 1개
        if (indexInGroup === 1) {
          const bg = (VIEW.bbukGroups || []).find(function (g) { return g.month === c.month; });
          if (bg && bg.ownerIdx != null && VIEW.players[bg.ownerIdx]) {
            const owner = VIEW.players[bg.ownerIdx];
            const badge = document.createElement('span');
            badge.className = 'g-bbuk-owner';
            badge.textContent = bg.ownerIdx === me ? '내 뻑' : (owner.name + ' 뻑');
            wrap.appendChild(badge);
          }
        }
      } else if (isBbukCard && groupSize === 4) {
        // 뻑 + 4번째 매칭 카드 (싹쓸이 직전) — 4장 cascade
        const off = indexInGroup - 1.5;
        stackX = off * 14; stackY = Math.abs(off) * 4; tilt = off * 8;
      } else if (groupSize === 2) {
        // 일반 같은 달 2장 — 좌우로 펼침
        stackX = (indexInGroup === 0 ? -12 : 12);
        stackY = 0;
        tilt = (indexInGroup === 0 ? -7 : 7);
      } else {
        // 일반 같은 달 3+장 — fan 펼침
        const center = (groupSize - 1) / 2;
        const off = indexInGroup - center;
        stackX = off * 16; stackY = Math.abs(off) * 3; tilt = off * 8;
      }
      wrap.style.position = 'absolute';
      wrap.style.left = 'calc(' + slot.x + '% - 26px + ' + stackX + 'px)';
      wrap.style.top = 'calc(' + slot.y + '% - 41px + ' + stackY + 'px)';
      wrap.style.zIndex = String(10 + indexInGroup);
      wrap.style.width = '52px';
      wrap.style.height = '82px';
      wrap.style.aspectRatio = '54 / 86';
      wrap.style.flex = 'none';
      wrap.style.margin = '0';
      wrap.style.transform = 'rotate(' + tilt + 'deg)';
      wrap.style.transformOrigin = 'center';
      wrap.style.transition = 'transform 0.25s ease, left 0.25s ease, top 0.25s ease';
      const innerImg = wrap.querySelector('img, .hwa-img, .hwa-card');
      if (innerImg) {
        innerImg.style.width = '100%';
        innerImg.style.height = '100%';
        innerImg.style.objectFit = 'contain';
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
          // captorIdx 는 absolute idx — data-player-idx 로 정확히
          const captorBox = document.querySelector('.g-opp[data-player-idx="' + captorIdx + '"]');
          if (captorBox) bumpBounce(captorBox.querySelector('.g-opp-captured') || captorBox);
        }
      }
    }

    // 내 손패 — 사용자 커스텀 순서가 있으면 그대로, 없으면 월 + 타입 자동 정렬
    const handEl = $('gameHand');
    if (isMyTurn && VIEW.phase === 'play-hand') {
      handEl.title = '같은 패를 한 번 탭하면 살짝 뜨고, 다시 탭하면 냅니다. 위로 드래그해도 한 번에 낼 수 있어요.';
    } else {
      handEl.removeAttribute('title');
    }
    const wasEmpty = handEl.children.length === 0;
    handEl.innerHTML = '';
    // ★ 손패 컨테이너 — 모드별 컬럼 수 (2인:5/10장→5+5, 3인:4/7장→4+3, 4인:3/6장→3+3)
    const handCols = VIEW.playerCount === 2 ? 5 : VIEW.playerCount === 3 ? 4 : 3;
    handEl.style.cssText = 'display:grid !important;' +
      'grid-template-columns:repeat(' + handCols + ', 1fr) !important;' +
      'grid-auto-rows:auto !important;gap:4px !important;' +
      'padding:6px 4px 4px !important;width:100% !important;' +
      'overflow:visible !important;justify-content:center;position:relative;';
    const typeOrder = { light: 0, animal: 1, ribbon: 2, junk: 3 };
    let sortedHand;
    if (window.HAND_CUSTOM_ORDER && window.HAND_CUSTOM_ORDER.length) {
      // 커스텀 순서 우선
      const orderMap = new Map();
      window.HAND_CUSTOM_ORDER.forEach(function (id, idx) { orderMap.set(id, idx); });
      sortedHand = VIEW.myHand.slice().sort(function (a, b) {
        const ai = orderMap.has(a.id) ? orderMap.get(a.id) : 9999 + a.month * 10;
        const bi = orderMap.has(b.id) ? orderMap.get(b.id) : 9999 + b.month * 10;
        return ai - bi;
      });
    } else {
      sortedHand = VIEW.myHand.slice().sort(function (a, b) {
        if (a.month !== b.month) return a.month - b.month;
        return (typeOrder[a.type] || 9) - (typeOrder[b.type] || 9);
      });
    }
    const boardMonths = new Set(VIEW.board.map(function (c) { return c.month; }));
    const prevHandIds = new Set((PREV_VIEW && PREV_VIEW.myHand ? PREV_VIEW.myHand : []).map(function (c) { return c.id; }));
    sortedHand.forEach(function (c, i) {
      const opts = { selected: PENDING_HAND_CARD === c.id };
      const wrap = GostopCards.renderCard(c, opts);
      if (VIEW.phase === 'play-hand' && isMyTurn && HAND_PRESELECT_ID === c.id) wrap.classList.add('is-hand-prelift');
      if (boardMonths.has(c.month)) wrap.classList.add('is-matchable');
      // 첫 딜링(이전에 손패 없었고 지금 생김) → stagger deal-in
      // ★ reduced-motion 사용자 — stagger delay 제거 (CSS 측에서도 fade 만 남김)
      if (wasEmpty || !prevHandIds.has(c.id)) {
        wrap.classList.add('is-handdeal');
        if (!isReducedMotion()) wrap.style.animationDelay = (i * 0.06) + 's';
        // R26: 첫 딜링시 stagger 와 동기화된 shuffleBurst (cardSlide OGG)
        // §3 결합 누락 — 데드 코드였던 shuffleBurst 활성화
        if (wasEmpty && window.GostopSFX) {
          setTimeout(function () { window.GostopSFX.sfx.shuffleBurst(); }, i * 60);
        }
      }
      // 클릭/탭 핸들링은 attachHandDragReorder 의 pointerup 에서 통합 처리 (drag/tap 구분)
      // ★ 손패 카드 사이즈 인라인 강제 — grid cell 안에 자동 축소
      wrap.style.width = '100%';
      wrap.style.maxWidth = '70px';
      wrap.style.minWidth = '0';
      wrap.style.height = 'auto';
      wrap.style.aspectRatio = '54 / 86';
      wrap.style.flex = '0 0 auto';
      wrap.style.margin = '0 auto';
      wrap.style.justifySelf = 'center';
      wrap.dataset.cardId = String(c.id);
      const innerH = wrap.querySelector('img, .hwa-img, .hwa-card');
      if (innerH) {
        innerH.style.width = '100%';
        innerH.style.height = '100%';
        innerH.style.objectFit = 'contain';
      }
      // ★ Long-press 드래그 reorder
      attachHandDragReorder(wrap, c.id);
      handEl.appendChild(wrap);
    });

    // 내 획득 카드 — 요약(칩) + 카드 스택 피크
    const capEl = $('gameMyCaptured');
    if (capEl) capEl.innerHTML = renderCapturedSummary(VIEW.captured[me]);
    renderCapturedPeek(VIEW.captured[me], 'gameMyCapturedPeek');
    // ★ 내 아바타·점수 pill 강제 우하단 floating (인라인 스타일 — 캐시·specificity 무관)
    const myMetaPill = $('gameMyMetaPill');
    if (myMetaPill) {
      myMetaPill.style.cssText = 'position:fixed !important;right:12px !important;bottom:12px !important;' +
        'z-index:8500 !important;display:flex !important;align-items:center !important;gap:6px !important;' +
        'padding:6px 12px 6px 6px !important;border-radius:999px !important;' +
        'background:linear-gradient(180deg, #FFFDF5, #FFE7C2) !important;' +
        'border:2px solid #D4A574 !important;' +
        'box-shadow:0 6px 18px rgba(0,0,0,0.3), 0 2px 4px rgba(0,0,0,0.15) !important;';
    }
    const myScoreEl = $('gameMyScore');
    if (myScoreEl) {
      const newScore = VIEW.scores[me] || 0;
      const prevScore = PREV_VIEW ? (PREV_VIEW.scores[me] || 0) : 0;
      if (newScore !== prevScore) {
        // R26: 점수 카운트업과 동시에 짧은 tick 사운드 — 누락된 §3 결합
        if (window.GostopSFX) window.GostopSFX.sfx.score();
        animateScoreCount(myScoreEl, prevScore, newScore);
        // 점수 변화 시 메타 pill 도 살짝 bump — 시각적 임팩트
        const pill = $('gameMyMetaPill');
        if (pill) bumpBounce(pill);
      } else {
        myScoreEl.textContent = newScore + '점';
      }
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
    // R26: 흔들기/폭탄/자뻑 곱셈 배지 — 점수 pill 안쪽
    renderBonusBadges();
    // 내 아바타
    const myAvatarEl = $('gameMyAvatar');
    if (myAvatarEl) {
      const mp = VIEW.players[me] || {};
      myAvatarEl.innerHTML = mp.photoUrl
        ? '<img src="' + escapeHtml(mp.photoUrl) + '" alt="" />'
        : iconEmoji(mp.icon);
    }
    // 내 차례면 me-wrap + felt 글로우
    const isMyTurnNow = VIEW.turn === me && !VIEW.finished;
    const meWrap = document.querySelector('.g-me-wrap');
    if (meWrap) meWrap.classList.toggle('is-turn', isMyTurnNow);
    const feltEl = document.querySelector('.g-felt');
    if (feltEl) feltEl.classList.toggle('is-my-turn', isMyTurnNow);
    // 덱 카운트
    const deckCount = $('gameDeckCount');
    const stock = VIEW.stockCount || 0;
    if (deckCount) deckCount.textContent = String(stock);
    const deckEl = $('gameDeck');
    if (deckEl) {
      deckEl.classList.toggle('is-empty', stock === 0);
      deckEl.classList.toggle('is-low', stock > 0 && stock <= 5);
    }

    // 덱 뒤집기는 자동 실행 — 손패 낸 뒤 centerpiece 애니 종료 직후 트리거
    const btnFlip = $('btnFlip');
    btnFlip.classList.add('hidden');
    if (isMyTurn && VIEW.phase === 'flip-stock' && !_autoFlipPending) {
      _autoFlipPending = true;
      // centerpiece 총 길이 = 280(slide-in) + 500*mult(hold) + 240(exit) + 80ms 여유
      // → fast 880 / normal 1080 / slow 1430 (이전엔 fast 시 centerpiece 와 겹침)
      const mult = getSpeedMultiplier();
      const flipDelay = Math.round(280 + 500 * mult + 240 + 80);
      setTimeout(function () {
        _autoFlipPending = false;
        socket().emit('game:flip', null, function () {});
      }, flipDelay);
    }

    // 내 차례 floating (좌하단) — 헤더에 영향 X
    const myTurnFloat = $('myTurnFloat');
    if (myTurnFloat) {
      if (isMyTurn && !VIEW.finished) myTurnFloat.classList.remove('hidden');
      else myTurnFloat.classList.add('hidden');
    }

    // 고/스톱 다이얼로그 — 게임판이 보이도록 가벼운 dim + 하단 sheet
    const gsDlg = $('goStopDialog');
    if (VIEW.phase === 'choose-go-stop' && isMyTurn) {
      // 다이얼로그가 새로 열릴 때만 등장 사운드 (phase 진입 1회)
      const justOpened = !PREV_VIEW || PREV_VIEW.phase !== 'choose-go-stop';
      if (justOpened) {
        const SFX = window.GostopSFX ? window.GostopSFX.sfx : null;
        if (SFX) SFX.dialogOpen();
      }
      gsDlg.classList.remove('hidden');
      // 게임판이 보이도록 살짝만 dim, 다이얼로그는 하단으로 — 손패/바닥 보고 판단 가능
      gsDlg.style.cssText = 'display:flex !important;position:fixed !important;' +
        'top:0 !important;left:0 !important;right:0 !important;bottom:0 !important;' +
        'z-index:10000 !important;align-items:flex-end !important;justify-content:center !important;' +
        'background:rgba(0,0,0,0.28) !important;' +
        'padding:0 !important;pointer-events:auto;';
      // 다이얼로그 본체는 하단 sheet 스타일 (높이 제한해 게임판 보이게)
      const inner = gsDlg.querySelector('.g-dlg');
      if (inner) {
        inner.style.cssText = 'width:100% !important;max-width:520px !important;' +
          'margin:0 12px 12px !important;border-radius:18px 18px 14px 14px !important;' +
          'max-height:48vh !important;overflow-y:auto !important;' +
          'box-shadow:0 -8px 24px rgba(0,0,0,0.35), 0 0 0 1px rgba(255,216,77,0.4) !important;' +
          'padding:14px 16px 12px !important;';
      }
      const myGo = (VIEW.goCounts && VIEW.goCounts[me]) || 0;
      const currentMult = Math.pow(2, myGo);
      const baseScore = VIEW.scores[me];
      const finalScore = baseScore * currentMult;
      $('gsScore').textContent = baseScore + '점' + (myGo >= 1 ? ' × ' + currentMult : '');
      // 싱글모드면 점당 환산해 "획득 가능 X원" 표시
      let moneyTxt;
      try {
        const prog = JSON.parse(localStorage.getItem('gostop_single_progress_v2') || '{}');
        const lv = Number(prog.level) || 1;
        const pv = 10 + (lv - 1) * 10;
        const won = finalScore * pv;
        moneyTxt = won >= 10000
          ? (Math.floor(won / 10000) + '만 ' + (won % 10000 ? (won % 10000).toLocaleString('ko-KR') + '원' : '원'))
          : won.toLocaleString('ko-KR') + '원';
      } catch {
        moneyTxt = (finalScore * 10).toLocaleString('ko-KR') + '원';
      }
      const moneyEl = $('gsMoney');
      if (moneyEl) moneyEl.textContent = moneyTxt;
      const goBtn = $('btnGo');
      if (goBtn) {
        goBtn.textContent = (myGo + 1) + '고!';
        goBtn.dataset.goNum = String(myGo + 1);
      }
      // 점수 브레이크다운 인라인 — 어떤 카드 조합으로 N점인지
      injectGoStopBreakdown(inner, me);
    } else {
      gsDlg.classList.add('hidden');
      gsDlg.style.display = 'none';
    }

    // 점수 올라가면 bump 임팩트 (이미 위에서 myScoreEl 변수 정의되어 있음 — 재사용)
    const sEl = document.getElementById('gameMyScore');
    if (sEl) {
      const prev = Number(sEl.dataset.prev || '0');
      const cur = VIEW.scores[me] || 0;
      if (cur > prev) {
        sEl.classList.remove('score-bump');
        void sEl.offsetWidth;
        sEl.classList.add('score-bump');
      }
      sEl.dataset.prev = String(cur);
    }

    // 로그 — display:none 이면 갱신 skip (R21~ 진행 기록 제거됨)
    const logEl = $('gameLog');
    if (logEl && logEl.style.display !== 'none') {
      logEl.innerHTML = VIEW.log.map(function (l) {
        return '<li>' + escapeHtml(l.msg) + '</li>';
      }).join('');
      logEl.scrollTop = logEl.scrollHeight;
    }

    // 턴 종료 / 게임 종료 시 pending 초기화
    if (VIEW.phase !== 'choose-hand-match') PENDING_HAND_CARD = null;
    if (VIEW.phase !== 'play-hand' || !isMyTurn) HAND_PRESELECT_ID = null;
    else if (HAND_PRESELECT_ID != null) {
      const still = (VIEW.myHand || []).some(function (c) { return c.id === HAND_PRESELECT_ID; });
      if (!still) HAND_PRESELECT_ID = null;
    }
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

  // 획득 카드 — 인라인 스타일로 강제 가로 (외부 CSS 캐시·specificity 무관)
  function renderCapturedPeek(cap, containerId) {
    const el = document.getElementById(containerId);
    if (!el) return;
    el.innerHTML = '';
    // 상대 영역(작은 칸)인지 판별 — id 가 oppCapPeek-* 면 컴팩트 모드
    const isCompact = /^oppCapPeek/.test(containerId);
    const cardW = isCompact ? 22 : 28;
    const cardH = isCompact ? 35 : 44;
    const overlap = isCompact ? -13 : -16;
    const showPerGroup = isCompact ? 3 : 5;
    const minH = isCompact ? 38 : 50;
    el.style.cssText = 'display:flex;flex-direction:row;flex-wrap:nowrap;align-items:center;' +
      'gap:' + (isCompact ? '3' : '4') + 'px;overflow-x:auto;overflow-y:hidden;' +
      'padding:' + (isCompact ? '2px' : '4px') + ';min-height:' + minH + 'px;width:100%;' +
      '-webkit-overflow-scrolling:touch;';
    if (!cap) return;
    const ribbons = (cap.ribbon || []);
    const animals = (cap.animal || []);
    const groupColors = {
      light: 'rgba(255,176,0,0.18)', godori: 'rgba(34,197,94,0.18)',
      animal: 'rgba(96,165,250,0.16)', hongdan: 'rgba(239,68,68,0.18)',
      cheongdan: 'rgba(59,130,246,0.18)', chodan: 'rgba(132,204,22,0.20)',
      ribbon: 'rgba(190,18,60,0.16)', junk: 'rgba(107,114,128,0.12)',
    };
    const groups = [
      { key: 'light',     cards: cap.light || [] },
      { key: 'godori',    cards: animals.filter(function (c) { return GODORI_LABELS.has(c.label); }) },
      { key: 'animal',    cards: animals.filter(function (c) { return !GODORI_LABELS.has(c.label); }) },
      { key: 'hongdan',   cards: ribbons.filter(function (c) { return HONGDAN_LABELS.has(c.label); }) },
      { key: 'cheongdan', cards: ribbons.filter(function (c) { return CHEONGDAN_LABELS.has(c.label); }) },
      { key: 'chodan',    cards: ribbons.filter(function (c) { return CHODAN_LABELS.has(c.label); }) },
      { key: 'ribbon',    cards: ribbons.filter(function (c) { return !HONGDAN_LABELS.has(c.label) && !CHEONGDAN_LABELS.has(c.label) && !CHODAN_LABELS.has(c.label); }) },
      { key: 'junk',      cards: cap.junk || [] },
    ];
    groups.forEach(function (g) {
      if (!g.cards.length) return;
      const grp = document.createElement('span');
      grp.className = 'g-cap-grp g-cap-grp-' + g.key;
      grp.style.cssText = 'display:inline-flex !important;flex-direction:row !important;' +
        'align-items:center;flex-shrink:0;padding:' + (isCompact ? '2px 3px' : '3px 4px') +
        ';border-radius:6px;background:' + groupColors[g.key] + ';';
      const visible = g.cards.slice(0, showPerGroup);
      const overflow = g.cards.length - visible.length;
      visible.forEach(function (c, idx) {
        const mini = GostopCards.renderCard(c, {});
        mini.classList.add('g-cap-mini');
        const overlapMargin = idx === 0 ? '0' : (overlap + 'px');
        mini.style.cssText = 'width:' + cardW + 'px !important;height:' + cardH + 'px !important;' +
          'flex:0 0 auto !important;margin:0 0 0 ' + overlapMargin + ' !important;' +
          'pointer-events:none;position:relative;border-radius:4px;z-index:' + (idx + 1) + ';';
        const inner = mini.querySelector('img, .hwa-img, .hwa-card');
        if (inner) inner.style.cssText = 'width:100% !important;height:100% !important;' +
          'object-fit:cover !important;border-radius:4px;display:block;';
        grp.appendChild(mini);
      });
      // 오버플로 칩 — "+N"
      if (overflow > 0) {
        const more = document.createElement('span');
        more.style.cssText = 'margin-left:' + (isCompact ? '4' : '6') + 'px;' +
          'font-size:' + (isCompact ? '10' : '11') + 'px;font-weight:800;color:#333;' +
          'background:rgba(255,255,255,0.9);padding:' + (isCompact ? '1px 5px' : '2px 6px') +
          ';border-radius:999px;flex:0 0 auto;';
        more.textContent = '+' + overflow;
        grp.appendChild(more);
      }
      el.appendChild(grp);
    });
  }

  // ★ 바닥 카드 자연 배치 — 덱(중앙) 주위로 골고루 분산. 카드 추가될수록 빈 공간 채움.
  function boardCardPosition(idx, total) {
    // 8방향 우선 배치 (덱 중앙 회피, 균등 분산)
    const layout = [
      { x: 50, y: 16 },   // 0  top-center
      { x: 50, y: 86 },   // 1  bottom-center
      { x: 15, y: 50 },   // 2  middle-left
      { x: 85, y: 50 },   // 3  middle-right
      { x: 22, y: 18 },   // 4  top-left
      { x: 78, y: 18 },   // 5  top-right
      { x: 22, y: 84 },   // 6  bottom-left
      { x: 78, y: 84 },   // 7  bottom-right
      // 9장+ 추가 자리 (대각 / 사이드 보강)
      { x: 30, y: 50 },   // 8  inner-left
      { x: 70, y: 50 },   // 9  inner-right
      { x: 38, y: 28 },   // 10 inner-top-left
      { x: 62, y: 28 },   // 11 inner-top-right
      { x: 38, y: 74 },   // 12 inner-bottom-left
      { x: 62, y: 74 },   // 13 inner-bottom-right
      { x: 8, y: 30 },    // 14 corner
      { x: 92, y: 30 },   // 15 corner
    ];
    return layout[idx % layout.length];
  }

  // ★ 손패 즉각 드래그 — 위로 빠지면 내기, 손패 영역 안에선 재정렬
  window.HAND_CUSTOM_ORDER = window.HAND_CUSTOM_ORDER || [];
  function handClearPrelift(exceptWrap) {
    const handEl = $('gameHand');
    if (!handEl) return;
    handEl.querySelectorAll('.hwa-card-wrap.is-hand-prelift').forEach(function (el) {
      if (el !== exceptWrap) el.classList.remove('is-hand-prelift');
    });
  }

  function onHandPlayTap(wrap, cardId) {
    if (!VIEW || VIEW.finished) return;
    if (VIEW.turn !== VIEW.myIndex || VIEW.phase !== 'play-hand') return;
    if (HAND_PRESELECT_ID === cardId) {
      HAND_PRESELECT_ID = null;
      wrap.classList.remove('is-hand-prelift');
      playCard(cardId);
    } else {
      handClearPrelift(wrap);
      HAND_PRESELECT_ID = cardId;
      wrap.classList.add('is-hand-prelift');
    }
  }

  function attachHandDragReorder(wrap, cardId) {
    let pid = null;
    let startX = 0, startY = 0;
    let dragging = false;
    let moved = false;
    let suppressClick = false;
    const DRAG_THRESHOLD = 4; // 4px 이상 움직이면 즉시 드래그 모드
    // click 가로채기 — 드래그 후 click 이벤트 무시
    wrap.addEventListener('click', function (e) {
      if (suppressClick) {
        e.stopPropagation(); e.preventDefault();
        suppressClick = false;
      }
    }, true);
    wrap.addEventListener('pointerdown', function (e) {
      if (e.button !== undefined && e.button !== 0) return;
      pid = e.pointerId;
      startX = e.clientX; startY = e.clientY;
      dragging = false;
      moved = false;
    });
    wrap.addEventListener('pointermove', function (e) {
      if (e.pointerId !== pid) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      if (!dragging && (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD)) {
        // 즉각 드래그 모드 진입
        dragging = true;
        moved = true;
        wrap.classList.add('is-handdrag');
        wrap.style.transition = 'none';
        wrap.style.zIndex = '10000';
        wrap.style.cursor = 'grabbing';
        try { wrap.setPointerCapture(pid); } catch {}
        if (navigator.vibrate) navigator.vibrate(10);
      }
      if (dragging) {
        e.preventDefault();
        moved = true;
        wrap.style.transform = 'translate(' + dx + 'px, ' + dy + 'px) scale(1.08)';
        wrap.style.boxShadow = '0 12px 28px rgba(0,0,0,0.4)';
      }
    });
    function tryPlay() {
      // 내 차례 + play-hand phase 일 때만 patch
      if (!VIEW || VIEW.finished) return;
      const isMyTurnNow = VIEW.turn === VIEW.myIndex;
      if (isMyTurnNow && VIEW.phase === 'play-hand' && typeof playCard === 'function') {
        playCard(cardId);
      }
    }
    function release(e) {
      if (e.pointerId !== pid) return;
      if (!dragging) {
        if (VIEW && VIEW.turn === VIEW.myIndex && VIEW.phase === 'play-hand') {
          onHandPlayTap(wrap, cardId);
        } else {
          tryPlay();
        }
        pid = null; return;
      }
      suppressClick = true; // 드래그 후 click 트리거 방지
      const handEl = $('gameHand');
      const handRect = handEl.getBoundingClientRect();
      const releasedY = e.clientY;
      // ★ Y축으로 손패 영역 위쪽으로 빠짐 → 패 내기
      const draggedAbove = releasedY < handRect.top - 8;
      if (draggedAbove) {
        HAND_PRESELECT_ID = null;
        handClearPrelift(null);
        // 카드 빠지는 시각 효과 + 패 내기
        wrap.style.transition = 'transform 0.25s ease, opacity 0.25s ease';
        wrap.style.transform = 'translate(' + (e.clientX - startX) + 'px, ' + (e.clientY - startY - 30) + 'px) scale(0.85)';
        wrap.style.opacity = '0.4';
        tryPlay();
      } else {
          // 영역 안 → 가장 가까운 카드 위치로 재정렬
          const allCards = Array.from(handEl.querySelectorAll('.hwa-card-wrap'));
          let nearest = null, minD = Infinity;
          allCards.forEach(function (other) {
            if (other === wrap) return;
            const r = other.getBoundingClientRect();
            const cx = r.left + r.width / 2;
            const cy = r.top + r.height / 2;
            const d = Math.hypot(e.clientX - cx, e.clientY - cy);
            if (d < minD) { minD = d; nearest = other; }
          });
          if (nearest && minD < 120) {
            const fromId = Number(wrap.dataset.cardId);
            const toId = Number(nearest.dataset.cardId);
            const curOrder = allCards.map(function (el) { return Number(el.dataset.cardId); });
            const fromIdx = curOrder.indexOf(fromId);
            const toIdx = curOrder.indexOf(toId);
            if (fromIdx >= 0 && toIdx >= 0 && fromIdx !== toIdx) {
              curOrder.splice(fromIdx, 1);
              curOrder.splice(toIdx, 0, fromId);
              window.HAND_CUSTOM_ORDER = curOrder;
              try { render(); } catch {}
            }
          }
          // 원위치로 부드럽게 복귀
          wrap.style.transition = 'transform 0.2s cubic-bezier(.34,1.56,.64,1), box-shadow 0.2s ease';
          wrap.style.transform = '';
          wrap.style.boxShadow = '';
        }
      // 클래스 / cursor 정리
      setTimeout(function () {
        wrap.style.zIndex = '';
        wrap.style.cursor = '';
        wrap.classList.remove('is-handdrag');
      }, 300);
      try { wrap.releasePointerCapture(pid); } catch {}
      pid = null;
      dragging = false;
      moved = false;
    }
    wrap.addEventListener('pointerup', release);
    wrap.addEventListener('pointercancel', release);
  }

  // 사용자 액션을 서버로 보낸 뒤 view 도착 전까지의 짧은 공백에 자동패가 발화하지 않도록
  // turn timer 를 즉시 정지 + autoPlayed 마킹. 다음 view 도착 시 startTurnTimer 가 reset.
  function pauseTurnTimerForAction() {
    stopTurnTimer();
    const el = $('turnTimer');
    if (el) el.dataset.autoPlayed = '1';
  }

  function playCard(cardId) {
    if (!VIEW) return;
    PENDING_HAND_CARD = cardId;
    pauseTurnTimerForAction();
    // 사용자 입력 즉시 confirm — 0 latency feedback (centerpiece 사운드는 275ms 후 발화)
    const SFX = window.GostopSFX ? window.GostopSFX.sfx : null;
    if (SFX) SFX.tap();
    socket().emit('game:play', { cardId: cardId }, function (res) {
      if (!res || !res.ok) showToast('⚠️ ' + (res && res.error || '못 냈어요'));
    });
  }

  function chooseMatch(matchCardId) {
    pauseTurnTimerForAction();
    const SFX = window.GostopSFX ? window.GostopSFX.sfx : null;
    if (SFX) SFX.tap();
    socket().emit('game:match', { matchCardId: matchCardId }, function (res) {
      if (!res || !res.ok) showToast('⚠️ ' + (res && res.error || '선택 실패'));
    });
  }

  $('btnFlip').addEventListener('click', function () {
    pauseTurnTimerForAction();
    socket().emit('game:flip', null, function (res) {
      if (!res || !res.ok) showToast('⚠️ ' + (res && res.error || '뒤집기 실패'));
    });
  });

  // 이모티콘 빠른 채팅
  (function setupEmojiBar() {
    const bar = document.querySelector('.g-emoji-bar');
    if (!bar) return;
    bar.addEventListener('click', function (e) {
      const btn = e.target.closest('.g-emoji-btn');
      if (!btn) return;
      const emoji = btn.dataset.e;
      btn.classList.add('is-sent');
      setTimeout(function () { btn.classList.remove('is-sent'); }, 400);
      const SFX = window.GostopSFX ? window.GostopSFX.sfx : null;
      if (SFX) SFX.emojiSend();
      socket().emit('chat:emoji', { emoji: emoji }, function (res) {
        if (!res || !res.ok) {} // 스팸이면 무시
      });
    });
  })();

  // 수신한 이모지를 해당 플레이어 박스 위에 말풍선으로 표시
  if (window.GostopSocket) {
    window.GostopSocket.on('chat:emoji', function (msg) {
      if (!VIEW) return;
      // userId 로 playerIdx 찾기
      const idx = VIEW.players.findIndex(function (p) { return p.userId === msg.userId; });
      if (idx < 0) return;
      const me = VIEW.myIndex;
      let anchor;
      if (idx === me) anchor = document.querySelector('.g-me-wrap') || document.querySelector('.g-me-meta');
      else anchor = document.querySelector('.g-opp[data-player-idx="' + idx + '"]');
      if (!anchor) return;
      const bubble = document.createElement('div');
      bubble.className = 'g-emoji-bubble';
      bubble.textContent = msg.emoji;
      anchor.appendChild(bubble);
      setTimeout(function () { bubble.remove(); }, 2400);
      // 수신 사운드 — 다른 사람이 보낸 것만 (내가 보낸 건 emojiSend 로 이미 처리)
      if (msg.userId !== (window.GostopMe && window.GostopMe.id)) {
        const SFX = window.GostopSFX ? window.GostopSFX.sfx : null;
        if (SFX) SFX.emojiReceive();
      }
    });
  }

  // ★ 첫 사용자 제스처에 AudioContext 깨우기 — 첫 사운드 지연 제거 (iOS 정책)
  (function warmupAudio() {
    if (!window.GostopSFX) return;
    const wake = function () {
      try { window.GostopSFX.ensure && window.GostopSFX.ensure(); } catch {}
      document.removeEventListener('pointerdown', wake, true);
      document.removeEventListener('touchstart', wake, true);
      document.removeEventListener('keydown', wake, true);
    };
    document.addEventListener('pointerdown', wake, true);
    document.addEventListener('touchstart', wake, true);
    document.addEventListener('keydown', wake, true);
  })();

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
      window.GostopSFX.ensure && window.GostopSFX.ensure();
      render();
      if (!window.GostopSFX.isMuted()) window.GostopSFX.sfx.myturn();
    });
  })();
  // 속도 토글 — 빠름/보통/느림 순환
  (function setupSpeed() {
    const btn = $('btnSpeed');
    if (!btn) return;
    btn.textContent = getSpeedLabel();
    btn.addEventListener('click', function () { cycleSpeed(); });
  })();
  $('btnGo').addEventListener('click', function () {
    pauseTurnTimerForAction();
    socket().emit('game:gostop', { choice: 'go' }, function () {});
  });
  $('btnStop').addEventListener('click', function () {
    pauseTurnTimerForAction();
    socket().emit('game:gostop', { choice: 'stop' }, function () {});
  });

  // 세로 모드 hint — 사용자가 닫으면 영구 기억
  (function setupPortraitHint() {
    const hint = $('portraitHint');
    const btn = $('btnPortraitHintClose');
    if (!hint || !btn) return;
    try {
      if (localStorage.getItem('gostop_portrait_hint_dismissed') === '1') {
        hint.classList.add('is-dismissed');
      }
    } catch {}
    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      hint.classList.add('is-dismissed');
      try { localStorage.setItem('gostop_portrait_hint_dismissed', '1'); } catch {}
    });
  })();

  function escapeHtml(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]; }); }

  window.GostopGame = { start: start, onView: onView };
})();
