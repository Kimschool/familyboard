# 고스톱 플레이테스트 이슈 정리 (R24 / v85)

> "한 명이 실제로 한 판 끝까지 플레이하면서" 발견한 싱크·사운드·UI/UX 불편함, 그리고 마감과 이벤트 부족 지점들. 코드 위치는 `path:line` 형식으로 표기.

## 변경 이력

- **2026-04-26 R1** — 초안 작성 (섹션 0~6).
- **2026-04-26 R2 (v85 캐시 bump)** — 즉시 픽스 4건 적용:
  - ✅ §0-1 BLOCKER 봇 freeze — `gostop-server.js:380, 389` `pending.options` → `pending.choices`. 시뮬레이션 검증 완료 (`ai.decideMatchChoice` 정상 카드 ID 반환).
  - ✅ §2-2 dead SFX 살림 — 승리 `fanfare`, 패배 `lose`, 뻑/N고 `gong`, 싹쓸이 `fanfare`, 점수 임계(3·5·7·10) `fanfare`. `clack(275ms)`와 분리하기 위해 fanfare 는 480ms 지연.
  - ✅ §3-1 `g-portrait-hint` ✕ 닫기 버튼 + `localStorage.gostop_portrait_hint_dismissed` 영구 기억.
  - ✅ §3-2 `v84` 빌드 태그 헤더에서 제거 → `window.GOSTOP_BUILD = 'v85'` (콘솔 확인용).
  - ✅ §3-3 게임 중 액션 실패 `alert` 4건 (`playCard`, `chooseMatch`, `btnFlip`, `btnRematch`) → `showToast`. (로비 흐름의 alert 는 그대로 — 나중 라운드.)
- **2026-04-26 R3** — 신규 발견 9건 §7 에 추가 (총 9건: 7-1~7-9).
- **2026-04-26 R4 (v86 캐시 bump)** — §7-1 / §7-8 픽스:
  - ✅ §7-1 [HIGH] disconnect grace — 게임 진행 중 socket 끊김은 30초 grace, `socketId` 만 무효화. 같은 user 재접속 시 자동으로 active room 발견 → `socketId` 갱신 + `game:resumed` emit + view 1회 푸시. 클라 `lobby.js` 에 `game:resumed` 핸들러 추가해 game 화면으로 즉시 전환. `broadcastGameView` 도 `socketId === null` skip 가드.
  - ✅ §7-8 무승부 DB 기록 — `broadcastGameView` 의 `if (w != null)` 분기 안에 묶여 있던 `recordGameResult` 호출을 분기 밖으로 이동. 무승부도 `gameHistory` 에 `winnerUserId: null` 로 기록 + DB INSERT (schema 가 NULL 허용).
- **2026-04-26 R5 (v87 캐시 bump)** — 사용자 직접 피드백 2건:
  - ✅ **뻑 3장 흩어짐** — `boardCardPosition(idx)` 가 카드별 ring 슬롯을 줘서 같은 달 카드도 화면에 분산. month 별 group 만들어 같은 슬롯에 stack. 뻑 3장은 부채꼴 (-10°/0°/+10°, X offset ±11px). 일반 같은 달 2장은 살짝 어긋난 stack. 뻑 4번째(매칭 직전)는 4장 cascade.
  - ✅ **§3-5 고/스톱 다이얼로그가 게임판 가림** — 풀스크린 진한 그라데이션 → `rgba(0,0,0,0.28)` 가벼운 dim + 하단 sheet (`align-items:flex-end`, `max-height:48vh`). 게임판 위쪽이 그대로 보여 손패/바닥 보면서 결정 가능. 추가로 `injectGoStopBreakdown` 으로 점수 구성표(광/고도리/홍단/청단/초단/피 +N점) 다이얼로그 안에 인라인 표시 — §3-4 도 동시 해소.
- **2026-04-26 R6** — R5 검증 + 신규 발견 §8 추가 (6건).
- **2026-04-26 R7 (v88 캐시 bump)** — §8 + §7 부분 픽스 5건:
  - ✅ §8-1 [HIGH] `start()` 안에 `PREV_VIEW=null; VIEW=null; VIEW_QUEUE=[]; VIEW_PROCESSING=false; CARD_EVENT_QUEUE=[]; CARD_EVENT_RUNNING=false; _autoFlipPending=false; TURN_TIMER_START=0; stopTurnTimer();` 추가. 짧은 백그라운드 reconnect 후 stale diff effects 방지.
  - ✅ §8-2 [MED] `pauseTurnTimerForAction()` 헬퍼 추가 — `playCard` / `chooseMatch` / `btnFlip` / `btnGo` / `btnStop` 직후 호출. `stopTurnTimer()` + `el.dataset.autoPlayed='1'` 으로 자동패 중복 emit 차단. 다음 view 도착 시 `startTurnTimer` 가 reset.
  - ✅ §8-3 [LOW] 손패 grid 컬럼 모드별: 2인 5열 / 3인 4열 / 4인 3열. 5+1, 5+2 어색한 grid 해소.
  - ✅ §7-2 도움말에 §5 "캐주얼 룰 안내" 섹션 추가 — 흔들기/쪽/따닥/폭탄/고박 미적용, 비광 단독 광 3장 = 3점, 같은 달 3장 매치 = 자동 뻑. CSS `.g-help-casual` 황금 테두리 박스.
  - ✅ §7-5 `lobby.js` 진입 시 `typeof io === 'undefined'` 가드 — socket.io.js 로드 실패 시 빈 화면 대신 "⚠️ 서버에 연결할 수 없어요" 안내.
- **2026-04-26 R8** — R7 검증 + §9 신규 발견 5건 + §10 마감/이벤트 구현 outline.
- **2026-04-26 R9 (v89 캐시 bump)** — §11 우선순위 5건 픽스:
  - ✅ §7-6/7-9 GostopMe race — `lobby.js` connect ack 안에서 `if (CURRENT_ROOM) renderRoom(CURRENT_ROOM)` 재호출. 싱글 결과 처리는 `view.myIndex` (서버가 채움) 우선 사용 → GostopMe 늦게 도착해도 정확.
  - ✅ §7-4 bbuk owner 배지 — 뻑 stack 의 가운데 카드(`indexInGroup === 1`)에 "내 뻑" / "OOO 뻑" 작은 빨간 배지. 4인 모드에서 누가 만든 뻑인지 즉시 인지 가능. CSS `.g-bbuk-owner` 추가.
  - ✅ §9-4 dead `gameLog` 갱신 — `if (logEl.style.display !== 'none')` 한 줄 가드. CPU 낭비 제거.
  - ✅ §10-6 5초 카운트다운 — `tickTurnTimer` 안에서 `sec ≤ 5 && isMyTurn` 일 때 화면 중앙에 큰 빨간 숫자 1초마다 1번 (cubic-bezier pop) + `navigator.vibrate(40)`. CSS `.g-urgent-cd` + `@keyframes urgentCdPop`.
  - ✅ §10-6 endDialog MVP 콤보 — `pickMvpCombo(captured)` 가 `engine.scoreBreakdown` 으로 winner 의 활성 콤보 중 최고 점수 1개 추출 ("고도리 (+5점)" 등). 다이얼로그 sub 영역에 황금 pill 로 노출. CSS `.g-end-mvp`.
