/**
 * Japanese Learning System - Application Bootstrap
 * Initializes router, theme, and sets up the app shell.
 */
(function() {
  'use strict';

  // ─────────────────────────────────────────────────────────────────────────
  // Global App State
  // ─────────────────────────────────────────────────────────────────────────
  window.App = {
    user: null,

    /**
     * Get the current language preference.
     * @returns {string} Language code (e.g., 'en', 'fr', 'pt')
     */
    getLanguage: function() {
      return localStorage.getItem('jls-language') || 'en';
    },

    /**
     * Set the language preference.
     * @param {string} lang - Language code (e.g., 'en', 'fr', 'pt')
     */
    setLanguage: function(lang) {
      var supportedLangs = window.i18n && window.i18n.languages
        ? window.i18n.languages.map(function(l) { return l.code; })
        : ['en', 'fr'];
      var valid = supportedLangs.indexOf(lang) !== -1 ? lang : 'en';
      localStorage.setItem('jls-language', valid);
    },

    /**
     * Shared navigation bar renderer.
     * @param {string} active - The active page key (dashboard, levels, progress, settings)
     * @returns {string} HTML string for the navbar
     */
    renderNav: function(active) {
      var username = (window.App.user && window.App.user.username) || '';
      var userHtml = username
        ? '<span class="navbar__user">' + escapeHtmlNav(username) + ' &#9662;</span>'
        : '';

      return '<nav class="navbar">' +
        '<div class="navbar__brand">日本語学習</div>' +
        '<div class="navbar__links">' +
          '<a href="#/dashboard" class="navbar__link' + (active === 'dashboard' ? ' navbar__link--active' : '') + '">' + window.i18n('nav.dashboard') + '</a>' +
          '<a href="#/curriculum" class="navbar__link' + (active === 'curriculum' ? ' navbar__link--active' : '') + '">' + window.i18n('nav.curriculum') + '</a>' +
          '<a href="#/progress" class="navbar__link' + (active === 'progress' ? ' navbar__link--active' : '') + '">' + window.i18n('nav.progress') + '</a>' +
          '<a href="#/settings" class="navbar__link' + (active === 'settings' ? ' navbar__link--active' : '') + '">' + window.i18n('nav.settings') + '</a>' +
        '</div>' +
        '<div class="navbar__right">' +
          '<select class="navbar__lang-select" id="nav-lang-select" onchange="window.App.setLanguage(this.value); window.location.reload();">' +
            (window.i18n && window.i18n.languages
              ? window.i18n.languages.map(function(l) {
                  return '<option value="' + l.code + '"' + (window.App.getLanguage() === l.code ? ' selected' : '') + '>' + l.flag + ' ' + l.code.toUpperCase() + '</option>';
                }).join('')
              : '<option value="en" selected>🇬🇧 EN</option>') +
          '</select>' +
          (userHtml ? ' ' + userHtml : '') +
        '</div>' +
      '</nav>';
    }
  };

  /**
   * Simple HTML escaper for nav content.
   */
  function escapeHtmlNav(str) {
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
  }

  /**
   * Handle hashchange events - extract path and navigate.
   */
  function onHashChange() {
    var hash = window.location.hash || '#/';
    var path = hash.replace(/^#/, '') || '/';
    window.Router.navigate(path);
  }

  /**
   * Bootstrap the application on DOMContentLoaded.
   */
  function init() {
    // Ensure #app container exists
    var appEl = document.getElementById('app');
    if (!appEl) {
      appEl = document.createElement('div');
      appEl.id = 'app';
      document.body.appendChild(appEl);
    }

    // Initialize theme (loads user preference)
    window.Theme.initTheme();

    // Set up hashchange listener for SPA routing
    window.addEventListener('hashchange', onHashChange);

    // Navigate to the current hash on initial load
    onHashChange();
  }

  // Wait for DOM to be ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
