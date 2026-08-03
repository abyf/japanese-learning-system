/**
 * Japanese Learning System - Theme Manager
 * Handles light/dark mode toggle with persistence via API.
 */
(function() {
  'use strict';

  var currentTheme = 'light';

  /**
   * Apply the theme to the document body.
   * @param {string} theme - 'light' or 'dark'
   */
  function applyTheme(theme) {
    currentTheme = theme;
    if (theme === 'dark') {
      document.body.setAttribute('data-theme', 'dark');
    } else {
      document.body.removeAttribute('data-theme');
    }
  }

  /**
   * Initialize the theme by loading user preference from the API.
   * Falls back to 'light' if not authenticated or on error.
   */
  function initTheme() {
    // Check localStorage for instant theme application (avoids flash)
    var cached = localStorage.getItem('jls-theme');
    if (cached === 'dark' || cached === 'light') {
      applyTheme(cached);
    }

    // Then fetch from API for the authoritative setting
    return window.API.get('/settings')
      .then(function(data) {
        var theme = (data && data.theme) || 'light';
        applyTheme(theme);
        localStorage.setItem('jls-theme', theme);
      })
      .catch(function() {
        // Not authenticated or API unavailable - keep cached or default
        if (!cached) {
          applyTheme('light');
        }
      });
  }

  /**
   * Toggle between light and dark themes.
   * Persists the change to the API.
   */
  function toggleTheme() {
    var newTheme = currentTheme === 'light' ? 'dark' : 'light';
    applyTheme(newTheme);
    localStorage.setItem('jls-theme', newTheme);

    // Persist to API (fire and forget with error handling)
    window.API.put('/settings', { theme: newTheme }).catch(function(err) {
      // Silently handle - theme is already applied locally
      console.warn('Failed to persist theme preference:', err.message);
    });
  }

  /**
   * Get the current theme.
   * @returns {string} 'light' or 'dark'
   */
  function getTheme() {
    return currentTheme;
  }

  // Export to global namespace
  window.Theme = {
    initTheme: initTheme,
    toggleTheme: toggleTheme,
    getTheme: getTheme
  };

})();
