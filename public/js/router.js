/**
 * Japanese Learning System - Hash-based SPA Router
 * Handles route matching, param extraction, and auth guards.
 */
(function() {
  'use strict';

  var routes = [];
  var currentRoute = null;

  // Routes that don't require authentication (exact match)
  var PUBLIC_ROUTES = ['/login', '/register', '/catalog', '/account',
    '/pricing', '/terms', '/privacy', '/refunds', '/contact'];
  // Public route prefixes (e.g., course landing pages are browsable by anyone)
  var PUBLIC_PREFIXES = ['/course/'];
  // "Test before paying" free-sample routes: openable by anyone (shown with a
  // preview banner). These mirror the is_preview rows seeded for the course.
  var PREVIEW_ROUTES = [
    '/kana/hiragana', '/kana/katakana', '/kana/kanji',
    '/vocab/beginner/v001', '/reading/beginner/r001',
    '/listening/beginner/l001', '/dictation/beginner/d001',
    '/grammar/beginner/g001'
  ];

  function isPreviewRoute(path) {
    // Compare against the path without query string.
    var clean = path.split('?')[0];
    for (var i = 0; i < PREVIEW_ROUTES.length; i++) {
      if (clean === PREVIEW_ROUTES[i]) return true;
    }
    return false;
  }

  /**
   * Register a route with a path pattern and handler.
   * Supports :param patterns (e.g., '/reading/:level/:id')
   */
  function registerRoute(path, handler) {
    var paramNames = [];
    // Convert path pattern to regex, extracting param names
    var regexStr = '^' + path.replace(/:([^/]+)/g, function(_, name) {
      paramNames.push(name);
      return '([^/]+)';
    }) + '$';

    routes.push({
      path: path,
      regex: new RegExp(regexStr),
      paramNames: paramNames,
      handler: handler
    });
  }

  /**
   * Match a URL path against registered routes.
   * Returns { route, params } or null if no match.
   */
  function matchRoute(path) {
    // Match against the path WITHOUT its query string. Pages that need query
    // params read them from window.location.hash themselves.
    var clean = path.split('?')[0];
    for (var i = 0; i < routes.length; i++) {
      var route = routes[i];
      var match = clean.match(route.regex);
      if (match) {
        var params = {};
        for (var j = 0; j < route.paramNames.length; j++) {
          params[route.paramNames[j]] = decodeURIComponent(match[j + 1]);
        }
        return { route: route, params: params };
      }
    }
    return null;
  }

  /**
   * Check if user is authenticated by calling /api/auth/me.
   * Returns a promise resolving to true/false.
   */
  function checkAuth() {
    return fetch('/api/auth/me', {
      credentials: 'same-origin'
    }).then(function(res) {
      return res.ok;
    }).catch(function() {
      return false;
    });
  }

  /**
   * Determine if a path is public (no auth required).
   */
  function isPublicRoute(path) {
    var clean = path.split('?')[0];
    for (var i = 0; i < PUBLIC_ROUTES.length; i++) {
      if (clean === PUBLIC_ROUTES[i]) return true;
    }
    for (var j = 0; j < PUBLIC_PREFIXES.length; j++) {
      if (clean.indexOf(PUBLIC_PREFIXES[j]) === 0) return true;
    }
    if (isPreviewRoute(path)) return true;
    return false;
  }

  /**
   * Get the current hash path (without #).
   */
  function getHashPath() {
    var hash = window.location.hash || '#/';
    return hash.replace(/^#/, '') || '/';
  }

  /**
   * Navigate to a given hash path.
   * Handles auth guards and route matching.
   */
  function navigate(hash) {
    if (!hash) hash = '/';
    // Normalize: ensure leading slash
    if (hash.charAt(0) !== '/') hash = '/' + hash;

    var path = hash;

    // Auth guard check
    if (!isPublicRoute(path)) {
      checkAuth().then(function(authenticated) {
        if (!authenticated) {
          // Unauthenticated users go to the public catalog (platform front door),
          // not the legacy login. From the catalog they can preview and sign in.
          window.location.hash = '#/catalog';
          return;
        }
        resolveRoute(path);
      });
    } else {
      resolveRoute(path);
    }
  }

  /**
   * Resolve and execute a matched route handler.
   */
  function resolveRoute(path) {
    var result = matchRoute(path);

    if (result) {
      currentRoute = {
        path: path,
        params: result.params,
        pattern: result.route.path
      };
      result.route.handler(result.params);
    } else {
      // No match - show 404 or redirect to home
      currentRoute = { path: path, params: {}, pattern: null };
      var appEl = document.getElementById('app');
      if (appEl) {
        appEl.innerHTML =
          '<div class="page text-center">' +
          '<h1>404</h1>' +
          '<p class="text-secondary mt-2">Page not found</p>' +
          '<a href="#/" class="btn mt-3">Go Home</a>' +
          '</div>';
      }
    }
  }

  /**
   * Get the current route info.
   */
  function getCurrentRoute() {
    return currentRoute;
  }

  // Export to global namespace
  window.Router = {
    navigate: navigate,
    registerRoute: registerRoute,
    getCurrentRoute: getCurrentRoute,
    matchRoute: matchRoute,
    isPreviewRoute: isPreviewRoute
  };

})();
