/**
 * Entitlement Guard (Task 10.2)
 *
 * Gates the full Japanese course behind an active entitlement. Course entry
 * points call `EntitlementGuard.require(courseId)` before rendering. It:
 *   - ensures the learner is signed in (Supabase) — else routes to #/account
 *   - checks /api/platform/me/entitlements for an active entitlement
 *   - if entitled: resolves true (render the course)
 *   - if not: routes to the course landing/paywall and resolves false
 *
 * Result is cached briefly in memory to avoid repeated calls during navigation.
 */
(function() {
  'use strict';

  var COURSE_ID = 'japanese-beginner';
  var cache = { at: 0, active: false };
  var CACHE_MS = 15000;

  function isEntitled(entitlements, courseId) {
    return (entitlements || []).some(function(e) {
      var matches = e.all_access || e.course_id === courseId;
      var okStatus = (e.status === 'active' || e.status === 'canceled' || e.status === 'past_due');
      if (!matches || !okStatus) return false;
      if (e.plan_type === 'lifetime') return true;
      if (e.current_period_end) return new Date(e.current_period_end) > new Date();
      // no period end + active (e.g., freshly granted lifetime) -> allow
      return e.status === 'active';
    });
  }

  /**
   * Require an active entitlement for a course. Returns Promise<boolean>.
   * On failure it performs the appropriate redirect and resolves false.
   */
  function require(courseId) {
    courseId = courseId || COURSE_ID;

    var initP = (window.PlatformAuth && window.PlatformAuth.init)
      ? window.PlatformAuth.init() : Promise.resolve();

    return initP.then(function() {
      var token = window.PlatformAuth && window.PlatformAuth.getAccessToken();
      if (!token) {
        // Genuinely not signed in -> course landing (taster + subscribe/sign-in).
        window.location.hash = '#/course/' + encodeURIComponent(courseId);
        return false;
      }

      // Fresh cache?
      if (Date.now() - cache.at < CACHE_MS) {
        if (cache.active) return true;
      }

      return fetch('/api/platform/me/entitlements', { headers: { 'Authorization': 'Bearer ' + token } })
        .then(function(r) { return r.json(); })
        .then(function(data) {
          var active = isEntitled(data && data.entitlements, courseId);
          cache = { at: Date.now(), active: active };
          if (!active) {
            window.location.hash = '#/course/' + encodeURIComponent(courseId);
            return false;
          }
          return true;
        })
        .catch(function() {
          // On error, be safe: send to the landing rather than exposing content.
          window.location.hash = '#/course/' + encodeURIComponent(courseId);
          return false;
        });
    });
  }

  function invalidate() { cache = { at: 0, active: false }; }

  window.EntitlementGuard = { require: require, invalidate: invalidate, isEntitled: isEntitled };
})();
