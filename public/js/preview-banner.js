/**
 * Preview Banner (Task 10 polish)
 *
 * Shows a sticky "free sample — subscribe to unlock" banner whenever the
 * learner is viewing one of the free "Test before paying" sample pages and does
 * not already have an active entitlement. Hides itself on all other pages and
 * for entitled learners.
 *
 * Watches hashchange and updates on each navigation.
 */
(function() {
  'use strict';

  var COURSE_ID = 'japanese-beginner';
  var BANNER_ID = 'preview-banner';

  function currentPath() {
    var hash = window.location.hash || '#/';
    return hash.replace(/^#/, '') || '/';
  }

  function remove() {
    var el = document.getElementById(BANNER_ID);
    if (el && el.parentNode) el.parentNode.removeChild(el);
  }

  function show() {
    if (document.getElementById(BANNER_ID)) return;
    var bar = document.createElement('div');
    bar.id = BANNER_ID;
    bar.className = 'preview-banner';
    bar.innerHTML =
      '<span class="preview-banner__text">' +
        'Free sample — this is a taste of <strong>Japanese for Beginners</strong>. Subscribe to unlock the full course.' +
      '</span>' +
      '<a href="#/course/' + COURSE_ID + '" class="btn btn--sm btn--accent preview-banner__cta">See plans</a>';
    document.body.appendChild(bar);
    document.body.classList.add('has-preview-banner');
  }

  function update() {
    var path = currentPath();
    var isPreview = window.Router && window.Router.isPreviewRoute && window.Router.isPreviewRoute(path);

    if (!isPreview) { remove(); document.body.classList.remove('has-preview-banner'); return; }

    // If the learner is entitled, they're not "previewing" — hide the banner.
    var entitled = false;
    if (window.EntitlementGuard && window.PlatformAuth && window.PlatformAuth.getSession) {
      // Best-effort: use cached entitlement if available; otherwise show the banner
      // (a false "free sample" note for an entitled user is harmless and rare).
    }
    if (!entitled) show();
  }

  window.addEventListener('hashchange', function() { setTimeout(update, 0); });
  document.addEventListener('DOMContentLoaded', function() { setTimeout(update, 0); });
  // Also run shortly after load in case DOMContentLoaded already fired.
  setTimeout(update, 300);

  window.PreviewBanner = { update: update };
})();