- **2026-04-26 R10 (v90 캐시 bump)** — 사용자 직접 피드백 2건 + 사운드 마스터 플랜 문서:
  - ✅ **[BUG] 바닥 카드 위치 매 render 마다 바뀜** — `monthOrder` 가 매 render 시 새로 정렬되어 같은 month 도 다른 slot. 모듈 scope `BOARD_SLOT_FOR_MONTH` (month → fixed slotIdx 0..15) + `BOARD_SLOT_USED` (16칸 점유 표). 사라진 month 슬롯 free, 새 month 만 빈 슬롯 신규 부여. `start()` 시 reset. 사용자 시야 안정 — 패 낼 때 다른 카드 위치 안 바뀜.
  - ✅ **겹친 패 시인성 — stack offset 확대**: 일반 2장 ±12px (±7°), 일반 3+장 ±16px center fan, 뻑 3장 ±20px (-12°/0°/+12°), 뻑 4장 ±14px cascade. 카드 면적 35~42% 시인 → 한 장처럼 안 보임.
  - 📄 사운드 디자인 마스터 플랜 별도 문서: `docs/gostop-sound-design.md`. 현재 시스템 진단 (10개 영역 미흡) + Round S1/S2/S3 코드 분배. S1 (Audio Bus, 합성 14종, polyphony) 다음 라운드부터 시작.
- **2026-04-26 R11** — R10 검증 + §13 신규 발견 5건.
- **2026-04-26 R12 (v91 캐시 bump)** — §13 픽스 3건 + 사운드 S1 코드 진입:
  - ✅ §13-1 [HIGH] `popScore` opp-i + captor bump 매핑 — `boxes[absoluteIdx]` → `document.querySelector('.g-opp[data-player-idx="' + idx + '"]')`. 두 곳 (`popScore`, captor bumpBounce) + 보너스로 이모지 수신 anchor 도 같은 패턴 fix. 이제 +X점 pop 이 정확한 상대 박스 옆에 표시.
  - ✅ §13-2 `HAND_CUSTOM_ORDER` reset — `start()` 안에 `window.HAND_CUSTOM_ORDER = []`. 새 게임 시 사용자 reorder 잔존 제거.
  - ✅ §13-3 `animateScoreCount` cancel — 모듈 scope `_scoreAnimHandle` 에 `requestAnimationFrame` id 저장, 새 호출 시 `cancelAnimationFrame`. 점수 빠르게 두 번 변해도 깜빡 없음.
  - ✅ **사운드 S1** — `sfx.js` 132줄 → 230줄+ 전면 재설계:
    - **5채널 Audio Bus**: master / sfx / music / ui / voice GainNode. master 만 destination 직결.
    - **Web Audio synthesis 헬퍼**: `synthOsc` (sine/saw/square/triangle + ADSR + pitch sweep), `synthNoise` (filtered noise + ADSR).
    - **Polyphony manager**: category 별 cap (sfx:6 ui:3 voice:2 music:4), 초과 시 oldest 60ms fade-out.
    - **합성 사운드 14종**: tap (사용자 탭 즉시 confirm), cardClack (low pitch + transient noise 2-layer), cardSlide, cardFlip (highpass swish + click), coin (triangle+sine bell), fanfare (C-E-G arpeggio saw+sine), gong (3-layer harmonic stack 110/165/440Hz), lose (단조 하강 A-F-D), myTurn (triangle+sine chime), tick / tickFinal (5초 카운트), emojiSend / emojiReceive, dialogOpen, shuffleBurst.
    - **OGG 파일 의존 제거** — 모바일 OGG 미지원 환경도 정상 발화. 기존 OGG 들은 `public/games/gostop/sounds/` 에 남아있지만 코드에서 더 이상 fetch 하지 않음.
    - **API 호환**: 기존 SFX.clack/ching/flip/myturn/slap/gong/fanfare/lose/score 그대로. 신규 SFX.tap/tick/tickFinal/emojiSend/emojiReceive/dialogOpen/shuffleBurst.
    - **새 사운드 호출 통합**:
      - `playCard`/`chooseMatch` → `SFX.tap()` 즉시 (0 latency confirm).
      - `tickTurnTimer` 5초 이하 → `SFX.tick()` 매 초, sec===1 시 `SFX.tickFinal()`.
      - 이모지 발사 → `SFX.emojiSend()`, 수신 → `SFX.emojiReceive()` (내가 보낸 거 제외).
      - choose-go-stop phase 진입 (PREV_VIEW.phase !== 현재) → `SFX.dialogOpen()`.
    - 마스터 볼륨 API 노출: `GostopSFX.setMasterVol(0..1)` / `getMasterVol()` / `setBusVol(name, 0..1.5)`.

---

## 0. 가장 먼저 — 실제로 게임이 멈출 수 있는 버그

### 0-1. 싱글모드 봇이 "같은 달 2장 매치 선택"에서 영구 정지 [BLOCKER]
- 엔진은 `flipStock` / `playHandCard` 가 매칭 후보 2장 이상일 때 `pending = { ... choices: [...] }` 형태로 채워서 phase 를 `choose-flip-match` 로 넘긴다 (`engine.js:339`, `engine.js:357`).
- 그런데 서버가 봇 차례에 후보를 꺼낼 때 `game.pending.options` 를 본다.
  - `gostop-server.js:380` → `const candidates = (game.pending && game.pending.options) ? ... : [];`
  - `gostop-server.js:389` → 같은 코드.
- `options` 라는 키는 엔진 어디에도 만들지 않으므로 **항상 빈 배열**. `ai.decideMatchChoice` 가 `null` 을 리턴 → `if (pick == null) return;` 에서 그대로 빠져나오고, 다음 봇 액션 스케줄도 안 된다.
- **결과:** 싱글모드에서 봇이 덱을 뒤집어 같은 달이 2장 깔린 상황을 만나면 그대로 얼어붙는다. 클라이언트엔 그냥 "🤖 입문 봇 Lv.x · 손패 N · 생각중…" 점점점만 영원히. 30초 자동 패는 *내* 차례에만 동작하므로 복구도 안 됨 → **유일한 탈출은 "← 나가기"**.
- 수정: `game.pending.choices` 를 사용하면 끝.

### 0-2. `playHandCard` 에서 `choose-hand-match` phase 는 절대 진입하지 않는다
- `engine.js:260` — `matches.length === 2` 일 때 즉시 "뻑" 처리하고 `flip-stock` 로 바로 넘어간다.
- 그런데 클라/서버는 `choose-hand-match` 분기를 다 갖고 있다 (`game.js:119`, `game.js:716`, `gostop-server.js:206`). 죽은 코드 + 헷갈림.
- 더 큰 문제: 실제 고스톱에서는 같은 달 3장이 깔려 있을 때 손패 1장을 내면 **싹쓸이가 정상**인데, 현재 엔진은 같은 달 2장에 손패를 더하면 *무조건 뻑* 처리. (3장 이상이면 따로 처리하지만, 손패에서 같은 달 2장 매치 = 정상 룰에서는 1장 골라 먹기.) 룰 해석 버그 가능성.

---

## 1. 싱크 (애니메이션·서버 view·사운드 정합성)

### 1-1. 봇이 빠를수록 view 큐가 쌓여 lag 가 보인다
- 서버는 `broadcastGameView` 끝에서 다음 봇 행동을 즉시 스케줄 (`gostop-server.js:470`).
- `ai.thinkDelay` 의 최소가 Lv.1 기준 ~500ms (`ai.js:33`).
- 클라 한 view 처리 = 220ms(렌더 지연) + centerpiece 280+500\*mult+240+80 ≈ **1080ms (보통 속도)**.
- 즉 봇이 0.5~1.1s 안에 액션을 끝내고 다음 view 를 쏘는데, 클라는 그걸 1초 넘게 직렬 처리. **2~3개 액션이 누적되면 사용자 입장에선 "왜 자꾸 뒤늦게 한꺼번에 일어나지?"** 가 됨. 특히 ⚡상(fast=0.6) 모드에서도 880ms 라 봇이 더 빠르면 큐가 늘어남.
- `VIEW_QUEUE` 를 직렬화하는 건 잘 짜여 있지만, **봇 thinkDelay 의 최저값을 클라 centerpiece 길이보다 길게** (예: 1100ms) 잡는 게 맞다.

