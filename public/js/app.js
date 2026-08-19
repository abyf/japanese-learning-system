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
     * Get the learner's chosen learning mode: 'guided', 'explore', or null (not chosen).
     */
    getMode: function() {
      var m = localStorage.getItem('jls-mode');
      return (m === 'guided' || m === 'explore') ? m : null;
    },

    /**
     * Set the learning mode.
     * @param {string} mode - 'guided' or 'explore'
     */
    setMode: function(mode) {
      if (mode === 'guided' || mode === 'explore') {
        localStorage.setItem('jls-mode', mode);
      }
    },

    /**
     * Select a mode and enter the matching interface.
     * Guided -> the daily plan view; Explore -> the open exploration view.
     */
    selectMode: function(mode) {
      window.App.setMode(mode);
      var target = mode === 'explore' ? '#/explore' : '#/plan';
      window.location.hash = target;
      try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch (e) { window.scrollTo(0, 0); }
    },

    /**
     * Shared navigation bar renderer.
     * @param {string} active - The active page key (dashboard, levels, progress, settings)
     * @returns {string} HTML string for the navbar
     */
    renderNav: function(active) {
      var username = (window.App.user && window.App.user.username) || '';
      var userHtml = username
        ? '<div class="navbar__user-menu">' +
            '<button type="button" class="navbar__user" onclick="window.App.toggleUserMenu(event)">' +
              escapeHtmlNav(username) + ' &#9662;' +
            '</button>' +
            '<div class="navbar__dropdown" id="navbar-dropdown">' +
              '<a href="#/settings" class="navbar__dropdown-item" onclick="window.App.closeUserMenu()">' + window.i18n('nav.settings') + '</a>' +
              '<button type="button" class="navbar__dropdown-item navbar__dropdown-item--danger" onclick="window.App.logout()">' + window.i18n('settings.logout') + '</button>' +
            '</div>' +
          '</div>'
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
                  return '<option value="' + l.code + '"' + (window.App.getLanguage() === l.code ? ' selected' : '') + '>' + l.code.toUpperCase() + '</option>';
                }).join('')
              : '<option value="en" selected>EN</option>') +
          '</select>' +
          (userHtml ? ' ' + userHtml : '') +
        '</div>' +
      '</nav>';
    },

    /**
     * Toggle the user dropdown menu in the navbar.
     */
    toggleUserMenu: function(event) {
      if (event) event.stopPropagation();
      var dd = document.getElementById('navbar-dropdown');
      if (dd) dd.classList.toggle('navbar__dropdown--open');
    },

    /**
     * Close the user dropdown menu.
     */
    closeUserMenu: function() {
      var dd = document.getElementById('navbar-dropdown');
      if (dd) dd.classList.remove('navbar__dropdown--open');
    },

    /**
     * Log the user out and return to the login screen.
     */
    logout: function() {
      window.App.closeUserMenu();
      window.API.post('/auth/logout', {})
        .then(function() {
          window.App.user = null;
          window.location.hash = '#/login';
        })
        .catch(function() {
          window.App.user = null;
          window.location.hash = '#/login';
        });
    }
  };

  // Close the user dropdown when clicking anywhere else
  document.addEventListener('click', function(e) {
    var menu = document.querySelector('.navbar__user-menu');
    if (menu && !menu.contains(e.target)) {
      window.App.closeUserMenu();
    }
  });

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

    // Persistent site footer with brand logo + copyright
    renderFooter();

    // Set up hashchange listener for SPA routing
    window.addEventListener('hashchange', onHashChange);

    // Navigate to the current hash on initial load
    onHashChange();
  }

  /**
   * Render the persistent brand footer (logo + copyright).
   * Lives outside #app so it survives SPA route changes.
   */
  function renderFooter() {
    if (document.querySelector('.app-footer')) return;
    var year = new Date().getFullYear();
    var rights = (window.i18n && window.i18n('footer.rights')) || 'All rights reserved.';
    var footer = document.createElement('footer');
    footer.className = 'app-footer';
    footer.innerHTML =
      '<img class="app-footer__logo" src="/assets/nipponmboa-logo.svg" alt="NipponMboa Consulting" width="150" height="89">' +
      '<p class="app-footer__copy">\u00A9 ' + year + ' NipponMboa Consulting. ' + escapeHtmlNav(rights) + '</p>';
    document.body.appendChild(footer);
  }

  // Wait for DOM to be ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
