/**
 * Japanese Learning System - Deep Dive Page
 * Shows themed onomatopoeia, collocations, and idioms (in-app, no external links).
 * Route: /deepdive/:topic
 */
(function() {
  'use strict';

  function renderNav(active) {
    return window.App.renderNav(active);
  }

  function L(obj) {
    if (!obj) return '';
    if (typeof obj === 'string') return obj;
    var lang = window.App.getLanguage();
    return obj[lang] || obj.en || '';
  }

  function render(params) {
    var topic = (params.topic || '').split('?')[0];
    var app = document.getElementById('app');
    app.innerHTML = renderNav('curriculum') +
      '<div class="page page--deepdive">' +
        '<div class="deepdive__loading">' + window.i18n('general.loading') + '</div>' +
      '</div>';

    window.API.get('/deepdive/' + encodeURIComponent(topic))
      .then(function(data) { renderTopic(data); })
      .catch(function(err) {
        var page = document.querySelector('.page--deepdive');
        if (page) page.innerHTML = '<div class="error-message">' + window.i18n('general.error') + ': ' + (err.message || '') + '</div>';
      });
  }

  function renderTopic(data) {
    var page = document.querySelector('.page--deepdive');
    if (!page) return;

    var backUrl = getBackUrl();

    var html =
      '<div class="deepdive__header">' +
        '<a href="' + backUrl + '" class="btn btn--sm btn--secondary">' + window.i18n('activity.back') + '</a>' +
        '<span class="deepdive__kind">' + escapeHtml(L(data.kind)) + '</span>' +
        '<h1 class="deepdive__title">' + (window.Icons ? window.Icons.torii(30) : '') + ' ' + escapeHtml(L(data.title)) + '</h1>' +
        (data.intro ? '<p class="deepdive__intro">' + escapeHtml(L(data.intro)) + '</p>' : '') +
      '</div>';

    html += '<div class="deepdive__list">';
    (data.items || []).forEach(function(item) {
      html += '<div class="deepdive-item">' +
        '<div class="deepdive-item__main">' +
          '<button class="deepdive-item__jp" data-say="' + escapeAttr(item.jp) + '" title="' + window.i18n('kana.playSound') + '">' +
            escapeHtml(item.jp) + ' <span class="deepdive-item__play">♪</span>' +
          '</button>' +
          '<span class="deepdive-item__reading">' + escapeHtml(item.reading || '') + '</span>' +
        '</div>' +
        '<div class="deepdive-item__meaning">' + escapeHtml(L(item.meaning)) + '</div>' +
        (item.note ? '<div class="deepdive-item__note">' + escapeHtml(L(item.note)) + '</div>' : '') +
      '</div>';
    });
    html += '</div>';

    var ctx = getCtx();
    html += '<div class="deepdive__actions">';
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

    // Bind audio
    var jpBtns = page.querySelectorAll('.deepdive-item__jp');
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

  window.Router.registerRoute('/deepdive/:topic', render);
})();