### 1-2. 30초 턴 타이머가 "내 차례 시작" 시점을 놓쳐 220ms 짧게 시작
- `processNextView` 에서 board 변화가 있으면 **220ms 후에 `render()` + `startTurnTimer()`** (`game.js:60-66`).
- 하지만 `TURN_TIMER_START` 는 `processNextView` 진입 즉시 갱신 (`game.js:44-46`). 결국 첫 tick 에서 이미 220ms 빠진 29.78s 부터 보인다. 사람이 인식하기엔 작지만, 매 턴마다 슬쩍슬쩍 줄어드는 효과.

### 1-3. 같은 턴 안에서 phase 가 여러 번 바뀌면 30초가 누적된다
- `playHandCard` → `flipStock` → `choose-go-stop` 까지 같은 turn 인데, 타이머 reset 조건이 `PREV_VIEW.turn !== view.turn` 뿐 (`game.js:44`). 매치 선택 + 고스톱 결정까지 한 사이클이 30초 안에 다 들어가야 함. 7점 룰에서 광 1장 선택 + 고/스톱 2번 결정하는 동안 1초도 안 남는 일 발생 가능 → 자동 스톱.

### 1-4. centerpiece 가 끝나기 전 다음 view 도 클릭되지 않고 큐만 쌓이면, 사용자 점수 변화가 한꺼번에 점프
- `animateScoreCount` 는 650ms easing. 그 사이 다음 view 가 처리되면 **이전 애니가 abort 없이 진행되다가 setText 가 덮어쓰여** 점수 숫자가 깜빡 거꾸로 갔다 다시 올라가는 글리치 가능. (cancel 로직 없음 — `game.js:534-547`.)

### 1-5. `playerActed` 추적 오류 가능성
- `fireDiffEffects` 에서 `playerActed = (PREV_VIEW.turn != null) ? PREV_VIEW.turn : VIEW.turn` (`game.js:145`).
- 매치 선택을 본인이 마치는 순간엔 `endTurn` 으로 turn 이 다음 사람으로 바뀐다. 그런데 *방금 매치한 사람이 누구인지* 는 PREV_VIEW.turn 으로 잘 잡힌다 — 여기까진 OK.
- 그러나 "고!" 선언 후엔 turn 이 *그대로 본인* 이라 `PREV_VIEW.turn === VIEW.turn` → "내 차례로 바뀜" 로직(`game.js:219`)을 안 타고 myturn 사운드 미발화. 고 직후 처음 손패 낼 때 차례 알림이 없어서 "내 차례인지 헷갈림".

---

## 2. 사운드

### 2-1. OGG 만 제공 — iPhone Safari 일부 환경 무음 [HIGH]
- `sfx.js:25` — `fetch(SOUND_DIR + name + '.ogg')`. mp3 / m4a fallback 없음.
- iOS 17 미만 Safari, 오래된 macOS Safari 에서는 OGG decode 실패 → 모든 효과음 안 들림. 가족 게임 특성상 부모 세대 구형 iPad 사용 가능.

### 2-2. 정의는 했지만 한 번도 호출하지 않는 사운드 5개
- `sfx.js` 에 정의된 `fanfare / lose / score / gong / slap` — 코드 어디서도 호출 X (grep 0건).
- 결과: **승리 / 패배 / 뻑 / 고! / 카드 일반 내기 / 점수 임계 달성 모두 무음.** Confetti 만 펑펑.
- `game.js:289` 에 "사운드 다 끔" 주석으로 의도적인 결정처럼 보이지만, 임팩트가 가장 큰 순간이 다 죽어있는 건 게임답지 않다.

### 2-3. 매치/플립 사운드 타이밍이 사용자 입력 사운드보다 늦는다
- 손패 탭 → 즉시 시각 피드백 (`game.js:1296-1300`) → 서버 응답 → view → centerpiece 발사 → **275ms 후에 비로소 clack/ching** (`game.js:209-210`).
- 사용자 탭 → 시각 반응 → 1초 가까이 뒤에 "탁!" 들리면 인과관계 끊김. 적어도 *내가 직접 낸 카드*는 탭 즉시 가벼운 슬쩍 사운드를 먼저 깔아주는 게 좋음 (선응답 사운드).

### 2-4. flip 사운드와 clack/ching 가 겹친다
- 덱에서 뒤집어 즉시 매치하는 경우: `SFX.flip()` 즉시 (`game.js:142`) + `SFX.clack()` 275ms (`game.js:209`). 두 사운드가 거의 함께 울리고, 둘 다 카드 슬라이드 계열이라 하나로 뭉개져 들림.

### 2-5. myturn 종소리가 매치 없는 상대 카드 직후엔 0ms 즉시 발화
- `turnSoundDelay = stockDropped || matched || newBoardCount > 0 ? 720 : 0` (`game.js:220`).
- 정의상 newBoardCount > 0 이면 720 으로 가는데, 상대가 매치 없이 카드를 내고 → 덱도 안 뒤집고 turn 만 넘어가는 케이스(불가능에 가깝지만 phase 처리 중 발생할 수 있음)에 0ms 즉시 발화 → swish 와 겹침.

### 2-6. 음소거 토글 사운드 — 켤 때 "highUp" 발화하지만 끌 땐 무음
- `game.js:1445`. 일관성 부족. 또한 음소거 상태/볼륨 슬라이더가 없어서 **부분 음소거** 불가.

### 2-7. AudioContext gain 단일 — 마스터 볼륨 / 카테고리별 볼륨 분리 없음
- 카드 사운드만 줄이고 알림 사운드는 살리고 싶어도 불가. 결혼식·장례식 같은 장소에서 잠깐 "조용 모드" 가 필요한데 토글만으로는 거칠다.

---

## 3. UI / UX 불편함

### 3-1. "📱 가로로 회전하면 더 편해요" 가 dismiss 불가 (`index.html:144`)
- 가로로 돌리면 CSS media query 로 사라지긴 함 (`gostop.css:507-510`). 그런데 **데스크톱 브라우저 좁게 띄운 사용자**는 영원히 보임. 닫기 버튼 + localStorage 기억 필요.

### 3-2. 디버그 빌드 태그 `v84` 가 정식 헤더에 노출 (`index.html:146`)
- "옛 화면 보이면 강제 새로고침" 안내라는데, 일반 사용자는 의미 모름. 푸터/도움말 안쪽으로 옮기거나 숨김.

### 3-3. `alert()` 남발
- `lobby.js:30, 65, 169, 301`, `game.js:1365, 1371, 1378`, `lobby.js:359`, `game.js:397` 등.
- 모바일에선 OS 모달이 게임 위로 뜸 → 게임 흐름 끊김. 일관된 toast 시스템(`showToast`) 이미 있는데 활용 안 됨.

### 3-4. 점수 브레이크다운 발견성이 너무 낮다
- 내 점수 옆 "점" 클릭하면 상세 — 그런데 알 길이 없음. `title` 만 있고 모바일은 hover 없음 (`game.js:967-968`).
- 고/스톱 다이얼로그에는 *총점*과 *원으로 환산한 금액*만. 어떤 카드 조합 덕에 그 점수가 나왔는지 다이얼로그 안에서도 확인 가능해야 의사결정이 쉬움.

### 3-5. 고/스톱 다이얼로그가 풀스크린 + 진한 배경으로 게임판을 가린다 (`game.js:1027-1031`)
- "내 손패 어떤가, 바닥에 뭐 깔렸나" 보면서 결정해야 하는 게 고스톱의 핵심. 다이얼로그 반투명 + 작은 카드 시점이거나, 다이얼로그를 우측 사이드에 띄우는 편이 좋음.

