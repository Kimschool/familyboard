/* eslint-disable no-console */
// ============================================================================
// 고스톱 시뮬레이션 — 봇 vs 봇으로 한 판 끝까지 돌려 deadlock / 상태 머신 무결성 확인
//   실행: node public/games/gostop/__tests__/sim.test.js
//   여러 seed 로 반복해 모든 phase 가 정상 종료되는지 검증
//   + 신규 룰 (흔들기/폭탄/따닥/자뻑/뻑먹기/쓸) 발생 빈도 통계 출력
// ============================================================================
const path = require('path');
const engine = require(path.join(__dirname, '..', 'engine.js'));
const ai = require(path.join(__dirname, '..', 'ai.js'));

function runOnce(seed, ruleEvents) {
  const players = [{ userId: 1, name: 'A' }, { userId: 2, name: 'B' }];
  let state = engine.createGame({ players, playerCount: 2, seed });
  let safeguard = 800;
  while (!state.finished && safeguard-- > 0) {
    let r;
    const phase = state.phase;
    const actor = (state.pending && state.pending.playerIdx != null) ? state.pending.playerIdx : state.turn;
    // 신규 phase: declare-shake — 봇은 decideShake 로 결정
    if (phase === 'declare-shake') {
      const accept = ai.decideShake(state, actor, 12);
      r = engine.declareShake(state, actor, accept);
      state = r.state;
      continue;
    }
    if (phase === 'play-hand') {
      // 폭탄 가능하면 우선 검토 (확률적으로 폭탄)
      const opts = engine.computeBombOptions(state, actor);
      if (opts.length) {
        // ai.decideBomb는 state.bombOptions 를 본다 — sim에선 직접 주입
        const sWithOpts = Object.assign({}, state, { bombOptions: opts });
        const bombMonth = ai.decideBomb(sWithOpts, actor, 12);
        if (bombMonth != null) {
          r = engine.playBomb(state, actor, bombMonth);
          state = r.state;
          continue;
        }
      }
      const cardId = ai.decideHandPlay(state, actor, 10);
      if (cardId == null) throw new Error('seed=' + seed + ' play-hand: no cardId');
      r = engine.playHandCard(state, actor, cardId, null);
    } else if (phase === 'choose-hand-match') {
      const choices = state.pending.choices;
      const pick = ai.decideMatchChoice(state, actor, choices, 10);
      r = engine.resolveHandMatch(state, pick);
    } else if (phase === 'flip-stock') {
      r = engine.flipStock(state, null);
    } else if (phase === 'choose-flip-match') {
      const choices = state.pending.choices;
      const pick = ai.decideMatchChoice(state, actor, choices, 10);
      r = engine.resolveFlipMatch(state, pick);
    } else if (phase === 'choose-go-stop') {
      // 항상 stop 으로 빠른 종료 보장
      r = engine.callGoStop(state, actor, 'stop');
    } else {
      throw new Error('seed=' + seed + ' unknown phase: ' + phase);
    }
    state = r.state;
  }
  if (safeguard <= 0) throw new Error('seed=' + seed + ' DEADLOCK at phase=' + state.phase);
  // 룰 이벤트 누적
  (state.events || []).forEach(function (ev) {
    ruleEvents[ev.type] = (ruleEvents[ev.type] || 0) + 1;
  });
  return state;
}

let pass = 0, fail = 0;
const results = { wins: [0, 0], draws: 0, totalScore: [0, 0] };
const ruleEvents = {};
for (let seed = 1; seed <= 30; seed++) {
  try {
    const final = runOnce(seed, ruleEvents);
    if (!final.finished) throw new Error('seed=' + seed + ' not finished');
    if (final.winner == null) results.draws++;
    else results.wins[final.winner]++;
    results.totalScore[0] += final.scores[0] || 0;
    results.totalScore[1] += final.scores[1] || 0;
    pass++;
  } catch (e) {
    console.log('  FAIL seed=' + seed, e.message);
    fail++;
  }
}

console.log('\n========================================');
console.log(`30판 시뮬레이션`);
console.log(`  성공: ${pass}  실패: ${fail}`);
console.log(`  A 승: ${results.wins[0]}  B 승: ${results.wins[1]}  무: ${results.draws}`);
console.log(`  평균 점수: A=${(results.totalScore[0]/30).toFixed(1)} B=${(results.totalScore[1]/30).toFixed(1)}`);
console.log('  ── 신규 룰 발생 빈도 ──');
const keys = ['shake', 'bomb', 'ttadak', 'jaBbuk', 'bbukMeok', 'sseul'];
keys.forEach(function (k) {
  console.log('    ' + k.padEnd(10) + ': ' + (ruleEvents[k] || 0) + '회');
});
console.log('========================================');
process.exit(fail > 0 ? 1 : 0);
