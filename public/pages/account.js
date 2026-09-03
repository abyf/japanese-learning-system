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

  // ── Plan / status formatting helpers ────────────────────────────────────
  var PLAN_LABELS = {
    monthly:  'Monthly subscription',
    annual:   'Annual subscription',
    yearly:   'Annual subscription',
    lifetime: 'Lifetime access'
  };
  var STATUS_LABELS = {
    active:   'Active',
    canceled: 'Canceling',
    past_due: 'Payment due',
    expired:  'Expired',
    refunded: 'Refunded'
  };

  function planLabel(e) {
    if (e.plan_type && PLAN_LABELS[e.plan_type]) return PLAN_LABELS[e.plan_type];
    if (e.plan_type) return e.plan_type.charAt(0).toUpperCase() + e.plan_type.slice(1);
    return 'Course access';
  }
  function statusLabel(status) {
    return STATUS_LABELS[status] || (status ? status.charAt(0).toUpperCase() + status.slice(1) : 'Unknown');
  }
  function formatDate(iso) {
    if (!iso) return null;
    var d = new Date(iso);
    if (isNaN(d.getTime())) return null;
    try {
      return d.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
    } catch (e) { return d.toISOString().slice(0, 10); }
  }
  // What to show for the "renews / expires" row, given plan + status.
  function renewalRow(e) {
    if (e.plan_type === 'lifetime') return { label: 'Expires', value: 'Never — lifetime access' };
    var when = formatDate(e.current_period_end);
    if (e.status === 'canceled') {
      return { label: 'Access until', value: when || 'End of current period' };
    }
    if (e.status === 'expired' || e.status === 'refunded') {
      return { label: 'Ended', value: when || '—' };
    }
    // active / past_due recurring
    return { label: 'Renews on', value: when || 'Next billing date' };
  }

  // A single row in the details grid.
  function detailRow(label, value) {
    if (value == null || value === '') return '';
    return '<div class="sub-detail">' +
      '<span class="sub-detail__label">' + escapeHtml(label) + '</span>' +
      '<span class="sub-detail__value">' + escapeHtml(value) + '</span>' +
    '</div>';
  }

  // Render one subscription/entitlement as a professional card.
  function subscriptionCard(e) {
    var scope = e.all_access ? 'All courses' : (e.course_id || 'Course');
    var renew = renewalRow(e);
    var provider = e.provider ? (e.provider.charAt(0).toUpperCase() + e.provider.slice(1)) : null;
    return '<div class="sub-card">' +
      '<div class="sub-card__head">' +
        '<div>' +
          '<h3 class="sub-card__plan">' + escapeHtml(planLabel(e)) + '</h3>' +
          '<p class="sub-card__scope">' + escapeHtml(scope) + '</p>' +
        '</div>' +
        '<span class="ent-list__status ent-list__status--' + escapeHtml(e.status) + '">' + escapeHtml(statusLabel(e.status)) + '</span>' +
      '</div>' +
      '<div class="sub-card__grid">' +
        detailRow('Plan', planLabel(e)) +
        detailRow('Status', statusLabel(e.status)) +
        detailRow('Access', scope) +
        detailRow(renew.label, renew.value) +
        detailRow('Member since', formatDate(e.created_at)) +
        detailRow('Billing', provider) +
      '</div>' +
      (e.status === 'canceled'
        ? '<p class="sub-card__note">Your subscription is set to cancel. You keep access until the date above.</p>'
        : '') +
      (e.status === 'past_due'
        ? '<p class="sub-card__note sub-card__note--warn">A payment is due. Please update your billing details to keep access.</p>'
        : '') +
    '</div>';
  }

  // ── Signed-in view ──────────────────────────────────────────────────────
  function renderSignedIn(session) {
    var page = document.querySelector('.page--account');
    var email = session.user && session.user.email;
    var displayName = (window.PlatformAuth && window.PlatformAuth.getDisplayName && window.PlatformAuth.getDisplayName()) || null;

    page.innerHTML =
      '<h1>Your account</h1>' +
      '<div class="account-card">' +
        (displayName ? '<p class="account-card__name"><strong>' + escapeHtml(displayName) + '</strong></p>' : '') +
        '<p class="account-card__email">Signed in as <strong>' + escapeHtml(email) + '</strong></p>' +
        '<h2 class="account-card__section-title">Subscription</h2>' +
        '<div id="account-entitlements" class="account-card__ents">Loading your subscription…</div>' +
        '<div class="account-card__actions">' +
          '<a href="#/dashboard" class="btn btn--primary">Go to course</a>' +
          '<button id="account-portal" class="btn btn--secondary">Manage billing</button>' +
          '<button id="account-logout" class="btn btn--danger">Log out</button>' +
        '</div>' +
      '</div>';

    // Load entitlements → render subscription cards (or an empty state).
    var token = window.PlatformAuth.getAccessToken();
    fetch('/api/platform/me/entitlements', { headers: { 'Authorization': 'Bearer ' + token } })
      .then(function(r) { return r.json(); })
      .then(function(data) {
        var el = document.getElementById('account-entitlements');
        var ents = (data && data.entitlements) || [];
        // Only surface entitlements that actually grant/granted access.
        ents = ents.filter(function(e) { return e && e.status; });
        if (!ents.length) {
          el.innerHTML =
            '<div class="sub-empty">' +
              '<p class="sub-empty__title">No active subscription</p>' +
              '<p class="text-secondary">You have an account but haven\'t subscribed yet. Browse the catalog to unlock the full course.</p>' +
              '<a href="#/catalog" class="btn btn--primary btn--sm">Browse courses</a>' +
            '</div>';
          // Hide the "Go to course" primary action for non-subscribers.
          var goBtn = page.querySelector('.account-card__actions .btn--primary');
          if (goBtn) goBtn.setAttribute('href', '#/catalog');
          return;
        }
        el.innerHTML = ents.map(subscriptionCard).join('');
      })
      .catch(function() {
        var el = document.getElementById('account-entitlements');
        if (el) el.innerHTML = '<p class="text-secondary">Could not load your subscription right now.</p>';
      });

    document.getElementById('account-logout').addEventListener('click', function() {
      window.PlatformAuth.signOut().then(function() {
        if (window.App) window.App.user = null;
        if (window.App && window.App.refreshNav) window.App.refreshNav();
        window.location.hash = '#/catalog';
        render();
      });
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
        '<input class="form__input" id="auth-name" type="text" placeholder="Your name" autocomplete="name">' +
        '<input class="form__input" id="auth-alias" type="text" placeholder="Username / alias" autocomplete="username">' +
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
      var name = (document.getElementById('auth-name') || {}).value;
      var alias = (document.getElementById('auth-alias') || {}).value;
      if (!name || !name.trim()) { show('Please enter your name.', true); return; }
      if (!alias || !alias.trim()) { show('Please choose a username / alias.', true); return; }
      if (!email || !password || password.length < 6) { show('Enter a valid email and a password of at least 6 characters.', true); return; }
      show('Creating your account…', false);
      window.PlatformAuth.signUp({ email: email, password: password, displayName: name.trim(), alias: alias.trim() })
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