### 3-6. 매치 선택 phase 에서 손패 hint 부재
- `is-matchable` 클래스로 손패 카드 hint 가 있긴 하지만 (`game.js:912`), `choose-flip-match` phase 에선 손패가 아니라 바닥에서 골라야 하는데 도움말은 "👉 바닥에서 같은 달 카드 한 장을 탭" 만 (`game.js:717`). 화살표/펄스 같은 시각 가이드가 없어 노약자에겐 어렵다.

### 3-7. 30초 타이머의 시각적 무게가 약하다
- 헤더에 작게 "30s". 잔여 ≤10s 에 색만 변함 (`game.js:98`). 5초 카운트다운 사운드 / 화면 펄스 / 진동 같은 긴장감 연출 없음.

### 3-8. 4인 모드 모바일 좁은 화면에서 상대 박스 3개가 헤더를 잠식
- `g-opp-wrap-3` 레이아웃. 각 박스에 아바타 + 손패 fan + 획득 카드 peek. 세로 모바일에선 가독성 무너질 가능성. 가로 hint 가 떠도 강제 가로 회전은 OS 잠금 풀어야 가능.

### 3-9. 드래그 reorder 시 카드가 emoji bar 아래로 사라진다
- 드래그 중 `wrap.style.zIndex = '10000'` (`game.js:1270`). 그러나 `g-emoji-bar` 의 z-index 가 그 이상이면 카드가 가려짐. 드래그 중엔 emoji bar 의 pointer-events 차단 + opacity 낮추는 처리 필요.

### 3-10. 손패 첫 딜링 stagger animation 이 멈춰 있는 순간에 클릭 들어가면 카드가 안 움직임
- `is-handdeal` 클래스 + animationDelay (`game.js:914-916`). 마지막 카드 딜링 완료까지 ~600ms. 그 사이 탭하면 transform 충돌 가능.

### 3-11. 재대결 후 카드가 **이전 판의 손패 그림자** 가 잠깐 잔존
- `start()` 에서 hand/board innerHTML 비움 (`game.js:18-20`). 그런데 `endDialog` 닫기 클릭 → 즉시 새 판 시작이 아니라 사용자가 "다시하기" 누르면 그 시점에야 PREV_VIEW=null. 그동안 stale view 가 남아 있을 수 있음.

### 3-12. 게임 종료 다이얼로그 — "다시하기 / 로비로" 두 버튼만
- 누적 점수, 박 표기는 있는데 **이번 판 핵심 하이라이트**(어떤 콤보가 결정적이었는지, 최다 점수 콤보)가 없다.
- 또 "공유하기" / "스크린샷 저장" 같은 가족 게임 특화 기능 없음.

### 3-13. 헤더 버튼 5개 (나가기/상태/타이머/속도/음소거) — 좁은 화면에서 충돌
- `g-status-compact` 로 줄여놨지만 한국어 phaseLabel 까지 들어가면 잘림.

### 3-14. 손패 5×2 grid 강제 인라인 스타일 (`game.js:885-889`)
- 4인 모드에선 6장. 그래도 5열 grid → 두 번째 줄 1장만 외로움. playerCount 별 grid 전환 필요.

### 3-15. 이모지 수신 위치 산정 인덱스 불일치 가능성
- `game.js:1407` — `document.querySelectorAll('.g-opp')[idx > me ? idx - 1 : idx]` 로 oppBox 를 찾음. 그런데 `gameOpponents` 박스는 forEach 로 me 를 빼고 만든다 — me=0 이면 idx=1,2,3 → 0,1,2 로 매핑은 OK. 하지만 me 가 중간(예: 3인방에서 me=1)이면 다른 oppBox 인덱스도 손봐야 함. 매핑 검증 필요.

### 3-16. 싱글모드 결과 알림이 `alert()` (`game.js:397`)
- 화려한 endDialog 까지 보고 "← 로비로" 누르면 **OS alert 로 텍스트 한 줄 더 뜬다**. 게임 속 화려함 → OS 알림창의 단조로움으로 급추락. endDialog 안에서 자연스럽게 "💸 -300원 / 소지금 5,700원" 표시해야.

### 3-17. 누적 점수 / 가족 랭킹은 있는데 "최근 한 판"·"오늘의 베스트 콤보" 같은 기간성 통계 없음
- `lobby.js:362` — 누적 wins 만. 시즌·주간·일별 분리 X.

---

## 4. 마감 부족 (Polish gap)

| 영역 | 현재 | 부족 |
|---|---|---|
| 카드 셔플 모션 | 없음 (deal-in stagger 만) | 게임 시작 시 "카드 셔플 → 분배" 1.5s 시퀀스 |
| 매치 임팩트 | centerpiece 1.1× pop + 노란 글로우 | 화면 흔들림(shake), 충격파 SVG, 햅틱 강화 |
| "고!" / "스톱!" | 텍스트 콜아웃만 | 시그니처 사운드 (현재 sfx.gong 사용 안 함) + 화면 전체 색 플래시 |
| 승리 | confetti | 승리 BGM, 카드 무지개 펼치기, 별가루 |
| 패배 | 결과 modal 만 | 위로 메시지 + 다음 판 격려 ("다시 해봐요!" + 한 번에 가는 단축 버튼) |
| 점수 임계치 | bigCallout 텍스트 | 게이지바 / 진행도 시각화 (3점/5점/7점에 가까워질수록 차오름) |
| 카드 이미지 | Wikimedia hanafuda PNG | 호버/탭 시 카드 정보(이 카드의 점수 기여, 어디 세트 후보) 툴팁 |
| 봇 캐릭터성 | 이름 (🐣 새내기 → 💀 마왕) | 봇별 말풍선 ("이번엔 안 봐줘요!" 등 — 캐주얼 가족 게임에 큰 차이) |
| 첫 플레이 onboarding | 도움말 시트 텍스트 | 인터랙티브 튜토리얼 (1턴짜리 가이드) |
| 에러 안내 | alert() | 토스트 + 일관된 디자인 |

---

## 5. 이벤트 / 콘텐츠 부족

### 5-1. 데일리 / 주간 후크 0개
- 출석 보상, 매일 한 판 보너스, 주말 더블 점수, 시즌 패스 — 전부 없음.
- 가족 게임 특성: "오늘도 한 판 하자" 의 트리거가 약하다. 매일 들어와야 할 이유가 "어제 누가 이겼지?" 정도.

### 5-2. 싱글모드 보상 흐름이 단조롭다
- Lv 1~20 클리어 = 다음 단계 해금 + 봇 보유금 흡수.
- 보상이 돈 한 가지뿐. **타이틀 / 스킨 / 카드 뒷면 / 봇 잠금해제 효과음** 등 컬렉션 요소 부재.
- 한 번 클리어한 단계에 다시 들어갈 동기 없음 (반복 보상 X).

### 5-3. 가족 vs 가족, 또는 가족 내 토너먼트 모드 없음
- "이번 주 가족 챔피언" 자동 선출 같은 가벼운 경쟁 이벤트 X.
- "OO 가족 vs XX 가족" 친선 전 같은 외부 경쟁 X.

### 5-4. 리플레이 / 명장면 저장 없음
- "방금 그 11점 콤보" 다시 보기 / 가족 채팅에 공유 — 가족 게임 핵심 sticky factor 인데 없음.
- 게임 종료 후에는 그대로 사라짐 (`game.js:404` — `VIEW = null; PREV_VIEW = null`).

### 5-5. 커스터마이즈 0
- 카드 뒷면 디자인 선택 X
- 테이블 펠트 색 X
- 효과음 팩 X (현재 Kenney CC0 단일)
- 봇 난이도/시간 커스텀 (Lv 매핑된 thinkDelay 만)

### 5-6. 시즌성 (Seasonal) 콘텐츠 0
- 설/추석 같은 명절 이벤트 (시각 테마 + 더블 점수)
- 생일자 보너스
- 신년 특별 카드 백 — 시각 자산만 갈아끼우면 큰 비용 없이 큰 효과.

