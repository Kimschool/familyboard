// 멘트 읽기 — 브라우저 내장 Web Speech API (한국어 음성). 별도 라이브러리 없음.
(function (global) {
  'use strict';
  const STORAGE_KEY = 'gostop_tts_enabled';
  var cachedVoice = null;
  var lastHintKey = '';

  function isSupported() {
    return typeof global.speechSynthesis !== 'undefined' && typeof SpeechSynthesisUtterance !== 'undefined';
  }

  function isEnabled() {
    try { return localStorage.getItem(STORAGE_KEY) === '1'; } catch { return false; }
  }

  function setEnabled(on) {
    var v = !!on;
    try { localStorage.setItem(STORAGE_KEY, v ? '1' : '0'); } catch {}
    if (v) lastHintKey = '';
    else stop();
    return v;
  }

  function pickKoVoice() {
    if (cachedVoice) return cachedVoice;
    var list = global.speechSynthesis.getVoices() || [];
    var i, v;
    for (i = 0; i < list.length; i++) {
      v = list[i];
      if (v.lang && (v.lang === 'ko-KR' || v.lang.toLowerCase().indexOf('ko') === 0)) {
        cachedVoice = v;
        return v;
      }
    }
    return null;
  }

  if (isSupported() && global.speechSynthesis.addEventListener) {
    global.speechSynthesis.addEventListener('voiceschanged', function () { cachedVoice = null; });
  }

  // 이모지·装飾 — 읽을 때 건너뛰기
  function toSpeakable(s) {
    if (s == null) return '';
    var t = String(s).replace(/\r?\n/g, ' ');
    t = t.replace(/[⚠️⏰👉🏆💸🙃🤝🎴✨📋·…]/g, ' ');
    try {
      t = t.replace(/[\p{Extended_Pictographic}]/gu, ' ');
    } catch (e) {
      t = t.replace(/[\uD83C-\uDBFF][\uDC00-\uDFFF]/g, ' ');
    }
    t = t.replace(/\s+/g, ' ').trim();
    return t;
  }

  function stop() {
    try { global.speechSynthesis.cancel(); } catch (e) {}
  }

  function speakInternal(text, priority) {
    if (!isSupported() || !isEnabled()) return;
    var plain = toSpeakable(text);
    if (!plain) return;
    stop();
    var u = new SpeechSynthesisUtterance(plain);
    u.lang = 'ko-KR';
    u.rate = 0.96;
    u.pitch = 1.0;
    u.volume = 0.95;
    var v = pickKoVoice();
    if (v) u.voice = v;
    try { global.speechSynthesis.speak(u); } catch (e) {}
  }

  function speakToast(msg) {
    if (!isEnabled() || !msg) return;
    speakInternal(msg, 'toast');
  }

  function speakHintOnce(dedupKey, text) {
    if (!isEnabled() || !text) return;
    if (String(dedupKey) === lastHintKey) return;
    lastHintKey = String(dedupKey);
    speakInternal(text, 'hint');
  }

  function resetHintTracking() {
    lastHintKey = '';
  }

  function updateButtonUI(btn) {
    if (!btn) return;
    var on = isEnabled();
    btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    btn.classList.toggle('is-tts-on', on);
    btn.title = on ? '멘트 읽기(음성) 켜짐 — 탭해 끄기' : '멘트 읽기(음성) 켜기';
    btn.setAttribute('aria-label', on ? '멘트 읽기 켜짐' : '멘트 읽기 끄기');
    btn.textContent = on ? '🗣' : '🎙';
  }

  function init(opts) {
    opts = opts || {};
    var btn = opts.btn;
    if (btn) {
      updateButtonUI(btn);
      btn.addEventListener('click', function () {
        if (!isSupported()) {
          alert('이 브라우저는 읽기 음성(음성 합성)을 지원하지 않아요.');
          return;
        }
        setEnabled(!isEnabled());
        updateButtonUI(btn);
        if (isEnabled()) speakInternal('멘트 읽기 켰어요', 'toast');
      });
    }
    if (isSupported() && global.speechSynthesis.getVoices().length === 0) {
      setTimeout(function () { pickKoVoice(); }, 300);
    }
  }

  global.GostopTTS = {
    isSupported: isSupported,
    isEnabled: isEnabled,
    setEnabled: setEnabled,
    speak: speakInternal,
    speakToast: speakToast,
    speakHintOnce: speakHintOnce,
    resetHintTracking: resetHintTracking,
    stop: stop,
    toSpeakable: toSpeakable,
    init: init
  };
})(typeof self !== 'undefined' ? self : this);
