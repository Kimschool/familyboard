// 고스톱 효과음 — Web Audio 합성 (파일 0MB). iOS 는 첫 유저 제스처 후 활성.
(function (global) {
  'use strict';

  let ctx = null;
  let muted = localStorage.getItem('gostopMute') === '1';

  function ensureCtx() {
    if (ctx) return ctx;
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) { return null; }
    return ctx;
  }

  function now() { return ctx ? ctx.currentTime : 0; }

  function tone(freq, durMs, opts) {
    if (muted) return;
    const c = ensureCtx();
    if (!c) return;
    opts = opts || {};
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = opts.type || 'sine';
    osc.frequency.setValueAtTime(freq, c.currentTime);
    if (opts.freqEnd) osc.frequency.exponentialRampToValueAtTime(opts.freqEnd, c.currentTime + durMs / 1000);
    const vol = opts.vol == null ? 0.15 : opts.vol;
    gain.gain.setValueAtTime(0.0001, c.currentTime);
    gain.gain.exponentialRampToValueAtTime(vol, c.currentTime + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + durMs / 1000);
    osc.connect(gain).connect(c.destination);
    osc.start();
    osc.stop(c.currentTime + durMs / 1000 + 0.02);
  }

  function noise(durMs, opts) {
    if (muted) return;
    const c = ensureCtx();
    if (!c) return;
    opts = opts || {};
    const bufSize = (c.sampleRate * durMs) / 1000;
    const buf = c.createBuffer(1, bufSize, c.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / bufSize);
    const src = c.createBufferSource();
    src.buffer = buf;
    const filter = c.createBiquadFilter();
    filter.type = opts.filter || 'bandpass';
    filter.frequency.value = opts.freq || 1200;
    filter.Q.value = opts.Q || 2;
    const gain = c.createGain();
    gain.gain.value = opts.vol == null ? 0.18 : opts.vol;
    src.connect(filter).connect(gain).connect(c.destination);
    src.start();
  }

  const SFX = {
    // 카드 치는 찰싹 (노이즈 short + 저음 쿵)
    slap: function () {
      noise(60, { freq: 1800, Q: 1, vol: 0.22 });
      tone(120, 90, { type: 'sine', vol: 0.18 });
    },
    // 카드 획득 — 상승 종소리
    ching: function () {
      tone(900, 150, { type: 'triangle', freqEnd: 1500, vol: 0.16 });
      setTimeout(function () { tone(1400, 180, { type: 'sine', vol: 0.12 }); }, 60);
    },
    // 덱 뒤집기 — 짧은 swish
    flip: function () {
      noise(120, { freq: 800, Q: 0.8, vol: 0.15 });
    },
    // 고 — 징 소리
    gong: function () {
      tone(200, 400, { type: 'sine', vol: 0.25 });
      tone(300, 400, { type: 'sine', vol: 0.12 });
      tone(600, 350, { type: 'triangle', vol: 0.1 });
    },
    // 스톱/승리 — 팡파르 C E G C
    fanfare: function () {
      const notes = [523.25, 659.25, 783.99, 1046.5];
      notes.forEach(function (f, i) {
        setTimeout(function () { tone(f, 280, { type: 'triangle', vol: 0.18 }); }, i * 100);
      });
    },
    // 패배 — 하강 음
    lose: function () {
      tone(400, 250, { type: 'sine', freqEnd: 200, vol: 0.15 });
      setTimeout(function () { tone(300, 400, { type: 'sine', freqEnd: 150, vol: 0.12 }); }, 150);
    },
    // 내 차례 알림 — 짧은 두 번 삐
    myturn: function () {
      tone(880, 80, { type: 'sine', vol: 0.1 });
      setTimeout(function () { tone(1100, 100, { type: 'sine', vol: 0.1 }); }, 90);
    },
  };

  function setMuted(m) {
    muted = !!m;
    localStorage.setItem('gostopMute', muted ? '1' : '0');
  }
  function isMuted() { return muted; }

  global.GostopSFX = { sfx: SFX, setMuted: setMuted, isMuted: isMuted, ensure: ensureCtx };
})(typeof self !== 'undefined' ? self : this);