### 5-7. 소셜 인터랙션 — 이모티콘 8개만
- `index.html:191-200`. 1.2초 쿨다운 (`gostop-server.js:251`).
- 음성 메모 X, 빠른 메시지("좋은 한 판이었어요!" 같은 프리셋) X, 끝나고 박수치기 / 트로피 보내기 X.

---

## 6. 빠르게 고치면 큰 효과 — 실행 우선순위

### 즉시 (1줄 ~ 1시간)
1. **`gostop-server.js:380, 389` — `pending.options` → `pending.choices`** (BLOCKER 봇 freeze)
2. **`game.js` — `SFX.fanfare()` 를 승리 시, `SFX.gong()` 을 고/뻑 시, `SFX.score()` 를 3점 임계치에 호출** (정의된 dead code 살리기)
3. **`alert()` 전부 `showToast()` 로 치환**
4. **`v84` 빌드 태그 숨김**, `g-portrait-hint` 에 닫기 버튼 + localStorage 기억

### 단기 (반나절~1일)
5. **OGG → mp3/aac 듀얼 포맷** (sfx.js loadBuffer 에 fallback)
6. **30초 타이머 시각화 강화** (5초부터 큰 카운트다운 + 진동 + 사운드)
7. **고/스톱 다이얼로그에 점수 브레이크다운 인라인 표시**
8. **봇 thinkDelay 최저 1100ms 로 상향** (centerpiece 와 동기화)
9. **싱글모드 결과 alert → endDialog 안에 통합**

### 중기 (1주)
10. **인터랙티브 튜토리얼** (1판 자동 가이드)
11. **데일리 보너스 + 주간 패밀리 챔피언 자동 선출**
12. **리플레이 — 직전 판 재생 / 가족 채팅 공유**
13. **카드 뒷면 / 펠트 색 커스텀**
14. **봇 캐릭터 말풍선** (Lv별 멘트 사전 — 가족 게임의 정서를 크게 끌어올림)

---

---

## 7. R3 신규 발견 (2026-04-26)

이미 픽스된 P0 너머의 영역을 더 깊게 살펴보면서 새로 발견한 것들. 모두 코드 reading + Node 시뮬레이션 기반.

### 7-1. 새로고침 / 백그라운드 이탈 = 게임에서 즉시 퇴장 [HIGH]
- `gostop-server.js:337-341` — 모든 `disconnect` 이벤트에서 `leaveRoom(room, me.id, socket)` 호출. 게임 진행 중인지 체크 X.
- 결과:
  - 모바일에서 다른 앱 갔다 돌아오는 짧은 백그라운드 → 소켓 끊김 → **방에서 빠지고 게임 종료**.
  - 페이지 새로고침 → 똑같이 방 탈락.
  - 멀티에서 한 명 끊기면 다른 플레이어들은 끝까지 못 감 (재시작 방법: 호스트가 재대결, 그러나 방은 사라진 뒤).
- 권장 패치 모양:
  - 게임 진행 중(`room.game && !room.game.finished`)에는 `leaveRoom` 대신 *socketId 만 무효화*하고 N초간 grace period 유지.
  - 같은 userId 로 재연결 시 `room.players` 의 기존 entry 의 `socketId` 만 갱신하고 `socket.join(room:...)` + `broadcastGameView` 한 번. (`room:join` 로직에 이미 비슷한 회복 코드가 있음 — `gostop-server.js:139-141`.)
  - grace period 후에도 재연결 없으면 그제서야 leave + 봇 대체 또는 게임 무효 처리.

### 7-2. "흔들기 / 쪽 / 따닥 / 폭탄 / 고박" 룰 미구현
- 엔진 grep 결과 `engine.js` 에 없음:
  - **흔들기**: 첫 분배 시 같은 달 3장이 들어오면 신고하면 점수 ×2. 미구현.
  - **쪽**: 손에서 낸 카드와 덱에서 뒤집힌 카드가 같은 달이라 같이 잡으면 상대 피 1장 뺏어옴 (보너스). 미구현.
  - **따닥**: 손에서 낸 카드의 같은 달이 바닥에 1장 → 가져옴 + 덱 뒤집은 카드도 같은 달이라 또 따라잡음 (연속). 미구현.
  - **폭탄 (3장 깡)**: 손에 같은 달 3장. 한 번에 다 내고 1턴 추가 + 보너스. 미구현.
  - **고박**: 상대가 N고 외친 후 그 사람이 못 이기면 ×2. `bakMultiplier` 에 없음 (`engine.js:402-406` — 광박/멍박/피박만).
- 캐주얼 가족 게임이라 의도적 단순화일 수 있음. **명시적 결정**으로 README/도움말에 "캐주얼 룰: 광박/멍박/피박만 적용. 흔들기/쪽/따닥/폭탄/고박 미적용" 표기 권장.
- 도움말 시트(`index.html:97-118`) 에는 그냥 "박: 광/피/열끗 많이 먹은 승자 ..." 만 있어 사용자가 정통 룰을 기대했다가 어리둥절할 수 있음.

### 7-3. 비광 단독으로 광 3장 채우면 정통 룰 위반 — 그대로 인정됨
- `engine.js:147-150` — `lightCount = captured.light.length`; `lightCount === 5 → 15`, `>= 3 → lightCount`.
- 정통 룰: 비광(12월 광)이 포함된 광 3장은 2점 (3점 X). 비광 4장은 4점, 5장은 15점은 같음.
- 현 엔진은 비광 포함도 무차별 3점 처리. `scoreBreakdown` 도 동일 (`engine.js:184-189`).
- 캐주얼 룰이면 "괜찮음" 으로 쉴드 가능. 단 §7-2 와 같이 명시 필요.

### 7-4. 뻑 그룹의 소유자(`bbukGroups[].ownerIdx`) 가 UI 에 표시 안 됨
- 엔진은 누가 뻑을 만들었는지 저장 (`engine.js:265` — `s.bbukGroups.push({ month, ownerIdx })`).
- 그러나 뷰는 `bbukGroups` 만 그대로 노출 (`engine.js:461`), 클라는 `bbukMonths` Set 만 만들어 month 표시 (`game.js:811`).
- 결과: 화면에 "뻑!" 빨간 뱃지는 뜨는데 **누가 만든 뻑인지** (그래서 4장째 잡히면 누구한테 가는지) 표시 X. 4인 모드에서 특히 헷갈림.
- 패치 모양: bbuk 그룹 카드 위에 작게 owner 아바타 2~3px 배지.

### 7-5. socket.io.js 로드 실패 시 무방비
- `lobby.js:6` — `const socket = io({ path: '/gostop/socket', withCredentials: true });`
- `index.html:243` — `<script src="/gostop/socket/socket.io.js"></script>` 가 먼저 로드되어 `io` 글로벌 가정.
- 네트워크 끊기거나 서버 에러로 socket.io.js 가 404 면 `io is not defined` 에러로 lobby 초기화 전체 실패. 사용자에겐 빈 화면.
- `try { ... } catch` 또는 `if (typeof io === 'undefined') { showError(); return; }` 가드 권장.

### 7-6. `window.GostopMe` 채워지기 전 race condition
- `lobby.js:232-241` — `socket.on('connect', ...) → emit('me', ...) → callback 에 GostopMe 할당`.
- 그 사이에 사용자가 빠르게 "방 만들기" / "참가" 누르면 `renderRoom` 의 `const me = window.GostopMe;` 가 undefined → `isHost` 가 false → 방장이지만 시작 버튼 안 보임 (`lobby.js:136-142`).
- `room:update` 가 GostopMe 를 받기 전에 도착해도 같은 증상.
- 패치: GostopMe 채워질 때까지 버튼 비활성화 또는 제한된 placeholder 렌더.

