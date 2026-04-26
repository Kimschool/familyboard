# 고스톱 사운드 디자인 마스터 플랜

> 게임 사운드 디자이너 관점에서 현재 시스템 진단 + 3 라운드 단계적 재설계.
> 사용자 평가: "초급 개발자 수준". 목표: 한게임/넷마블 캐주얼 게임 표준 수준의 audio polish.

## 1. 현재 시스템 진단 (sfx.js v85~v90)

### 1-1. 아키텍처 한계
- **단일 게인 채널** — 모든 사운드가 `ctx.destination` 으로 직결. 카테고리별 볼륨 조절 / sidechain 불가.
- **Polyphony 무제한** — 매 카드 매치마다 buffer source 새로 만듦. 빠른 봇 액션 4~5개 연속 시 cacophony.
- **Stereo pan 부재** — 상대 카드 / 내 카드 / 시스템 알림이 모두 mono 같은 위치.
- **Web Audio synthesis 미사용** — 모든 사운드가 외부 OGG 파일 의존. iOS 17 미만 Safari OGG decode 실패 시 무음.
- **BGM 없음** — ambient pad / 분위기 음악 0개. 정적인 인터페이스 느낌.

### 1-2. 콘텐츠 한계
- **사운드 종류 9개**, 그 중 **5개는 dead code** 였음 (R2 에서 4개 살림: fanfare/gong/lose/score 통합).
- **녹음 출처 단일**: Kenney CC0 Casino pack 만. 사운드 톤이 한 색조 (밝은 슬롯머신/카지노).
- **layering 없음**: 카드 매치 = `cardPlace.ogg` 한 발. 진짜 게임은 base + transient + tail 3-layer 로 풍성한 임팩트.
- **velocity 없음**: 매치 1점/3점/싹쓸이가 다 같은 sample. 강도 표현 0.

### 1-3. 인터랙션 누락
- **사용자 탭 즉시 confirm 사운드 없음** — 카드 탭 → 0~275ms 무음 → centerpiece 클릭 — 인과관계 끊김.
- **5초 카운트다운 진동만, tick 사운드 없음** — 위급 알림 약함.
- **이모지 발사/수신 무음** — 가족 게임의 핵심인 reaction 인데 음향 피드백 없음.
- **고/스톱 다이얼로그 등장 무음** — 큰 결정 순간인데 적막.
- **봇 thinking 무음** — "생각중..." dots 만, ambient 없음.
- **셔플 모션 자체가 없음** → 셔플 사운드도 없음 (R10 §10-1 카드 셔플 모션이 구현되면 동기화 필요).

---

## 2. 사운드 디자인 표준 (모바일 캐주얼 게임)

| 영역 | 표준 | 현재 위치 |
|---|---|---|
| Audio Bus 분리 | master / sfx / music / ui / voice 5채널 | ❌ 1채널 |
| Polyphony | category 별 동시 4~6개 cap, oldest fade-out | ❌ 무제한 |
| Sidechain ducking | SFX 발화 시 BGM -8dB 일시 감쇠 | ❌ BGM 자체 없음 |
| Velocity layers | 강도별 다른 sample (피아니시모/포르테) | ❌ 단일 |
| Layering | base + transient + tail 3-layer | ❌ 단일 |
| Stereo positioning | 상대/내/시스템 분리 | ❌ mono |
| Adaptive intensity | 점수 임박 시 BGM tempo↑ | ❌ |
| Cross-format fallback | mp3/aac + ogg dual | ❌ ogg only |
| User volume control | master + 카테고리 슬라이더 | ❌ mute toggle 만 |
| Web Audio synthesis | 가벼운 사운드 즉석 합성 | ❌ |

10개 영역 모두 미흡. R2 에서 dead code 살림은 콘텐츠 채움이지 시스템 변화 아님.

---

## 3. 3 라운드 재설계 플랜

### Round S1: 인프라 — Audio Bus + 합성 라이브러리
**목표**: 향후 모든 사운드 작업의 기반 마련.

- `sfx.js` 확장 — `AudioContext` 위에 5채널 GainNode (master/sfx/music/ui/voice).
- Polyphony manager — category 별 활성 source list, limit (sfx:6, ui:3, voice:2). limit 초과 시 oldest 60ms fade-out.
- Web Audio synthesis 헬퍼:
  - `synthOsc(freq, type, dur, opts)` — sine/saw/square/triangle + ADSR envelope + pitch sweep.
  - `synthNoise(dur, opts)` — white/brown noise + biquad filter + ADSR.
