/**
 * Animated SVG icon library (offline, CSS-animated).
 * Used across the app to give a lively, game-like feel.
 * Usage: window.Icons.celebrate(), window.Icons.guided(), etc.
 * Each returns an HTML string wrapping an inline SVG with animation classes.
 */
(function() {
  'use strict';

  function wrap(size, inner) {
    return '<span class="anim-icon" style="width:' + size + 'px;height:' + size + 'px">' +
      '<svg viewBox="0 0 48 48" class="ai-svg">' + inner + '</svg></span>';
  }

  window.Icons = {
    // Star burst — rewards / completion
    celebrate: function(size) {
      return wrap(size || 44,
        '<g class="ai-spark">' +
          '<circle cx="8" cy="10" r="2"/><circle cx="40" cy="12" r="2"/>' +
          '<circle cx="9" cy="38" r="1.8"/><circle cx="39" cy="36" r="1.8"/>' +
        '</g>' +
        '<path class="ai-star" d="M24 6 l4.9 10 10.9 1.6 -7.9 7.7 1.9 10.8 -9.8 -5.1 -9.8 5.1 1.9 -10.8 -7.9 -7.7 10.9 -1.6 Z"/>'
      );
    },

    // Try-again — gentle pulsing refresh arc
    tryagain: function(size) {
      return wrap(size || 40,
        '<g class="ai-refresh">' +
          '<path d="M36 24 a12 12 0 1 1 -3.5 -8.5" class="ai-arc"/>' +
          '<path d="M33 6 L34 17 L23 16 Z" class="ai-arrowhead"/>' +
        '</g>'
      );
    },

    // Ascending steps — the Guided Plan (structured progression)
    guided: function(size) {
      return wrap(size || 46,
        '<rect class="ai-bar ai-bar1" x="7"  y="28" width="9" height="13" rx="2"/>' +
        '<rect class="ai-bar ai-bar2" x="19" y="20" width="9" height="21" rx="2"/>' +
        '<rect class="ai-bar ai-bar3" x="31" y="11" width="9" height="30" rx="2"/>'
      );
    },

    // Spinning compass — Self Explore
    explore: function(size) {
      return wrap(size || 46,
        '<circle cx="24" cy="24" r="16" class="ai-compass-ring"/>' +
        '<g class="ai-compass-needle">' +
          '<path d="M24 11 L28 24 L24 27 L20 24 Z" class="ai-needle-n"/>' +
          '<path d="M24 37 L20 24 L24 21 L28 24 Z" class="ai-needle-s"/>' +
        '</g>'
      );
    },

    // Bobbing torii gate — Japanese-themed section accent
    torii: function(size) {
      return wrap(size || 40,
        '<g class="ai-bob">' +
          '<rect x="8" y="12" width="32" height="5" rx="1.5" class="ai-torii"/>' +
          '<rect x="11" y="19" width="26" height="4" rx="1.5" class="ai-torii"/>' +
          '<rect x="14" y="17" width="4" height="22" class="ai-torii"/>' +
          '<rect x="30" y="17" width="4" height="22" class="ai-torii"/>' +
        '</g>'
      );
    },

    // Bouncing brush — writing / dictation
    brush: function(size) {
      return wrap(size || 40,
        '<g class="ai-bob">' +
          '<rect x="21" y="6" width="6" height="22" rx="3" class="ai-brush-handle"/>' +
          '<path d="M20 26 L28 26 L26 40 Q24 44 22 40 Z" class="ai-brush-tip"/>' +
        '</g>'
      );
    }
  };
})();