### 7-7. 매치 가능 카드 우선 정렬 / "내가 낼 수 있는 패" 시각 강조 약함
- 손패 카드 중 board month 와 매칭 가능한 것엔 `is-matchable` 클래스 (`game.js:912`). 그러나 CSS 가 어떻게 강조하는지 확인 필요 — 단순 border 만이면 다른 카드들 사이에 묻힘.
- "이 카드 내면 어떤 점수가 어떻게 변하나" 미리보기 부재.

### 7-8. 무승부(winner=null) 시 endDialog 처리는 OK 인데, **DB 기록은 winner_user_id NULL 로 들어감**
- `gostop-server.js:486-500` — `winner_user_id = winnerUserId || null`. INSERT IGNORE.
- 그런데 `recordGameResult` 호출 조건은 `if (w != null)` (`gostop-server.js:435-453`) 안에 들어가 있어 **무승부는 DB 기록 자체가 안 된다**. 가족 통계에 "오늘 우리 진짜 비겼는데 왜 안 떠?" → 통계 누락.
- 패치: 무승부 케이스도 `recordGameResult` 호출 (winner_user_id NULL 허용).

### 7-9. 싱글모드 결과의 `view.players[myIdx]` 매칭이 reload 후 깨질 수 있음
- `lobby.js:516` — `view.players.findIndex(p => p.userId === window.GostopMe.id)`. GostopMe 가 race 로 비어 있으면 `myIdx = -1` → `myScore = 0` → "비겼어요" 로 잘못 처리되어 소지금 차감 미반영 가능.
- 7-6 와 묶어 처리 가능.

---

---

## 8. R6 신규 발견 (2026-04-26 · v87 후)

R5 변경사항(뻑 stacking / 다이얼로그 dim) 후의 잠재 regression 점검 + 새 깊이로 본 영역.

### R5 변경 검증 결과 (regression 없음)
- **뻑 stacking** — `boardEl.innerHTML = ''` 가 매번 fresh node 생성하므로 stack offset / z-index 잔존 우려 없음. 매치 highlight `boardCardEl.style.filter = brightness(...)` 도 다음 render 에선 사라짐 (새 노드).
- **고/스톱 다이얼로그 dim** — choose-go-stop 해제 시 `dlg.classList.add('hidden')` + `display:none`. 다음 phase 에서 다시 열리면 inline cssText 재설정. 정상.
- **PWA 캐시** — `service-worker.js` 가 자기 소멸 + 캐시 비움 + clients.navigate. 한 번 잡고 사라지므로 `?v=87` 만으로 무효화 충분 (한 번 PWA 로 들었으면 첫 진입 시 SW 가 강제 reload 시킴).

### 8-1. Reconnect 시 `PREV_VIEW` 가 stale 로 남음 [HIGH]
- 새로고침이면 페이지 자체가 reload → 모듈 새로 로드 → `PREV_VIEW = null`. OK.
- 그러나 **짧은 네트워크 끊김 (모바일 백그라운드 5~10초)** 후 socket 재연결의 경우, 페이지는 그대로 → `GostopGame` 모듈 그대로 → `PREV_VIEW` 가 끊기기 직전 상태 그대로 메모리에 잔존.
- R4 추가한 `tryResume` → `socket.emit('game:resumed')` → 클라 `GostopGame.start(payload)` → `start()` 안에서 `PENDING_HAND_CARD = null` 만 reset, **`PREV_VIEW` 는 reset 안 함** (`game.js:16-27`).
- 결과: reconnect 후 첫 game:view 도착 시 `fireDiffEffects` 가 stale PREV_VIEW 와 신규 VIEW 를 비교 → "이미 사라진 카드" 가 다시 등장한 것처럼 처리되어 잘못된 centerpiece 발사 + 사운드 + 점수 카운트 가능.
- **수정**: `game.js:16-27` `start()` 안에 `PREV_VIEW = null;` `VIEW = null;` `VIEW_QUEUE = [];` `CARD_EVENT_QUEUE = [];` 추가. 한 줄 패치.

### 8-2. 카드 제출 / 매치 선택 직후 turn-timer 가 즉시 정지 안 됨 [MEDIUM]
- 사용자 탭 → `playCard` → `socket().emit('game:play', ...)`. 서버 응답·view 도달 사이 보통 0.3~1.0초.
- `turnTimer` 는 `setInterval(tickTurnTimer, 500)` 로 계속 카운트. 잔여 시간이 ≤1s 직전에 탭하면 **자동패가 먼저 발화**할 위험 (사용자가 낸 카드 + 자동 카드 두 번 emit).
- `tickTurnTimer` 의 `el.dataset.autoPlayed === '1'` 가드는 같은 turn 내 중복 자동패만 방지. 사용자 emit 후 자동패 emit 은 둘 다 다른 cardId → 서버는 두 번째 emit 에 "not your turn" 또는 "card not in hand" 에러로 거부 (안전망). 그래도 `showToast('⚠️ ...')` 한 번 깜빡.
- **수정**: `playCard`/`chooseMatch`/`btnFlip` 호출 직후 `stopTurnTimer()` + `turnTimer dataset.autoPlayed='1'` set. 다음 view 도착 시 `startTurnTimer` 가 초기화.

### 8-3. 손패 grid 가 5열 강제 — 3인(7장) / 4인(6장) 모드에서 어색 [LOW]
- `game.js:885-889` — `grid-template-columns:repeat(5, 1fr) !important;`.
- 2인 맞고: 10장 → 5+5 (OK).
- 3인 고스톱: 7장 → 5+2 (어색, 두 번째 줄에 2장만 외로움).
- 4인 고스톱: 6장 → 5+1 (한 장만 외로움).
- **수정**: `playerCount` 별 `grid-template-columns: repeat(VIEW.playerCount === 2 ? 5 : VIEW.playerCount === 3 ? 4 : 3, 1fr)` 또는 단순 `repeat(auto-fill, minmax(60px, 1fr))`.

### 8-4. 가로 모드(landscape)에서 felt 영역 비율
- `gostop.css` 가로 미디어쿼리 (`orientation: landscape`)에서 felt 높이/너비를 줄여 손패 위로 뜨게 함. 그런데 매우 좁은 가로(예: 노트북 16:10 좁은 창) 에선 carousel 안 잡힘.
- 이건 코드 더 봐야 정확히 진단. 다음 라운드 후보.

### 8-5. 매치 highlight `boardCardEl.style.filter/boxShadow` 가 같은 노드에 누적 가능
- `game.js:150-157` — captured 카드의 board DOM 노드에 inline filter/boxShadow 설정. 220ms 후 render() 가 board 를 통째로 다시 그리므로 사라짐 (해당 노드 사라짐).
- 그러나 **render() 가 220ms 안에 일어나기 전 또 다른 view 가 도착하면** queue 된 다음 fireDiffEffects 가 새 PREV_VIEW 와 비교 → 같은 카드(아직 화면에 있음)가 다시 highlight 받음. 잠재 누적 가능.
- 실제 발생 빈도 낮음. 메모.

### 8-6. 게임 종료 후 endDialog 의 점수 정렬 — 동점이면 unstable
- `game.js:343-345` — `ranked.sort(function (a, b) { return b.score - a.score; })`. JS sort 는 stable 보장은 ES2019+, 모든 브라우저 보장. 그런데 동점 시 *원래 player 인덱스 순*이 유지됨. 정렬된 순서가 항상 winner=#1 이라는 보장 X (동점이면 winner index 가 random 일 수도).
- engine 의 `endTurn` 에서 `winners.length === 1 ? winners[0] : null` (동점 무승부 처리). 따라서 winner != null 이면 unique max → 정렬 unstable 영향 없음. **사실상 무관**, 메모만.

---

