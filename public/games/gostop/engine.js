// ============================================================================
// 고스톱 엔진 — 브라우저 / Node 양쪽 호환 (UMD 패턴)
// - 순수 로직 · DOM 비의존 · 결정론적
// - Browser: window.GostopEngine 로 노출
// - Node: module.exports 로 내보내 require 가능
// ============================================================================
(function (global, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else global.GostopEngine = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const DECK_SPEC = [
    [1, 'light', false, '송학 광'],
    [1, 'ribbon', false, '송학 홍단'],
    [1, 'junk', false, '송학 피'],
    [1, 'junk', false, '송학 피'],
    [2, 'animal', false, '매조 열끗'],
    [2, 'ribbon', false, '매조 홍단'],
    [2, 'junk', false, '매조 피'],
    [2, 'junk', false, '매조 피'],
    [3, 'light', false, '벚꽃 광'],
    [3, 'ribbon', false, '벚꽃 홍단'],
    [3, 'junk', false, '벚꽃 피'],
    [3, 'junk', false, '벚꽃 피'],
    [4, 'animal', false, '흑싸리 열끗'],
    [4, 'ribbon', false, '흑싸리 초단'],
    [4, 'junk', false, '흑싸리 피'],
    [4, 'junk', false, '흑싸리 피'],
    [5, 'animal', false, '난초 열끗'],
    [5, 'ribbon', false, '난초 초단'],
    [5, 'junk', false, '난초 피'],
    [5, 'junk', false, '난초 피'],
    [6, 'animal', false, '모란 열끗'],
    [6, 'ribbon', false, '모란 청단'],
    [6, 'junk', false, '모란 피'],
    [6, 'junk', false, '모란 피'],
    [7, 'animal', false, '홍싸리 열끗'],
    [7, 'ribbon', false, '홍싸리 초단'],
    [7, 'junk', false, '홍싸리 피'],
    [7, 'junk', false, '홍싸리 피'],
    [8, 'light', false, '공산 광'],
    [8, 'animal', false, '공산 열끗'],
    [8, 'junk', false, '공산 피'],
    [8, 'junk', false, '공산 피'],
    [9, 'animal', false, '국화 열끗'],
    [9, 'ribbon', false, '국화 청단'],
    [9, 'junk', true, '국화 쌍피'],
    [9, 'junk', false, '국화 피'],
    [10, 'animal', false, '단풍 열끗'],
    [10, 'ribbon', false, '단풍 청단'],
    [10, 'junk', false, '단풍 피'],
    [10, 'junk', false, '단풍 피'],
    [11, 'light', false, '오동 광'],
    [11, 'junk', true, '오동 쌍피'],
    [11, 'junk', false, '오동 피'],
    [11, 'junk', false, '오동 피'],
    [12, 'light', false, '비광'],
    [12, 'animal', false, '비 열끗'],
    [12, 'ribbon', false, '비 띠'],
    [12, 'junk', false, '비 피'],
  ];

  function buildDeck() {
    return DECK_SPEC.map(function (row, i) {
      return { id: i + 1, month: row[0], type: row[1], doubleJunk: row[2], label: row[3] };
    });
  }

  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) | 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function shuffle(arr, seed) {
    const a = arr.slice();
    const rand = mulberry32(seed);
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      const tmp = a[i]; a[i] = a[j]; a[j] = tmp;
    }
    return a;
  }

  function createGame(opts) {
    const players = opts.players;
    const playerCount = opts.playerCount;
    const seed = opts.seed || Date.now();
    const rules = opts.rules || {};
    const winScoreMin = [3, 5, 7].indexOf(Number(rules.winScoreMin)) >= 0 ? Number(rules.winScoreMin) : 3;
    if ([2, 3, 4].indexOf(playerCount) < 0) throw new Error('playerCount must be 2, 3, or 4');
    if (players.length < playerCount) throw new Error('not enough players');

    const deck = shuffle(buildDeck(), seed);
    const hands = [];
    for (let i = 0; i < playerCount; i++) hands.push([]);
    const board = [];

    let handSize, floorSize;
    if (playerCount === 2) { handSize = 10; floorSize = 8; }
    else if (playerCount === 3) { handSize = 7; floorSize = 6; }
    else { handSize = 6; floorSize = 4; }

    let idx = 0;
    for (let i = 0; i < handSize; i++) {
      for (let p = 0; p < playerCount; p++) hands[p].push(deck[idx++]);
    }
    for (let i = 0; i < floorSize; i++) board.push(deck[idx++]);
    const stock = deck.slice(idx);

    const captured = [];
    for (let i = 0; i < playerCount; i++) captured.push({ light: [], animal: [], ribbon: [], junk: [] });

    const bonuses = [];
    for (let i = 0; i < playerCount; i++) bonuses.push({ shake: 0, jaBbuk: 0, bomb: 0 });

    const initState = {
      seed: seed,
      playerCount: playerCount,
      players: players.slice(0, playerCount),
      hands: hands,
      board: board,
      stock: stock,
      captured: captured,
      turn: 0,
      phase: 'play-hand',
      pending: null,
      log: [{ ts: Date.now(), msg: '게임 시작' }],
      scores: new Array(playerCount).fill(0),
      goCounts: new Array(playerCount).fill(0),
      winScoreMin: winScoreMin,
      finished: false,
      winner: null,
      // ── 신규 룰셋 ──
      bbukGroups: [],          // [{month, ownerIdx}]
      bombMarkers: [],         // 보드에 놓인 폭탄 마커: [{month, ownerIdx, count}]
      bonuses: bonuses,        // 각 플레이어별 점수 곱셈 보너스
      events: [],              // {type:'shake'|'bomb'|'ttadak'|'jaBbuk'|'bbukMeok'|'sseul', ...}
      sseulBonusPoint: !!(opts.rules && opts.rules.sseulBonusPoint), // 옵션
      shakeAvailable: null,    // {playerIdx, month} - declare-shake 진입 조건
    };
    // 첫 턴 시작 시 흔들기 가능 검사 (각 플레이어 1회만)
    initState._shakeChecked = {};
    initState._shakeChecked[0] = true;
    const sa = computeShakeAvailability(initState, 0);
    if (sa) {
      initState.phase = 'declare-shake';
      initState.shakeAvailable = sa;
    }
    return initState;
  }

  // ── 신규 룰: 흔들기 가능 검사 ──
  // 같은 달 카드 3장을 손에 보유 시 (단 4장이면 폭탄으로 분류 → 흔들기 X 권장; 표준은 둘 다 가능하나 일관 단순화)
  function computeShakeAvailability(state, playerIdx) {
    const hand = state.hands[playerIdx] || [];
    const byMonth = {};
    hand.forEach(function (c) { byMonth[c.month] = (byMonth[c.month] || 0) + 1; });
    const months = Object.keys(byMonth).filter(function (m) { return byMonth[m] === 3; }).map(Number);
    if (!months.length) return null;
    return { playerIdx: playerIdx, months: months };
  }

  // ── 신규 룰: 폭탄 가능 검사 ──
  // 손패에 같은 달 3장 + 보드에 같은 달 1장
  function computeBombOptions(state, playerIdx) {
    const hand = state.hands[playerIdx] || [];
    const byMonth = {};
    hand.forEach(function (c) { byMonth[c.month] = (byMonth[c.month] || 0) + 1; });
    const opts = [];
    Object.keys(byMonth).forEach(function (mStr) {
      const m = Number(mStr);
      if (byMonth[m] !== 3) return;
      const onBoard = state.board.filter(function (b) { return b.month === m; }).length;
      if (onBoard === 1) opts.push(m);
    });
    return opts;
  }

  function findMatches(board, card) {
    return board.filter(function (b) { return b.month === card.month; });
  }

  function calculateScore(captured) {
    let score = 0;
    const lightCount = captured.light.length;
    // 비광 (12월 광) 포함 여부
    const hasRainLight = captured.light.some(function (c) { return c.month === 12; });
    if (lightCount === 5) score += 15;
    else if (lightCount === 4) score += 4;
    else if (lightCount === 3) score += hasRainLight ? 2 : 3; // 비광 포함 3광 = 2점

    // 고도리 — 매조+흑싸리+공산 열끗 세트 = 5점 보너스
    const animalLabels = captured.animal.map(function (c) { return c.label; });
    const godori = ['매조 열끗', '흑싸리 열끗', '공산 열끗'].every(function (l) { return animalLabels.indexOf(l) >= 0; });
    if (godori) score += 5;

    const animalCount = captured.animal.length;
    if (animalCount >= 5) score += (animalCount - 4);

    const ribbonLabels = captured.ribbon.map(function (c) { return c.label; });
    let ribbonScore = 0;
    if (['송학 홍단', '벚꽃 홍단', '매조 홍단'].every(function (l) { return ribbonLabels.indexOf(l) >= 0; })) ribbonScore += 3;
    if (['모란 청단', '국화 청단', '단풍 청단'].every(function (l) { return ribbonLabels.indexOf(l) >= 0; })) ribbonScore += 3;
    if (['흑싸리 초단', '난초 초단', '홍싸리 초단'].every(function (l) { return ribbonLabels.indexOf(l) >= 0; })) ribbonScore += 3;
    if (captured.ribbon.length >= 5) ribbonScore += (captured.ribbon.length - 4);
    score += ribbonScore;

    const junkCount = captured.junk.reduce(function (n, c) { return n + (c.doubleJunk ? 2 : 1); }, 0);
    if (junkCount >= 10) score += (junkCount - 9);

    return score;
  }

  // 점수 브레이크다운 — 클라에서 설명용
  function scoreBreakdown(captured) {
    const parts = [];
    let total = 0;
    const push = function (label, pts, pending) {
      parts.push({ label: label, pts: pts, pending: pending || '' });
      if (pts > 0) total += pts;
    };
    const cap = captured || { light: [], animal: [], ribbon: [], junk: [] };

    // 광
    const lc = cap.light.length;
    const hasRain = cap.light.some(function (c) { return c.month === 12; });
    if (lc === 5) push('광 5장', 15);
    else if (lc === 4) push('광 4장', 4);
    else if (lc === 3) push(hasRain ? '광 3장 (비광 포함)' : '광 3장', hasRain ? 2 : 3);
    else if (lc > 0) push('광 ' + lc + '장', 0, (3 - lc) + '장 더');
    else push('광 0장', 0, '3장부터 득점');

    // 고도리
    const alab = cap.animal.map(function (c) { return c.label; });
    const godori = ['매조 열끗', '흑싸리 열끗', '공산 열끗'].filter(function (l) { return alab.indexOf(l) >= 0; }).length;
    if (godori === 3) push('고도리 (3/3)', 5);
    else if (godori > 0) push('고도리 ' + godori + '/3', 0, (3 - godori) + '장 더');

    // 열끗
    const ac = cap.animal.length;
    if (ac >= 5) push('열끗 ' + ac + '장', ac - 4);

    // 단 세트
    const rlab = cap.ribbon.map(function (c) { return c.label; });
    const hd = ['송학 홍단', '벚꽃 홍단', '매조 홍단'].filter(function (l) { return rlab.indexOf(l) >= 0; }).length;
    const cd = ['모란 청단', '국화 청단', '단풍 청단'].filter(function (l) { return rlab.indexOf(l) >= 0; }).length;
    const chod = ['흑싸리 초단', '난초 초단', '홍싸리 초단'].filter(function (l) { return rlab.indexOf(l) >= 0; }).length;
    if (hd === 3) push('홍단 (3/3)', 3);
    else if (hd > 0) push('홍단 ' + hd + '/3', 0, (3 - hd) + '장 더');
    if (cd === 3) push('청단 (3/3)', 3);
    else if (cd > 0) push('청단 ' + cd + '/3', 0, (3 - cd) + '장 더');
    if (chod === 3) push('초단 (3/3)', 3);
    else if (chod > 0) push('초단 ' + chod + '/3', 0, (3 - chod) + '장 더');

    // 띠 (5장 이상)
    const rc = cap.ribbon.length;
    if (rc >= 5) push('띠 ' + rc + '장', rc - 4);

    // 피
    const jc = cap.junk.reduce(function (n, c) { return n + (c.doubleJunk ? 2 : 1); }, 0);
    if (jc >= 10) push('피 ' + jc + '장', jc - 9);
    else if (jc > 0) push('피 ' + jc + '장', 0, (10 - jc) + '장 더');

    return { parts: parts, total: total };
  }

  function cloneState(s) { return JSON.parse(JSON.stringify(s)); }

  function appendLog(state, msg) {
    state.log.push({ ts: Date.now(), msg: msg });
    if (state.log.length > 100) state.log.shift();
  }

  function addCaptured(state, playerIdx, card) {
    state.captured[playerIdx][card.type].push(card);
  }

  function pushEvent(state, ev) {
    if (!state.events) state.events = [];
    state.events.push(Object.assign({ ts: Date.now() }, ev));
    if (state.events.length > 200) state.events.shift();
  }

  // 피 1장 갈취: opponent → playerIdx. 가장 가치 낮은 피(단피) 우선.
  // 갈취 못 하면(상대 피 없음) noop.
  function stealOnePi(state, playerIdx, opponentIdx) {
    const opCap = state.captured[opponentIdx];
    if (!opCap || !opCap.junk || !opCap.junk.length) return null;
    // 단피(doubleJunk=false) 우선
    let idx = opCap.junk.findIndex(function (c) { return !c.doubleJunk; });
    if (idx < 0) idx = 0;
    const stolen = opCap.junk.splice(idx, 1)[0];
    state.captured[playerIdx].junk.push(stolen);
    return stolen;
  }

  // 보드 0장 검사 → 쓸. 자기 차례에 보드를 0장으로 만들면 다른 플레이어 모두에게서 피 1장씩 갈취.
  // sseulBonusPoint 옵션 켜면 +1점도 가산 (현재 곱셈에는 영향 없음 — score는 calculateScore에서 자동).
  function checkAndApplySseul(state, playerIdx) {
    if (state.board.length !== 0) return false;
    let stoleAny = false;
    for (let i = 0; i < state.playerCount; i++) {
      if (i === playerIdx) continue;
      const c = stealOnePi(state, playerIdx, i);
      if (c) stoleAny = true;
    }
    if (stoleAny) {
      pushEvent(state, { type: 'sseul', playerIdx: playerIdx });
      appendLog(state, '쓸! ' + state.players[playerIdx].name + '님 보드 싹쓸이 — 피 1장씩 갈취');
    }
    return true;
  }

  // 매치된 보드 카드들이 뻑 그룹이었는지 검사 → 자뻑 / 뻑먹기 처리
  // matchedMonth: 이번에 회수된 달
  // pre 단계에서 호출: bbukGroups 에서 month 매치 항목을 읽고 owner 판정
  function applyBbukConsume(state, playerIdx, month) {
    if (!state.bbukGroups) return;
    const group = state.bbukGroups.find(function (g) { return g.month === month; });
    if (!group) return;
    if (group.ownerIdx === playerIdx) {
      // 자뻑: 본인이 만든 뻑을 본인이 먹음
      state.bonuses[playerIdx].jaBbuk = (state.bonuses[playerIdx].jaBbuk || 0) + 1;
      // 자뻑은 다른 플레이어들에게서 피 1장씩 갈취 (표준)
      for (let i = 0; i < state.playerCount; i++) {
        if (i === playerIdx) continue;
        stealOnePi(state, playerIdx, i);
      }
      pushEvent(state, { type: 'jaBbuk', playerIdx: playerIdx, month: month });
      appendLog(state, '자뻑! ' + state.players[playerIdx].name + '님 ' + month + '월 — 피 갈취 + 점수 ×2');
    } else {
      // 뻑먹기: 상대가 만든 뻑을 먹음 → owner 에게서 피 1장 갈취 (점수 곱셈 없음 — 사양)
      stealOnePi(state, playerIdx, group.ownerIdx);
      pushEvent(state, { type: 'bbukMeok', playerIdx: playerIdx, opponentIdx: group.ownerIdx, month: month });
      appendLog(state, '뻑 먹기! ' + state.players[playerIdx].name + '님이 ' + state.players[group.ownerIdx].name + '님 뻑(' + month + '월)을 먹음 — 피 갈취');
    }
    state.bbukGroups = state.bbukGroups.filter(function (g) { return g.month !== month; });
  }

  // ── 신규 룰: 흔들기 선언 ──
  function declareShake(state, playerIdx, accept) {
    if (state.phase !== 'declare-shake') throw new Error('not in declare-shake');
    if (state.turn !== playerIdx) throw new Error('not your turn');
    const s = cloneState(state);
    if (accept) {
      s.bonuses[playerIdx].shake = (s.bonuses[playerIdx].shake || 0) + 1;
      pushEvent(s, { type: 'shake', playerIdx: playerIdx, months: (s.shakeAvailable && s.shakeAvailable.months) || [] });
      appendLog(s, '흔들기! ' + s.players[playerIdx].name + '님 — 점수 ×2');
    }
    s.shakeAvailable = null;
    s.phase = 'play-hand';
    return { state: s };
  }

  // ── 신규 룰: 폭탄 ──
  // 손패 같은 달 3장 + 보드 같은 달 1장 → 4장 모두 capture + 폭탄 마커 1장 보드에 놓기.
  // 다음 본인 턴에 마커가 다시 손으로 돌아옴(자동) — 표준 변형 채택.
  // 결정 사유: "마커 즉시 재플레이"는 연쇄 폭탄으로 deadlock 가능성, "다음 턴 손 복귀"가
  // 더 안전하고 표준 한국 룰에 가까움.
  function playBomb(state, playerIdx, month) {
    if (state.finished) throw new Error('game finished');
    if (state.turn !== playerIdx) throw new Error('not your turn');
    if (state.phase !== 'play-hand') throw new Error('not play-hand phase');
    const opts = computeBombOptions(state, playerIdx);
    if (opts.indexOf(Number(month)) < 0) throw new Error('bomb not available for month ' + month);
    const s = cloneState(state);
    const m = Number(month);
    const hand = s.hands[playerIdx];
    // 손에서 같은 달 3장
    const handCards = hand.filter(function (c) { return c.month === m; });
    if (handCards.length !== 3) throw new Error('hand needs exactly 3 of month');
    // 보드에서 같은 달 1장
    const boardCards = s.board.filter(function (b) { return b.month === m; });
    if (boardCards.length !== 1) throw new Error('board needs exactly 1 of month');
    // 자뻑/뻑먹기 가능성도 적용 (보드 1장이 뻑 그룹의 일부라면 거의 없지만, 일관 처리)
    applyBbukConsume(s, playerIdx, m);
    // 4장 모두 본인 capture
    handCards.forEach(function (c) { addCaptured(s, playerIdx, c); });
    boardCards.forEach(function (c) { addCaptured(s, playerIdx, c); });
    s.hands[playerIdx] = hand.filter(function (c) { return c.month !== m; });
    s.board = s.board.filter(function (b) { return b.month !== m; });
    // 폭탄 마커: 다음 본인 턴에 손으로 복귀할 1장. id는 음수로 충돌 회피.
    const markerId = -1000 - (s.bombMarkers ? s.bombMarkers.length : 0) - 1;
    const marker = { id: markerId, month: 0, type: 'junk', doubleJunk: false, label: '폭탄', _bombMarker: true, ownerIdx: playerIdx };
    s.board.push(marker);
    s.bombMarkers = (s.bombMarkers || []).concat([{ id: markerId, ownerIdx: playerIdx }]);
    s.bonuses[playerIdx].bomb = (s.bonuses[playerIdx].bomb || 0) + 1;
    pushEvent(s, { type: 'bomb', playerIdx: playerIdx, month: m });
    appendLog(s, '폭탄! ' + s.players[playerIdx].name + '님 ' + m + '월 4장 — 점수 ×2');
    // 보드가 비어 쓸이 발생할 수 있으나, 폭탄 마커가 항상 남으므로 board.length>=1 보장 → 쓸 X
    s.phase = 'flip-stock';
    return { state: s };
  }

  function playHandCard(state, playerIdx, cardId, matchCardId) {
    matchCardId = matchCardId || null;
    if (state.finished) throw new Error('game finished');
    if (state.turn !== playerIdx) throw new Error('not your turn');
    if (state.phase !== 'play-hand') throw new Error('not play-hand phase');

    const s = cloneState(state);
    const hand = s.hands[playerIdx];
    const idx = hand.findIndex(function (c) { return c.id === cardId; });
    if (idx < 0) throw new Error('card not in hand');
    const card = hand[idx];
    const matches = s.board.filter(function (b) { return b.month === card.month; });
    s.bbukGroups = s.bbukGroups || [];
    const isBbukMonth = s.bbukGroups.some(function (g) { return g.month === card.month; });

    if (matches.length === 0) {
      hand.splice(idx, 1);
      s.board.push(card);
      appendLog(s, s.players[playerIdx].name + '님: ' + card.label + ' 를 바닥에 냈어요');
    } else if (matches.length === 1) {
      hand.splice(idx, 1);
      const m = matches[0];
      s.board = s.board.filter(function (b) { return b.id !== m.id; });
      addCaptured(s, playerIdx, card);
      addCaptured(s, playerIdx, m);
      // 자뻑/뻑먹기 처리: 한 장 남은 뻑(이미 그룹 해제 직전)을 먹은 경우
      if (isBbukMonth) applyBbukConsume(s, playerIdx, card.month);
      // 매치 후 stock 카드와 따닥 가능성 — flip 단계에서 검출
      s.lastPlayHand = { playerIdx: playerIdx, month: card.month, capturedCount: 2 };
      appendLog(s, s.players[playerIdx].name + '님: ' + card.label + ' 로 ' + m.label + ' 을 먹었어요');
    } else if (matches.length === 2) {
      // ★ 표준 룰: 보드에 같은 달이 2장 있으면 사용자가 한 장을 선택해서 먹음 (뻑 X).
      // 뻑은 "뒤집기로 새 카드가 떨어졌는데 보드에 같은 달 1장이 있어 한 쌍을 못 먹는 상황" 에서 발생.
      // 따라서 2장 매치는 choose-hand-match 단계로 진입.
      // 단, 이미 같은 달 뻑 그룹이 있다면 (= 보드 2장 모두 뻑) 즉시 싹쓸이.
      if (isBbukMonth) {
        hand.splice(idx, 1);
        matches.forEach(function (m) {
          s.board = s.board.filter(function (b) { return b.id !== m.id; });
          addCaptured(s, playerIdx, m);
        });
        addCaptured(s, playerIdx, card);
        applyBbukConsume(s, playerIdx, card.month);
        appendLog(s, '뻑 먹기! ' + s.players[playerIdx].name + '님 ' + card.month + '월 싹쓸이');
        s.lastPlayHand = { playerIdx: playerIdx, month: card.month, capturedCount: matches.length + 1 };
        s.phase = 'flip-stock';
        return { state: s, bbukCleared: true };
      }
      // matchCardId 가 미리 주어졌으면 즉시 처리 (옵션)
      if (matchCardId) {
        const chosen = matches.find(function (m) { return m.id === matchCardId; });
        if (!chosen) throw new Error('invalid match choice');
        hand.splice(idx, 1);
        s.board = s.board.filter(function (b) { return b.id !== chosen.id; });
        addCaptured(s, playerIdx, card);
        addCaptured(s, playerIdx, chosen);
        appendLog(s, s.players[playerIdx].name + '님: ' + card.label + ' 로 ' + chosen.label + ' 을 먹었어요');
        s.lastPlayHand = { playerIdx: playerIdx, month: card.month, capturedCount: 2 };
        s.phase = 'flip-stock';
        return { state: s };
      }
      // 사용자 선택 단계로 진입
      s.phase = 'choose-hand-match';
      s.pending = {
        cardId: card.id,
        playerIdx: playerIdx,
        choices: matches.map(function (m) { return m.id; }),
      };
      return { state: s, needsMatchChoice: true, choices: matches.map(function (m) { return m.id; }) };
    } else {
      // 3장 이상 매칭 — 뻑 그룹이 있다는 뜻. 모두 먹기 (싹쓸이)
      hand.splice(idx, 1);
      matches.forEach(function (m) {
        s.board = s.board.filter(function (b) { return b.id !== m.id; });
        addCaptured(s, playerIdx, m);
      });
      addCaptured(s, playerIdx, card);
      applyBbukConsume(s, playerIdx, card.month);
      appendLog(s, '뻑 먹기! ' + s.players[playerIdx].name + '님 ' + card.month + '월 싹쓸이');
      s.lastPlayHand = { playerIdx: playerIdx, month: card.month, capturedCount: matches.length + 1 };
      s.phase = 'flip-stock';
      return { state: s, bbukCleared: true };
    }

    s.phase = 'flip-stock';
    return { state: s };
  }

  function resolveHandMatch(state, matchCardId) {
    if (state.phase !== 'choose-hand-match') throw new Error('not in choose-hand-match');
    const s = cloneState(state);
    const p = s.pending;
    const hand = s.hands[s.turn];
    const idx = hand.findIndex(function (c) { return c.id === p.cardId; });
    if (idx < 0) throw new Error('card not in hand');
    const card = hand[idx];
    const chosen = s.board.find(function (b) { return b.id === matchCardId && b.month === card.month; });
    if (!chosen) throw new Error('invalid match choice');
    hand.splice(idx, 1);
    s.board = s.board.filter(function (b) { return b.id !== chosen.id; });
    addCaptured(s, s.turn, card);
    addCaptured(s, s.turn, chosen);
    appendLog(s, s.players[s.turn].name + '님: ' + card.label + ' 로 ' + chosen.label + ' 을 먹었어요');
    s.lastPlayHand = { playerIdx: s.turn, month: card.month, capturedCount: 2 };
    s.pending = null;
    s.phase = 'flip-stock';
    return { state: s };
  }

  function flipStock(state, matchCardId) {
    matchCardId = matchCardId || null;
    if (state.finished) throw new Error('game finished');
    if (state.phase !== 'flip-stock') throw new Error('not flip-stock phase');
    const s = cloneState(state);
    if (!s.stock.length) return endTurn(s);
    const flipped = s.stock.shift();
    const matches = s.board.filter(function (b) { return b.month === flipped.month; });
    const playerIdx = s.turn;
    s.bbukGroups = s.bbukGroups || [];
    const isBbukMonth = s.bbukGroups.some(function (g) { return g.month === flipped.month; });

    if (matches.length === 0) {
      s.board.push(flipped);
      appendLog(s, '뒤집기: ' + flipped.label + ' — 바닥으로');
    } else if (matches.length === 1) {
      const m = matches[0];
      s.board = s.board.filter(function (b) { return b.id !== m.id; });
      addCaptured(s, playerIdx, flipped);
      addCaptured(s, playerIdx, m);
      // 뻑 한 장 남은 상황을 뒤집기로 잡으면 자뻑/뻑먹기 처리
      if (isBbukMonth) applyBbukConsume(s, playerIdx, flipped.month);
      // ── 따닥 검출 ── 직전 손패 매치와 같은 달 + 본인 + 매치 형태였다면 따닥
      if (s.lastPlayHand && s.lastPlayHand.playerIdx === playerIdx && s.lastPlayHand.month === flipped.month) {
        // 따닥 — 피 1장 갈취 (다음 상대부터 순회)
        for (let i = 1; i < s.playerCount; i++) {
          const target = (playerIdx + i) % s.playerCount;
          const stolen = stealOnePi(s, playerIdx, target);
          if (stolen) break;
        }
        pushEvent(s, { type: 'ttadak', playerIdx: playerIdx, month: flipped.month });
        appendLog(s, '따닥! ' + s.players[playerIdx].name + '님 ' + flipped.month + '월 — 피 1장 갈취');
      }
      appendLog(s, '뒤집기: ' + flipped.label + ' 로 ' + m.label + ' 을 먹었어요');
    } else if (matches.length === 2) {
      // ★ 표준 룰: 보드에 같은 달이 2장(직전에 손에서 낸 카드 포함) 있으면 → 뻑 발생.
      //   3장 모두 바닥에 남고, owner = 현재 턴 플레이어.
      //   단 이미 같은 달 뻑 그룹이면 (2장 뻑 + 1장 새로) 싹쓸이.
      if (isBbukMonth) {
        matches.forEach(function (m) {
          s.board = s.board.filter(function (b) { return b.id !== m.id; });
          addCaptured(s, playerIdx, m);
        });
        addCaptured(s, playerIdx, flipped);
        applyBbukConsume(s, playerIdx, flipped.month);
        appendLog(s, '뒤집어서 뻑 먹기! ' + s.players[playerIdx].name + '님 ' + flipped.month + '월 싹쓸이');
        return afterFlip(s);
      }
      s.board.push(flipped);
      s.bbukGroups.push({ month: flipped.month, ownerIdx: playerIdx });
      appendLog(s, '뻑! ' + s.players[playerIdx].name + '님 ' + flipped.month + '월 뻑');
      // 뻑 발생 시 추가 점수/플레이는 없음 — 그대로 턴 종료(점수 변동 없으므로 endTurn).
      return endTurn(s);
    } else if (matches.length >= 3) {
      // 보드에 같은 달 3장 (= 뻑 그룹). 뒤집어서 걸림 — 모두 먹기 (싹쓸이).
      matches.forEach(function (m) {
        s.board = s.board.filter(function (b) { return b.id !== m.id; });
        addCaptured(s, playerIdx, m);
      });
      addCaptured(s, playerIdx, flipped);
      applyBbukConsume(s, playerIdx, flipped.month);
      appendLog(s, '뒤집어서 뻑 먹기! ' + s.players[playerIdx].name + '님 ' + flipped.month + '월 싹쓸이');
      return afterFlip(s);
    }

    return afterFlip(s);
  }

  function resolveFlipMatch(state, matchCardId) {
    if (state.phase !== 'choose-flip-match') throw new Error('not in choose-flip-match');
    const s = cloneState(state);
    const p = s.pending;
    const chosen = s.board.find(function (b) { return b.id === matchCardId && b.month === p.flipped.month; });
    if (!chosen) throw new Error('invalid match choice');
    s.board = s.board.filter(function (b) { return b.id !== chosen.id; });
    addCaptured(s, s.turn, p.flipped);
    addCaptured(s, s.turn, chosen);
    // 따닥 검출 — flip이 같은 달인데 직전 손패도 같은 달이었음
    if (s.lastPlayHand && s.lastPlayHand.playerIdx === s.turn && s.lastPlayHand.month === p.flipped.month) {
      for (let i = 1; i < s.playerCount; i++) {
        const target = (s.turn + i) % s.playerCount;
        const stolen = stealOnePi(s, s.turn, target);
        if (stolen) break;
      }
      pushEvent(s, { type: 'ttadak', playerIdx: s.turn, month: p.flipped.month });
      appendLog(s, '따닥! ' + s.players[s.turn].name + '님 ' + p.flipped.month + '월 — 피 1장 갈취');
    }
    appendLog(s, '뒤집기: ' + p.flipped.label + ' 로 ' + chosen.label + ' 을 먹었어요');
    s.pending = null;
    return afterFlip(s);
  }

  function afterFlip(s) {
    // 쓸 검사 — 보드가 0장이면 (단, 폭탄 마커는 보드에 살아있으므로 자연 회피됨)
    checkAndApplySseul(s, s.turn);
    // 점수 계산 (라운드 점수 곱셈은 callGoStop에서 적용)
    const score = computeFinalScore(s, s.turn).total;
    s.scores[s.turn] = score;
    const threshold = s.winScoreMin || 3;
    if (score >= threshold) {
      s.phase = 'choose-go-stop';
      appendLog(s, s.players[s.turn].name + '님: ' + score + '점 — 고? 스톱?');
      return { state: s, needsGoStop: true };
    }
    return endTurn(s);
  }

  // 신규: 흔들기/자뻑/폭탄 곱셈 적용된 라운드 점수
  // 최종 = 기본 × 흔들기 × 자뻑 × 폭탄 × GO곱(3고+) × 박곱(광/피/멍)
  // (GO곱·박곱은 callGoStop에서 추가 적용. 여기선 화면 표시용 base × 룰곱.)
  function computeFinalScore(state, playerIdx) {
    const base = calculateScore(state.captured[playerIdx]);
    const b = (state.bonuses && state.bonuses[playerIdx]) || { shake: 0, jaBbuk: 0, bomb: 0 };
    const shakeMult = Math.pow(2, b.shake || 0);
    const jaBbukMult = Math.pow(2, b.jaBbuk || 0);
    const bombMult = Math.pow(2, b.bomb || 0);
    const ruleMult = shakeMult * jaBbukMult * bombMult;
    return { base: base, total: base * ruleMult, ruleMult: ruleMult, shakeMult: shakeMult, jaBbukMult: jaBbukMult, bombMult: bombMult };
  }

  function endTurn(s) {
    s.turn = (s.turn + 1) % s.playerCount;
    s.phase = 'play-hand';
    s.lastPlayHand = null;
    // 폭탄 마커 회수 — 다음 본인 턴에 손으로 복귀
    if (s.bombMarkers && s.bombMarkers.length) {
      const nextActor = s.turn;
      const remaining = [];
      s.bombMarkers.forEach(function (mk) {
        if (mk.ownerIdx === nextActor) {
          // 보드에서 마커 제거 후 손에 추가 (손에 보충 — 일반 카드처럼)
          const idxOnBoard = s.board.findIndex(function (b) { return b.id === mk.id; });
          if (idxOnBoard >= 0) {
            s.board.splice(idxOnBoard, 1);
            // 마커는 더 이상 카드로 안 쓰임 — 손 길이만 정상화 위해 보충은 생략 (이미 카운트는 맞음)
            // 실제 카드는 이미 capture에 들어갔으므로, 손 보충은 필요 없음.
            // → 즉 마커는 그냥 보드에서 사라짐 (다음 턴 무손실 회수)
          }
        } else {
          remaining.push(mk);
        }
      });
      s.bombMarkers = remaining;
    }
    // 다음 플레이어 흔들기 가능 검사 — 단, 본인이 처음 카드 내기 전(첫 본인 턴)에 한 번만
    s.shakeAvailable = null;
    if (!s._shakeChecked) s._shakeChecked = {};
    if (!s._shakeChecked[s.turn]) {
      s._shakeChecked[s.turn] = true;
      const sa = computeShakeAvailability(s, s.turn);
      if (sa) {
        s.phase = 'declare-shake';
        s.shakeAvailable = sa;
      }
    }
    // 종료 조건: (1) 모두 손패 비었거나 (2) stock 도 비었고 어느 한 명이라도 손패 비었음 (= 더 이상 진행 불가)
    const allHandsEmpty = s.hands.every(function (h) { return h.length === 0; });
    const someHandsEmpty = s.hands.some(function (h) { return h.length === 0; });
    if (allHandsEmpty || (s.stock.length === 0 && someHandsEmpty)) {
      s.finished = true;
      const maxScore = Math.max.apply(null, s.scores);
      // winScoreMin 미달이면 무승부 처리 (점수 안 나서 스톱 못 함 = 모두 패)
      if (maxScore < (s.winScoreMin || 3)) {
        s.winner = null;
        appendLog(s, '점수 미달 — 무승부');
      } else {
        const winners = s.scores.map(function (v, i) { return v === maxScore ? i : -1; }).filter(function (i) { return i >= 0; });
        s.winner = winners.length === 1 ? winners[0] : null;
        const wname = (s.winner != null && s.players[s.winner]) ? s.players[s.winner].name : null;
        appendLog(s, wname ? (wname + ' 승리') : '무승부');
      }
    }
    return { state: s };
  }

  // 박 판정 — 승자 vs 패자 1명의 multiplier (× 2 stacking)
  // 표준 한국 룰:
  //   광박: 승자가 광 점수를 받는 상태(3광+) AND 패자 광 0장
  //   피박: 승자가 피 점수를 받는 상태(피 10+) AND 패자 피 < 7장(피점수 0)
  //   멍박: 승자가 열끗 점수를 받는 상태(열끗 5+) AND 패자 열끗 < 5장(열끗점수 0)
  function bakMultiplier(winnerCap, loserCap) {
    let mult = 1;
    const flags = [];
    const junkCount = function (pile) {
      return pile.reduce(function (n, c) { return n + (c.doubleJunk ? 2 : 1); }, 0);
    };
    const winJunk = junkCount(winnerCap.junk);
    const loseJunk = junkCount(loserCap.junk);
    if (winnerCap.light.length >= 3 && loserCap.light.length === 0) { mult *= 2; flags.push('광박'); }
    if (winnerCap.animal.length >= 5 && loserCap.animal.length < 5) { mult *= 2; flags.push('멍박'); }
    if (winJunk >= 10 && loseJunk < 7) { mult *= 2; flags.push('피박'); }
    return { mult: mult, flags: flags };
  }

  // GO 가산 — 표준 한국 룰
  //   1고: +1점
  //   2고: +1점 (총 +2)
  //   3고+: 매고마다 ×2 (3고=×2, 4고=×4, ...)
  //   합계 = (baseScore + goAddition) × goMultiplier
  function goBonus(goN) {
    if (goN <= 0) return { add: 0, mult: 1 };
    if (goN === 1) return { add: 1, mult: 1 };
    if (goN === 2) return { add: 2, mult: 1 };
    return { add: 2, mult: Math.pow(2, goN - 2) };
  }

  function callGoStop(state, playerIdx, choice) {
    if (state.phase !== 'choose-go-stop') throw new Error('not in go-stop phase');
    if (state.turn !== playerIdx) throw new Error('not your turn');
    const s = cloneState(state);
    if (!s.goCounts) s.goCounts = new Array(s.playerCount).fill(0);
    if (choice === 'stop') {
      s.finished = true;
      s.winner = playerIdx;
      const goN = s.goCounts[playerIdx] || 0;
      const gb = goBonus(goN);
      // 최종 = 기본 × 흔들기 × 자뻑 × 폭탄 × GO곱(3고+) × 박곱(광/피/멍)
      const fs = computeFinalScore(s, playerIdx);
      const baseScore = fs.total; // 흔들기·자뻑·폭탄 곱셈 이미 적용
      const adjusted = (baseScore + gb.add) * gb.mult;
      // 각 패자별 박 multiplier 계산 · 합산 (인원 ≥ 3인 경우 합산식)
      let total = 0;
      const bakFlagsAll = [];
      for (let i = 0; i < s.playerCount; i++) {
        if (i === playerIdx) continue;
        const bak = bakMultiplier(s.captured[playerIdx], s.captured[i]);
        const pay = adjusted * bak.mult;
        total += pay;
        if (bak.flags.length) bakFlagsAll.push(s.players[i].name + ': ' + bak.flags.join(', '));
      }
      s.scores[playerIdx] = total;
      s.bakFlags = bakFlagsAll;
      let tag = '';
      if (fs.ruleMult > 1) {
        const parts = [];
        if (fs.shakeMult > 1) parts.push('흔들기×' + fs.shakeMult);
        if (fs.jaBbukMult > 1) parts.push('자뻑×' + fs.jaBbukMult);
        if (fs.bombMult > 1) parts.push('폭탄×' + fs.bombMult);
        tag += ' [' + parts.join(' ') + ']';
      }
      if (goN >= 1) tag += ' ' + goN + '고(+' + gb.add + (gb.mult > 1 ? ' ×' + gb.mult : '') + ')';
      if (bakFlagsAll.length) tag += ' [' + bakFlagsAll.join(' / ') + ']';
      appendLog(s, s.players[playerIdx].name + '님 스톱! ' + total + '점' + tag + ' 승리');
      return { state: s };
    }
    s.goCounts[playerIdx] = (s.goCounts[playerIdx] || 0) + 1;
    const n = s.goCounts[playerIdx];
    appendLog(s, s.players[playerIdx].name + '님 ' + n + '고! 계속 진행합니다');
    return endTurn(s);
  }

  function viewFor(state, playerIdx) {
    // 폭탄 가능 옵션 — 본인 손패 기준
    const bombOpts = (state.phase === 'play-hand' && state.turn === playerIdx)
      ? computeBombOptions(state, playerIdx) : [];
    return {
      seed: state.seed,
      playerCount: state.playerCount,
      players: state.players,
      myIndex: playerIdx,
      myHand: state.hands[playerIdx] || [],
      opponentHandCounts: state.hands.map(function (h, i) { return i === playerIdx ? null : h.length; }),
      board: state.board,
      stockCount: state.stock.length,
      captured: state.captured,
      scores: state.scores,
      turn: state.turn,
      phase: state.phase,
      pending: state.pending,
      finished: state.finished,
      winner: state.winner,
      log: state.log.slice(-10),
      bbukGroups: state.bbukGroups || [],
      bombMarkers: state.bombMarkers || [],
      goCounts: state.goCounts || new Array(state.playerCount).fill(0),
      bakFlags: state.bakFlags || [],
      winScoreMin: state.winScoreMin || 3,
      // ── 신규 룰 노출 ──
      bonuses: state.bonuses || [],
      events: (state.events || []).slice(-20),
      shakeAvailable: state.shakeAvailable || null,
      bombOptions: bombOpts,
    };
  }

  return {
    buildDeck: buildDeck,
    shuffle: shuffle,
    createGame: createGame,
    findMatches: findMatches,
    calculateScore: calculateScore,
    scoreBreakdown: scoreBreakdown,
    playHandCard: playHandCard,
    resolveHandMatch: resolveHandMatch,
    flipStock: flipStock,
    resolveFlipMatch: resolveFlipMatch,
    callGoStop: callGoStop,
    viewFor: viewFor,
    // 신규 룰 API
    declareShake: declareShake,
    playBomb: playBomb,
    computeShakeAvailability: computeShakeAvailability,
    computeBombOptions: computeBombOptions,
    computeFinalScore: computeFinalScore,
  };
});
