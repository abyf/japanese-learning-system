/**
 * Japanese Learning System - Exam Page (placement test / N5 mock)
 * Route: /exam/:id  (id = 'placement' | 'n5-mock')
 */
(function() {
  'use strict';

  function renderNav(active) { return window.App.renderNav(active); }
  function L(o) { if (!o) return ''; if (typeof o === 'string') return o; var l = window.App.getLanguage(); return o[l] || o.en || ''; }

  var exam = null;
  var answers = [];

  function render(params) {
    var id = (params.id || '').split('?')[0];
    var app = document.getElementById('app');
    app.innerHTML = renderNav('curriculum') +
      '<div class="page page--exam"><div class="exam__loading">' + window.i18n('general.loading') + '</div></div>';

    window.API.get('/exam/' + encodeURIComponent(id))
      .then(function(d) { exam = d; answers = new Array((d.questions || []).length).fill(null); renderExam(); })
      .catch(function(err) {
        var page = document.querySelector('.page--exam');
        if (page) page.innerHTML = '<div class="error-message">' + window.i18n('general.error') + ': ' + (err.message || '') + '</div>';
      });
  }

  function renderExam() {
    var page = document.querySelector('.page--exam');
    if (!page) return;
    var qs = exam.questions || [];

    var html = '<div class="exam__header">' +
      '<h1 class="exam__title">' + escapeHtml(L(exam.title)) + '</h1>' +
      '<p class="exam__intro">' + escapeHtml(L(exam.intro)) + '</p>' +
      '</div><div class="exam__questions">';

    qs.forEach(function(q, i) {
      html += '<div class="exam-q" data-q="' + i + '">' +
        '<div class="exam-q__num">Q' + (i + 1) + '</div>' +
        (q.jp ? '<div class="exam-q__jp">' + escapeHtml(q.jp) + '</div>' : '') +
        '<div class="exam-q__prompt">' + escapeHtml(L(q.question)) + '</div>' +
        '<div class="exam-q__options">' +
          q.options.map(function(opt, j) {
            return '<button class="exam-opt" data-q="' + i + '" data-opt="' + escapeAttr(opt) + '">' + escapeHtml(opt) + '</button>';
          }).join('') +
        '</div>' +
      '</div>';
    });
    html += '</div>' +
      '<div class="exam__actions">' +
        '<button id="exam-submit" class="btn btn--primary btn--lg" disabled>' + window.i18n('exam.submit') + '</button>' +
        '<span id="exam-progress" class="exam__progress"></span>' +
      '</div>' +
      '<div id="exam-result"></div>';

    page.innerHTML = html;

    page.querySelectorAll('.exam-opt').forEach(function(b) {
      b.addEventListener('click', function() {
        var qi = parseInt(this.getAttribute('data-q'), 10);
        answers[qi] = this.getAttribute('data-opt');
        var group = page.querySelectorAll('.exam-opt[data-q="' + qi + '"]');
        group.forEach(function(g) { g.classList.remove('exam-opt--sel'); });
        this.classList.add('exam-opt--sel');
        updateProgress();
      });
    });
    document.getElementById('exam-submit').addEventListener('click', submit);
    updateProgress();
  }

  function updateProgress() {
    var done = answers.filter(function(a) { return a !== null; }).length;
    var total = answers.length;
    var prog = document.getElementById('exam-progress');
    if (prog) prog.textContent = done + ' / ' + total;
    var btn = document.getElementById('exam-submit');
    if (btn) btn.disabled = done < total;
  }

  function submit() {
    var qs = exam.questions || [];
    var correct = 0;
    qs.forEach(function(q, i) { if (answers[i] === q.answer) correct++; });
    var pct = Math.round(correct / qs.length * 100);

    if (window.Feedback) { pct >= 60 ? window.Feedback.celebrate() : window.Feedback.incorrect(); }

    // Mark answers
    var page = document.querySelector('.page--exam');
    qs.forEach(function(q, i) {
      var group = page.querySelectorAll('.exam-opt[data-q="' + i + '"]');
      group.forEach(function(g) {
        g.disabled = true;
        var opt = g.getAttribute('data-opt');
        if (opt === q.answer) g.classList.add('exam-opt--ok');
        else if (opt === answers[i]) g.classList.add('exam-opt--wrong');
      });
    });

    var msg = '';
    if (exam.recommend) {
      // Placement recommendation
      var rec;
      if (pct < 40) rec = window.i18n('exam.recStart');
      else if (pct < 75) rec = window.i18n('exam.recFoundation');
      else rec = window.i18n('exam.recContent');
      msg = '<p class="exam-result__rec">' + rec + '</p>';
    } else if (exam.passMark !== undefined) {
      var passed = (correct / qs.length) >= exam.passMark;
      msg = '<p class="exam-result__rec ' + (passed ? 'text-success' : '') + '">' +
        (passed ? window.i18n('exam.passed') : window.i18n('exam.keepGoing')) + '</p>';
    }

    var ctx = ctxOf();
    var finishBtn = ctx
      ? '<button id="exam-finish" class="btn btn--success btn--lg">' + window.i18n('lesson.finish') + '</button> '
      : '<a href="#/curriculum" class="btn btn--primary">' + window.i18n('general.fullCurriculum') + '</a>';

    var result = document.getElementById('exam-result');
    result.innerHTML =
      '<div class="exam-result">' +
        (window.Icons && pct >= 60 ? window.Icons.celebrate(44) : '') +
        '<h2>' + window.i18n('result.score') + ': ' + correct + ' / ' + qs.length + ' (' + pct + '%)</h2>' +
        msg +
        '<div class="exam-result__actions">' +
          '<button id="exam-retry" class="btn btn--secondary">' + window.i18n('activity.retry') + '</button> ' +
          finishBtn +
        '</div>' +
      '</div>';
    document.getElementById('exam-submit').disabled = true;
    var retry = document.getElementById('exam-retry');
    if (retry) retry.addEventListener('click', function() { answers = new Array(qs.length).fill(null); renderExam(); });
    var fin = document.getElementById('exam-finish');
    if (fin && ctx) {
      fin.addEventListener('click', function() {
        fin.disabled = true; fin.textContent = '...';
        var body = { week: parseInt(ctx.week, 10), day: parseInt(ctx.day, 10) };
        if (ctx.idx !== undefined && ctx.idx !== '') body.activityIndex = parseInt(ctx.idx, 10);
        window.API.post('/curriculum/external-done', body).then(back).catch(back);
        function back() { window.location.hash = '#/curriculum/' + ctx.week + '/' + ctx.day; }
      });
    }
    result.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function ctxOf() {
    var params = (window.location.hash || '').split('?')[1] || '';
    if (params.indexOf('from=curriculum') === -1) return null;
    var w = params.match(/week=(\d+)/), d = params.match(/day=(\d+)/), i = params.match(/idx=(\d+)/);
    if (!w || !d) return null;
    return { week: w[1], day: d[1], idx: i ? i[1] : '' };
  }

  function escapeHtml(str) { var d = document.createElement('div'); d.appendChild(document.createTextNode(str == null ? '' : String(str))); return d.innerHTML; }
  function escapeAttr(str) { return escapeHtml(str).replace(/"/g, '&quot;'); }

  window.Router.registerRoute('/exam/:id', render);
})();
