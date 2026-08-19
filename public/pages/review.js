/**
 * Japanese Learning System - SRS Review Page
 * Spaced-repetition flashcard review pulling due cards from /api/srs.
 * Route: /review
 */
(function() {
  'use strict';

  function renderNav(active) { return window.App.renderNav(active); }

  var queue = [];
  var idx = 0;
  var reviewed = 0;

  function ctxOf() {
    var params = (window.location.hash || '').split('?')[1] || '';
    if (params.indexOf('from=curriculum') === -1) return null;
    var w = params.match(/week=(\d+)/), d = params.match(/day=(\d+)/), i = params.match(/idx=(\d+)/);
    if (!w || !d) return null;
    return { week: w[1], day: d[1], idx: i ? i[1] : '' };
  }

  function finishCta() {
    var ctx = ctxOf();
    if (!ctx) return '<a href="#/dashboard" class="btn btn--secondary">' + window.i18n('nav.dashboard') + '</a>';
    return '<button id="review-finish" class="btn btn--success btn--lg">' + window.i18n('lesson.finish') + '</button>';
  }

  function bindFinish() {
    var ctx = ctxOf();
    var fin = document.getElementById('review-finish');
    if (fin && ctx) {
      fin.addEventListener('click', function() {
        fin.disabled = true; fin.textContent = '...';
        var body = { week: parseInt(ctx.week, 10), day: parseInt(ctx.day, 10) };
        if (ctx.idx !== undefined && ctx.idx !== '') body.activityIndex = parseInt(ctx.idx, 10);
        window.API.post('/curriculum/external-done', body).then(back).catch(back);
        function back() { window.location.hash = '#/curriculum/' + ctx.week + '/' + ctx.day; }
      });
    }
  }

  function render() {
    var app = document.getElementById('app');
    app.innerHTML = renderNav('review') +
      '<div class="page page--review"><div class="review__loading">' + window.i18n('general.loading') + '</div></div>';
    load();
  }

  function load() {
    Promise.all([
      window.API.get('/srs/stats').catch(function() { return null; }),
      window.API.get('/srs/due?limit=20')
    ]).then(function(res) {
      var stats = res[0] || {};
      queue = (res[1] && res[1].cards) || [];
      idx = 0; reviewed = 0;
      renderStart(stats);
    }).catch(function(err) {
      var page = document.querySelector('.page--review');
      if (page) page.innerHTML = '<div class="error-message">' + window.i18n('general.error') + ': ' + (err.message || '') + '</div>';
    });
  }

  function renderStart(stats) {
    var page = document.querySelector('.page--review');
    if (!page) return;
    var statBar =
      '<div class="review__stats">' +
        stat(stats.dueCards || queue.length, window.i18n('review.due')) +
        stat(stats.totalCards || 0, window.i18n('review.total')) +
        stat(stats.masteredCards || 0, window.i18n('review.mastered')) +
      '</div>';

    if (queue.length === 0) {
      page.innerHTML =
        '<div class="review__header"><h1>' + window.i18n('review.title') + '</h1></div>' +
        statBar +
        '<div class="review__empty">' + (window.Icons ? window.Icons.celebrate(48) : '') +
        '<p>' + window.i18n('review.empty') + '</p>' + finishCta() + '</div>';
      bindFinish();
      return;
    }

    page.innerHTML =
      '<div class="review__header"><h1>' + window.i18n('review.title') + '</h1>' +
        '<p class="text-secondary">' + window.i18n('review.intro') + '</p></div>' +
      statBar +
      '<div id="review-card"></div>';
    renderCard();
  }

  function stat(n, label) {
    return '<div class="review-stat"><span class="review-stat__num">' + n + '</span><span class="review-stat__label">' + label + '</span></div>';
  }

  function renderCard() {
    var host = document.getElementById('review-card');
    if (!host) return;
    if (idx >= queue.length) { renderDone(); return; }
    var c = queue[idx];

    host.innerHTML =
      '<div class="flashcard">' +
        '<div class="flashcard__progress">' + (idx + 1) + ' / ' + queue.length + '</div>' +
        '<div class="flashcard__word">' + escapeHtml(c.word || c.cardId) + '</div>' +
        '<button class="flashcard__audio" id="fc-audio" title="' + window.i18n('kana.playSound') + '">♪</button>' +
        '<div class="flashcard__back" id="fc-back" hidden>' +
          '<div class="flashcard__reading">' + escapeHtml(c.reading || '') + '</div>' +
          '<div class="flashcard__meaning">' + escapeHtml(c.meaning || '') + '</div>' +
          (c.exampleSentence ? '<div class="flashcard__example">' + escapeHtml(c.exampleSentence) + '</div>' : '') +
          (c.mnemonic ? '<div class="flashcard__mnemonic">' + escapeHtml(c.mnemonic) + '</div>' : '') +
        '</div>' +
        '<div class="flashcard__actions" id="fc-actions">' +
          '<button class="btn btn--primary btn--lg" id="fc-show">' + window.i18n('review.show') + '</button>' +
        '</div>' +
      '</div>';

    var audio = document.getElementById('fc-audio');
    if (audio) audio.addEventListener('click', function() { if (window.TTS) window.TTS.speak(c.word || '', { rate: 0.85 }); });

    document.getElementById('fc-show').addEventListener('click', function() {
      var back = document.getElementById('fc-back');
      if (back) back.hidden = false;
      if (window.TTS) window.TTS.speak(c.word || '', { rate: 0.85 });
      document.getElementById('fc-actions').innerHTML =
        '<div class="flashcard__rate">' +
          rateBtn('again', 1, window.i18n('review.again')) +
          rateBtn('hard', 3, window.i18n('review.hard')) +
          rateBtn('good', 4, window.i18n('review.good')) +
          rateBtn('easy', 5, window.i18n('review.easy')) +
        '</div>';
      var btns = document.querySelectorAll('.flashcard__rate .btn');
      for (var i = 0; i < btns.length; i++) {
        btns[i].addEventListener('click', function() { rate(parseInt(this.getAttribute('data-q'), 10)); });
      }
    });
  }

  function rateBtn(key, q, label) {
    return '<button class="btn btn--sm rate rate--' + key + '" data-q="' + q + '">' + label + '</button>';
  }

  function rate(quality) {
    var c = queue[idx];
    reviewed++;
    window.API.post('/srs/review', { cardId: c.cardId || c.id, quality: quality }).catch(function() {});
    idx++;
    renderCard();
  }

  function renderDone() {
    var host = document.getElementById('review-card');
    if (!host) return;
    host.innerHTML =
      '<div class="review__empty">' + (window.Icons ? window.Icons.celebrate(48) : '') +
        '<p>' + window.i18n('review.sessionDone').replace('{n}', reviewed) + '</p>' +
        '<button class="btn btn--primary" id="review-more">' + window.i18n('review.more') + '</button> ' +
        finishCta() +
      '</div>';
    var more = document.getElementById('review-more');
    if (more) more.addEventListener('click', load);
    bindFinish();
  }

  function escapeHtml(str) { var d = document.createElement('div'); d.appendChild(document.createTextNode(str == null ? '' : String(str))); return d.innerHTML; }

  window.Router.registerRoute('/review', render);
})();
