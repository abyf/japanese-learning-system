/**
 * Japanese Learning System - Text-to-Speech Module
 * 
 * Uses the browser's Web Speech API to speak Japanese text.
 * Falls back gracefully if TTS is unavailable.
 */
(function() {
  'use strict';

  var currentUtterance = null;
  var speaking = false;
  var rate = 1.0;

  /**
   * Speak Japanese text using the browser's TTS engine.
   * @param {string} text - Japanese text to speak
   * @param {object} [options] - Options
   * @param {number} [options.rate] - Speech rate (0.5-2.0, default 1.0)
   * @param {function} [options.onEnd] - Callback when speech ends
   */
  function speak(text, options) {
    if (!window.speechSynthesis) {
      console.warn('TTS not supported in this browser');
      if (options && options.onEnd) options.onEnd();
      return;
    }

    // Cancel any ongoing speech
    stop();

    var opts = options || {};
    var utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'ja-JP';
    utterance.rate = opts.rate || rate;
    utterance.pitch = 1.0;

    // Try to find a Japanese voice
    var voices = window.speechSynthesis.getVoices();
    var japaneseVoice = voices.find(function(v) {
      return v.lang === 'ja-JP' || v.lang === 'ja';
    });
    if (japaneseVoice) {
      utterance.voice = japaneseVoice;
    }

    utterance.onstart = function() {
      speaking = true;
    };

    utterance.onend = function() {
      speaking = false;
      currentUtterance = null;
      if (opts.onEnd) opts.onEnd();
    };

    utterance.onerror = function() {
      speaking = false;
      currentUtterance = null;
      if (opts.onEnd) opts.onEnd();
    };

    currentUtterance = utterance;
    window.speechSynthesis.speak(utterance);
  }

  /**
   * Stop any ongoing speech.
   */
  function stop() {
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    speaking = false;
    currentUtterance = null;
  }

  /**
   * Set the speech rate.
   * @param {number} newRate - 0.5 to 2.0
   */
  function setRate(newRate) {
    rate = Math.max(0.5, Math.min(2.0, newRate));
  }

  /**
   * Check if currently speaking.
   * @returns {boolean}
   */
  function isSpeaking() {
    return speaking;
  }

  /**
   * Get current rate.
   * @returns {number}
   */
  function getRate() {
    return rate;
  }

  // Preload voices (some browsers need this)
  if (window.speechSynthesis) {
    window.speechSynthesis.getVoices();
    window.speechSynthesis.onvoiceschanged = function() {
      window.speechSynthesis.getVoices();
    };
  }

  // Export to global namespace
  window.TTS = {
    speak: speak,
    stop: stop,
    setRate: setRate,
    isSpeaking: isSpeaking,
    getRate: getRate
  };

})();
