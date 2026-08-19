/**
 * Japanese Learning System - Shadowing (speaking practice) Page
 * Hear the model (TTS), record yourself (MediaRecorder), play both to compare.
 * Route: /shadow/:topic
 */
(function() {
  'use strict';

  function renderNav(active) { return window.App.renderNav(active); }
  function L(o) { if (!o) return ''; if (typeof o === 'string') return o; var l = window.App.getLanguage(); return o[l] || o.en || ''; }

  var data = null;
  var mediaRecorder = null;
  var chunks = [];
  var recordings = {}; // idx -> objectURL

  function render(params) {
    var topic = (params.topic || '').split('?')[0];
    var app = document.getElementById('app');
    app.innerHTML = renderNav('curriculum') +
      '<div class="page page--shadow"><div class="shadow__loading">' + window.i18n('general.loading') + '</div></div>';

    window.API.get('/shadowing/' + encodeURIComponent(topic))
      .then(function(d) { data = d; recordings = {}; renderShadow(); })
      .catch(function(err) {
        var page = document.querySelector('.page--shadow');
        if (page) page.innerHTML = '<div class="error-message">' + window.i18n('general.error') + ': ' + (err.message || '') + '</div>';
      });
  }

  function ctxOf() {
    var params = (window.location.hash || '').split('?')[1] || '';
    if (params.indexOf('from=curriculum') === -1) return null;
    var w = params.match(/week=(\d+)/), d = params.match(/day=(\d+)/), i = params.match(/idx=(\d+)/);
    if (!w || !d) return null;
    return { week: w[1], day: d[1], idx: i ? i[1] : '' };
  }

  function renderShadow() {
    var page = document.querySelector('.page--shadow');
    if (!page) return;
    var ctx = ctxOf();

    var tabs = '';
    if (!ctx && data.topics && data.topics.length > 1) {
      tabs = '<div class="drill__tabs">' + data.topics.map(function(tp) {
        return '<a href="#/shadow/' + tp.id + '" class="drill__tab' + (tp.id === data.id ? ' drill__tab--active' : '') + '">' + escapeHtml(L(tp.title)) + '</a>';
      }).join('') + '</div>';
    }

    var html = '<div class="shadow__header">' +
      (ctx ? '<a href="#/curriculum/' + ctx.week + '/' + ctx.day + '" class="btn btn--sm btn--secondary">' + window.i18n('activity.back') + '</a>' : '') +
      tabs +
      '<h1 class="shadow__title">' + escapeHtml(L(data.title)) + '</h1>' +
      '<p class="shadow__intro">' + escapeHtml(L(data.intro)) + '</p>' +
      '<p class="shadow__mic-note" id="shadow-mic-note"></p>' +
      '</div>';

    html += '<div class="shadow__list">';
    (data.items || []).forEach(function(it, i) {
      html += '<div class="shadow-item" data-i="' + i + '">' +
        '<div class="shadow-item__jp">' + escapeHtml(it.jp) + '</div>' +
        '<div class="shadow-item__reading">' + escapeHtml(it.reading || '') + '</div>' +
        '<div class="shadow-item__meaning">' + escapeHtml(L(it.meaning)) + '</div>' +
        '<div class="shadow-item__controls">' +
          '<button class="btn btn--sm btn--secondary shadow-listen" data-i="' + i + '">▶ ' + window.i18n('shadow.listen') + '</button>' +
          '<button class="btn btn--sm shadow-rec" data-i="' + i + '">● ' + window.i18n('shadow.record') + '</button>' +
          '<button class="btn btn--sm btn--secondary shadow-play" data-i="' + i + '" disabled>' + window.i18n('shadow.playMine') + '</button>' +
        '</div>' +
      '</div>';
    });
    html += '</div>';

    html += '<div class="shadow__actions">';
    if (ctx) {
      html += '<div class="lesson-finish"><p class="lesson-finish__hint">' + window.i18n('lesson.finishHint') + '</p>' +
        '<button id="shadow-finish" class="btn btn--success btn--lg">' + window.i18n('lesson.finish') + '</button></div>';
    } else {
      html += '<a href="#/dashboard" class="btn btn--secondary">' + window.i18n('nav.dashboard') + '</a>';
    }
    html += '</div>';

    page.innerHTML = html;
    bind(ctx);
  }

  function bind(ctx) {
    var page = document.querySelector('.page--shadow');
    // Listen (model TTS)
    page.querySelectorAll('.shadow-listen').forEach(function(b) {
      b.addEventListener('click', function() {
        var i = parseInt(this.getAttribute('data-i'), 10);
        if (window.TTS) window.TTS.speak(data.items[i].jp, { rate: 0.85 });
      });
    });
    // Record
    page.querySelectorAll('.shadow-rec').forEach(function(b) {
      b.addEventListener('click', function() { toggleRecord(parseInt(this.getAttribute('data-i'), 10), this); });
    });
    // Play mine
    page.querySelectorAll('.shadow-play').forEach(function(b) {
      b.addEventListener('click', function() {
        var i = parseInt(this.getAttribute('data-i'), 10);
        if (recordings[i]) { var a = new Audio(recordings[i]); a.play(); }
      });
    });
    // Finish
    var fin = document.getElementById('shadow-finish');
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

  function toggleRecord(i, btn) {
    var note = document.getElementById('shadow-mic-note');
    if (!navigator.mediaDevices || !window.MediaRecorder) {
      if (note) note.textContent = window.i18n('shadow.noMic');
      return;
    }
    // If already recording this one → stop
    if (mediaRecorder && mediaRecorder.state === 'recording') {
      mediaRecorder.stop();
      return;
    }
    navigator.mediaDevices.getUserMedia({ audio: true }).then(function(stream) {
      chunks = [];
      mediaRecorder = new MediaRecorder(stream);
      mediaRecorder.ondataavailable = function(e) { if (e.data.size > 0) chunks.push(e.data); };
      mediaRecorder.onstop = function() {
        var blob = new Blob(chunks, { type: 'audio/webm' });
        recordings[i] = URL.createObjectURL(blob);
        stream.getTracks().forEach(function(t) { t.stop(); });
        btn.textContent = '● ' + window.i18n('shadow.record');
        btn.classList.remove('shadow-rec--active');
        var playBtn = document.querySelector('.shadow-play[data-i="' + i + '"]');
        if (playBtn) playBtn.disabled = false;
      };
      mediaRecorder.start();
      btn.textContent = '■ ' + window.i18n('shadow.stop');
      btn.classList.add('shadow-rec--active');
    }).catch(function() {
      if (note) note.textContent = window.i18n('shadow.micDenied');
    });
  }

  function escapeHtml(str) { var d = document.createElement('div'); d.appendChild(document.createTextNode(str == null ? '' : String(str))); return d.innerHTML; }

  window.Router.registerRoute('/shadow/:topic', render);
})();
