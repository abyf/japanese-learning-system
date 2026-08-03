/**
 * Japanese Learning System - Global Keyboard Shortcuts
 * 
 * Shortcuts are only active on relevant pages and disabled
 * when the user is typing in input/textarea fields.
 * 
 * Shortcuts:
 *   Space  - Next card / advance
 *   Enter  - Flip card
 *   1-5    - Rate card quality
 *   F      - Toggle furigana
 *   Escape - Close modal/popup
 */
(function() {
  'use strict';

  var handlers = {};

  /**
   * Register a shortcut handler for a specific key.
   * @param {string} key - The key value (e.g., ' ', 'Enter', 'f', '1')
   * @param {function} handler - Function to call when key is pressed
   */
  function register(key, handler) {
    handlers[key] = handler;
  }

  /**
   * Unregister a shortcut handler.
   * @param {string} key - The key to unregister
   */
  function unregister(key) {
    delete handlers[key];
  }

  /**
   * Clear all registered shortcuts.
   */
  function clearAll() {
    handlers = {};
  }

  /**
   * Global keydown listener.
   * Ignores events when focus is in input/textarea elements.
   */
  function handleKeydown(e) {
    // Don't intercept when typing in form fields
    var tag = e.target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
      return;
    }

    // Don't intercept if modifier keys are held (allow browser shortcuts)
    if (e.ctrlKey || e.altKey || e.metaKey) {
      return;
    }

    var key = e.key;
    var handler = handlers[key];

    if (handler) {
      e.preventDefault();
      handler(e);
    }
  }

  // Attach global listener
  document.addEventListener('keydown', handleKeydown);

  // Export to global namespace
  window.Shortcuts = {
    register: register,
    unregister: unregister,
    clearAll: clearAll
  };

})();
