/**
 * Japanese Learning System - Text-to-Speech Module
 *
 * Uses the browser's Web Speech API to speak Japanese text.
 * Robustly handles asynchronous voice loading, selects a Japanese voice,
 * and exposes an audio-readiness status so the UI can guide the user when
 * no Japanese voice is installed.
 */
(function() {
  'use strict';

  var speaking = false;
  var rate = 1.0;
  var voices = [];
  var jaVoice = null;
  var ready = false;
  var readyCbs = [];

  var supported = !!(window.speechSynthesis && window.SpeechSynthesisUtterance);

  function pickJaVoice(list) {
    if (!list || !list.length) return null;
    // Prefer an explicit ja-JP voice, then any ja*, then a voice whose name mentions Japanese
    return list.find(function(v) { return v.lang === 'ja-JP'; })
        || list.find(function(v) { return (v.lang || '').toLowerCase().indexOf('ja') === 0; })
        || list.find(function(v) { return /japan|日本/i.test(v.name || ''); })
        || null;
  }

  function loadVoices() {
    if (!supported) { markReady(); return; }
    var list = window.speechSynthesis.getVoices();
    if (list && list.length) {
      voices = list;
      jaVoice = pickJaVoice(list);
      markReady();
    }
  }

  function markReady() {
    if (ready) return;
    ready = true;
    var cbs = readyCbs.slice();
    readyCbs = [];
    cbs.forEach(function(cb) { try { cb(getAudioStatus()); } catch (e) {} });
  }

  /**
   * 'ok' (Japanese voice available), 'no-voice' (TTS works but no JP voice),
   * or 'unsupported' (no speech synthesis at all).
   */
  function getAudioStatus() {
    if (!supported) return 'unsupported';
    return jaVoice ? 'ok' : 'no-voice';
  }

  /**
   * Register a callback fired once voice status is known (or after a timeout).
   */
  function onReady(cb) {
    if (ready) { cb(getAudioStatus()); return; }
    readyCbs.push(cb);
  }

  function speak(text, options) {
    var opts = options || {};
    if (!supported) { if (opts.onEnd) opts.onEnd(); return; }

    stop();

    function doSpeak() {
      var u = new SpeechSynthesisUtterance(text);
      u.lang = 'ja-JP';
      u.rate = opts.rate || rate;
      u.pitch = 1.0;
      if (!jaVoice) { jaVoice = pickJaVoice(window.speechSynthesis.getVoices()); }
      if (jaVoice) u.voice = jaVoice;
      u.onstart = function() { speaking = true; };
      u.onend = function() { speaking = false; if (opts.onEnd) opts.onEnd(); };
      u.onerror = function() { speaking = false; if (opts.onEnd) opts.onEnd(); };
      window.speechSynthesis.speak(u);
    }

    // If voices aren't loaded yet, wait briefly then speak
    if (!window.speechSynthesis.getVoices().length) {
      loadVoices();
      setTimeout(doSpeak, 180);
    } else {
      doSpeak();
    }
  }

  function stop() {
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    speaking = false;
  }

  function setRate(newRate) { rate = Math.max(0.5, Math.min(2.0, newRate)); }
  function isSpeaking() { return speaking; }
  function getRate() { return rate; }
  function hasJapaneseVoice() { return !!jaVoice; }
  function isSupported() { return supported; }

  // Initialise voice loading
  if (supported) {
    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
    // Some engines never fire onvoiceschanged; retry then give up gracefully
    setTimeout(loadVoices, 400);
    setTimeout(loadVoices, 1200);
    setTimeout(markReady, 1800);
  } else {
    markReady();
  }

  window.TTS = {
    speak: speak,
    stop: stop,
    setRate: setRate,
    isSpeaking: isSpeaking,
    getRate: getRate,
    hasJapaneseVoice: hasJapaneseVoice,
    isSupported: isSupported,
    getAudioStatus: getAudioStatus,
    onReady: onReady
  };
})();
