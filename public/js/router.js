/**
 * Japanese Learning System - Hash-based SPA Router
 * Handles route matching, param extraction, and auth guards.
 */
(function() {
  'use strict';

  var routes = [];
  var currentRoute = null;

  // Routes that don't require authentication
  var PUBLIC_ROUTES = ['/login', '/register'];

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
    for (var i = 0; i < routes.length; i++) {
      var route = routes[i];
      var match = path.match(route.regex);
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
    for (var i = 0; i < PUBLIC_ROUTES.length; i++) {
      if (path === PUBLIC_ROUTES[i]) return true;
    }
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
          window.location.hash = '#/login';
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
    matchRoute: matchRoute
  };

})();