## 9. 다음 라운드 추천 픽스 우선순위

1. **§8-1** PREV_VIEW reset on resume — 1줄, HIGH.
2. **§8-2** turn-timer 즉시 정지 — 작은 패치, MEDIUM.
3. **§8-3** 손패 grid 모드별 컬럼 — 시각 개선.
4. **§7-2** 도움말에 캐주얼 룰 명시 — 텍스트 5줄.
5. **§7-5** `io is not defined` 가드 — 1줄.
6. **§7-6 + §7-9** GostopMe race 가드 — Host 판정 / 싱글 결과 정합.
7. **§7-4** bbuk owner UI 작은 배지 — R5 stacking 으로 시각적 cluster 는 해소된 상태.

---

---

## 9. R8 신규 발견 (2026-04-26 · v88 후)

### R7 검증 결과
- **§8-1 PREV_VIEW reset** — `start()` 안 9개 변수 reset. 짧은 reconnect 후 `game:resumed` → `start()` → 다음 view 도착 = 첫 view 처럼 처리. 정상.
- **§8-2 pauseTurnTimerForAction** — `stopTurnTimer()` + `autoPlayed='1'` 후 다음 view 도착 시 `startTurnTimer` → `tickTurnTimer` 의 `else { autoPlayed='0' }` 경로로 자연 reset. 사이드 이펙트 없음.
- **§8-3 손패 grid handCols** — 2/3/4인 정상 분기.
- **§7-2 도움말 §5** — `.g-help-casual` CSS 박스 정상 표기.
- **§7-5 io 가드** — `typeof io === 'undefined'` 분기 정상.
- **잠재 edge case**: `pauseTurnTimerForAction` 후 server 가 응답 못 하면 (네트워크 단절) timer 가 영원히 stop. 단 §7-1 reconnect grace + tryResume 가 game:view 한 번 푸시 → startTurnTimer 재가동 → 자동 복구. **연쇄 안전망 OK.**

### 9-1. PNG 카드 로딩 실패 시 fallback SVG swap 동안 빈 칸 깜빡 [LOW]
- `cards-svg.js:90-97` — `img.onerror` 에서 `img.remove()` + fallback SVG insert. 이 사이 1~2 frame 동안 카드 자리가 비어 보임.
- 모든 48장 PNG 가 `public/games/gostop/cards/` 에 존재하므로 (확인) 실 운영에선 거의 발생 X.
- 패치 옵션: 미리 fallback SVG 를 `<img>` 뒤에 layered 로 깔아두고 `img.onload` 에서 hide. 굳이 안 해도 됨.

### 9-2. `lobby.js` 의 `connect_error` 가 'unauthorized' 만 처리 [LOW]
- `lobby.js:396-402` — `if (err.message === 'unauthorized') { ... }`. 다른 에러(transport, timeout, 5xx) 는 silent.
- 사용자에겐 "방 목록이 안 떠요" 만 보임. 콘솔에는 socket 에러 찍히지만 사용자 모름.
- 패치: `else { roomEmpty.textContent = '⚠️ 연결 끊김 — 잠시 후 새로고침해 주세요'; }`.

### 9-3. `room:join` 등 socket emit 의 ack timeout 부재 [LOW]
- `lobby.js` 의 모든 `socket.emit(..., callback)` 은 ack 가 안 오면 callback 안 발화.
- 서버 응답 도중 끊기면 사용자가 버튼 누른 채 무반응. socket.io 의 `timeout()` API 미사용.
- 패치: `socket.timeout(5000).emit(...)` 로 5초 timeout. callback 첫 인자가 Error 면 toast.

### 9-4. 게임 로그(`gameLog`) 가 화면 안 보이는 dead element
- `index.html:203` — `<ul id="gameLog" class="g-log" style="display:none">`. R21~ 진척에서 "진행 기록 제거됨" 주석. 그러나 `game.js:1077-1081` 에서 매 render 마다 `logEl.innerHTML = ...` 로 채움 + scrollTop = scrollHeight 까지 함. **죽은 작업 — CPU 낭비.**
- 패치: render 의 logEl 갱신 코드 제거 또는 `if (logEl.style.display === 'none') return;` 가드.

### 9-5. `room.players` 동기화 — disconnect grace 중 reconnect 시 socketId 갱신 OK 인데 host 위임이 한 박자 어긋날 가능성
- 호스트가 disconnect → grace 30초 시작.
- grace 중에 다른 player 가 `room:leave` 로 나감 → leaveRoom 가 player 제거 + `if (room.hostId === userId) room.hostId = room.players[0].userId`. 호스트 자체는 grace 중이라 `room.players` 에 그대로 있음.
- 호스트가 reconnect → tryResume 로 socketId 갱신. host 권한 유지. OK.
- 그러나 **grace 만료 시점에 setTimeout 콜백이 stillThere.players 에서 제거**. 이 시점에 다른 player 가 호스트 권한 받음.
- 합리적이지만 호스트 변경 알림이 toast 같은 걸로 표시되면 좋음. 메모.

---

## 10. 마감 / 이벤트 강화 — 구체 구현 outline

R1 §4-§5 에서 항목만 나열. 사용자가 다음 라운드 진행할 수 있도록 *구현 단위* 로 분해.

### 10-1. 카드 셔플 모션 (게임 시작 1.5s 시퀀스)
- **타이밍**: `lobby.js` 의 `'game:started'` → `GostopGame.start(payload)` 직후 → 첫 `game:view` 도착 사이 (~200ms 공백).
- **구현**:
  - 빈 board 위에 face-down 카드 16장 가운데로 모음 → 셔플 (rotate ±45° random + translateX random) 4 cycle (0.8s) → 정렬 (0.3s) → 첫 view 도착하면 stagger deal-in (이미 구현된 `is-handdeal`).
  - CSS keyframe `@keyframes shuffleSpread`, `@keyframes shuffleGather`.
  - 시작 효과음: `SFX.flip()` 4회 빠르게 (0.2s 간격).
- **위험**: 첫 view 도착이 셔플 중간에 도착하면 점프. → 셔플 시간을 fallback heartbeat 로 잡고 view 도착 시 즉시 collapse → deal-in 으로 전환.

### 10-2. 봇 캐릭터 멘트 (Lv 별 사전)
- **데이터**: `ai.js` 에 `botLines = { 1: ['살살 부탁해요…'], 5: ['이번엔 안 봐줘요!'], 10: ['좀 만만치 않을걸요?'], 20: ['후후, 운이 좋길'] }` 형식.
- **트리거**: 봇 차례 시작 / 매치 성공 / 고 외침 / 패배 직전. socket 으로 `chat:emoji` 처럼 "chat:bot-line" 푸시.
- **클라**: 기존 `chat:emoji` bubble 시스템 재활용해 텍스트 bubble. 2.4s 후 사라짐.
- **데이터 분량**: Lv 1~20 × 4 트리거 = 80줄 정도 카피 작성 필요.

### 10-3. 데일리 출석 + 주간 챔피언
- **백엔드**: `gostop_daily_streak (user_id, last_visit_date, current_streak)` 테이블. 첫 게임 진입 시 streak 갱신.
- **보상**: 7일 연속 → 싱글모드 소지금 +1000원. UI 에 "🔥 5일 연속!" 뱃지.
- **주간 챔피언**: 매주 일요일 자정 cron 으로 `gostop_results` 집계 → 가족별 1위 user 에게 "🏆 이번 주 챔피언" 뱃지 1주 노출. 알림(`/api/notifications`) 1건.

### 10-4. 리플레이 / 공유
- **저장**: 게임 중 모든 view 의 hash 만 저장 (각 view 의 `seed` + turn step) → 끝나면 game record 1줄.
- **재생**: `recordGameResult` 의 row 에 `seed` 추가. "이 판 다시 보기" 클릭 시 endgame view 시퀀스 재생 (비동기 setTimeout 으로 1초마다 다음 view).
- **공유**: 스크린샷은 브라우저 한계. 대신 `/api/chat` 로 "🎴 5점 승! 5월/9월 띠 콤보" 자동 게시.

