// ============================================================================
// 고스톱 엔진 (순수 로직 · DOM 비의존 · 결정론적)
// - 네이티브 이식 시 그대로 재사용 가능
// - 모든 상태는 plain object — 서버/클라이언트에서 동일 실행 가능
// ============================================================================

// ------- 화투 48장 덱 구성 -------
// type: 'light'(광), 'animal'(열끗), 'ribbon'(띠), 'junk'(피)
// doubleJunk: 쌍피 여부 (계산 시 2장으로 카운트)
const DECK_SPEC = [
  // [month, type, doubleJunk, label]
  [1,  'light',   false, '송학 광'],
  [1,  'ribbon',  false, '송학 홍단'],
  [1,  'junk',    false, '송학 피'],
  [1,  'junk',    false, '송학 피'],

  [2,  'animal',  false, '매조 열끗'],
  [2,  'ribbon',  false, '매조 홍단'],
  [2,  'junk',    false, '매조 피'],
  [2,  'junk',    false, '매조 피'],

  [3,  'light',   false, '벚꽃 광'],
  [3,  'ribbon',  false, '벚꽃 홍단'],
  [3,  'junk',    false, '벚꽃 피'],
  [3,  'junk',    false, '벚꽃 피'],

  [4,  'animal',  false, '흑싸리 열끗'],
  [4,  'ribbon',  false, '흑싸리 초단'],
  [4,  'junk',    false, '흑싸리 피'],
  [4,  'junk',    false, '흑싸리 피'],

  [5,  'animal',  false, '난초 열끗'],
  [5,  'ribbon',  false, '난초 초단'],
  [5,  'junk',    false, '난초 피'],
  [5,  'junk',    false, '난초 피'],

  [6,  'animal',  false, '모란 열끗'],
  [6,  'ribbon',  false, '모란 청단'],
  [6,  'junk',    false, '모란 피'],
  [6,  'junk',    false, '모란 피'],

  [7,  'animal',  false, '홍싸리 열끗'],
  [7,  'ribbon',  false, '홍싸리 초단'],
  [7,  'junk',    false, '홍싸리 피'],
  [7,  'junk',    false, '홍싸리 피'],

  [8,  'light',   false, '공산 광'],
  [8,  'animal',  false, '공산 열끗'],
  [8,  'junk',    false, '공산 피'],
  [8,  'junk',    false, '공산 피'],

  [9,  'animal',  false, '국화 열끗'],
  [9,  'ribbon',  false, '국화 청단'],
  [9,  'junk',    true,  '국화 쌍피'],
  [9,  'junk',    false, '국화 피'],

  [10, 'animal',  false, '단풍 열끗'],
  [10, 'ribbon',  false, '단풍 청단'],
  [10, 'junk',    false, '단풍 피'],
  [10, 'junk',    false, '단풍 피'],

  [11, 'light',   false, '오동 광'],
  [11, 'junk',    true,  '오동 쌍피'],
  [11, 'junk',    false, '오동 피'],
  [11, 'junk',    false, '오동 피'],

  [12, 'light',   false, '비광'],
  [12, 'animal',  false, '비 열끗'],
  [12, 'ribbon',  false, '비 띠'],
  [12, 'junk',    false, '비 피'],
];

export function buildDeck() {
  return DECK_SPEC.map(([month, type, doubleJunk, label], i) => ({
    id: i + 1,
    month,
    type,
    doubleJunk,
    label,
  }));
}

// ------- 결정론적 셔플 (시드 기반 — 서버·클라 같은 결과) -------
// Fisher-Yates with mulberry32 PRNG
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

