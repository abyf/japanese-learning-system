/**
 * Account page - Supabase Auth UI (Task 3.2 frontend)
 *
 * Route: #/account   (public)
 *   - Signed out: shows Login / Register / Reset-password tabs (Supabase Auth).
 *   - Signed in:  shows account summary + entitlements + logout.
 *
 * Supports #/account?next=course/<id> so the subscribe flow can send a visitor
 * here to sign in, then bounce them back to the course to complete checkout.
 */
(function() {
  'use strict';

  function getQuery() {
    var hash = window.location.hash || '';
    var qi = hash.indexOf('?');
    var out = {};
    if (qi === -1) return out;
    hash.substring(qi + 1).split('&').forEach(function(pair) {
      var kv = pair.split('=');
      if (kv[0]) out[decodeURIComponent(kv[0])] = decodeURIComponent(kv[1] || '');
    });
    return out;
  }

  function nav() { return (window.App && window.App.renderNav) ? window.App.renderNav('') : ''; }

  function render() {
    var app = document.getElementById('app');
    app.innerHTML = nav() + '<div class="page page--account"><div class="account__loading">Loading…</div></div>';

    // Ensure PlatformAuth is initialized before deciding which view to show.
    var initPromise = (window.PlatformAuth && window.PlatformAuth.init)
      ? window.PlatformAuth.init() : Promise.resolve();

    initPromise.then(function() {
      var session = window.PlatformAuth && window.PlatformAuth.getSession();
      if (session) renderSignedIn(session);
      else renderAuthForms('login');
    });
  }

  // ── Signed-in view ──────────────────────────────────────────────────────
  function renderSignedIn(session) {
    var page = document.querySelector('.page--account');
    var email = session.user && session.user.email;
    page.innerHTML =
      '<h1>Your account</h1>' +
      '<div class="account-card">' +
        '<p class="account-card__email">Signed in as <strong>' + escapeHtml(email) + '</strong></p>' +
        '<div id="account-entitlements" class="account-card__ents">Loading your courses…</div>' +
        '<div class="account-card__actions">' +
          '<a href="#/catalog" class="btn btn--primary">Browse courses</a>' +
          '<button id="account-portal" class="btn btn--secondary">Manage billing</button>' +
          '<button id="account-logout" class="btn btn--danger">Log out</button>' +
        '</div>' +
      '</div>';

    // Load entitlements
    var token = window.PlatformAuth.getAccessToken();
    fetch('/api/platform/me/entitlements', { headers: { 'Authorization': 'Bearer ' + token } })
      .then(function(r) { return r.json(); })
      .then(function(data) {
        var el = document.getElementById('account-entitlements');
        var ents = (data && data.entitlements) || [];
        if (!ents.length) { el.innerHTML = '<p class="text-secondary">No active courses yet. Browse the catalog to subscribe.</p>'; return; }
        el.innerHTML = '<ul class="ent-list">' + ents.map(function(e) {
          var label = e.all_access ? 'All courses' : e.course_id;
          return '<li class="ent-list__item"><span>' + escapeHtml(label) + '</span>' +
            '<span class="ent-list__status ent-list__status--' + escapeHtml(e.status) + '">' + escapeHtml(e.status) + (e.plan_type ? ' · ' + escapeHtml(e.plan_type) : '') + '</span></li>';
        }).join('') + '</ul>';
      }).catch(function() {});

    document.getElementById('account-logout').addEventListener('click', function() {
      window.PlatformAuth.signOut().then(function() { window.location.hash = '#/catalog'; render(); });
    });
    document.getElementById('account-portal').addEventListener('click', function() {
      var t = window.PlatformAuth.getAccessToken();
      fetch('/api/platform/billing/portal', { headers: { 'Authorization': 'Bearer ' + t } })
        .then(function(r) { return r.json(); })
        .then(function(d) { if (d.url) window.open(d.url, '_blank'); else alert(d.message || 'No billing to manage yet.'); })
        .catch(function() { alert('Could not open billing portal.'); });
    });
  }

  // ── Signed-out view (login / register / reset) ──────────────────────────
  function renderAuthForms(mode) {
    var page = document.querySelector('.page--account');
    var q = getQuery();
    var nextHint = q.next ? '<p class="auth__next">Sign in to continue.</p>' : '';

    var tabs =
      '<div class="auth__tabs">' +
        '<button class="auth__tab' + (mode === 'login' ? ' auth__tab--active' : '') + '" data-mode="login">Log in</button>' +
        '<button class="auth__tab' + (mode === 'register' ? ' auth__tab--active' : '') + '" data-mode="register">Create account</button>' +
      '</div>';

    var form;
    if (mode === 'register') {
      form =
        '<input class="form__input" id="auth-email" type="email" placeholder="Email" autocomplete="email">' +
        '<input class="form__input" id="auth-password" type="password" placeholder="Password (min 6 chars)" autocomplete="new-password">' +
        '<button class="btn btn--primary auth__submit" id="auth-submit">Create account</button>';
    } else if (mode === 'reset') {
      form =
        '<input class="form__input" id="auth-email" type="email" placeholder="Email" autocomplete="email">' +
        '<button class="btn btn--primary auth__submit" id="auth-submit">Send reset link</button>';
    } else {
      form =
        '<input class="form__input" id="auth-email" type="email" placeholder="Email" autocomplete="email">' +
        '<input class="form__input" id="auth-password" type="password" placeholder="Password" autocomplete="current-password">' +
        '<button class="btn btn--primary auth__submit" id="auth-submit">Log in</button>' +
        '<button class="auth__link" id="auth-forgot" type="button">Forgot password?</button>';
    }

    page.innerHTML =
      '<div class="auth">' +
        '<h1 class="auth__title">' + (mode === 'reset' ? 'Reset password' : 'Welcome') + '</h1>' +
        nextHint +
        (mode === 'reset' ? '' : tabs) +
        '<div class="auth__form">' + form + '</div>' +
        '<p id="auth-msg" class="auth__msg" hidden></p>' +
      '</div>';

    // Tab switching
    var tabBtns = page.querySelectorAll('.auth__tab');
    for (var i = 0; i < tabBtns.length; i++) {
      tabBtns[i].addEventListener('click', function() { renderAuthForms(this.getAttribute('data-mode')); });
    }
    var forgot = document.getElementById('auth-forgot');
    if (forgot) forgot.addEventListener('click', function() { renderAuthForms('reset'); });

    document.getElementById('auth-submit').addEventListener('click', function() {
      submit(mode);
    });
    // Enter key submits
    page.querySelectorAll('.form__input').forEach(function(inp) {
      inp.addEventListener('keydown', function(e) { if (e.key === 'Enter') submit(mode); });
    });
  }

  function submit(mode) {
    var msg = document.getElementById('auth-msg');
    function show(text, isError) {
      msg.hidden = false; msg.textContent = text;
      msg.className = 'auth__msg' + (isError ? ' text-danger' : ' text-success');
    }
    var email = (document.getElementById('auth-email') || {}).value;
    var password = (document.getElementById('auth-password') || {}).value;

    if (!window.PlatformAuth) { show('Auth not available.', true); return; }

    if (mode === 'register') {
      if (!email || !password || password.length < 6) { show('Enter a valid email and a password of at least 6 characters.', true); return; }
      show('Creating your account…', false);
      window.PlatformAuth.signUp({ email: email, password: password })
        .then(function() {
          show('Account created. Please check your email to confirm your address, then log in.', false);
          setTimeout(function() { renderAuthForms('login'); }, 2500);
        })
        .catch(function(e) { show(e.message || 'Sign-up failed.', true); });
    } else if (mode === 'reset') {
      if (!email) { show('Enter your email.', true); return; }
      window.PlatformAuth.resetPassword(email)
        .then(function() { show('If that email exists, a reset link has been sent.', false); })
        .catch(function(e) { show(e.message || 'Could not send reset link.', true); });
    } else {
      if (!email || !password) { show('Enter your email and password.', true); return; }
      show('Signing in…', false);
      window.PlatformAuth.signIn({ email: email, password: password })
        .then(function() {
          var q = getQuery();
          var next = q.next ? ('#/' + q.next) : '#/account';
          window.location.hash = next;
          if (next === '#/account') render();
        })
        .catch(function(e) {
          // Supabase returns a specific error if email not confirmed.
          show(e.message || 'Invalid email or password.', true);
        });
    }
  }

  function escapeHtml(str) {
    var d = document.createElement('div');
    d.appendChild(document.createTextNode(str == null ? '' : String(str)));
    return d.innerHTML;
  }

  if (window.Router) window.Router.registerRoute('/account', render);
})();
