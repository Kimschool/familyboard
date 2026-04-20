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

    return {
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
      goCounts: new Array(playerCount).fill(0),  // 플레이어별 '고' 누적 횟수
      finished: false,
      winner: null,
    };
  }

  function findMatches(board, card) {
    return board.filter(function (b) { return b.month === card.month; });
  }

  function calculateScore(captured) {
    let score = 0;
    const lightCount = captured.light.length;
    if (lightCount === 5) score += 15;
    else if (lightCount >= 3) score += lightCount;

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

  function cloneState(s) { return JSON.parse(JSON.stringify(s)); }

  function appendLog(state, msg) {
    state.log.push({ ts: Date.now(), msg: msg });
    if (state.log.length > 100) state.log.shift();
  }

  function addCaptured(state, playerIdx, card) {
    state.captured[playerIdx][card.type].push(card);
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
      appendLog(s, s.players[playerIdx].name + '님: ' + card.label + ' 로 ' + m.label + ' 을 먹었어요');
    } else if (matches.length === 2) {
      // 뻑! — 3장 모두 바닥에 놓고, 뻑 그룹으로 마킹
      hand.splice(idx, 1);
      s.board.push(card);
      s.bbukGroups = s.bbukGroups || [];
      s.bbukGroups.push({ month: card.month, ownerIdx: playerIdx });
      appendLog(s, '뻑! ' + s.players[playerIdx].name + '님 ' + card.month + '월 뻑');
      s.phase = 'flip-stock';
      return { state: s, bbuk: true };
    } else {
      // 3장 이상 매칭 — 뻑 그룹이 있다는 뜻. 모두 먹기
      hand.splice(idx, 1);
      matches.forEach(function (m) {
        s.board = s.board.filter(function (b) { return b.id !== m.id; });
        addCaptured(s, playerIdx, m);
      });
      addCaptured(s, playerIdx, card);
      s.bbukGroups = (s.bbukGroups || []).filter(function (g) { return g.month !== card.month; });
      appendLog(s, '뻑 먹기! ' + s.players[playerIdx].name + '님 ' + card.month + '월 싹쓸이');
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

    if (matches.length === 0) {
      s.board.push(flipped);
      appendLog(s, '뒤집기: ' + flipped.label + ' — 바닥으로');
    } else if (matches.length === 1) {
      const m = matches[0];
      s.board = s.board.filter(function (b) { return b.id !== m.id; });
      addCaptured(s, playerIdx, flipped);
      addCaptured(s, playerIdx, m);
      appendLog(s, '뒤집기: ' + flipped.label + ' 로 ' + m.label + ' 을 먹었어요');
    } else if (matches.length >= 3) {
      // 뻑 그룹을 뒤집어서 걸림 — 모두 먹기
      matches.forEach(function (m) {
        s.board = s.board.filter(function (b) { return b.id !== m.id; });
        addCaptured(s, playerIdx, m);
      });
      addCaptured(s, playerIdx, flipped);
      s.bbukGroups = (s.bbukGroups || []).filter(function (g) { return g.month !== flipped.month; });
      appendLog(s, '뒤집어서 뻑 먹기! ' + s.players[playerIdx].name + '님 ' + flipped.month + '월 싹쓸이');
      return afterFlip(s);
    } else {
      if (!matchCardId) {
        s.phase = 'choose-flip-match';
        s.pending = { flipped: flipped, choices: matches.map(function (m) { return m.id; }) };
        return { state: s, needsMatchChoice: true, choices: matches.map(function (m) { return m.id; }) };
      }
      const chosen = matches.find(function (m) { return m.id === matchCardId; });
      if (!chosen) throw new Error('invalid match choice');
      s.board = s.board.filter(function (b) { return b.id !== chosen.id; });
      addCaptured(s, playerIdx, flipped);
      addCaptured(s, playerIdx, chosen);
      appendLog(s, '뒤집기: ' + flipped.label + ' 로 ' + chosen.label + ' 을 먹었어요');
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
    appendLog(s, '뒤집기: ' + p.flipped.label + ' 로 ' + chosen.label + ' 을 먹었어요');
    s.pending = null;
    return afterFlip(s);
  }

  function afterFlip(s) {
    const score = calculateScore(s.captured[s.turn]);
    s.scores[s.turn] = score;
    if (score >= 3) {
      s.phase = 'choose-go-stop';
      appendLog(s, s.players[s.turn].name + '님: ' + score + '점 — 고? 스톱?');
      return { state: s, needsGoStop: true };
    }
    return endTurn(s);
  }

  function endTurn(s) {
    s.turn = (s.turn + 1) % s.playerCount;
    s.phase = 'play-hand';
    if (s.hands.every(function (h) { return h.length === 0; })) {
      s.finished = true;
      const maxScore = Math.max.apply(null, s.scores);
      const winners = s.scores.map(function (v, i) { return v === maxScore ? i : -1; }).filter(function (i) { return i >= 0; });
      s.winner = winners.length === 1 ? winners[0] : null;
      appendLog(s, maxScore === 0 ? '무승부' : ((s.players[s.winner] && s.players[s.winner].name) || '무승부') + ' 승리');
    }
    return { state: s };
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
      const mult = Math.pow(2, goN); // 고 1회=2배, 2회=4배, 3회=8배
      const baseScore = s.scores[playerIdx];
      s.scores[playerIdx] = baseScore * mult;
      const tag = goN >= 1 ? ' (' + goN + '고 ×' + mult + ')' : '';
      appendLog(s, s.players[playerIdx].name + '님 스톱! ' + s.scores[playerIdx] + '점' + tag + ' 승리');
      return { state: s };
    }
    s.goCounts[playerIdx] = (s.goCounts[playerIdx] || 0) + 1;
    const n = s.goCounts[playerIdx];
    appendLog(s, s.players[playerIdx].name + '님 ' + n + '고! 계속 진행합니다');
    return endTurn(s);
  }

  function viewFor(state, playerIdx) {
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
      goCounts: state.goCounts || new Array(state.playerCount).fill(0),
    };
  }

  return {
    buildDeck: buildDeck,
    shuffle: shuffle,
    createGame: createGame,
    findMatches: findMatches,
    calculateScore: calculateScore,
    playHandCard: playHandCard,
    resolveHandMatch: resolveHandMatch,
    flipStock: flipStock,
    resolveFlipMatch: resolveFlipMatch,
    callGoStop: callGoStop,
    viewFor: viewFor,
  };
});
