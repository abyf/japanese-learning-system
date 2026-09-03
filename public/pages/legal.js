/**
 * Legal / Compliance Pages (Task 12)
 *
 * Public pages required for payment-provider (Paddle) approval and general
 * trust: pricing, terms of service, privacy policy, refund policy, contact.
 * Routes:
 *   #/pricing   #/terms   #/privacy   #/refunds   #/contact
 *
 * NOTE: This is boilerplate legal copy tailored to the platform's model
 * (subscriptions via a Merchant of Record). Have a professional review it
 * before relying on it for a live commercial service.
 */
(function() {
  'use strict';

  // Update these with your real business details before go-live.
  var BUSINESS = {
    name: 'NipponMboa Consulting',
    site: 'NipponMboa Learning',
    contactEmail: 'nipponmboaconsulting@gmail.com',
    mor: 'Paddle.com Market Limited'               // Merchant of Record
  };

  function nav() { return (window.App && window.App.renderNav) ? window.App.renderNav('') : ''; }
  function page(title, bodyHtml) {
    var app = document.getElementById('app');
    app.innerHTML = nav() +
      '<div class="page page--legal">' +
        '<a href="#/catalog" class="btn btn--sm btn--secondary">\u2190 Home</a>' +
        '<h1 class="legal__title">' + title + '</h1>' +
        '<div class="legal__body">' + bodyHtml + '</div>' +
        renderLegalNav() +
      '</div>';
  }

  function renderLegalNav() {
    return '<nav class="legal__links">' +
      '<a href="#/pricing">Pricing</a>' +
      '<a href="#/terms">Terms</a>' +
      '<a href="#/privacy">Privacy</a>' +
      '<a href="#/refunds">Refunds</a>' +
      '<a href="#/contact">Contact</a>' +
    '</nav>';
  }

  var updated = 'Last updated: ' + new Date().getFullYear();

  // ── Pricing ───────────────────────────────────────────────────────────────
  function renderPricing() {
    page('Pricing', '<div class="legal__loading">Loading plans…</div>');
    fetch('/api/platform/catalog').then(function(r){return r.json();}).then(function(data){
      var body = document.querySelector('.legal__body');
      var courses = (data && data.courses) || [];
      if (!courses.length) { body.innerHTML = '<p>Pricing is being finalized.</p>'; return; }
      body.innerHTML =
        '<p>Each course is available on three plans. Prices are in US dollars. ' +
        'Applicable taxes are calculated at checkout by our payment provider.</p>' +
        courses.map(function(c){
          var order = {monthly:1, annual:2, lifetime:3};
          var plans = (c.prices||[]).slice().sort(function(a,b){return (order[a.planType]||9)-(order[b.planType]||9);});
          return '<h2>' + esc(c.title) + '</h2><ul class="legal__plans">' +
            plans.map(function(p){
              var per = p.planType === 'monthly' ? ' / month' : p.planType === 'annual' ? ' / year' : ' (one-time)';
              return '<li><strong>' + cap(p.planType) + ':</strong> $' + (p.amountCents/100).toFixed(0) + per + '</li>';
            }).join('') + '</ul>';
        }).join('') +
        '<p><a href="#/catalog" class="btn btn--primary">Browse courses</a></p>';
    }).catch(function(){
      var body = document.querySelector('.legal__body');
      if (body) body.innerHTML = '<p>Could not load pricing right now.</p>';
    });
  }

  // ── Terms of Service ───────────────────────────────────────────────────────
  function renderTerms() {
    page('Terms of Service',
      '<p class="legal__meta">' + updated + '</p>' +
      '<p>Welcome to ' + BUSINESS.site + ' ("the Service"), operated by ' + BUSINESS.name +
      ' ("we", "us"). By creating an account or subscribing, you agree to these Terms.</p>' +
      '<h2>1. The Service</h2><p>We provide online language-learning courses accessed through a web application. ' +
      'Access to paid course content requires an active subscription or a lifetime purchase.</p>' +
      '<h2>2. Accounts</h2><p>You are responsible for your account credentials and for activity under your account. ' +
      'You must provide accurate information and be old enough to form a binding contract in your jurisdiction.</p>' +
      '<h2>3. Subscriptions & billing</h2><p>Monthly and annual plans renew automatically until canceled. ' +
      'Lifetime plans are a one-time purchase granting ongoing access to the purchased course. ' +
      'Payments are processed by our payment provider, ' + BUSINESS.mor + ', which acts as the Merchant of Record.</p>' +
      '<h2>4. Cancellation</h2><p>You may cancel a recurring plan at any time via the billing portal; access continues ' +
      'until the end of the current paid period. See our <a href="#/refunds">Refund Policy</a>.</p>' +
      '<h2>5. Acceptable use</h2><p>You may not share, resell, or redistribute course content, or attempt to bypass ' +
      'access controls. Content is for your personal learning use.</p>' +
      '<h2>6. Intellectual property</h2><p>Course materials are owned by us or our licensors. Some components are used ' +
      'under open licenses (see credits within the app). You receive a limited, non-transferable license to access ' +
      'purchased content.</p>' +
      '<h2>7. Disclaimers</h2><p>The Service is provided "as is". We do not guarantee specific learning outcomes.</p>' +
      '<h2>8. Limitation of liability</h2><p>To the maximum extent permitted by law, our liability is limited to the ' +
      'amount you paid in the 12 months before the claim.</p>' +
      '<h2>9. Changes</h2><p>We may update these Terms; material changes will be notified in-app or by email.</p>' +
      '<h2>10. Contact</h2><p>Questions: <a href="#/contact">contact us</a>.</p>'
    );
  }

  // ── Privacy Policy ─────────────────────────────────────────────────────────
  function renderPrivacy() {
    page('Privacy Policy',
      '<p class="legal__meta">' + updated + '</p>' +
      '<p>' + BUSINESS.name + ' respects your privacy. This policy explains what we collect and why.</p>' +
      '<h2>What we collect</h2><ul>' +
        '<li><strong>Account data:</strong> email and a display name, via our authentication provider (Supabase).</li>' +
        '<li><strong>Learning data:</strong> your progress within courses.</li>' +
        '<li><strong>Billing data:</strong> handled by our payment provider (' + BUSINESS.mor + '). ' +
        'We receive subscription status and identifiers, but never your full card details.</li>' +
      '</ul>' +
      '<h2>How we use it</h2><p>To provide the Service, manage your access and subscription, and improve the courses.</p>' +
      '<h2>Processors</h2><p>We use Supabase (database, authentication, storage) and ' + BUSINESS.mor +
      ' (payments). These providers process data on our behalf under their own terms.</p>' +
      '<h2>Data retention & deletion</h2><p>You may request deletion of your account and associated data at any time ' +
      'via <a href="#/contact">contact</a>. We delete or anonymize data when it is no longer needed.</p>' +
      '<h2>Your rights</h2><p>Depending on your location, you may have rights to access, correct, or delete your data.</p>' +
      '<h2>Cookies</h2><p>We use essential cookies/session storage to keep you signed in. We do not sell your data.</p>' +
      '<h2>Contact</h2><p>Privacy questions: <a href="#/contact">contact us</a>.</p>'
    );
  }

  // ── Refund Policy ──────────────────────────────────────────────────────────
  function renderRefunds() {
    page('Refund Policy',
      '<p class="legal__meta">' + updated + '</p>' +
      '<h2>Free preview first</h2><p>Every course offers a free "Test before paying" preview so you can try the ' +
      'experience before subscribing.</p>' +
      '<h2>Subscriptions</h2><p>You can cancel a monthly or annual plan at any time; you keep access until the end of ' +
      'the current paid period, and you will not be charged again after cancellation.</p>' +
      '<h2>Refunds</h2><p>If you are not satisfied, contact us within <strong>14 days</strong> of a charge and we will ' +
      'review your request for a refund. Refunds are processed by our payment provider (' + BUSINESS.mor + ').</p>' +
      '<h2>Lifetime purchases</h2><p>Lifetime purchases are also covered by the 14-day satisfaction window described ' +
      'above.</p>' +
      '<h2>How to request</h2><p>Email us via <a href="#/contact">contact</a> with your account email and the purchase ' +
      'in question.</p>'
    );
  }

  // ── Contact ────────────────────────────────────────────────────────────────
  function renderContact() {
    page('Contact',
      '<p>We\u2019re happy to help with questions about courses, billing, privacy, or account deletion.</p>' +
      '<p><strong>Email:</strong> <a href="mailto:' + BUSINESS.contactEmail + '">' + BUSINESS.contactEmail + '</a></p>' +
      '<p><strong>Operated by:</strong> ' + BUSINESS.name + '</p>' +
      '<p>For account or data-deletion requests, email us from your account address and we will process it promptly.</p>'
    );
  }

  function esc(s){ var d=document.createElement('div'); d.appendChild(document.createTextNode(s==null?'':String(s))); return d.innerHTML; }
  function cap(s){ return s ? s.charAt(0).toUpperCase()+s.slice(1) : s; }

  if (window.Router) {
    window.Router.registerRoute('/pricing', renderPricing);
    window.Router.registerRoute('/terms', renderTerms);
    window.Router.registerRoute('/privacy', renderPrivacy);
    window.Router.registerRoute('/refunds', renderRefunds);
    window.Router.registerRoute('/contact', renderContact);
  }
  window.LegalPages = { business: BUSINESS };
})();
