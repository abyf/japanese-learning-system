/**
 * Japanese Learning System - Kana Learning Page (In-App Hiragana / Katakana)
 * Clean, aesthetic chart + detail view. No external resources needed.
 * Routes: /kana/:script  (script = 'hiragana' | 'katakana')
 */
(function() {
  'use strict';

  function renderNav(active) {
    return window.App.renderNav(active);
  }

  function L(obj) {
    // Pick localized string from an { en, fr, pt } object
    if (!obj) return '';
    if (typeof obj === 'string') return obj;
    var lang = window.App.getLanguage();
    return obj[lang] || obj.en || '';
  }

  var kanaData = null;
  var currentScript = 'hiragana';
  var scopeGroups = null;      // array of group ids to show, or null for all
  var curriculumCtx = null;    // { week, day, idx } when launched from the guided plan

  function isKanji() {
    return currentScript === 'kanji';
  }

  function parseQuery() {
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

  function render(params) {
    var s = (params.script || '').split('?')[0];
    if (s === 'katakana') currentScript = 'katakana';
    else if (s === 'kanji' || s === 'kanji-n5') currentScript = 'kanji';
    else currentScript = 'hiragana';

    var q = parseQuery();
    scopeGroups = q.groups ? q.groups.split(',') : null;
    curriculumCtx = (q.from === 'curriculum' && q.week && q.day)
      ? { week: q.week, day: q.day, idx: q.idx } : null;

    var app = document.getElementById('app');
    app.innerHTML = renderNav('curriculum') +
      '<div class="page page--kana">' +
        '<div class="kana__loading">' + window.i18n('general.loading') + '</div>' +
      '</div>';

    // Preload stroke-order data so the first character tap is instant
    if (window.StrokeOrder) { window.StrokeOrder.load(); }

    window.API.get('/kana/' + encodeURIComponent(currentScript))
      .then(function(data) {
        kanaData = data;
        // Scope to specific groups when requested (single-lesson focus)
        if (scopeGroups && data.groups) {
          var filtered = data.groups.filter(function(g) { return scopeGroups.indexOf(g.id) !== -1; });
          if (filtered.length) kanaData.groups = filtered;
        }
        renderKana();
      })
      .catch(function(err) {
        var page = document.querySelector('.page--kana');
        if (page) {
          page.innerHTML = '<div class="error-message">' + window.i18n('general.error') + ': ' + (err.message || '') + '</div>';
        }
      });
  }

  function renderKana() {
    var page = document.querySelector('.page--kana');
    if (!page || !kanaData) return;

    var kanjiMode = isKanji();
    var scoped = !!scopeGroups;

    // When scoped to a single lesson, the title reflects the specific group(s).
    var titleText = scoped
      ? kanaData.groups.map(function(g) { return L(g.name); }).join(' · ')
      : L(kanaData.displayName);

    var backHref = curriculumCtx
      ? '#/curriculum/' + curriculumCtx.week + '/' + curriculumCtx.day
      : null;

    var html = '<div class="kana__header">';
    // Tabs only in free-browse mode (not when focused on one lesson)
    if (!scoped) {
      html +=
        '<div class="kana__tabs">' +
          '<a href="#/kana/hiragana" class="kana__tab' + (currentScript === 'hiragana' ? ' kana__tab--active' : '') + '">' + window.i18n('kana.hiragana') + '</a>' +
          '<a href="#/kana/katakana" class="kana__tab' + (currentScript === 'katakana' ? ' kana__tab--active' : '') + '">' + window.i18n('kana.katakana') + '</a>' +
          '<a href="#/kana/kanji" class="kana__tab' + (currentScript === 'kanji' ? ' kana__tab--active' : '') + '">' + window.i18n('kana.kanji') + '</a>' +
        '</div>';
    } else if (backHref) {
      html += '<a href="' + backHref + '" class="btn btn--sm btn--secondary">' + window.i18n('activity.back') + '</a>';
    }
    html +=
        '<h1 class="kana__title">' + (window.Icons ? window.Icons.torii(34) : '') + ' ' + escapeHtml(titleText) + '</h1>' +
        '<p class="kana__intro">' + L(kanaData.intro) + '</p>' +
        (kanaData.history
          ? '<details class="kana__history"' + (scoped ? '' : ' open') + '>' +
              '<summary class="kana__history-summary">' + L(kanaData.history.title) + '</summary>' +
              '<p class="kana__history-body">' + escapeHtml(L(kanaData.history.body)) + '</p>' +
            '</details>'
          : '') +
        '<p class="kana__hint">' + window.i18n('kana.tapHint') + '</p>' +
      '</div>';

    // Detail panel (hidden until a character is tapped).
    // Placed ABOVE the chart and made sticky so tapping any character updates
    // it in place — no page jump, no scrolling back up.
    html += '<div id="kana-detail" class="kana-detail" hidden></div>';

    // Chart grouped by row/theme
    html += '<div class="kana__chart' + (kanjiMode ? ' kana__chart--kanji' : '') + '">';
    (kanaData.groups || []).forEach(function(group) {
      html += '<div class="kana-group">' +
        '<h2 class="kana-group__name">' + L(group.name) + '</h2>' +
        '<div class="kana-group__grid' + (kanjiMode ? ' kana-group__grid--kanji' : '') + '">';
      group.characters.forEach(function(c) {
        var sub = kanjiMode ? L(c.meaning) : c.romaji;
        html += '<button class="kana-cell" data-kana="' + escapeAttr(c.kana) + '">' +
          '<span class="kana-cell__char">' + escapeHtml(c.kana) + '</span>' +
          '<span class="kana-cell__romaji">' + escapeHtml(sub) + '</span>' +
        '</button>';
      });
      html += '</div></div>';
    });
    html += '</div>';

    // Quiz launcher
    html += '<div class="kana__actions">' +
      '<button id="kana-quiz-btn" class="btn btn--primary">' + window.i18n('kana.startQuiz') + '</button>' +
    '</div>';
    html += '<div id="kana-quiz" class="kana-quiz" hidden></div>';

    // Finish button (only when launched from the guided plan)
    if (curriculumCtx) {
      html += '<div class="lesson-finish">' +
        '<p class="lesson-finish__hint">' + window.i18n('lesson.finishHint') + '</p>' +
        '<button id="lesson-finish-btn" class="btn btn--success btn--lg">' + window.i18n('lesson.finish') + '</button>' +
      '</div>';
    }

    page.innerHTML = html;

    // Bind cell clicks
    var cells = page.querySelectorAll('.kana-cell');
    for (var i = 0; i < cells.length; i++) {
      cells[i].addEventListener('click', function() {
        showDetail(this.getAttribute('data-kana'));
      });
    }

    // Bind quiz
    var quizBtn = document.getElementById('kana-quiz-btn');
    if (quizBtn) quizBtn.addEventListener('click', startQuiz);

    // Bind finish
    var finishBtn = document.getElementById('lesson-finish-btn');
    if (finishBtn) finishBtn.addEventListener('click', finishLesson);
  }

  function finishLesson() {
    if (!curriculumCtx) return;
    var btn = document.getElementById('lesson-finish-btn');
    if (btn) { btn.disabled = true; btn.textContent = '...'; }
    var body = { week: parseInt(curriculumCtx.week, 10), day: parseInt(curriculumCtx.day, 10) };
    if (curriculumCtx.idx !== undefined && curriculumCtx.idx !== '') {
      body.activityIndex = parseInt(curriculumCtx.idx, 10);
    }
    window.API.post('/curriculum/external-done', body)
      .then(function() {
        window.location.hash = '#/curriculum/' + curriculumCtx.week + '/' + curriculumCtx.day;
      })
      .catch(function() {
        window.location.hash = '#/curriculum/' + curriculumCtx.week + '/' + curriculumCtx.day;
      });
  }

  function findChar(kana) {
    for (var g = 0; g < kanaData.groups.length; g++) {
      var chars = kanaData.groups[g].characters;
      for (var c = 0; c < chars.length; c++) {
        if (chars[c].kana === kana) return chars[c];
      }
    }
    return null;
  }

  function showDetail(kana) {
    var c = findChar(kana);
    var panel = document.getElementById('kana-detail');
    if (!c || !panel) return;

    var kanjiMode = isKanji();

    // Build the info block depending on mode
    var infoHtml = '';
    if (kanjiMode) {
      infoHtml =
        '<div class="kana-detail__romaji">' + escapeHtml(L(c.meaning)) + '</div>' +
        '<div class="kana-detail__readings">' +
          '<span class="kana-detail__reading-tag kana-detail__reading-tag--on">' + window.i18n('kana.onyomi') + ': ' + escapeHtml(c.onyomi || '—') + '</span>' +
          '<span class="kana-detail__reading-tag kana-detail__reading-tag--kun">' + window.i18n('kana.kunyomi') + ': ' + escapeHtml(c.kunyomi || '—') + '</span>' +
        '</div>' +
        '<div class="kana-detail__strokes">' + window.i18n('kana.strokes') + ': ' + (c.strokes || '-') + '</div>';
    } else {
      infoHtml =
        '<div class="kana-detail__romaji">' + escapeHtml(c.romaji) + '</div>' +
        '<div class="kana-detail__strokes">' + window.i18n('kana.strokes') + ': ' + (c.strokes || '-') + '</div>' +
        '<div class="kana-detail__mnemonic"><strong>' + window.i18n('kana.mnemonic') + ':</strong> ' + escapeHtml(L(c.mnemonic)) + '</div>';
    }

    panel.hidden = false;
    panel.innerHTML =
      '<button class="kana-detail__close" id="kana-detail-close" aria-label="close">×</button>' +
      '<div class="kana-detail__main">' +
        '<div class="kana-detail__char-box">' +
          '<span class="kana-detail__char">' + escapeHtml(c.kana) + '</span>' +
          '<div class="kana-detail__char-actions">' +
            '<button class="kana-detail__audio" id="kana-audio-btn" title="' + window.i18n('kana.playSound') + '">♪</button>' +
            '<button class="btn btn--sm btn--secondary" id="kana-trace-btn">' + window.i18n('kana.practiceWrite') + '</button>' +
          '</div>' +
        '</div>' +
        '<div class="kana-detail__info">' +
          infoHtml +
          (c.example ? '<div class="kana-detail__example">' +
            '<strong>' + window.i18n('kana.example') + ':</strong> ' +
            '<span class="kana-detail__example-word" data-word="' + escapeAttr(c.example.word) + '">' + escapeHtml(c.example.word) + '</span> ' +
            '<span class="kana-detail__example-reading">(' + escapeHtml(c.example.reading) + ')</span> — ' +
            '<span class="kana-detail__example-meaning">' + escapeHtml(L(c.example.meaning)) + '</span>' +
          '</div>' : '') +
        '</div>' +
      '</div>' +
      '<div class="kana-detail__stroke-order">' +
        '<h3 class="kana-detail__section-title">' + window.i18n('kana.strokeOrder') + '</h3>' +
        '<div id="kana-stroke-viewer"></div>' +
        '<p class="kana-detail__credit">Stroke data: <a href="https://kanjivg.tagaini.net/" target="_blank" rel="noopener">KanjiVG</a> (CC BY-SA 3.0)</p>' +
      '</div>';

    // Render the stroke-order viewer (numbered diagram + animation)
    var strokeViewer = document.getElementById('kana-stroke-viewer');
    if (strokeViewer && window.StrokeOrder) {
      window.StrokeOrder.renderInto(strokeViewer, c.kana, { compact: true });
    }

    // Auto-play the sound on open
    speakKana(c);

    // Bind audio button
    var audioBtn = document.getElementById('kana-audio-btn');
    if (audioBtn) audioBtn.addEventListener('click', function() { speakKana(c); });

    // Bind writing-practice button
    var traceBtn = document.getElementById('kana-trace-btn');
    if (traceBtn) traceBtn.addEventListener('click', function() { openTracer(c.kana); });

    // Play example word audio
    var exWord = panel.querySelector('.kana-detail__example-word');
    if (exWord) {
      exWord.style.cursor = 'pointer';
      exWord.addEventListener('click', function() {
        if (window.TTS) window.TTS.speak(this.getAttribute('data-word'), {});
      });
    }

    // Close
    var closeBtn = document.getElementById('kana-detail-close');
    if (closeBtn) closeBtn.addEventListener('click', function() { panel.hidden = true; });

    // The panel is sticky at the top of the chart, so it's already visible.
    // Only nudge into view if it happens to be scrolled above the viewport
    // (e.g. the learner scrolled far down the chart before tapping).
    var rect = panel.getBoundingClientRect();
    if (rect.bottom < 0 || rect.top > (window.innerHeight || document.documentElement.clientHeight)) {
      panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }

  function speakKana(c) {
    if (window.TTS && c) {
      window.TTS.speak(c.kana, { rate: 0.85 });
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Writing practice: trace the character on a canvas (offline, no stroke data)
  // ─────────────────────────────────────────────────────────────────────────
  function openTracer(char) {
    var existing = document.getElementById('tracer-overlay');
    if (existing) existing.parentNode.removeChild(existing);

    var overlay = document.createElement('div');
    overlay.id = 'tracer-overlay';
    overlay.className = 'tracer-overlay';
    overlay.innerHTML =
      '<div class="tracer">' +
        '<div class="tracer__stage">' +
          '<div id="tracer-guide" class="tracer__guide"></div>' +
          '<canvas id="tracer-canvas" width="300" height="300" class="tracer__canvas"></canvas>' +
        '</div>' +
        '<p class="tracer__hint">' + window.i18n('kana.traceHint') + '</p>' +
        '<div class="tracer__actions">' +
          '<button class="btn btn--sm btn--secondary" id="tracer-guide-toggle">' + window.i18n('kana.playStrokes') + '</button>' +
          '<button class="btn btn--sm btn--secondary" id="tracer-clear">' + window.i18n('kana.clear') + '</button>' +
          '<button class="btn btn--sm btn--primary" id="tracer-close">' + window.i18n('general.close') + '</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(overlay);

    // Stroke-order guide behind the canvas (numbered diagram + animation)
    var guideEl = document.getElementById('tracer-guide');
    var guideBtn = document.getElementById('tracer-guide-toggle');
    if (guideEl && guideBtn && window.StrokeOrder) {
      window.StrokeOrder.load().then(function() {
        if (!window.StrokeOrder.has(char)) {
          guideBtn.style.display = 'none';
          return;
        }
        guideBtn.addEventListener('click', function() {
          // Re-render (and thus replay) the stroke order as a light guide
          window.StrokeOrder.renderInto(guideEl, char, { compact: true });
        });
      });
    } else if (guideBtn) {
      guideBtn.style.display = 'none';
    }

    var canvas = document.getElementById('tracer-canvas');
    var ctx = canvas.getContext('2d');
    var W = canvas.width, H = canvas.height;
    var themeColor = getComputedStyle(document.body).getPropertyValue('--text') || '#1a1a1a';

    function drawGuide() {
      ctx.clearRect(0, 0, W, H);
      // grid
      ctx.strokeStyle = 'rgba(127,127,127,0.35)';
      ctx.lineWidth = 1;
      ctx.setLineDash([6, 6]);
      ctx.beginPath();
      ctx.moveTo(W / 2, 0); ctx.lineTo(W / 2, H);
      ctx.moveTo(0, H / 2); ctx.lineTo(W, H / 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.strokeStyle = 'rgba(127,127,127,0.5)';
      ctx.strokeRect(4, 4, W - 8, H - 8);
      // faint character to trace
      ctx.fillStyle = 'rgba(127,127,127,0.25)';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = '220px "Noto Sans JP", "Hiragino Kaku Gothic Pro", "Yu Gothic", sans-serif';
      ctx.fillText(char, W / 2, H / 2 + 10);
    }
    drawGuide();

    // Freehand drawing
    var drawing = false;
    function pos(e) {
      var r = canvas.getBoundingClientRect();
      var p = (e.touches && e.touches[0]) ? e.touches[0] : e;
      return { x: (p.clientX - r.left) * (W / r.width), y: (p.clientY - r.top) * (H / r.height) };
    }
    function start(e) { drawing = true; var pt = pos(e); ctx.strokeStyle = themeColor.trim() || '#1a1a1a'; ctx.lineWidth = 8; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.beginPath(); ctx.moveTo(pt.x, pt.y); e.preventDefault(); }
    function move(e) { if (!drawing) return; var pt = pos(e); ctx.lineTo(pt.x, pt.y); ctx.stroke(); e.preventDefault(); }
    function end() { drawing = false; }

    canvas.addEventListener('mousedown', start);
    canvas.addEventListener('mousemove', move);
    window.addEventListener('mouseup', end);
    canvas.addEventListener('touchstart', start, { passive: false });
    canvas.addEventListener('touchmove', move, { passive: false });
    canvas.addEventListener('touchend', end);

    document.getElementById('tracer-clear').addEventListener('click', drawGuide);
    document.getElementById('tracer-close').addEventListener('click', function() {
      window.removeEventListener('mouseup', end);
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
    });
    overlay.addEventListener('click', function(e) {
      if (e.target === overlay) {
        window.removeEventListener('mouseup', end);
        overlay.parentNode.removeChild(overlay);
      }
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Simple recognition quiz: show a kana, pick the correct romaji
  // ─────────────────────────────────────────────────────────────────────────

  var quizChars = [];
  var quizIndex = 0;
  var quizScore = 0;

  function answerOf(c) {
    // The value the learner must identify: meaning for kanji, romaji for kana
    return isKanji() ? L(c.meaning) : c.romaji;
  }

  function startQuiz() {
    // Flatten all characters (skip rare particle-only wo/ヲ for cleaner kana quiz)
    quizChars = [];
    kanaData.groups.forEach(function(g) {
      g.characters.forEach(function(c) {
        if (isKanji() || c.romaji !== 'wo') quizChars.push(c);
      });
    });
    // Shuffle and take 10
    quizChars = shuffle(quizChars).slice(0, 10);
    quizIndex = 0;
    quizScore = 0;
    renderQuizQuestion();
    var quizEl = document.getElementById('kana-quiz');
    if (quizEl) quizEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function renderQuizQuestion() {
    var quizEl = document.getElementById('kana-quiz');
    if (!quizEl) return;
    quizEl.hidden = false;

    if (quizIndex >= quizChars.length) {
      var perfect = quizScore === quizChars.length;
      var passed = quizScore >= Math.ceil(quizChars.length * 0.6);
      if (window.Feedback) { passed ? window.Feedback.celebrate() : window.Feedback.confetti({ count: 40 }); }
      quizEl.innerHTML =
        '<div class="kana-quiz__result">' +
          '<h3>' + window.i18n('kana.quizDone') + '</h3>' +
          '<p class="kana-quiz__score">' + quizScore + ' / ' + quizChars.length + '</p>' +
          '<button id="kana-quiz-again" class="btn btn--primary">' + window.i18n('activity.retry') + '</button>' +
        '</div>';
      var again = document.getElementById('kana-quiz-again');
      if (again) again.addEventListener('click', startQuiz);
      return;
    }

    var q = quizChars[quizIndex];
    var answer = answerOf(q);
    // Build 4 options (1 correct + 3 distractors)
    var options = [answer];
    var pool = quizChars.filter(function(c) { return answerOf(c) !== answer; });
    pool = shuffle(pool);
    for (var i = 0; i < pool.length && options.length < 4; i++) {
      var a = answerOf(pool[i]);
      if (options.indexOf(a) === -1) options.push(a);
    }
    options = shuffle(options);

    quizEl.innerHTML =
      '<div class="kana-quiz__q">' +
        '<div class="kana-quiz__progress">' + (quizIndex + 1) + ' / ' + quizChars.length + '</div>' +
        '<div class="kana-quiz__char">' + escapeHtml(q.kana) + '</div>' +
        '<div class="kana-quiz__options' + (isKanji() ? ' kana-quiz__options--kanji' : '') + '">' +
          options.map(function(opt) {
            return '<button class="kana-quiz__option" data-answer="' + escapeAttr(opt) + '">' + escapeHtml(opt) + '</button>';
          }).join('') +
        '</div>' +
      '</div>';

    var optBtns = quizEl.querySelectorAll('.kana-quiz__option');
    for (var j = 0; j < optBtns.length; j++) {
      optBtns[j].addEventListener('click', function() {
        var chosen = this.getAttribute('data-answer');
        var correct = chosen === answer;
        if (correct) quizScore++;
        if (window.Feedback) { correct ? window.Feedback.correct() : window.Feedback.incorrect(); }
        // Visual feedback
        for (var k = 0; k < optBtns.length; k++) {
          optBtns[k].disabled = true;
          if (optBtns[k].getAttribute('data-answer') === answer) {
            optBtns[k].classList.add('kana-quiz__option--correct');
          } else if (optBtns[k] === this && !correct) {
            optBtns[k].classList.add('kana-quiz__option--wrong');
          }
        }
        if (window.TTS) window.TTS.speak(q.kana, { rate: 0.85 });
        setTimeout(function() { quizIndex++; renderQuizQuestion(); }, 800);
      });
    }
  }

  function shuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = a[i]; a[i] = a[j]; a[j] = tmp;
    }
    return a;
  }

  function escapeHtml(str) {
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(str == null ? '' : String(str)));
    return div.innerHTML;
  }

  function escapeAttr(str) {
    return escapeHtml(str).replace(/"/g, '&quot;');
  }

  window.Router.registerRoute('/kana/:script', render);
})();
