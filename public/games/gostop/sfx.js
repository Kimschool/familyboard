// 고스톱 사운드 엔진 v3 (R26 / Sound S2 — 자산+합성 혼합 + 한국 전통 화투 톤 재설계)
// - 5채널 Audio Bus (master / sfx / music / ui / voice)
// - Web Audio synthesis 헬퍼 (sine/saw/square/triangle + ADSR + pitch sweep + biquad noise)
// - NEW: AudioBuffer 자산 로더 — sounds/*.ogg (필수 16 + 선택 matchHit1) 사전 디코드 후 풀 재생
// - Polyphony manager (category 별 동시 cap, oldest fade-out)
// - 합성 + OGG 자산 혼합 라이브러리 (전 타격음/슬라이드/싹쓸이는 OGG, 톤·시그널·점수 jingle 은 합성)
// - 기존 SFX API 호환: clack/ching/flip/myturn/slap/gong/fanfare/lose/score
// - 신규(R12): tap/tick/tickFinal/emojiSend/emojiReceive/dialogOpen/shuffleBurst
// - 신규(R26): shake/bomb/ttadak/jaBbuk/bbukMeok/sseul/chooseHint
// - SFX go/stop/win/goStopPrompt: 맞고·고스톱 콜·승(합성+OGG 혼합, 상용 BGM/효과음 미사용)
//
// === R26 사운드 진단 (사용자 "어색하고 불만" 피드백 대응) ===
// 1) 합성 사각파(square) tap/tick 의 고주파 (2.2kHz / 1.2kHz) 가 모바일 스피커에서 째지는 톤
//    → 음역대를 600~900Hz 쪽으로 낮추고 sine/triangle 로 전환
// 2) cardClack 합성톤은 두 레이어(180Hz sine + bandpass noise) 가 화투 카드 특유의 "탁!"
//    어택 트랜지언트를 표현하기엔 어택이 둔하고 잔향이 부족 → cardPlace OGG 풀로 대체
// 3) gong 110Hz sine 3-layer 가 너무 부드러워서 "뻑/N고" 의 임팩트가 약함
//    → sub-bass kick (60Hz pitch-down) + 짧은 공기노이즈 트랜지언트 추가, 잔향도 길게
// 4) fanfare C-E-G arpeggio 가 너무 짧고(0.22s × 3) 서양적 → 화투 분위기에 안 맞음
//    → 한국 전통 5음 음계(C-D-E-G-A 펜타토닉) 4-note 로 변경, 길이 1.5x, sine + 약한 saw 배음
// 5) coin (점수 jingle) 단발 ding 이 점수 카운트업 7~10회 반복 시 너무 길어서 누적 마스킹
//    → score 신규 키는 짧은(45ms) high-pitch tick 으로 분리, fanfare 트리거는 coin() 유지
// 6) 마스터 EQ 에 lowpass 미적용 → 고주파 에너지 누적으로 청취 피로
//    → 12kHz lowpass + 200Hz highpass 마스터 필터 체인 추가 (전화기 톤 방지)

