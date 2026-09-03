/**
 * Catalog & Course Landing (Task 6.3)
 *
 * Public pages (browsable without login):
 *   #/catalog          - list of courses + pricing
 *   #/course/:id       - course landing: "Test before paying" taster + subscribe
 *
 * Subscribe flow:
 *   1. Requires sign-in (Supabase Auth). If not signed in, prompt to log in/register.
 *   2. POST /api/platform/checkout {courseId, planType} -> transaction id / url.
 *   3. Open Paddle.js overlay checkout with that transaction.
 *   4. On success, Paddle webhook grants the entitlement; we poll entitlements
 *      then route into the course.
 */
(function() {
  'use strict';

  var paddleReady = false;

  function money(cents, currency) {
    var amt = (cents / 100);
    var sym = currency === 'USD' ? '$' : (currency + ' ');
    return sym + (amt % 1 === 0 ? amt.toFixed(0) : amt.toFixed(2));
  }

  function planLabel(plan) {
    return plan === 'monthly' ? 'Monthly'
      : plan === 'annual' ? 'Annual'
      : plan === 'lifetime' ? 'Lifetime' : plan;
  }

  function planSuffix(plan) {
    return plan === 'monthly' ? '/mo' : plan === 'annual' ? '/yr' : '';
  }

  // ── Catalog page ───────────────────────────────────────────────────────
  function renderCatalog() {
    var app = document.getElementById('app');
    app.innerHTML = (window.App && window.App.renderNav ? window.App.renderNav('') : '') +
      '<div class="page page--catalog"><div class="catalog__loading">Loading courses…</div></div>';

    fetch('/api/platform/catalog')
      .then(function(r) { return r.json(); })
      .then(function(data) {
        var courses = (data && data.courses) || [];
        var page = document.querySelector('.page--catalog');
        if (!courses.length) {
          page.innerHTML = '<h1>Courses</h1><p class="text-secondary">No courses available yet.</p>';
          return;
        }
        page.innerHTML =
          '<h1 class="catalog__title">Courses</h1>' +
          '<div class="catalog__grid">' +
            courses.map(function(c) {
              var from = c.prices && c.prices.length
                ? Math.min.apply(null, c.prices.map(function(p) { return p.amountCents; }))
                : null;
              return '<a class="course-card" href="#/course/' + encodeURIComponent(c.id) + '">' +
                '<span class="course-card__lang">' + escapeHtml((c.language || '').toUpperCase()) + '</span>' +
                '<h2 class="course-card__title">' + escapeHtml(c.title) + '</h2>' +
                '<p class="course-card__desc">' + escapeHtml((c.description || '').slice(0, 120)) + '…</p>' +
                (from != null ? '<span class="course-card__from">From ' + money(from, 'USD') + '</span>' : '') +
                '<span class="course-card__cta">View course →</span>' +
              '</a>';
            }).join('') +
          '</div>';
      })
      .catch(function() {
        var page = document.querySelector('.page--catalog');
        if (page) page.innerHTML = '<div class="error-message">Failed to load courses.</div>';
      });
  }

  // ── Course landing page ──────────────────────────────────────────────────
  function renderCourse(params) {
    var courseId = params.id;
    var app = document.getElementById('app');
    app.innerHTML = (window.App && window.App.renderNav ? window.App.renderNav('') : '') +
      '<div class="page page--course"><div class="course__loading">Loading…</div></div>';

    Promise.all([
      fetch('/api/platform/catalog').then(function(r) { return r.json(); }),
      fetch('/api/platform/courses/' + encodeURIComponent(courseId) + '/preview').then(function(r) { return r.json(); })
    ]).then(function(results) {
      var courses = (results[0] && results[0].courses) || [];
      var course = courses.filter(function(c) { return c.id === courseId; })[0];
      var preview = (results[1] && results[1].preview) || [];
      if (!course) {
        document.querySelector('.page--course').innerHTML = '<div class="error-message">Course not found.</div>';
        return;
      }
      renderCourseView(course, preview);
    }).catch(function() {
      var page = document.querySelector('.page--course');
      if (page) page.innerHTML = '<div class="error-message">Failed to load course.</div>';
    });
  }

  function renderCourseView(course, preview) {
    var page = document.querySelector('.page--course');

    // Order plans nicely: monthly, annual, lifetime
    var order = { monthly: 1, annual: 2, lifetime: 3 };
    var plans = (course.prices || []).slice().sort(function(a, b) {
      return (order[a.planType] || 9) - (order[b.planType] || 9);
    });

    var plansHtml = plans.map(function(p) {
      var best = p.planType === 'annual' ? '<span class="plan-card__badge">Best value</span>' : '';
      return '<div class="plan-card' + (p.planType === 'annual' ? ' plan-card--featured' : '') + '">' +
        best +
        '<h3 class="plan-card__name">' + planLabel(p.planType) + '</h3>' +
        '<div class="plan-card__price">' + money(p.amountCents, p.currency) + '<span class="plan-card__suffix">' + planSuffix(p.planType) + '</span></div>' +
        '<button class="btn btn--primary plan-card__buy" data-plan="' + p.planType + '">Subscribe</button>' +
      '</div>';
    }).join('');

    // Preview grouped by section (kind). Each sample is clickable (opens the
    // real in-app exercise in preview mode via the route in its data).
    var previewHtml = preview.length
      ? '<div class="taster__grid">' + preview.map(function(u) {
          var d = u.data || {};
          var title = d.title || u.ref;
          var route = d.route || '';
          var inner =
            '<span class="taster__kind">' + escapeHtml(u.kind) + '</span>' +
            '<span class="taster__ref">' + escapeHtml(title) + '</span>';
          return route
            ? '<a class="taster__item taster__item--link" href="' + escapeHtml(route) + '">' + inner + '<span class="taster__try">Try →</span></a>'
            : '<div class="taster__item">' + inner + '</div>';
        }).join('') + '</div>'
      : '<p class="text-secondary">Free samples are being prepared for this course.</p>';

    page.innerHTML =
      '<a href="#/catalog" class="btn btn--sm btn--secondary">← All courses</a>' +
      '<div class="course-hero">' +
        '<span class="course-hero__lang">' + escapeHtml((course.language || '').toUpperCase()) + ' · ' + escapeHtml(course.level || '') + '</span>' +
        '<h1 class="course-hero__title">' + escapeHtml(course.title) + '</h1>' +
        '<p class="course-hero__desc">' + escapeHtml(course.description || '') + '</p>' +
      '</div>' +

      '<section class="taster">' +
        '<h2 class="taster__title">Test before paying</h2>' +
        '<p class="taster__sub">A free taste — one exercise from each part of the course. Subscribe to unlock everything.</p>' +
        previewHtml +
        '<div id="taster-open" class="taster__cta"></div>' +
      '</section>' +

      '<section class="pricing">' +
        '<h2 class="pricing__title">Choose your plan</h2>' +
        '<div class="pricing__grid">' + plansHtml + '</div>' +
        '<p id="checkout-msg" class="pricing__msg" hidden></p>' +
      '</section>';

    // If the taster has content, offer an "Open free taster" entry (routes into
    // the existing course UI in preview mode — wired fully in Task 10).
    var tasterOpen = document.getElementById('taster-open');
    if (preview.length && tasterOpen) {
      tasterOpen.innerHTML = '<a href="#/dashboard" class="btn btn--secondary">Open free taster →</a>';
    }

    // Bind subscribe buttons
    var buyBtns = page.querySelectorAll('.plan-card__buy');
    for (var i = 0; i < buyBtns.length; i++) {
      buyBtns[i].addEventListener('click', function() {
        startCheckout(course.id, this.getAttribute('data-plan'));
      });
    }
  }

  // ── Checkout ──────────────────────────────────────────────────────────────
  function startCheckout(courseId, planType) {
    var msg = document.getElementById('checkout-msg');
    function showMsg(text, isError) {
      if (!msg) return;
      msg.hidden = false;
      msg.textContent = text;
      msg.className = 'pricing__msg' + (isError ? ' text-danger' : '');
    }

    // 1. Require sign-in.
    var session = window.PlatformAuth && window.PlatformAuth.getSession();
    if (!session) {
      showMsg('Please sign in to subscribe.', false);
      // Route to login (platform auth UI is built in the account page).
      setTimeout(function() { window.location.hash = '#/account?next=course/' + encodeURIComponent(courseId); }, 800);
      return;
    }

    showMsg('Preparing secure checkout…', false);
    var token = window.PlatformAuth.getAccessToken();

    fetch('/api/platform/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
      body: JSON.stringify({ courseId: courseId, planType: planType })
    })
      .then(function(r) { return r.json().then(function(j) { return { status: r.status, body: j }; }); })
      .then(function(res) {
        if (res.status !== 200) {
          showMsg(res.body && res.body.message ? res.body.message : 'Checkout could not be started.', true);
          return;
        }
        openPaddleCheckout(res.body, courseId);
      })
      .catch(function() { showMsg('Network error starting checkout.', true); });
  }

  function openPaddleCheckout(checkout, courseId) {
    var msg = document.getElementById('checkout-msg');
    ensurePaddle().then(function() {
      if (!window.Paddle) {
        if (checkout.url) { window.location.href = checkout.url; return; }
        if (msg) { msg.hidden = false; msg.textContent = 'Checkout unavailable.'; }
        return;
      }
      var opts = {
        settings: { displayMode: 'overlay', theme: 'light' },
        transactionId: checkout.transactionId
      };
      window.Paddle.Checkout.open(opts);
      // After the overlay closes, poll for the new entitlement (webhook-driven).
      pollEntitlement(courseId);
    });
  }

  function pollEntitlement(courseId) {
    var token = window.PlatformAuth && window.PlatformAuth.getAccessToken();
    if (!token) return;
    var tries = 0;
    var timer = setInterval(function() {
      tries++;
      fetch('/api/platform/me/entitlements', { headers: { 'Authorization': 'Bearer ' + token } })
        .then(function(r) { return r.json(); })
        .then(function(data) {
          var ents = (data && data.entitlements) || [];
          var active = ents.some(function(e) {
            return (e.all_access || e.course_id === courseId) && e.status === 'active';
          });
          if (active) {
            clearInterval(timer);
            window.location.hash = '#/dashboard';
          }
        }).catch(function() {});
      if (tries > 20) clearInterval(timer); // ~1 min then stop
    }, 3000);
  }

  // Load Paddle.js and initialize with the client-side token from config.
  function ensurePaddle() {
    if (paddleReady && window.Paddle) return Promise.resolve();
    return fetch('/api/platform/config')
      .then(function(r) { return r.json(); })
      .then(function(cfg) {
        return loadScript('https://cdn.paddle.com/paddle/v2/paddle.js').then(function() {
          if (window.Paddle && cfg.paddleClientToken) {
            if (cfg.paddleEnvironment === 'sandbox' && window.Paddle.Environment) {
              window.Paddle.Environment.set('sandbox');
            }
            window.Paddle.Initialize({ token: cfg.paddleClientToken });
            paddleReady = true;
          }
        });
      });
  }

  function loadScript(src) {
    return new Promise(function(resolve, reject) {
      if (document.querySelector('script[src="' + src + '"]')) return resolve();
      var s = document.createElement('script');
      s.src = src; s.onload = resolve; s.onerror = function() { reject(new Error('script load failed')); };
      document.head.appendChild(s);
    });
  }

  function escapeHtml(str) {
    var d = document.createElement('div');
    d.appendChild(document.createTextNode(str == null ? '' : String(str)));
    return d.innerHTML;
  }

  // Register as PUBLIC routes (browsable without login).
  if (window.Router) {
    window.Router.registerRoute('/catalog', renderCatalog);
    window.Router.registerRoute('/course/:id', renderCourse);
  }
  // Expose for router public-route allowlist.
  window.CatalogPages = { renderCatalog: renderCatalog, renderCourse: renderCourse };
})();
