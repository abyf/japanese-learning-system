/**
 * Japanese Learning System - Drills Page
 * Interactive sentence-building (arrange tokens) and conjugation drills.
 * Route: /drill/:topic
 */
(function() {
  'use strict';

  function renderNav(active) { return window.App.renderNav(active); }
  function L(o) { if (!o) return ''; if (typeof o === 'string') return o; var l = window.App.getLanguage(); return o[l] || o.en || ''; }

  var data = null;
  var states = [];

  function render(params) {
    var topic = (params.topic || '').split('?')[0];
    var app = document.getElementById('app');
    app.innerHTML = renderNav('curriculum') +
      '<div class="page page--drill"><div class="drill__loading">' + window.i18n('general.loading') + '</div></div>';

    window.API.get('/drill/' + encodeURIComponent(topic))
      .then(function(d) { data = d; setup(); })
      .catch(function(err) {
        var page = document.querySelector('.page--drill');
        if (page) page.innerHTML = '<div class="error-message">' + window.i18n('general.error') + ': ' + (err.message || '') + '</div>';
      });
  }

  function shuffle(a) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }

  function setup() {
    states = (data.questions || []).map(function(q) {
      if (q.type === 'order') {
        return { type: 'order', tokens: q.tokens, bank: shuffle(q.tokens), built: [], correct: false, translation: q.translation };
      }
      return { type: 'conjugate', base: q.base, options: shuffle(q.options), answer: q.answer, correct: false, chosen: null };
    });
    renderDrill();
  }

  function ctxOf() {
    var params = (window.location.hash || '').split('?')[1] || '';
    if (params.indexOf('from=curriculum') === -1) return null;
    var w = params.match(/week=(\d+)/), d = params.match(/day=(\d+)/), i = params.match(/idx=(\d+)/);
    if (!w || !d) return null;
    return { week: w[1], day: d[1], idx: i ? i[1] : '' };
  }

  function renderDrill() {
    var page = document.querySelector('.page--drill');
    if (!page) return;
    var ctx = ctxOf();

    var tabs = '';
    if (!ctx && data.topics && data.topics.length > 1) {
      tabs = '<div class="drill__tabs">' + data.topics.map(function(tp) {
        return '<a href="#/drill/' + tp.id + '" class="drill__tab' + (tp.id === data.id ? ' drill__tab--active' : '') + '">' + escapeHtml(L(tp.title)) + '</a>';
      }).join('') + '</div>';
    }

    var html = '<div class="drill__header">' +
      (ctx ? '<a href="#/curriculum/' + ctx.week + '/' + ctx.day + '" class="btn btn--sm btn--secondary">' + window.i18n('activity.back') + '</a>' : '') +
      tabs +
      '<span class="drill__kind">' + escapeHtml(L(data.kind)) + '</span>' +
      '<h1 class="drill__title">' + escapeHtml(L(data.title)) + '</h1>' +
      '<p class="drill__intro">' + escapeHtml(L(data.intro)) + '</p>' +
      '</div>';

    html += '<div class="drill__questions">';
    states.forEach(function(s, i) {
      html += '<div class="drill-q' + (s.correct ? ' drill-q--correct' : '') + '" data-q="' + i + '">' +
        '<div class="drill-q__num">Q' + (i + 1) + '</div>' +
        '<div class="drill-q__body" id="drill-q-' + i + '">' + renderQuestion(s, i) + '</div>' +
      '</div>';
    });
    html += '</div>';

    html += '<div class="drill__footer" id="drill-footer"></div>';

    page.innerHTML = html;
    bind();
    updateFooter();
  }

  function renderQuestion(s, i) {
    if (s.type === 'order') {
      var built = s.built.map(function(tok, k) {
        return '<button class="drill-built" data-q="' + i + '" data-k="' + k + '"' + (s.correct ? ' disabled' : '') + '>' + escapeHtml(tok) + '</button>';
      }).join('');
      var bank = s.bank.map(function(tok, k) {
        return '<button class="drill-tok" data-q="' + i + '" data-k="' + k + '"' + (s.correct ? ' disabled' : '') + '>' + escapeHtml(tok) + '</button>';
      }).join('');
      return '<p class="drill-q__prompt">' + escapeHtml(L(s.translation)) + '</p>' +
        '<div class="drill-build">' + (built || '<span class="drill-build__empty">…</span>') + '</div>' +
        '<div class="drill-bank">' + bank + '</div>' +
        (s.correct
          ? '<p class="drill-q__result drill-q__result--ok">\u2713 ' + escapeHtml(s.tokens.join('')) + '</p>'
          : '<button class="btn btn--sm btn--primary drill-check" data-q="' + i + '"' + (s.built.length === s.tokens.length ? '' : ' disabled') + '>' + window.i18n('drill.check') + '</button>' +
            (s.wrong ? ' <span class="drill-q__result drill-q__result--wrong">' + window.i18n('drill.tryAgain') + '</span>' : '')) ;
    }
    // conjugate
    var base = '<span class="drill-conj__base">' + escapeHtml(s.base) + ' \u2192 ?</span>';
    var opts = s.options.map(function(opt) {
      var cls = 'drill-opt';
      if (s.correct && opt === s.answer) cls += ' drill-opt--ok';
      else if (s.chosen === opt && opt !== s.answer) cls += ' drill-opt--wrong';
      return '<button class="' + cls + '" data-q="' + i + '" data-opt="' + escapeAttr(opt) + '"' + (s.correct ? ' disabled' : '') + '>' + escapeHtml(opt) + '</button>';
    }).join('');
    return base + '<div class="drill-opts">' + opts + '</div>';
  }

  function rerenderQuestion(i) {
    var el = document.getElementById('drill-q-' + i);
    if (el) el.innerHTML = renderQuestion(states[i], i);
    var card = document.querySelector('.drill-q[data-q="' + i + '"]');
    if (card) card.classList.toggle('drill-q--correct', states[i].correct);
    bind();
    updateFooter();
  }

  function bind() {
    var page = document.querySelector('.page--drill');
    if (!page) return;
    page.onclick = function(e) {
      var el = e.target;
      if (!el.getAttribute) return;
      var qi = parseInt(el.getAttribute('data-q'), 10);
      if (el.classList.contains('drill-tok')) {
        var s = states[qi]; var k = parseInt(el.getAttribute('data-k'), 10);
        s.built.push(s.bank[k]); s.bank.splice(k, 1); s.wrong = false; rerenderQuestion(qi);
      } else if (el.classList.contains('drill-built')) {
        var s2 = states[qi]; var k2 = parseInt(el.getAttribute('data-k'), 10);
        s2.bank.push(s2.built[k2]); s2.built.splice(k2, 1); s2.wrong = false; rerenderQuestion(qi);
      } else if (el.classList.contains('drill-check')) {
        var s3 = states[qi];
        if (s3.built.join('') === s3.tokens.join('')) { s3.correct = true; if (window.Feedback) window.Feedback.correct(); }
        else { s3.wrong = true; if (window.Feedback) window.Feedback.incorrect(); }
        rerenderQuestion(qi);
      } else if (el.classList.contains('drill-opt')) {
        var s4 = states[qi]; var opt = el.getAttribute('data-opt');
        s4.chosen = opt;
        if (opt === s4.answer) { s4.correct = true; if (window.Feedback) window.Feedback.correct(); }
        else if (window.Feedback) { window.Feedback.incorrect(); }
        rerenderQuestion(qi);
      }
    };
  }

  function updateFooter() {
    var footer = document.getElementById('drill-footer');
    if (!footer) return;
    var total = states.length;
    var done = states.filter(function(s) { return s.correct; }).length;
    var allDone = done === total;
    var ctx = ctxOf();

    var bar = '<div class="drill-progress"><div class="progress-bar"><div class="progress-bar__fill" style="width:' + Math.round(done / Math.max(1, total) * 100) + '%"></div></div>' +
      '<span class="drill-progress__text">' + done + ' / ' + total + '</span></div>';

    if (!allDone) { footer.innerHTML = bar; return; }

    var cta;
    if (ctx) {
      cta = '<div class="lesson-finish">' +
        '<p class="lesson-finish__hint">' + window.i18n('lesson.finishHint') + '</p>' +
        '<button id="drill-finish" class="btn btn--success btn--lg">' + window.i18n('lesson.finish') + '</button>' +
      '</div>';
    } else {
      cta = '<button id="drill-retry" class="btn btn--primary">' + window.i18n('activity.retry') + '</button> ' +
        '<a href="#/dashboard" class="btn btn--secondary">' + window.i18n('nav.dashboard') + '</a>';
    }
    var wasDone = footer.querySelector('.drill-done');
    footer.innerHTML = bar +
      '<div class="drill-done">' + (window.Icons ? window.Icons.celebrate(40) : '') +
      '<span>' + window.i18n('result.completed') + '</span></div>' + cta;
    if (!wasDone && window.Feedback) window.Feedback.confetti();

    var retry = document.getElementById('drill-retry');
    if (retry) retry.addEventListener('click', function() { setup(); });
    var fin = document.getElementById('drill-finish');
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

  function escapeHtml(str) { var d = document.createElement('div'); d.appendChild(document.createTextNode(str == null ? '' : String(str))); return d.innerHTML; }
  function escapeAttr(str) { return escapeHtml(str).replace(/"/g, '&quot;'); }

  window.Router.registerRoute('/drill/:topic', render);
})();