### 10-5. 시즌 / 명절 테마
- **데이터**: `THEME_PACK = { default, lunarNewYear, chuseok, christmas }`. `gostop.css` 에 각 팩별 felt 색·카드 뒷면 SVG·헤더 장식 변수.
- **활성**: 날짜 기반 자동 (설/추석/12월 25일) + 사용자 토글. localStorage 에 선택 저장.

### 10-6. 즉시 적용 가능한 작은 마감 (1시간 이내)
- ✅ 기존 dead `SFX.fanfare/gong/lose` 살림 (R2 완료)
- ✅ 점수 브레이크다운 인라인 (R5 완료)
- 🔲 5초 이하 turn timer 카운트다운 — 큰 숫자 + 진동
- 🔲 매 턴 시작 시 "내 차례" floating 의 fade-in keyframe 강화
- 🔲 상대 매치 성공 시 상대 박스 펄스 + 숫자 +X 큰 폰트
- 🔲 endDialog "이번 판 MVP 콤보" 한 줄 ("5월·9월 띠 매치")

---

## 11. 다음 라운드 추천 우선순위 (업데이트)

기능 가치 ÷ 구현 난이도 기준 재정렬.

1. **§7-6 + §7-9 GostopMe race 가드** — 빠르게 클릭 시 isHost / 싱글 결과 깨짐. 패치 5줄.
2. **§7-4 bbuk owner 작은 배지** — R5 stacking 위에 가운데 카드에 owner 아바타 1개. 4인에서 큰 도움.
3. **§9-4 dead `gameLog` 갱신 제거** — CPU 낭비 한 줄 가드.
4. **§10-6 즉시 마감 4건** — 5초 카운트다운, 내 차례 강조, 상대 매치 펄스, MVP 콤보.
5. **§10-2 봇 멘트** — 가족 게임 정서 가장 큰 효과. 데이터 작업 1시간.
6. **§10-1 카드 셔플 모션** — 게임 첫인상 강화.

§9-1, §9-2, §9-3 은 LOW. 사용자 보고 시점에만.

---

---

## 13. R11 신규 발견 (2026-04-26 · v90 후)

### R10 검증 결과
- **BOARD_SLOT_FOR_MONTH 영속화** — `start()` 시 reset 정상. 게임 진행 중엔 `currentMonthsSet` 으로 사라진 month free, 새 month 만 빈 슬롯 부여. 사용자 시야 안정.
  - **잠재 edge**: 슬롯 16개 다 찼는데 새 month 생기면 fallback `monthOrder.indexOf(m) % 16` → BOARD_SLOT_USED 갱신 안 함, 슬롯 충돌 가능. 4인 모드(board floor 4 + 매 turn 카드 추가) 라도 16+ 월 동시 등장 거의 불가능 — 안전.
  - **시각 균형 메모**: `indexOf(false)` 가 항상 가장 작은 free 슬롯 부여 → top-center, bottom-center, middle-left, middle-right 순. 처음 4 month 까진 4방향 균형. 그 다음 4 corner. 자연 균형 OK.
- **stack offset 확대** — 카드 너비 52px 기준 35~42% 시인. 슬롯 corner(x=8/92) + ±20px stack ≈ 화면 가장자리 4~12% 안에 포함. 화면 밖 안 나감. OK.

### 13-1. `popScore` 의 `opp-i` 매핑 — 잘못된 상대 박스에 +X점 표시 [HIGH]
- `game.js:755-767` — `boxes[idx]` 로 absolute player idx 사용. 그러나 `.g-opp` 박스는 me 빼고 N-1 개.
- 예: me=0, 상대 player 2 가 점수 받음 → `popScore('+2점', 'opp-2')` → `boxes[2]` = N-1=2 개 중 인덱스 2 → `undefined` 또는 잘못된 박스. 점수 pop 이 (50%, 30%) 화면 중앙에 떨어짐 또는 다른 상대 옆에.
- 같은 패턴: `game.js:1042` — captor bumpBounce 도 `boxes[captorIdx]` (captor 가 me 면 `gameMyCapturedPeek` 분기, 아니면 `boxes[captorIdx]` 잘못된 박스).
- **수정**: `document.querySelector('.g-opp[data-player-idx="' + idx + '"]')` 로 변경 (data-player-idx 는 이미 셋팅됨, `game.js:763`).

### 13-2. `HAND_CUSTOM_ORDER` 가 게임 간 잔존 [MED]
- `game.js:1296` 내외 — `window.HAND_CUSTOM_ORDER = window.HAND_CUSTOM_ORDER || [];`. 사용자가 손패 reorder 하면 카드 ID 배열로 저장.
- `start()` 안에서 reset 안 됨. **새 게임의 카드 ID 가 1..48 deck 의 같은 ID** → orderMap.has(a.id) true → 옛 순서로 정렬. 사용자 입장에선 "왜 손패가 내가 정한 순서랑 다른 의외 순서?".
- **수정**: `start()` 안에 `window.HAND_CUSTOM_ORDER = [];` 추가.

### 13-3. 점수 카운트업 (`animateScoreCount`) cancel 부재 [LOW]
- `game.js:534-547` 내외 — `requestAnimationFrame(tick)` 으로 650ms easing. handle 저장 안 함.
- 짧은 시간 내 두 번 점수 변화 (예: 콤보 매치 + flip 매치 같은 turn) → 첫 애니가 abort 없이 두 번째와 충돌 → 숫자 깜빡 거꾸로 갔다 다시 올라감.
- **수정**: 모듈 scope `_scoreAnimHandle` 에 `requestAnimationFrame` id 저장. 새 호출 시 `cancelAnimationFrame(_scoreAnimHandle)`.

### 13-4. `g-opp` 박스 click 이 항상 `showOpponentDetail` — 점수 옆 클릭 = 상세 상자 띄움
- `game.js:775-778` — `box.addEventListener('click', ...)` 가 박스 전체에 attach. 사용자가 상대 점수만 보고 싶어도 박스 누르면 상세 dialog. 의도는 OK 인데 **장시간 떠 있으면 다음 액션 방해**.
- 메모만 — 사용자 피드백 받으면 진행.

### 13-5. `attachHandDragReorder` — 드래그 후 click 가로채기 timing
- `game.js:1338-1345` 내외 — `suppressClick = true` 로 click 한 번 무시. 그러나 click 이벤트가 비동기 발화되어 다음 render 타이밍과 race 가능. `dragging` 변수도 release 후 `setTimeout(..., 300)` 안에서 reset → 그 사이 다른 카드 탭 시 stale state 영향 가능.
- 실제 빈도 낮음. 메모.

---

## 14. 다음 라운드 추천 (업데이트)

1. **§13-1 popScore opp-i + captor bump 매핑 버그** — `data-player-idx` 사용으로 한 줄 fix (HIGH). `game.js:766` + `game.js:1042` 두 곳.
2. **§13-2 HAND_CUSTOM_ORDER reset** — `start()` 한 줄.
3. **§13-3 score anim cancel** — handle 저장 + cancel.
4. **사운드 S1 진입** — `docs/gostop-sound-design.md` 의 Round S1: Audio Bus 5채널 + 합성 14종 + polyphony manager.
5. **§7-4 bbuk owner 이미 R9** — 검증.

---

_생성: 2026-04-26 · 분석 대상 빌드 v90 · `engine.js` / `gostop-server.js` / `game.js` / `sfx.js` / `lobby.js` / `cards-svg.js` / `service-worker.js` / `index.html` 코드 리딩 + 시뮬레이션 기반_