export function shuffle(arr, seed) {
  const a = arr.slice();
  const rand = mulberry32(seed);
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ------- 새 게임 초기화 -------
// players: [{ id, name, icon, photoUrl }]
// playerCount: 2|3|4
// seed: 선택(없으면 Date.now())
export function createGame({ players, playerCount, seed = Date.now() }) {
  if (![2, 3, 4].includes(playerCount)) throw new Error('playerCount must be 2, 3, or 4');
  if (players.length < playerCount) throw new Error('not enough players');

  const deck = shuffle(buildDeck(), seed);
  const hands = Array.from({ length: playerCount }, () => []);
  const board = [];

  // 분배 규칙:
  //  2인 맞고: 각 10장, 바닥 8장, 덱 20장
  //  3인 고스톱: 각 7장, 바닥 6장, 덱 21장 (광팔이 고려 안 함 MVP)
  //  4인 고스톱: 각 6장, 바닥 4장, 덱 20장 (단순화, 한 명은 쉬는 형태)
  let handSize, floorSize;
  if (playerCount === 2) { handSize = 10; floorSize = 8; }
  else if (playerCount === 3) { handSize = 7; floorSize = 6; }
  else { handSize = 6; floorSize = 4; }

  // 바닥 4장씩 교차 배분 (전통 방식) — MVP 는 그냥 순서대로 나눠줌
  let idx = 0;
  for (let i = 0; i < handSize; i++) {
    for (let p = 0; p < playerCount; p++) hands[p].push(deck[idx++]);
  }
  for (let i = 0; i < floorSize; i++) board.push(deck[idx++]);
  const stock = deck.slice(idx);

  return {
    seed,
    playerCount,
    players: players.slice(0, playerCount),
    hands,
    board,
    stock,
    captured: Array.from({ length: playerCount }, () => ({
      light: [], animal: [], ribbon: [], junk: [],
    })),
    turn: 0,                // 0-indexed
    phase: 'play-hand',     // 'play-hand' → 'flip-stock' → 'resolve' → next turn
    pending: null,          // 임시: 뒤집은 카드 / 매칭 후보
    log: [{ ts: Date.now(), msg: '게임 시작' }],
    scores: Array.from({ length: playerCount }, () => 0),
    finished: false,
    winner: null,
  };
}

// ------- 같은 달 카드 매칭 검색 -------
export function findMatches(board, card) {
  return board.filter((b) => b.month === card.month);
}

// ------- 점수 계산 (기본 룰 MVP) -------
// 광점: 광 3장 3점, 4장 4점, 5장 15점 (비광 포함 4장 → 3점 인정 규칙은 MVP 제외)
// 열끗: 5장부터 1점 (+1장당 +1)
// 띠: 홍단/초단/청단 각 3점, 5장부터 1점 (+1장당 +1)
// 피: 10장부터 1점 (+1장당 +1). 쌍피는 2장으로 카운트
export function calculateScore(captured) {
  let score = 0;
  const lightCount = captured.light.length;
  if (lightCount === 5) score += 15;
  else if (lightCount >= 3) score += lightCount;

  const animalCount = captured.animal.length;
  if (animalCount >= 5) score += (animalCount - 4);

  // 띠 — 홍단/초단/청단 세트 체크 (간이)
  const ribbonLabels = captured.ribbon.map((c) => c.label);
  const hasHongdan = ribbonLabels.some((l) => l.includes('홍단'));
  const hasCheongdan = ribbonLabels.some((l) => l.includes('청단'));
  const hasChodan = ribbonLabels.some((l) => l.includes('초단'));
  let ribbonScore = 0;
  if (hasHongdan && ['송학 홍단', '벚꽃 홍단', '매조 홍단'].every((l) => ribbonLabels.includes(l))) ribbonScore += 3;
  if (hasCheongdan && ['모란 청단', '국화 청단', '단풍 청단'].every((l) => ribbonLabels.includes(l))) ribbonScore += 3;
  if (hasChodan && ['흑싸리 초단', '난초 초단', '홍싸리 초단'].every((l) => ribbonLabels.includes(l))) ribbonScore += 3;
  if (captured.ribbon.length >= 5) ribbonScore += (captured.ribbon.length - 4);
  score += ribbonScore;

  const junkCount = captured.junk.reduce((n, c) => n + (c.doubleJunk ? 2 : 1), 0);
  if (junkCount >= 10) score += (junkCount - 9);

  return score;
}

// ============================================================================
// 앞으로 구현 (다음 라운드):
// - playHandCard(state, playerIdx, cardId, floorCardId?) → state'
// - flipStock(state) → state'
// - resolvePhase(state, choice?) → state'  (뻑·따닥·쓸 등)
// - callGoOrStop(state, playerIdx, choice) → state'
// ============================================================================