- 합성 사운드 14종:
  | 이름 | 용도 | 합성 |
  |---|---|---|
  | tap | 사용자 탭 즉시 confirm | square 2200Hz, 40ms |
  | cardClack | 매치 탁! | sine 180→90Hz + bandpass noise burst |
  | cardSlide | 매치 실패 | lowpass noise 180ms |
  | cardFlip | 덱 뒤집기 | highpass noise + 1500Hz click |
  | coin | 점수 획득 | triangle 1320Hz + sine 1980Hz |
  | fanfare | 임계 달성/승리 | saw arpeggio C5-E5-G5 |
  | gong | 뻑/N고 | sine 110+165+440Hz, 0.7s decay |
  | lose | 패배 | sine A4-F4-D4 descending |
  | myTurn | 내 차례 | triangle 880+1318Hz |
  | tick | 5초 카운트 | square 900Hz, 50ms |
  | tickFinal | 마지막 1초 | square 1200Hz, 80ms |
  | emojiSend | 이모지 발사 | sine 660→1320Hz sweep |
  | emojiReceive | 이모지 수신 | triangle 1100Hz |
  | dialogOpen | 다이얼로그 등장 | sine 440→660Hz |
  | shuffleBurst | 셔플 burst | bandpass noise 60ms |
- `SFX` API 호환 유지 — 기존 `clack/ching/flip/myturn` 은 합성 사운드로 백엔드 교체. OGG 파일은 옵션 (사용자가 선호 시).
- `setMasterVol` / `getMasterVol` API + localStorage `gostopMasterVol`.

**예상 코드**: sfx.js 132줄 → ~330줄. game.js 호출 추가 5곳.

### Round S2: BGM + Mixing
**목표**: 살아있는 룸 분위기 + 동시 재생 품질.

- BGM ambient pad — Web Audio 로 합성:
  - 가야금 simulation: plucked string (Karplus-Strong 알고리즘) 5음 페달 톤.
  - 또는 sine + filtered noise 가 만드는 정적 ambient.
  - 8s 루프, music bus 0.45 default.
- Sidechain ducking — sfx bus 발화 시 music gain 0.45 → 0.18 (200ms ramp), 600ms 후 복귀.
- Stereo pan — 상대 박스의 view position 에 따라 사운드 stereoPanner. 내 사운드 +0.15R (중앙 우측), 상대 -0.4L 등.
- 마스터 볼륨 슬라이더 UI — `index.html` 헤더에 작은 slider 추가, `setMasterVol` 호출.
- 사용자 첫 카드 탭 = `SFX.tap()` 즉시 + 매치 처리 후 cardClack — 0ms 인풋 피드백.

### Round S3: 시그니처 사운드 + 한국풍 polish
**목표**: 게임의 "기억에 남는" 순간들.

- "고!" voice — synthesized vowel formant (오, 아, 이) + low gong. 또는 사용자가 녹음한 wav 옵션 (드롭 파일).
- "스톱!" voice — 비슷한 합성 또는 녹음.
- 승리 한국풍 melody — 가야금 simulation 으로 5도 화음 한 마디 (도 솔 도 미 솔 1.5s).
- 패배 한국풍 — 단조로 하강 가야금 (라 미 도 라).
- 셔플 시퀀스 사운드 — 카드 셔플 모션 (R10 §10-1)이 구현되면 cardSlide × 4 + 마지막 cardClack.
- 봇 thinking ambient — Lv 별 다른 hum tone (낮은 봇은 부드럽고, 마왕 Lv.20 은 minor key 어두운 sub-bass).
- 매치 시 captured 카드 종류별 layering:
  - 광 캡처: cardClack + 가벼운 chime (1320Hz triangle 80ms).
  - 띠 캡처: cardClack + ribbon-like swish (highpass noise 50ms).
  - 피 캡처: cardClack 만.

---

## 4. 구현 우선순위 — 사용자 체감 순서

1. **Round S1 사용자 탭 confirm + 5초 tick** — 즉시 체감 ↑↑.
2. **Round S2 BGM + ducking** — "게임이 살아있다" 느낌 ↑↑.
3. **Round S3 "고/스톱" 시그니처** — 시그니처 모먼트 ↑↑↑.
4. Round S2 stereo pan — 4인 모드에서 큰 도움.
5. Round S3 봇 thinking ambient — 캐주얼 가족 톤.

---

## 5. 외부 의존성 / 자산 부족

- **녹음 자산 0** — 모든 사운드를 Web Audio synthesis 로 한다는 가정. 더 풍성하게 하려면:
  - 한국 가야금 sample (CC0 또는 자체 녹음).
  - "고/스톱" 보이스 (가족이 직접 녹음하면 정서 +)
  - 카드 충돌음 고품질 wav.
- 라이센스 — 현재 OGG 는 Kenney CC0 (안전). 추가 자산도 CC0 우선.

---

_생성: 2026-04-26 · 분석 대상 빌드 v90 · `sfx.js` / `game.js` 사운드 호출 분석 + Web Audio API 표준 reference_
