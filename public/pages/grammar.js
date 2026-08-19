/**
 * Japanese Learning System - Grammar Lesson Page (in-app)
 * Route: /grammar/:level/:id  (e.g., /grammar/beginner/g001)
 */
(function() {
  'use strict';

  function renderNav(active) { return window.App.renderNav(active); }

  function render(params) {
    var level = params.level;
    var id = (params.id || '').split('?')[0];
    var app = document.getElementById('app');
    app.innerHTML = renderNav('curriculum') +
      '<div class="page page--grammar">' +
        '<div class="grammar__loading">' + window.i18n('general.loading') + '</div>' +
      '</div>';

    window.API.get('/grammar/' + encodeURIComponent(level) + '/' + encodeURIComponent(id))
      .then(function(g) { renderPoint(level, g); })
      .catch(function(err) {
        var page = document.querySelector('.page--grammar');
        if (page) page.innerHTML = '<div class="error-message">' + window.i18n('general.error') + ': ' + (err.message || '') + '</div>';
      });
  }

  function renderPoint(level, g) {
    var page = document.querySelector('.page--grammar');
    if (!page) return;
    var lang = window.App.getLanguage();

    var explanation = g.explanation;
    if (lang === 'fr') explanation = g.explanationFr || explanation;
    else if (lang === 'pt') explanation = g.explanationPt || explanation;

    var backUrl = getBackUrl();

    var html =
      '<div class="grammar__header">' +
        '<a href="' + backUrl + '" class="btn btn--sm btn--secondary">' + window.i18n('activity.back') + '</a>' +
        '<span class="grammar__tag">' + window.i18n('grammar.label') + '</span>' +
        '<h1 class="grammar__title">' + (window.Icons ? window.Icons.brush(28) : '') + ' ' + escapeHtml(g.title) + '</h1>' +
      '</div>' +
      '<div class="grammar__card">' +
        '<p class="grammar__explanation">' + escapeHtml(explanation) + '</p>' +
        (g.pattern ? '<div class="grammar__pattern"><span class="grammar__pattern-label">' + window.i18n('grammar.pattern') + '</span> <code>' + escapeHtml(g.pattern) + '</code></div>' : '') +
      '</div>' +
      '<h2 class="grammar__examples-title">' + window.i18n('grammar.examples') + '</h2>' +
      '<div class="grammar__examples">';

    (g.examples || []).forEach(function(ex) {
      var tr = ex.translation;
      if (lang === 'fr') tr = ex.translationFr || tr;
      else if (lang === 'pt') tr = ex.translationPt || tr;
      html += '<div class="grammar-example">' +
        '<button class="grammar-example__jp" data-say="' + escapeAttr(ex.japanese) + '" title="' + window.i18n('kana.playSound') + '">' +
          escapeHtml(ex.japanese) + ' <span class="grammar-example__play">♪</span>' +
        '</button>' +
        '<div class="grammar-example__tr">' + escapeHtml(tr) + '</div>' +
      '</div>';
    });
    var ctx = getCtx();
    html += '</div>' + '<div class="grammar__actions">';
    if (ctx) {
      html += '<div class="lesson-finish">' +
        '<p class="lesson-finish__hint">' + window.i18n('lesson.finishHint') + '</p>' +
        '<button id="lesson-finish-btn" class="btn btn--success btn--lg">' + window.i18n('lesson.finish') + '</button>' +
      '</div>';
    } else {
      html += '<a href="' + backUrl + '" class="btn btn--primary">' + window.i18n('nav.dashboard') + '</a>';
    }
    html += '</div>';

    page.innerHTML = html;

    var jpBtns = page.querySelectorAll('.grammar-example__jp');
    for (var i = 0; i < jpBtns.length; i++) {
      jpBtns[i].addEventListener('click', function() {
        if (window.TTS) window.TTS.speak(this.getAttribute('data-say'), { rate: 0.9 });
      });
    }

    var finishBtn = document.getElementById('lesson-finish-btn');
    if (finishBtn && ctx) {
      finishBtn.addEventListener('click', function() {
        finishBtn.disabled = true; finishBtn.textContent = '...';
        var body = { week: parseInt(ctx.week, 10), day: parseInt(ctx.day, 10) };
        if (ctx.idx !== undefined && ctx.idx !== '') body.activityIndex = parseInt(ctx.idx, 10);
        window.API.post('/curriculum/external-done', body).then(back).catch(back);
        function back() { window.location.hash = '#/curriculum/' + ctx.week + '/' + ctx.day; }
      });
    }
  }

  function getCtx() {
    var params = (window.location.hash || '').split('?')[1] || '';
    if (params.indexOf('from=curriculum') === -1) return null;
    var w = params.match(/week=(\d+)/);
    var d = params.match(/day=(\d+)/);
    var i = params.match(/idx=(\d+)/);
    if (!w || !d) return null;
    return { week: w[1], day: d[1], idx: i ? i[1] : '' };
  }

  function getBackUrl() {
    var ctx = getCtx();
    if (ctx) return '#/curriculum/' + ctx.week + '/' + ctx.day;
    return '#/dashboard';
  }

  function escapeHtml(str) {
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(str == null ? '' : String(str)));
    return div.innerHTML;
  }
  function escapeAttr(str) { return escapeHtml(str).replace(/"/g, '&quot;'); }

  window.Router.registerRoute('/grammar/:level/:id', render);
})();
