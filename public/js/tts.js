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

  // ── Bundled human-quality audio (Amazon Polly neural voices) ──────────────
  // We prefer a pre-recorded MP3 for the exact text; only if none exists do we
  // fall back to the browser's robotic speech synthesiser.
  var manifest = null;          // { "<text>": { file, voice } }
  var manifestLoaded = false;
  var currentAudio = null;      // the <audio> element currently playing

  // Bump this key whenever the audio bundle is regenerated so clients pick up
  // newly added clips instead of a stale cached manifest.
  var MANIFEST_CACHE_KEY = 'jls-audio-manifest-v3';

  function loadManifest() {
    if (manifestLoaded) return;
    manifestLoaded = true;
    try {
      var cached = sessionStorage.getItem(MANIFEST_CACHE_KEY);
      if (cached) { manifest = JSON.parse(cached); return; }
    } catch (e) {}
    if (window.API && window.API.get) {
      window.API.get('/audio/manifest')
        .then(function(m) {
          manifest = m || {};
          try { sessionStorage.setItem(MANIFEST_CACHE_KEY, JSON.stringify(manifest)); } catch (e) {}
          markReady(); // readiness now reflects bundled-audio availability
        })
        .catch(function() { manifest = {}; markReady(); });
    } else {
      manifest = {};
    }
  }

  function bundledEntry(text) {
    if (!manifest) return null;
    return manifest[text] || null;
  }

  // Learner's preferred voice: 'm' (male) or 'f' (female). Default male.
  function getVoicePref() {
    try {
      var v = localStorage.getItem('jls-voice');
      return (v === 'f') ? 'f' : 'm';
    } catch (e) { return 'm'; }
  }

  function setVoicePref(v) {
    try { localStorage.setItem('jls-voice', v === 'f' ? 'f' : 'm'); } catch (e) {}
  }

  // Resolve the clip file for an entry honoring the preferred voice, with a
  // graceful fallback to the other voice or the legacy single-file field.
  function fileForEntry(entry) {
    if (!entry) return null;
    var pref = getVoicePref();
    var other = pref === 'm' ? 'f' : 'm';
    return entry[pref] || entry[other] || entry.file || null;
  }

  function stopAudio() {
    if (currentAudio) {
      try { currentAudio.pause(); currentAudio.currentTime = 0; } catch (e) {}
      currentAudio = null;
    }
  }

  // Try to play a bundled clip. Returns true if playback was started.
  function playBundled(text, opts) {
    var entry = bundledEntry(text);
    var file = fileForEntry(entry);
    if (!file) return false;
    stopAudio();
    var audio = new Audio('/api/audio/' + file);
    currentAudio = audio;
    if (opts && opts.rate) {
      // Keep pitch natural; only slow slightly for learners if asked.
      audio.playbackRate = Math.max(0.5, Math.min(1.5, opts.rate));
    }
    audio.onplay = function() { speaking = true; };
    audio.onended = function() { speaking = false; if (opts && opts.onEnd) opts.onEnd(); };
    audio.onerror = function() {
      // Missing/broken clip -> fall back to browser TTS.
      speaking = false;
      currentAudio = null;
      speakTts(text, opts);
    };
    var p = audio.play();
    if (p && p.catch) {
      p.catch(function() {
        // Autoplay blocked or decode error -> fall back to TTS.
        currentAudio = null;
        speakTts(text, opts);
      });
    }
    return true;
  }

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
    // Bundled human-quality clips work regardless of browser voices, so if the
    // manifest has clips we're 'ok' even without a system Japanese voice.
    if (manifest && Object.keys(manifest).length > 0) return 'ok';
    if (!supported) return 'unsupported';
    return jaVoice ? 'ok' : 'no-voice';
  }

  function hasBundledAudio() {
    return !!(manifest && Object.keys(manifest).length > 0);
  }

  /**
   * Register a callback fired once voice status is known (or after a timeout).
   */
  function onReady(cb) {
    if (ready) { cb(getAudioStatus()); return; }
    readyCbs.push(cb);
  }

  /**
   * Public speak(): prefer the bundled human-quality clip for this exact text;
   * fall back to the browser speech synthesiser when no clip exists.
   */
  function speak(text, options) {
    var opts = options || {};
    if (!text) { if (opts.onEnd) opts.onEnd(); return; }

    stop();

    if (manifest === null) {
      // Manifest not loaded yet — kick it off, and speak once/if available.
      loadManifest();
    }
    if (playBundled(text, opts)) {
      return; // human-quality clip is playing
    }
    speakTts(text, opts);
  }

  /**
   * Browser speech-synthesis fallback (robotic; used only when no clip exists).
   */
  function speakTts(text, options) {
    var opts = options || {};
    if (!supported) { if (opts.onEnd) opts.onEnd(); return; }

    if (window.speechSynthesis) window.speechSynthesis.cancel();

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
    stopAudio();
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    speaking = false;
  }

  function setRate(newRate) { rate = Math.max(0.5, Math.min(2.0, newRate)); }
  function isSpeaking() { return speaking; }
  function getRate() { return rate; }
  function hasJapaneseVoice() { return !!jaVoice; }
  function isSupported() { return supported; }

  // Preload the bundled-audio manifest as soon as possible.
  loadManifest();

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
    hasBundledAudio: hasBundledAudio,
    isSupported: isSupported,
    getAudioStatus: getAudioStatus,
    onReady: onReady,
    getVoicePref: getVoicePref,
    setVoicePref: setVoicePref
  };
})();
