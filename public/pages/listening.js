/**
 * Japanese Learning System - Listening Activity Page
 */
(function() {
  'use strict';

  var exercise = null;
  var audioEl = null;
  var playbackRate = 1.0;

  function renderNav(active) {
    return window.App.renderNav(active);
  }

  function render(params) {
    var level = params.level;
    var id = (params.id || '').split('?')[0];
    var app = document.getElementById('app');

    app.innerHTML = renderNav('levels') +
      '<div class="page page--listening">' +
        '<div class="listening__loading">Loading exercise...</div>' +
      '</div>';

    playbackRate = 1.0;

    window.API.get('/listening/' + encodeURIComponent(level) + '/' + encodeURIComponent(id))
      .then(function(data) {
        exercise = data;
        renderExercise(level, id);
      })
      .catch(function(err) {
        var page = document.querySelector('.page--listening');
        if (page) {
          page.innerHTML = '<div class="error-message">Failed to load exercise: ' + (err.message || 'Unknown error') + '</div>';
        }
      });
  }

  function renderExercise(level, id) {
    var page = document.querySelector('.page--listening');
    if (!page || !exercise) return;

    var title = exercise.title || 'Listening Exercise';
    var type = exercise.type || 'multiple-choice';
    var questions = exercise.questions || [];

    page.innerHTML =
      '<div class="listening__header">' +
        '<h1>' + escapeHtml(title) + '</h1>' +
        '<p class="text-secondary">Listen to the audio and answer the questions below</p>' +
      '</div>' +
      '<div class="listening__player">' +
        '<div class="audio-controls">' +
          '<button class="btn" id="play-btn">▶ Play Audio</button>' +
          '<button class="btn btn--secondary" id="replay-btn">↺ Replay</button>' +
          '<div class="audio-controls__speed">' +
            '<button class="btn btn--sm speed-btn' + (playbackRate === 0.75 ? ' speed-btn--active' : '') + '" data-speed="0.75">Slow</button>' +
            '<button class="btn btn--sm speed-btn' + (playbackRate === 1.0 ? ' speed-btn--active' : '') + '" data-speed="1">Normal</button>' +
            '<button class="btn btn--sm speed-btn' + (playbackRate === 1.25 ? ' speed-btn--active' : '') + '" data-speed="1.25">Fast</button>' +
          '</div>' +
        '</div>' +
      '</div>' +
      '<form id="listening-form" class="listening__questions">' +
        renderQuestions(questions, type) +
        '<div class="form__actions mt-3">' +
          '<button class="btn btn--primary" type="submit">' + window.i18n('activity.submit') + '</button>' +
          ' <a href="#/level/' + level + '/listening" class="btn btn--secondary">' + window.i18n('activity.back') + '</a>' +
        '</div>' +
      '</form>' +
      '<div id="listening-results" class="listening__results" hidden></div>';

    // TTS audio controls
    document.getElementById('play-btn').addEventListener('click', togglePlay);
    document.getElementById('replay-btn').addEventListener('click', replayAudio);

    // Speed buttons
    var speedBtns = document.querySelectorAll('.speed-btn');
    for (var i = 0; i < speedBtns.length; i++) {
      speedBtns[i].addEventListener('click', function(e) {
        var speed = parseFloat(e.target.getAttribute('data-speed'));
        setSpeed(speed);
        var all = document.querySelectorAll('.speed-btn');
        for (var j = 0; j < all.length; j++) all[j].classList.remove('speed-btn--active');
        e.target.classList.add('speed-btn--active');
      });
    }

    // Form submission
    document.getElementById('listening-form').addEventListener('submit', function(e) {
      e.preventDefault();
      submitAnswers(level, id, questions, type);
    });
  }

  function renderQuestions(questions, type) {
    return questions.map(function(q, i) {
      var html = '<div class="question">';
      html += '<p class="question__text">' + (i + 1) + '. ' + escapeHtml(q.question || q.text || '') + '</p>';

      if (type === 'multiple-choice' || type === 'multiple_choice' || q.type === 'multiple-choice' || q.type === 'multiple_choice') {
        var options = q.options || [];
        html += options.map(function(opt, j) {
          return '<label class="question__option">' +
            '<input type="radio" name="q' + i + '" value="' + j + '"> ' +
            escapeHtml(opt) +
          '</label>';
        }).join('');
      } else if (type === 'fill-in-blank' || type === 'fill_in_blank' || q.type === 'fill-in-blank' || q.type === 'fill_in_blank') {
        html += '<input type="text" class="form__input" name="q' + i + '" placeholder="Type your answer">';
      } else if (type === 'sentence-ordering' || type === 'sentence_ordering' || q.type === 'sentence-ordering' || q.type === 'sentence_ordering') {
        var parts = q.parts || q.options || [];
        html += '<div class="ordering">';
        html += parts.map(function(part, j) {
          return '<div class="ordering__item">' +
            '<input type="number" class="form__input form__input--small" name="q' + i + '_' + j + '" min="1" max="' + parts.length + '" placeholder="' + (j + 1) + '"> ' +
            escapeHtml(part) +
          '</div>';
        }).join('');
        html += '</div>';
      } else if (q.options && q.options.length > 0) {
        // Fallback: if question has options, show as multiple choice
        var options = q.options;
        html += options.map(function(opt, j) {
          return '<label class="question__option">' +
            '<input type="radio" name="q' + i + '" value="' + j + '"> ' +
            escapeHtml(opt) +
          '</label>';
        }).join('');
      }

      html += '</div>';
      return html;
    }).join('');
  }

  function togglePlay() {
    var btn = document.getElementById('play-btn');
    if (window.TTS.isSpeaking()) {
      window.TTS.stop();
      btn.textContent = '▶ Play';
    } else {
      var text = (exercise && exercise.transcript) || '';
      window.TTS.speak(text, { rate: playbackRate, onEnd: function() {
        btn.textContent = '▶ Play';
      }});
      btn.textContent = '⏸ Stop';
    }
  }

  function replayAudio() {
    window.TTS.stop();
    var text = (exercise && exercise.transcript) || '';
    var btn = document.getElementById('play-btn');
    window.TTS.speak(text, { rate: playbackRate, onEnd: function() {
      if (btn) btn.textContent = '▶ Play';
    }});
    if (btn) btn.textContent = '⏸ Stop';
  }

  function setSpeed(speed) {
    playbackRate = speed;
    window.TTS.setRate(speed);
  }

  function submitAnswers(level, id, questions, type) {
    var form = document.getElementById('listening-form');
    var answers = [];

    for (var i = 0; i < questions.length; i++) {
      if (type === 'sentence-ordering' || (questions[i].type === 'sentence-ordering')) {
        var parts = questions[i].parts || questions[i].options || [];
        var order = [];
        for (var j = 0; j < parts.length; j++) {
          var input = form.querySelector('[name="q' + i + '_' + j + '"]');
          order.push(input ? parseInt(input.value, 10) || 0 : 0);
        }
        answers.push(order);
      } else {
        var input = form.querySelector('[name="q' + i + '"]:checked') || form.querySelector('[name="q' + i + '"]');
        answers.push(input ? input.value : '');
      }
    }

    window.API.post('/listening/' + encodeURIComponent(level) + '/' + encodeURIComponent(id) + '/submit', { answer: answers })
      .then(function(result) {
        renderResults(result);
      })
      .catch(function(err) {
        var resultsEl = document.getElementById('listening-results');
        if (resultsEl) {
          resultsEl.hidden = false;
          resultsEl.innerHTML = '<div class="error-message">Submission failed: ' + (err.message || 'Unknown error') + '</div>';
        }
      });
  }

  function renderResults(result) {
    var resultsEl = document.getElementById('listening-results');
    if (!resultsEl) return;

    var correctCount = result.correct || 0;
    var total = result.total || 1;
    var pct = Math.round((correctCount / total) * 100);
    var results = result.results || [];
    var transcript = result.transcript || '';
    var isCompleted = result.completed || (pct === 100);
    var cls = pct >= 80 ? 'text-success' : (pct >= 50 ? '' : 'text-danger');

    if (window.Feedback) { isCompleted ? window.Feedback.celebrate() : window.Feedback.incorrect(); }

    var statusHtml = '';
    if (isCompleted) {
      statusHtml = '<div class="result-banner result-banner--success">' +
        '<span class="result-banner__icon"></span>' +
        (window.Icons ? window.Icons.celebrate(38) : '') + '<span class="result-banner__text">' + window.i18n('result.completed') + '</span>' +
      '</div>';
    } else {
      statusHtml = '<div class="result-banner result-banner--retry">' +
        '<span class="result-banner__icon"></span>' +
        (window.Icons ? window.Icons.tryagain(34) : '') + '<span class="result-banner__text">' + window.i18n('result.notQuite') + '</span>' +
      '</div>';
    }

    resultsEl.hidden = false;
    resultsEl.innerHTML =
      statusHtml +
      '<h2>' + window.i18n('result.score') + '</h2>' +
      '<p class="listening__score ' + cls + '">' + window.i18n('result.score') + ': ' + correctCount + ' / ' + total + ' (' + pct + '%)</p>' +
      '<ul class="listening__answers">' +
        results.map(function(r, i) {
          var icon = r.correct ? '✓' : '✗';
          var itemCls = r.correct ? 'text-success' : 'text-danger';
          return '<li class="' + itemCls + '">' + icon + ' ' + (i + 1) + '. Correct answer: ' + escapeHtml(String(r.correctAnswer || '')) + '</li>';
        }).join('') +
      '</ul>' +
      (transcript ? '<div class="listening__transcript mt-2"><h3>Transcript</h3><p>' + escapeHtml(transcript) + '</p></div>' : '') +
      '<div class="reading__actions mt-3">' +
        (isCompleted
          ? (isFromCurriculum()
              ? '<div id="curriculum-next"></div>'
              : '<a href="#/level/' + exercise.level + '/listening" class="btn">' + window.i18n('activity.nextExercise') + '</a> <a href="#/dashboard" class="btn btn--secondary">' + window.i18n('nav.dashboard') + '</a>')
          : '<button class="btn btn--primary" id="retry-btn">' + window.i18n('activity.retry') + '</button> <a href="#/dashboard" class="btn btn--secondary">' + window.i18n('nav.dashboard') + '</a>') +
      '</div>';

    if (isCompleted && isFromCurriculum() && window.CurriculumNav) {
      window.CurriculumNav.renderInto('curriculum-next');
    }

    // Retry handler
    if (!isCompleted) {
      var retryBtn = document.getElementById('retry-btn');
      if (retryBtn) {
        retryBtn.addEventListener('click', function() {
          var route = window.Router.getCurrentRoute();
          if (route && route.params) render(route.params);
        });
      }
    }

    var form = document.getElementById('listening-form');
    if (form) {
      var btn = form.querySelector('button[type="submit"]');
      if (btn) btn.hidden = true;
    }
  }

  function isFromCurriculum() {
    return (window.location.hash || '').indexOf('from=curriculum') !== -1;
  }

  function escapeHtml(str) {
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
  }

  window.Router.registerRoute('/listening/:level/:id', render);
})();
