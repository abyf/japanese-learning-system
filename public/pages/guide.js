/**
 * Japanese Learning System - Reference Guide Page
 * Renders a sectioned reference (numbers, counters, time, money) with audio.
 * Route: /guide/:id  (e.g., /guide/numbers)
 */
(function() {
  'use strict';

  function renderNav(active) { return window.App.renderNav(active); }

  function L(obj) {
    if (!obj) return '';
    if (typeof obj === 'string') return obj;
    var lang = window.App.getLanguage();
    return obj[lang] || obj.en || '';
  }

  function render(params) {
    var id = (params.id || '').split('?')[0];
    var app = document.getElementById('app');
    app.innerHTML = renderNav('curriculum') +
      '<div class="page page--guide"><div class="guide__loading">' + window.i18n('general.loading') + '</div></div>';

    window.API.get('/guide/' + encodeURIComponent(id))
      .then(function(data) { renderGuide(data); })
      .catch(function(err) {
        var page = document.querySelector('.page--guide');
        if (page) page.innerHTML = '<div class="error-message">' + window.i18n('general.error') + ': ' + (err.message || '') + '</div>';
      });
  }

  function renderGuide(data) {
    var page = document.querySelector('.page--guide');
    if (!page) return;
    var ctx = getCtx();
    var backHref = ctx ? '#/curriculum/' + ctx.week + '/' + ctx.day : '#/dashboard';

    var html = '<div class="guide__header">' +
      (ctx ? '<a href="' + backHref + '" class="btn btn--sm btn--secondary">' + window.i18n('activity.back') + '</a>' : '') +
      '<h1 class="guide__title">' + (window.Icons ? window.Icons.torii(30) : '') + ' ' + escapeHtml(L(data.title)) + '</h1>' +
      '<p class="guide__intro">' + escapeHtml(L(data.intro)) + '</p>' +
      '</div>';

    (data.sections || []).forEach(function(sec) {
      html += '<div class="guide-section">' +
        '<h2 class="guide-section__heading">' + escapeHtml(L(sec.heading)) + '</h2>' +
        '<div class="guide-grid">';
      (sec.items || []).forEach(function(it) {
        html += '<button class="guide-cell" data-say="' + escapeAttr(it.reading || it.jp) + '">' +
          '<span class="guide-cell__jp">' + escapeHtml(it.jp) + '</span>' +
          '<span class="guide-cell__reading">' + escapeHtml(it.reading || '') + '</span>' +
          '<span class="guide-cell__meaning">' + escapeHtml(L(it.meaning)) + '</span>' +
        '</button>';
      });
      html += '</div></div>';
    });

    html += '<div class="guide__actions">';
    if (ctx) {
      html += '<div class="lesson-finish">' +
        '<p class="lesson-finish__hint">' + window.i18n('lesson.finishHint') + '</p>' +
        '<button id="lesson-finish-btn" class="btn btn--success btn--lg">' + window.i18n('lesson.finish') + '</button>' +
      '</div>';
    } else {
      html += '<a href="#/dashboard" class="btn btn--secondary">' + window.i18n('nav.dashboard') + '</a>';
    }
    html += '</div>';

    page.innerHTML = html;

    var cells = page.querySelectorAll('.guide-cell');
    for (var i = 0; i < cells.length; i++) {
      cells[i].addEventListener('click', function() {
        if (window.TTS) window.TTS.speak(this.getAttribute('data-say'), { rate: 0.85 });
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

  function escapeHtml(str) {
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(str == null ? '' : String(str)));
    return div.innerHTML;
  }
  function escapeAttr(str) { return escapeHtml(str).replace(/"/g, '&quot;'); }

  window.Router.registerRoute('/guide/:id', render);
})();
