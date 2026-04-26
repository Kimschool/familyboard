// ============================================================================
// 고스톱 AI — 휴리스틱 의사결정 (브라우저 / Node 양쪽 호환 UMD)
// - level: 1~20. 낮으면 랜덤 + 약한 휴리스틱, 높으면 결정론적 + 세트·고/스톱 EV
// - 모든 함수는 순수 (state/level → choice)
// ============================================================================
(function (global, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else global.GostopAI = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const GODORI = new Set(['매조 열끗', '흑싸리 열끗', '공산 열끗']);
  const HONGDAN = new Set(['송학 홍단', '벚꽃 홍단', '매조 홍단']);
  const CHEONGDAN = new Set(['모란 청단', '국화 청단', '단풍 청단']);
  const CHODAN = new Set(['흑싸리 초단', '난초 초단', '홍싸리 초단']);

  // 레벨별 의사결정 파라미터 (선형 보간, level 1~20)
  function paramsFor(level) {
    const t = Math.max(0, Math.min(1, (level - 1) / 19));
    return {
      // 랜덤성 — 낮은 레벨에서 약간의 무작위성 (가족이 이길 여지)
      randomness: 0.55 * (1 - t),
      // 매치 우선도 — 낮으면 가끔 매치 안 함, 높으면 항상 매치
      matchPriority: 0.3 + 0.7 * t,
      // 세트(광/단/고도리) 가중치
      setWeight: 0.2 + 1.4 * t,
      // 상대 견제 가중치 (상대가 거의 완성한 세트의 단서를 의도적으로 제거)
      defenseWeight: 0.0 + 1.0 * t,
      // 고/스톱 공격성 — 0:방어적(stop), 1:공격적(go)
      goAggression: 0.3 + 0.55 * t,
      // 사고 시간 (ms) — 높은 레벨일수록 잠시 더 길게 "깊이 생각"
      thinkMinMs: 500 + 700 * t,
      thinkMaxMs: 1100 + 1400 * t,
    };
  }

  function pickRandom(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

  function valueOfCard(c) {
    if (!c) return 0;
    // ★ DECK_SPEC 필드명은 type. (이전엔 c.kind 로 읽어 항상 1점으로 평가되던 버그)
    const t = c.type || c.kind;
    if (t === 'light') return 12;                  // 광
    if (GODORI.has(c.label)) return 10;            // 고도리 후보
    if (HONGDAN.has(c.label) || CHEONGDAN.has(c.label) || CHODAN.has(c.label)) return 8; // 단
    if (t === 'animal') return 5;                  // 일반 열끗
    if (t === 'ribbon') return 4;                  // 일반 띠
    if (t === 'junk') return c.doubleJunk ? 2 : 1; // 피
    return 1;
  }

  function setProgressOf(captured) {
    const labels = function (arr) { return new Set(arr.map(function (c) { return c.label; })); };
    const a = labels(captured.animal || []);
    const r = labels(captured.ribbon || []);
    const setNeed = function (S, set) {
      let have = 0;
      S.forEach(function (l) { if (set.has(l)) have += 1; });
      return have;
    };
    return {
      light: (captured.light || []).length,
      godori: setNeed(GODORI, a),
      hongdan: setNeed(HONGDAN, r),
      cheongdan: setNeed(CHEONGDAN, r),
      chodan: setNeed(CHODAN, r),
      junk: (captured.junk || []).reduce(function (n, c) { return n + (c.doubleJunk ? 2 : 1); }, 0),
    };
  }

  function setBonusOnCapture(card, capturedAfter) {
    // 잡으면 어떤 세트가 진전되는가 — 진전도가 클수록 가치 ↑
    if (!card) return 0;
    let bonus = 0;
    const ct = card.type || card.kind;
    if (ct === 'light') bonus += 6;
    if (GODORI.has(card.label)) {
      const before = setProgressOf({ animal: capturedAfter.animal.filter(function (c) { return c.id !== card.id; }), ribbon: [], light: [], junk: [] }).godori;
      const after = setProgressOf(capturedAfter).godori;
      bonus += (after - before) * 6 + (after === 3 ? 8 : 0);
    }
    [HONGDAN, CHEONGDAN, CHODAN].forEach(function (S) {
      if (S.has(card.label)) {
        const beforeR = capturedAfter.ribbon.filter(function (c) { return c.id !== card.id; });
        const before = setProgressOf({ ribbon: beforeR, animal: [], light: [], junk: [] });
        const after = setProgressOf(capturedAfter);
        const beforeKey = (S === HONGDAN ? before.hongdan : S === CHEONGDAN ? before.cheongdan : before.chodan);
        const afterKey = (S === HONGDAN ? after.hongdan : S === CHEONGDAN ? after.cheongdan : after.chodan);
        bonus += (afterKey - beforeKey) * 4 + (afterKey === 3 ? 6 : 0);
      }
    });
    return bonus;
  }

  // 손패 한 장을 낼 때 그 카드의 가치 (높을수록 먼저 내고 싶다)
  function scoreHandPlay(state, playerIdx, card, p) {
    const board = state.board;
    const myCap = state.captured[playerIdx];
    const matches = board.filter(function (b) { return b.month === card.month; });
    let score = 0;
    if (matches.length > 0) {
      // 매치되면 잡을 수 있음 — 잡힐 카드의 가치 + 내가 낸 카드도 같이 잡혀서 좋음
      const captureTargets = matches.slice(0, 1); // 매치 1장만 잡힘
      const allCaught = captureTargets.concat([card]);
      const setBonus = allCaught.reduce(function (sum, c) {
        const futureCap = mergeCap(myCap, c);
        return sum + setBonusOnCapture(c, futureCap);
      }, 0);
      score += p.matchPriority * 25;
      score += allCaught.reduce(function (sum, c) { return sum + valueOfCard(c); }, 0);
      score += p.setWeight * setBonus;
      // 같은 달이 board 에 2장 있으면 한 장 골라 먹기 (선택권 있음 = 좋음)
      if (matches.length === 2) score += 6;
      // 같은 달 3장 board 면 손에서 같은 달 내면 싹쓸이 (= 뻑 먹기) → 매우 좋음
      if (matches.length >= 3) score += 18;
    } else {
      // 매치 없음 — 그냥 버려야 함. 낮은 가치(피) 부터 버리는 게 좋음.
      score -= valueOfCard(card);
      // 상대에게 매치 단서 제공? — 지금 board 에 같은 달이 0장이고 상대가 같은 달 잡고 싶을 가능성
      score -= p.defenseWeight * 1.0;
    }
    return score;
  }

  function mergeCap(cap, card) {
    const ct = card.type || card.kind;
    const k = ct === 'light' ? 'light' :
              ct === 'animal' ? 'animal' :
              ct === 'ribbon' ? 'ribbon' : 'junk';
    const next = {
      light: (cap.light || []).slice(),
      animal: (cap.animal || []).slice(),
      ribbon: (cap.ribbon || []).slice(),
      junk: (cap.junk || []).slice(),
    };
    next[k].push(card);
    return next;
  }

  // ===== 의사결정 함수들 =====
  function decideHandPlay(state, playerIdx, level) {
    const p = paramsFor(level);
    const hand = state.hands[playerIdx];
    if (!hand || !hand.length) return null;
    if (Math.random() < p.randomness * 0.6) return pickRandom(hand).id;
    const scored = hand.map(function (c) { return { id: c.id, score: scoreHandPlay(state, playerIdx, c, p) }; });
    scored.sort(function (a, b) { return b.score - a.score; });
    // 상위 2개 중에서 약간의 무작위성
    if (scored.length >= 2 && Math.random() < p.randomness * 0.4) return scored[1].id;
    return scored[0].id;
  }

  // 같은 달 board 카드가 여럿일 때 어느 것을 잡을지
  function decideMatchChoice(state, playerIdx, candidateIds, level) {
    const p = paramsFor(level);
    if (!candidateIds || !candidateIds.length) return null;
    if (Math.random() < p.randomness * 0.5) return pickRandom(candidateIds);
    // candidateIds 는 board 에서의 cardId — 가치 가장 높은 것 선택
    const board = state.board;
    const myCap = state.captured[playerIdx];
    const list = candidateIds.map(function (id) {
      const c = board.find(function (b) { return b.id === id; });
      if (!c) return { id: id, v: -1 };
      const futureCap = mergeCap(myCap, c);
      const setB = setBonusOnCapture(c, futureCap);
      return { id: id, v: valueOfCard(c) + p.setWeight * setB };
    });
    list.sort(function (a, b) { return b.v - a.v; });
    return list[0].id;
  }

  // 고/스톱 결정. choice: 'go' | 'stop'
  function decideGoStop(state, playerIdx, level) {
    const p = paramsFor(level);
    const myScore = state.scores[playerIdx] || 0;
    const winMin = state.winScoreMin || 3;
    const goCount = state.goCounts[playerIdx] || 0;
    // 이미 고 1번 했으면 스톱 임계 ↑ (배수 매력)
    const margin = myScore - winMin; // 0 이상이면 스톱 가능
    // 손에 남은 카드 수 — 적으면 스톱 (남은 턴 적어 추가 점수 확률 ↓)
    const remainingTurns = (state.hands[playerIdx] || []).length;

    // 기대값: go 했을 때 추가로 1~2점 더 모을 가능성 vs 상대가 먼저 winMin 도달할 위험
    // 단순 휴리스틱:
    let goPower = p.goAggression
      + 0.05 * remainingTurns
      - 0.05 * goCount
      - 0.10 * Math.max(0, margin); // 점수 많이 벌면 stop 유도

    // 고도리/단 직전(2/3)이면 1턴 더 노릴 가치
    const cap = state.captured[playerIdx];
    const sp = setProgressOf(cap);
    if (sp.godori === 2 || sp.hongdan === 2 || sp.cheongdan === 2 || sp.chodan === 2) goPower += 0.25;
    if (sp.light === 2 || sp.light === 3 || sp.light === 4) goPower += 0.15;

    // 약간 무작위성
    goPower += (Math.random() - 0.5) * 0.2 * (p.randomness + 0.5);
    return goPower > 0.5 ? 'go' : 'stop';
  }

  // "사고 시간" — 봇 차례에 너무 빠르게 응답하지 않도록
  function thinkDelay(level) {
    const p = paramsFor(level);
    return Math.round(p.thinkMinMs + Math.random() * (p.thinkMaxMs - p.thinkMinMs));
  }

  // ── 신규 룰: 흔들기 결정 ──
  // 표준 휴리스틱: 같은 달 3장 중 광/단/열끗 비중이 높으면 적극 흔들기.
  // 레벨 높을수록 위험 보상 평가 정밀화.
  function decideShake(state, playerIdx, level) {
    const p = paramsFor(level);
    const sa = state.shakeAvailable;
    if (!sa || sa.playerIdx !== playerIdx) return false;
    const hand = state.hands[playerIdx] || [];
    // sa.months 중 어느 한 달이라도 점수 가능성이 높으면 accept
    let bestVal = 0;
    sa.months.forEach(function (m) {
      const trio = hand.filter(function (c) { return c.month === m; });
      const v = trio.reduce(function (s, c) { return s + valueOfCard(c); }, 0);
      if (v > bestVal) bestVal = v;
    });
    // 평균 trio 가치 ≥ 4 (피만 3장이면 3, 광·단 섞이면 12+) — 임계 보정
    const threshold = 6 - 2 * (paramsFor(level).goAggression - 0.3); // level 높을수록 적극
    // randomness 가미
    const accept = bestVal >= threshold || Math.random() < p.randomness * 0.3;
    return !!accept;
  }

  // ── 신규 룰: 폭탄 결정 ──
  // 폭탄 가능 옵션 중 어느 달이 valuable 한지 평가.
  // 반환: month (number) 또는 null.
  function decideBomb(state, playerIdx, level) {
    const p = paramsFor(level);
    const opts = state.bombOptions || [];
    if (!opts.length) return null;
    const hand = state.hands[playerIdx] || [];
    // 손패 잉여 + 그 달 4장 묶음 가치 평가
    let best = null;
    opts.forEach(function (m) {
      const trio = hand.filter(function (c) { return c.month === m; });
      const boardOne = state.board.filter(function (b) { return b.month === m; });
      const all = trio.concat(boardOne);
      const v = all.reduce(function (s, c) { return s + valueOfCard(c); }, 0);
      // 점수 ×2 보너스 가치까지 더해 적극 평가 (현재 score 가 낮으면 폭탄 가치↑)
      const myScore = state.scores[playerIdx] || 0;
      const score = v + 8 + p.setWeight * 4 + (myScore >= 1 ? myScore * 2 : 0);
      if (!best || score > best.score) best = { month: m, score: score };
    });
    if (!best) return null;
    // randomness 약간 — 낮은 레벨은 가끔 안 함
    if (Math.random() < p.randomness * 0.4) return null;
    return best.month;
  }

  // 봇 닉네임 — 레벨별 분위기
  function botNameFor(level) {
    if (level <= 3)  return '🐣 새내기 봇 Lv.' + level;
    if (level <= 7)  return '🤖 입문 봇 Lv.' + level;
    if (level <= 11) return '🎴 노련한 봇 Lv.' + level;
    if (level <= 15) return '🔥 고수 봇 Lv.' + level;
    if (level <= 18) return '👹 명인 봇 Lv.' + level;
    return '💀 마왕 Lv.' + level;
  }

  return {
    paramsFor: paramsFor,
    decideHandPlay: decideHandPlay,
    decideMatchChoice: decideMatchChoice,
    decideGoStop: decideGoStop,
    decideShake: decideShake,
    decideBomb: decideBomb,
    thinkDelay: thinkDelay,
    botNameFor: botNameFor,
  };
});