(function (global) {
  'use strict';

  let ctx = null;
  let muted = (function () { try { return localStorage.getItem('gostopMute') === '1'; } catch { return false; } })();
  let masterVol = (function () { try { return Math.max(0, Math.min(1, Number(localStorage.getItem('gostopMasterVol') || '0.85'))); } catch { return 0.85; } })();
  let buses = null;            // { master, sfx, music, ui, voice } GainNode

  // ===== 자산 로더 — sounds/*.ogg (16 + 선택 matchHit1) =====
  // 모바일/데스크탑 모두 OGG Vorbis 지원 (iOS Safari 14.1+ 도 OK)
  // fetch → arrayBuffer → decodeAudioData 로 사전 디코드. 풀 재생은 BufferSource 매번 new.
  const ASSET_LIST = [
    'cardPlace1','cardPlace2','cardPlace3','cardPlace4',
    'cardShove1','cardShove2',
    'cardSlide1','cardSlide2','cardSlide3',
    'highUp','pepSound1','pepSound2','pepSound3',
    'threeTone1','threeTone2','tone1',
    // 선택: public/games/gostop/sounds/matchHit1.ogg — 패-패 매칭( clack ) 전용. 없으면 기존 cardPlace+합성
    'matchHit1',
  ];
  const BUFFERS = Object.create(null);   // name → AudioBuffer
  let _preloadStarted = false;
  let _preloadDone = false;

  // Polyphony cap — 카테고리별 동시 재생 limit. limit 초과 시 oldest fade-out.
  const POLY = { sfx: [], ui: [], voice: [], music: [] };
  const POLY_LIMIT = { sfx: 6, ui: 3, voice: 2, music: 4 };

  // 같은 SFX 가 너무 가까운 간격으로 연속 호출되면 마스킹/클리핑 — 짧은 쿨다운으로 방어.
  const _lastFire = Object.create(null);
  const _DEFAULT_COOLDOWN = 0.030;
  const _COOLDOWN = {
    tap: 0.020,
    tick: 0.040,
    tickFinal: 0.040,
    cardClack: 0.060,
    cardSlide: 0.060,
    cardFlip: 0.060,
    coin: 0.060,
    score: 0.025,         // R26: 점수 카운트업 반복 — 매우 짧게
    fanfare: 0.500,
    gong: 0.400,
    lose: 0.500,
    myTurn: 0.300,
    emojiSend: 0.080,
    emojiReceive: 0.080,
    dialogOpen: 0.250,
    shuffleBurst: 0.020,
    // R26 신규
    shake: 0.250,
    bomb: 0.350,
    ttadak: 0.080,
    jaBbuk: 0.400,
    bbukMeok: 0.180,
    sseul: 0.350,
    chooseHint: 0.300,
    // 맞고 톤 — 고/스톱/승/매칭
    goCall: 0.320,
    stopCall: 0.380,
    winFan: 0.75,
    goStopPrompt: 0.30,
  };
  function _gateKey(key) {
    const c = ctx; if (!c) return true;
    const now = c.currentTime;
    const cd = (_COOLDOWN[key] != null) ? _COOLDOWN[key] : _DEFAULT_COOLDOWN;
    const last = _lastFire[key] || 0;
    if (now - last < cd) return false;
    _lastFire[key] = now;
    return true;
  }

  function ensureCtx() {
    if (ctx) return ctx;
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) { return null; }
    // 5채널 GainNode + 마스터 EQ 체인 (R26: 12kHz lowpass + 200Hz highpass 로 청취 피로 완화)
    const m = ctx.createGain(); m.gain.value = masterVol;
    const lpf = ctx.createBiquadFilter(); lpf.type = 'lowpass';  lpf.frequency.value = 12000; lpf.Q.value = 0.5;
    const hpf = ctx.createBiquadFilter(); hpf.type = 'highpass'; hpf.frequency.value = 90;    hpf.Q.value = 0.5;
    m.connect(hpf); hpf.connect(lpf); lpf.connect(ctx.destination);
    const sfx = ctx.createGain(); sfx.gain.value = 1.0; sfx.connect(m);
    const music = ctx.createGain(); music.gain.value = 0.55; music.connect(m);
    const ui = ctx.createGain(); ui.gain.value = 0.85; ui.connect(m);
    const voice = ctx.createGain(); voice.gain.value = 0.95; voice.connect(m);
    buses = { master: m, sfx: sfx, music: music, ui: ui, voice: voice };
    // ctx 생성 직후 자산 사전 로드 트리거 (background)
    preloadAssets();
    return ctx;
  }

  function getBus(name) {
    ensureCtx();
    return (buses && buses[name]) || (buses && buses.sfx) || null;
  }

  // ===== Asset preload =====
  function preloadAssets() {
    if (_preloadStarted || !ctx) return;
    _preloadStarted = true;
    let remaining = ASSET_LIST.length;
    ASSET_LIST.forEach(function (name) {
      const url = 'sounds/' + name + '.ogg';
      fetch(url).then(function (r) {
        if (!r.ok) throw new Error('http ' + r.status);
        return r.arrayBuffer();
      }).then(function (ab) {
        return new Promise(function (resolve, reject) {
          // Safari 호환 — promise/callback 양식 모두 지원
          try {
            const p = ctx.decodeAudioData(ab, resolve, reject);
            if (p && typeof p.then === 'function') p.then(resolve, reject);
          } catch (e) { reject(e); }
        });
      }).then(function (buf) {
        BUFFERS[name] = buf;
      }).catch(function () {
        // 자산 로드 실패 — 합성 폴백으로 계속 작동
      }).then(function () {
        if (--remaining === 0) _preloadDone = true;
      });
    });
  }

  // BufferSource 풀 재생 — pitch detune / vol / 약간의 랜덤 디튠으로 반복 호출 fatigue 완화
  function playBuf(name, opts) {
    if (muted) return false;
    const c = ensureCtx(); if (!c) return false;
    const buf = BUFFERS[name];
    if (!buf) return false;       // 미로드 — 합성 폴백 신호
    opts = opts || {};
    const src = c.createBufferSource();
    src.buffer = buf;
    if (opts.detune) src.detune.value = opts.detune;
    if (opts.playbackRate) src.playbackRate.value = opts.playbackRate;
    const g = c.createGain();
    const bus = getBus(opts.bus || 'sfx'); if (!bus) return false;
    src.connect(g); g.connect(bus);
    const now = c.currentTime + (opts.when || 0);
    const peak = opts.vol != null ? opts.vol : 0.7;
    // 짧은 fade-in/out 으로 클릭 노이즈 방지 (5ms / 30ms)
    g.gain.setValueAtTime(0.0001, now);
    g.gain.linearRampToValueAtTime(peak, now + 0.005);
    const dur = buf.duration / (opts.playbackRate || 1);
    if (dur > 0.05) {
      g.gain.setValueAtTime(peak, now + Math.max(0.005, dur - 0.03));
      g.gain.linearRampToValueAtTime(0.0001, now + dur);
    }
    src.start(now);
    src.stop(now + dur + 0.05);
    gateAndAdd(opts.bus || 'sfx', { src: src, gainNode: g });
    return true;
  }

  // 풀에서 랜덤 1개 선택 — variation 으로 같은 효과 반복시 단조로움 방지
  function playBufPool(names, opts) {
    if (!names || !names.length) return false;
    // 로드된 것만 필터
    const ready = names.filter(function (n) { return BUFFERS[n]; });
    if (!ready.length) return false;
    const pick = ready[Math.floor(Math.random() * ready.length)];
    // 약간의 랜덤 디튠 (-40 ~ +40 cents) — 자연스러운 variation
    const det = (opts && opts.detune != null) ? opts.detune : (Math.random() * 80 - 40);
    return playBuf(pick, Object.assign({}, opts, { detune: det }));
  }

  // ===== Polyphony manager =====
  function gateAndAdd(busName, gateObj) {
    const list = POLY[busName] || POLY.sfx;
    const limit = POLY_LIMIT[busName] || 6;
    if (list.length >= limit) {
      const oldest = list.shift();
      try {
        const now = ctx.currentTime;
        oldest.gainNode.gain.cancelScheduledValues(now);
        oldest.gainNode.gain.setValueAtTime(oldest.gainNode.gain.value, now);
        oldest.gainNode.gain.linearRampToValueAtTime(0.0001, now + 0.06);
        setTimeout(function () { try { oldest.src.stop(); } catch {} }, 80);
      } catch {}
    }
    list.push(gateObj);
    if (gateObj.src && typeof gateObj.src.onended !== 'undefined') {
      gateObj.src.onended = function () {
        const i = list.indexOf(gateObj);
        if (i >= 0) list.splice(i, 1);
      };
    }
  }

  // ===== Web Audio synthesis 헬퍼 =====
  function applyEnvelope(g, now, atk, dec, sus, rel, peak) {
    g.gain.cancelScheduledValues(now);
    g.gain.setValueAtTime(0.0001, now);
    g.gain.linearRampToValueAtTime(Math.max(peak, 0.0001), now + atk);
    g.gain.exponentialRampToValueAtTime(Math.max(sus * peak, 0.0001), now + atk + dec);
    g.gain.exponentialRampToValueAtTime(0.0001, now + atk + dec + rel);
  }

  function synthOsc(freq, type, dur, opts) {
    if (muted) return;
    const c = ensureCtx(); if (!c) return;
    opts = opts || {};
    const o = c.createOscillator();
    o.type = type || 'sine';
    o.frequency.value = freq;
    if (opts.detune) o.detune.value = opts.detune;
    const g = c.createGain();
    const bus = getBus(opts.bus || 'sfx');
    if (!bus) return;
    o.connect(g); g.connect(bus);
    const now = c.currentTime + (opts.when || 0);
    const atk = opts.attack != null ? opts.attack : 0.005;
    const dec = opts.decay != null ? opts.decay : Math.min(0.04, dur * 0.2);
    const sus = opts.sustain != null ? opts.sustain : 0.0;
    const rel = opts.release != null ? opts.release : Math.max(0.02, dur - atk - dec);
    const peak = opts.vol != null ? opts.vol : 0.4;
    applyEnvelope(g, now, atk, dec, sus, rel, peak);
    if (opts.pitchTo) {
      o.frequency.setValueAtTime(freq, now);
      o.frequency.linearRampToValueAtTime(opts.pitchTo, now + dur);
    }
    o.start(now);
    o.stop(now + dur + 0.05);
    gateAndAdd(opts.bus || 'sfx', { src: o, gainNode: g });
  }

  function synthNoise(dur, opts) {
    if (muted) return;
    const c = ensureCtx(); if (!c) return;
    opts = opts || {};
    const buf = c.createBuffer(1, Math.max(1, Math.floor(c.sampleRate * dur)), c.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const src = c.createBufferSource(); src.buffer = buf;
    const filter = c.createBiquadFilter();
    filter.type = opts.filterType || 'lowpass';
    filter.frequency.value = opts.filterFreq || 1500;
    if (opts.filterQ) filter.Q.value = opts.filterQ;
    const g = c.createGain();
    const bus = getBus(opts.bus || 'sfx');
    if (!bus) return;
    src.connect(filter); filter.connect(g); g.connect(bus);
    const now = c.currentTime + (opts.when || 0);
    const atk = opts.attack != null ? opts.attack : 0.001;
    const dec = opts.decay != null ? opts.decay : Math.min(0.04, dur * 0.25);
    const sus = opts.sustain != null ? opts.sustain : 0.0;
    const rel = opts.release != null ? opts.release : Math.max(0.02, dur - atk - dec);
    const peak = opts.vol != null ? opts.vol : 0.3;
    applyEnvelope(g, now, atk, dec, sus, rel, peak);
    src.start(now);
    src.stop(now + dur + 0.05);
    gateAndAdd(opts.bus || 'sfx', { src: src, gainNode: g });
  }

  // ===== R26 합성 + OGG 혼합 라이브러리 =====
  const SYNTH = {
    // 사용자 탭 즉시 confirm — R26 음역대 하향 (2200→700Hz), triangle 로 변경, 더 부드럽게
    tap: function () {
      if (!_gateKey('tap')) return;
      synthOsc(700, 'triangle', 0.05, { vol: 0.18, bus: 'ui', attack: 0.001, decay: 0.012, release: 0.035 });
    },
    // 화투끼리 매칭 "탁" — matchHit1.ogg(있으면) 우선 → 그다음 cardPlace 풀 + 합성
    cardClack: function () {
      if (!_gateKey('cardClack')) return;
      if (playBuf('matchHit1', { vol: 0.78, bus: 'sfx' })) return;
      if (playBufPool(['cardPlace1', 'cardPlace2', 'cardPlace3', 'cardPlace4'], { vol: 0.68, bus: 'sfx' })) {
        playBuf('cardShove1', { vol: 0.16, bus: 'sfx', when: 0.01, detune: -25 });
        playBuf('cardShove2', { vol: 0.1, bus: 'sfx', when: 0.02, detune: 12 });
      } else {
        if (playBuf('cardShove1', { vol: 0.5, bus: 'sfx', detune: 10 })) {
          playBuf('cardShove2', { vol: 0.28, bus: 'sfx', when: 0.016, detune: -8 });
        }
      }
      playBufPool(['cardSlide1', 'cardSlide2'], { vol: 0.1, bus: 'sfx', when: 0.003, detune: 50 });
      [0, 0.012, 0.024].forEach(function (t, i) {
        const fq = 260 + (i * 28) - (i > 0 ? 40 : 0);
        synthNoise(0.018, {
          vol: 0.32 - i * 0.06, bus: 'sfx', filterType: 'bandpass', filterFreq: fq, filterQ: 1.15,
          when: t, attack: 0.0003, decay: 0.005, release: 0.012,
        });
        synthNoise(0.01, {
          vol: 0.12 - i * 0.02, bus: 'sfx', filterType: 'lowpass', filterFreq: 700 + i * 100,
          when: t + 0.002, attack: 0.0002, decay: 0.004, release: 0.01,
        });
      });
      synthOsc(88 + Math.random() * 8, 'triangle', 0.03, { vol: 0.1, bus: 'sfx', attack: 0.0006, decay: 0.01, release: 0.018, when: 0.01 });
    },
    // 카드 슬라이드 — R26: cardSlide1~3 OGG 풀
    cardSlide: function () {
      if (!_gateKey('cardSlide')) return;
      if (playBufPool(['cardSlide1','cardSlide2','cardSlide3'], { vol: 0.55, bus: 'sfx' })) return;
      synthNoise(0.18, { vol: 0.22, bus: 'sfx', filterType: 'lowpass', filterFreq: 2200 });
    },
    // 덱 뒤집기 — 합성 유지 (highpass swish + click, OGG 자산보다 즉시성 높음)
    cardFlip: function () {
      if (!_gateKey('cardFlip')) return;
      synthNoise(0.12, { vol: 0.26, bus: 'sfx', filterType: 'highpass', filterFreq: 1200 });
      synthOsc(1400, 'triangle', 0.024, { vol: 0.14, bus: 'sfx', attack: 0.001, decay: 0.008, release: 0.014, when: 0.075 });
    },
    // 점수 fanfare jingle — R26: 한국 펜타토닉 4-note (D-E-G-A), sine + 약한 saw 배음
    coin: function () {
      if (!_gateKey('coin')) return;
      // C5 (523) D5 (587) E5 (659) G5 (783) — 펜타토닉 상행 4-note jingle
      const notes = [523.25, 587.33, 659.25, 783.99];
      notes.forEach(function (f, i) {
        synthOsc(f, 'sine',     0.20, { vol: 0.26, bus: 'sfx', attack: 0.004, decay: 0.05, release: 0.14, when: i * 0.07 });
        synthOsc(f * 2, 'sine', 0.18, { vol: 0.10, bus: 'sfx', attack: 0.004, decay: 0.05, release: 0.13, when: i * 0.07 });
      });
    },
    // 임계 점수/승리 — R26: 펜타토닉 5-note 상행 + 베이스 sub
    fanfare: function () {
      if (!_gateKey('fanfare')) return;
      if (playBuf('threeTone1', { vol: 0.38, bus: 'sfx', detune: -40 })) {
        playBuf('pepSound2', { vol: 0.24, bus: 'sfx', when: 0.08, detune: 60 });
        return;
      }
      // C5 D5 E5 G5 A5 — 한국 전통 5음 + 음 머리에 아주 짧은 '딱' (장단 느낌)
      const notes = [523.25, 587.33, 659.25, 783.99, 880.00];
      notes.forEach(function (f, i) {
        const w = i * 0.095;
        synthOsc(f, 'sine', 0.32, { vol: 0.27, bus: 'sfx', attack: 0.004, decay: 0.055, release: 0.20, when: w });
        synthOsc(f / 2, 'triangle', 0.32, { vol: 0.1, bus: 'sfx', attack: 0.004, decay: 0.055, release: 0.19, when: w });
        synthNoise(0.02, { vol: 0.1, bus: 'sfx', filterType: 'bandpass', filterFreq: 1800, filterQ: 0.7, when: w, attack: 0.0005, decay: 0.008, release: 0.014 });
      });
      synthOsc(98, 'sine', 0.5, { vol: 0.2, bus: 'sfx', attack: 0.006, decay: 0.12, release: 0.38, when: 0.4 });
    },
    // '고' — 계속 (맞고장 상승, 경쾌한 3음 + 은은한 끝박)
    goCall: function () {
      if (!_gateKey('goCall')) return;
      if (playBuf('threeTone2', { vol: 0.5, bus: 'sfx', detune: 80, playbackRate: 1.05 })) {
        playBuf('highUp', { vol: 0.22, bus: 'sfx', when: 0.1, detune: -20 });
        return;
      }
      const step = 0.09;
      [392, 440, 523.25].forEach(function (f, i) {
        synthOsc(f, 'triangle', 0.1, { vol: 0.32 - i * 0.04, bus: 'sfx', attack: 0.002, decay: 0.04, release: 0.06, when: i * step, pitchTo: f * 1.03 });
        synthNoise(0.018, { vol: 0.1, bus: 'sfx', filterType: 'bandpass', filterFreq: 1200, when: i * step + 0.002, attack: 0.0002, decay: 0.006, release: 0.01 });
      });
      synthOsc(185, 'sine', 0.28, { vol: 0.2, bus: 'sfx', attack: 0.004, decay: 0.08, release: 0.2, when: 0.32 });
    },
    // '스톱' / 판 끊김 — 하강 + 한 방의 종(맞고 승냥/마감)
    stopCall: function () {
      if (!_gateKey('stopCall')) return;
      if (playBuf('tone1', { vol: 0.45, bus: 'sfx', detune: -200, playbackRate: 0.9 })) {
        playBuf('pepSound3', { vol: 0.2, bus: 'sfx', when: 0.2, detune: 0 });
        return;
      }
      synthOsc(440, 'triangle', 0.2, { vol: 0.3, bus: 'sfx', attack: 0.005, decay: 0.06, release: 0.1, when: 0, pitchTo: 329.63 });
      synthOsc(329.63, 'sine', 0.22, { vol: 0.22, bus: 'sfx', attack: 0.01, decay: 0.07, release: 0.14, when: 0.2, pitchTo: 220 });
      synthNoise(0.04, { vol: 0.2, bus: 'sfx', filterType: 'lowpass', filterFreq: 500, when: 0, attack: 0.002, decay: 0.05, release: 0.1 });
      synthOsc(880, 'sine', 0.5, { vol: 0.2, bus: 'voice', attack: 0.003, decay: 0.15, release: 0.35, when: 0.38 });
      synthOsc(1318, 'sine', 0.4, { vol: 0.1, bus: 'voice', attack: 0.003, decay: 0.12, release: 0.3, when: 0.4 });
    },
    // 승리 — 상행 아르페지 + 베이스, OGG 있으면 얹기만
    winFanfare: function () {
      if (!_gateKey('winFan')) return;
      if (playBuf('threeTone1', { vol: 0.45, bus: 'music' })) {
        playBuf('pepSound1', { vol: 0.3, bus: 'music', when: 0.1, detune: 100 });
        playBuf('pepSound2', { vol: 0.25, bus: 'music', when: 0.2, detune: 50 });
        playBuf('highUp', { vol: 0.2, bus: 'sfx', when: 0.32, detune: 30 });
        return;
      }
      const u = 0.08;
      const up = [523.25, 587.33, 659.25, 698.46, 783.99, 880, 1046.5];
      up.forEach(function (f, i) {
        synthOsc(f, 'sine', 0.24, { vol: 0.28, bus: 'music', attack: 0.003, decay: 0.08, release: 0.16, when: i * u });
        synthNoise(0.028, { vol: 0.1, bus: 'music', filterType: 'highpass', filterFreq: 2000, when: i * u, attack: 0.0003, decay: 0.01, release: 0.02 });
      });
      synthNoise(0.1, { vol: 0.2, bus: 'sfx', filterType: 'bandpass', filterFreq: 2200, when: 0.52, attack: 0.001, decay: 0.06, release: 0.12 });
      synthOsc(65, 'sine', 0.85, { vol: 0.32, bus: 'sfx', attack: 0.01, decay: 0.16, release: 0.58, when: 0.55, pitchTo: 48 });
    },
    // 고/스톱 고르기 패널 — 긴장감(짧은 3도 + 베이스)
    goStopPrompt: function () {
      if (!_gateKey('goStopPrompt')) return;
      if (playBuf('tone1', { vol: 0.35, bus: 'ui', detune: 60 })) {
        return;
      }
      synthOsc(523.25, 'triangle', 0.12, { vol: 0.22, bus: 'ui', attack: 0.004, decay: 0.05, release: 0.08 });
      synthOsc(659.25, 'triangle', 0.1, { vol: 0.2, bus: 'ui', attack: 0.004, decay: 0.05, release: 0.08, when: 0.1 });
      synthOsc(196, 'sine', 0.2, { vol: 0.1, bus: 'sfx', attack: 0.02, decay: 0.08, release: 0.12, when: 0.05 });
    },
    // 뻑/N고 — R26: sub-bass kick + gong 3-layer 강화 + 짧은 air 트랜지언트
    gong: function () {
      if (!_gateKey('gong')) return;
      // sub kick — 60Hz pitch-down, 강한 어택
      synthOsc(120, 'sine', 0.18, { vol: 0.42, bus: 'sfx', attack: 0.001, decay: 0.05, release: 0.13, pitchTo: 55 });
      // gong body — 110/165/220 Hz 3-layer (옥타브+5도)
      synthOsc(110, 'sine', 0.85, { vol: 0.34, bus: 'sfx', attack: 0.005, decay: 0.18, release: 0.65, when: 0.005 });
      synthOsc(165, 'sine', 0.75, { vol: 0.20, bus: 'sfx', attack: 0.008, decay: 0.18, release: 0.55, when: 0.008 });
      synthOsc(220, 'sine', 0.65, { vol: 0.10, bus: 'sfx', attack: 0.010, decay: 0.16, release: 0.45, when: 0.012 });
      // air 트랜지언트 — 묵직한 임팩트 보강
      synthNoise(0.04, { vol: 0.15, bus: 'sfx', filterType: 'lowpass', filterFreq: 800 });
    },
    // 패배 — R26: 단조 하강 4-note (A-G-E-D), 더 천천히, 잔향 길게
    lose: function () {
      if (!_gateKey('lose')) return;
      const notes = [440, 392, 329.63, 293.66];
      notes.forEach(function (f, i) {
        synthOsc(f, 'sine', 0.36, { vol: 0.22, bus: 'sfx', attack: 0.012, decay: 0.07, release: 0.28, when: i * 0.18 });
      });
    },
    // 내 차례 알림 chime — R26: 부드러운 2-note (E5+B5)
    myTurn: function () {
      if (!_gateKey('myTurn')) return;
      synthOsc(659.25, 'triangle', 0.22, { vol: 0.24, bus: 'voice', attack: 0.005, decay: 0.06, release: 0.16 });
      synthOsc(987.77, 'sine',     0.20, { vol: 0.16, bus: 'voice', attack: 0.005, decay: 0.05, release: 0.15, when: 0.07 });
    },
    // 카운트다운 tick — R26: 음역대 하향 (900→680), triangle
    tick: function () {
      if (!_gateKey('tick')) return;
      synthOsc(680, 'triangle', 0.05, { vol: 0.22, bus: 'ui', attack: 0.001, decay: 0.018, release: 0.03 });
    },
    // 마지막 1초 alarm tick — R26: 1200→900Hz, triangle
    tickFinal: function () {
      if (!_gateKey('tickFinal')) return;
      synthOsc(900, 'triangle', 0.08, { vol: 0.32, bus: 'ui', attack: 0.001, decay: 0.025, release: 0.05 });
    },
    emojiSend: function () {
      if (!_gateKey('emojiSend')) return;
      synthOsc(660, 'sine', 0.10, { vol: 0.20, bus: 'ui', attack: 0.002, decay: 0.03, release: 0.06, pitchTo: 1320 });
    },
    emojiReceive: function () {
      if (!_gateKey('emojiReceive')) return;
      synthOsc(1100, 'triangle', 0.10, { vol: 0.18, bus: 'ui', attack: 0.002, decay: 0.03, release: 0.06 });
    },
    dialogOpen: function () {
      if (!_gateKey('dialogOpen')) return;
      synthOsc(440, 'sine', 0.16, { vol: 0.18, bus: 'ui', attack: 0.005, decay: 0.04, release: 0.12, pitchTo: 660 });
    },
    // 셔플 burst — R26: cardSlide OGG 풀 사용 (자연스러운 종이 마찰음)
    shuffleBurst: function () {
      if (!_gateKey('shuffleBurst')) return;
      if (playBufPool(['cardSlide1','cardSlide2','cardSlide3'], { vol: 0.40, bus: 'sfx' })) return;
      synthNoise(0.06, { vol: 0.20, bus: 'sfx', filterType: 'bandpass', filterFreq: 1800, filterQ: 0.8 });
    },

    // ===== R26 신규 키 7종 =====
    // 흔들기 선언 — 단호한 짧은 트레몰로 + 종 (jaBbuk OGG 활용 가능시 사용, 폴백 합성)
    shake: function () {
      if (!_gateKey('shake')) return;
      // pitch-tremolo 한 번 + 종 chime
      synthOsc(880, 'sine', 0.18, { vol: 0.28, bus: 'sfx', attack: 0.003, decay: 0.04, release: 0.13, pitchTo: 988 });
      synthOsc(1318.51, 'triangle', 0.20, { vol: 0.18, bus: 'sfx', attack: 0.005, decay: 0.05, release: 0.14, when: 0.09 });
    },
    // 폭탄 발사 — 묵직한 임팩트 + 짧은 잔향 (sub-bass + 와이드밴드 노이즈)
    bomb: function () {
      if (!_gateKey('bomb')) return;
      // sub-bass slam (80→30Hz pitch down)
      synthOsc(80, 'sine', 0.45, { vol: 0.45, bus: 'sfx', attack: 0.001, decay: 0.08, release: 0.36, pitchTo: 30 });
      // mid-low body
      synthOsc(160, 'sine', 0.30, { vol: 0.22, bus: 'sfx', attack: 0.002, decay: 0.06, release: 0.22, pitchTo: 60, when: 0.002 });
      // 폭발 노이즈 burst
      synthNoise(0.18, { vol: 0.30, bus: 'sfx', filterType: 'lowpass', filterFreq: 1800, when: 0 });
      // 잔향 tail — 약한 하이패스 노이즈
      synthNoise(0.25, { vol: 0.10, bus: 'sfx', filterType: 'highpass', filterFreq: 2200, when: 0.05 });
    },
    // 따닥(연속 매치) — 경쾌한 더블 클릭 (threeTone2 OGG 활용 우선, 폴백 합성)
    ttadak: function () {
      if (!_gateKey('ttadak')) return;
      if (playBuf('threeTone2', { vol: 0.50, bus: 'sfx', detune: 200 })) return;
      // 폴백 — 빠른 2회 cardClack 미니 버전
      synthOsc(220, 'sine', 0.05, { vol: 0.30, bus: 'sfx', attack: 0.001, decay: 0.02, release: 0.03 });
      synthOsc(220, 'sine', 0.05, { vol: 0.30, bus: 'sfx', attack: 0.001, decay: 0.02, release: 0.03, when: 0.075 });
      synthNoise(0.03, { vol: 0.18, bus: 'sfx', filterType: 'bandpass', filterFreq: 950, filterQ: 1.2, when: 0.075 });
    },
    // 자뻑 — 의기양양한 짧은 jingle (threeTone1 OGG 우선)
    jaBbuk: function () {
      if (!_gateKey('jaBbuk')) return;
      if (playBuf('threeTone1', { vol: 0.60, bus: 'sfx' })) return;
      // 폴백 — G-B-D 상행 트라이어드
      const notes = [392, 493.88, 587.33];
      notes.forEach(function (f, i) {
        synthOsc(f, 'triangle', 0.15, { vol: 0.24, bus: 'sfx', attack: 0.003, decay: 0.04, release: 0.11, when: i * 0.07 });
      });
    },
    // 뻑먹기 — 갈취 느낌의 슬쩍 슬라이드 (highUp OGG 우선)
    bbukMeok: function () {
      if (!_gateKey('bbukMeok')) return;
      if (playBuf('highUp', { vol: 0.55, bus: 'sfx' })) return;
      // 폴백 — pitch sweep up
      synthOsc(330, 'sine', 0.22, { vol: 0.28, bus: 'sfx', attack: 0.005, decay: 0.05, release: 0.17, pitchTo: 880 });
      synthNoise(0.10, { vol: 0.12, bus: 'sfx', filterType: 'highpass', filterFreq: 1500 });
    },
    // 쓸(싹쓸이) — 빗자루 쓸어담는 느낌 (cardShove1~2 OGG 풀)
    sseul: function () {
      if (!_gateKey('sseul')) return;
      if (playBufPool(['cardShove1','cardShove2'], { vol: 0.65, bus: 'sfx' })) return;
      // 폴백 — 긴 하강 노이즈 sweep
      synthNoise(0.45, { vol: 0.30, bus: 'sfx', filterType: 'lowpass', filterFreq: 3500 });
      synthOsc(440, 'sine', 0.32, { vol: 0.16, bus: 'sfx', attack: 0.01, decay: 0.06, release: 0.25, pitchTo: 110 });
    },
    // 점수 카운트업 tick — R26 신규: 매우 짧은 high pitch tick (반복 호출 가정)
    score: function () {
      if (!_gateKey('score')) return;
      // pepSound1~3 풀에서 랜덤 — variation 으로 단조로움 방지, 폴백시 합성 짧은 tick
      if (playBufPool(['pepSound1','pepSound2','pepSound3'], { vol: 0.32, bus: 'sfx' })) return;
      synthOsc(1320, 'sine', 0.04, { vol: 0.20, bus: 'sfx', attack: 0.001, decay: 0.012, release: 0.025 });
    },
    // 안내 비프 — choose-hand-match phase 진입 시 (tone1 OGG 우선)
    chooseHint: function () {
      if (!_gateKey('chooseHint')) return;
      if (playBuf('tone1', { vol: 0.40, bus: 'voice' })) return;
      // 폴백 — 부드러운 2음 chime (E5→G5)
      synthOsc(659.25, 'sine', 0.14, { vol: 0.20, bus: 'voice', attack: 0.005, decay: 0.04, release: 0.10 });
      synthOsc(783.99, 'sine', 0.14, { vol: 0.16, bus: 'voice', attack: 0.005, decay: 0.04, release: 0.10, when: 0.07 });
    },
  };

  // ===== 외부 SFX API — 기존 호환 + R26 신규 =====
  const SFX = {
    // 기존 — 합성/혼합 백엔드
    clack:   function () { SYNTH.cardClack(); },
    ching:   function () { SYNTH.cardSlide(); },
    flip:    function () { SYNTH.cardFlip(); },
    myturn:  function () { SYNTH.myTurn(); },
    slap:    function () { SYNTH.cardSlide(); },
    gong:    function () { SYNTH.gong(); },
    fanfare: function () { SYNTH.fanfare(); },
    lose:    function () { SYNTH.lose(); },
    // R26: score 는 짧은 카운트업 tick 으로 분리 (기존 coin jingle 은 별도)
    score:   function () { SYNTH.score(); },
    coin:    function () { SYNTH.coin(); },
    // R12 신규
    tap:          function () { SYNTH.tap(); },
    tick:         function () { SYNTH.tick(); },
    tickFinal:    function () { SYNTH.tickFinal(); },
    emojiSend:    function () { SYNTH.emojiSend(); },
    emojiReceive: function () { SYNTH.emojiReceive(); },
    dialogOpen:   function () { SYNTH.dialogOpen(); },
    shuffleBurst: function () { SYNTH.shuffleBurst(); },
    // R26 신규 7종 (game.js 호출은 UX 에이전트 후속 단계에서 결선 — 키만 사전 정의)
    shake:      function () { SYNTH.shake(); },
    bomb:       function () { SYNTH.bomb(); },
    ttadak:     function () { SYNTH.ttadak(); },
    jaBbuk:     function () { SYNTH.jaBbuk(); },
    bbukMeok:   function () { SYNTH.bbukMeok(); },
    sseul:      function () { SYNTH.sseul(); },
    chooseHint: function () { SYNTH.chooseHint(); },
    // 맞고/고스톱 콜 — go(), stop(), win(), goStopPrompt()
    go:          function () { SYNTH.goCall(); },
    stop:        function () { SYNTH.stopCall(); },
    win:         function () { SYNTH.winFanfare(); },
    goStopPrompt: function () { SYNTH.goStopPrompt(); },
  };

  function setMuted(m) {
    muted = !!m;
    try { localStorage.setItem('gostopMute', muted ? '1' : '0'); } catch {}
  }
  function isMuted() { return muted; }

  function setMasterVol(v) {
    masterVol = Math.max(0, Math.min(1, Number(v) || 0));
    try { localStorage.setItem('gostopMasterVol', String(masterVol)); } catch {}
    if (buses && buses.master && ctx) {
      const now = ctx.currentTime;
      const g = buses.master.gain;
      try { g.cancelScheduledValues(now); g.setValueAtTime(g.value, now); g.linearRampToValueAtTime(masterVol, now + 0.02); }
      catch { g.value = masterVol; }
    } else if (buses && buses.master) {
      buses.master.gain.value = masterVol;
    }
  }
  function getMasterVol() { return masterVol; }

  function setBusVol(name, v) {
    const bus = getBus(name);
    if (bus) bus.gain.value = Math.max(0, Math.min(1.5, Number(v) || 0));
  }

  global.GostopSFX = {
    sfx: SFX,
    setMuted: setMuted,
    isMuted: isMuted,
    setMasterVol: setMasterVol,
    getMasterVol: getMasterVol,
    setBusVol: setBusVol,
    ensure: function () {
      const c = ensureCtx();
      // iOS Safari 'interrupted' 도 resume 시도
      if (c && (c.state === 'suspended' || c.state === 'interrupted')) {
        try { c.resume(); } catch {}
      }
      // 첫 사용자 제스처 시 자산 사전 로드 (ensureCtx 가 이미 호출했지만 race 가드)
      preloadAssets();
      return c;
    },
    // R26: 명시적 preload — 사용자 제스처 후 lobby 에서 호출 가능
    preload: function () { ensureCtx(); preloadAssets(); },
    // 내부 진단용 — 자산 로드 상태 확인
    _stats: function () {
      return { loaded: Object.keys(BUFFERS).length, total: ASSET_LIST.length, done: _preloadDone };
    },
  };
})(typeof self !== 'undefined' ? self : this);
