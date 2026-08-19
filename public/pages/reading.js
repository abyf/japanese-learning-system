/**
 * Japanese Learning System - Reading Activity Page
 */
(function() {
  'use strict';

  var showFurigana = true;
  var showMeaning = false;
  var passage = null;

  function renderNav(active) {
    return window.App.renderNav(active);
  }

  function render(params) {
    var level = params.level;
    var id = (params.id || '').split('?')[0]; // Strip query params from ID
    var app = document.getElementById('app');

    app.innerHTML = renderNav('levels') +
      '<div class="page page--reading">' +
        '<div class="reading__loading">Loading passage...</div>' +
      '</div>';

    showFurigana = true;
    showMeaning = false;

    window.API.get('/reading/' + encodeURIComponent(level) + '/' + encodeURIComponent(id))
      .then(function(data) {
        passage = data;
        renderPassage(level, id);
      })
      .catch(function(err) {
        var page = document.querySelector('.page--reading');
        if (page) {
          page.innerHTML = '<div class="error-message">Failed to load passage: ' + (err.message || 'Unknown error') + '</div>';
        }
      });
  }

  function renderPassage(level, id) {
    var page = document.querySelector('.page--reading');
    if (!page || !passage) return;

    var title = passage.title || 'Reading Exercise';
    var text = passage.text || passage.content || '';
    var questions = passage.questions || [];

    page.innerHTML =
      '<div class="reading__header">' +
        '<h1>' + escapeHtml(title) + '</h1>' +
        '<div class="reading__controls">' +
          '<button class="btn btn--small" id="furigana-toggle">' + window.i18n('reading.furiganaOn') + '</button>' +
          '<button class="btn btn--small" id="meaning-toggle">' + window.i18n('reading.meaningOff') + '</button>' +
        '</div>' +
      '</div>' +
      '<div class="reading__passage' + (showFurigana ? ' reading__passage--furigana' : '') + '" id="reading-text">' +
        text +
      '</div>' +
      '<div id="meaning-box" class="reading__meaning-box" hidden>' +
        '<div class="reading__meaning-content" id="meaning-content"></div>' +
      '</div>' +
      '<div id="dictionary-popup" class="dictionary-popup" hidden></div>' +
      '<div class="reading__questions">' +
        '<h2>' + window.i18n('reading.comprehension') + '</h2>' +
        '<form id="reading-form">' +
          questions.map(function(q, i) {
            return '<div class="question">' +
              '<p class="question__text">' + (i + 1) + '. ' + escapeHtml(q.question || q.text || '') + '</p>' +
              (q.options ? q.options.map(function(opt, j) {
                return '<label class="question__option">' +
                  '<input type="radio" name="q' + i + '" value="' + j + '"> ' +
                  escapeHtml(opt) +
                '</label>';
              }).join('') : '<input type="text" class="form__input" name="q' + i + '" placeholder="Your answer">') +
            '</div>';
          }).join('') +
          '<div class="form__actions mt-3">' +
            '<button class="btn btn--primary" type="submit">' + window.i18n('activity.submit') + '</button>' +
            ' <a href="#/level/' + level + '/reading" class="btn btn--secondary">' + window.i18n('activity.back') + '</a>' +
          '</div>' +
        '</form>' +
      '</div>' +
      '<div id="reading-results" class="reading__results" hidden></div>';

    // Furigana toggle
    document.getElementById('furigana-toggle').addEventListener('click', toggleFurigana);
    document.addEventListener('keydown', handleFuriganaKey);

    // Meaning toggle
    document.getElementById('meaning-toggle').addEventListener('click', toggleMeaning);

    // Word click for dictionary
    document.getElementById('reading-text').addEventListener('click', handleWordClick);

    // Form submission
    document.getElementById('reading-form').addEventListener('submit', function(e) {
      e.preventDefault();
      submitAnswers(level, id, questions);
    });
  }

  function toggleFurigana() {
    showFurigana = !showFurigana;
    var textEl = document.getElementById('reading-text');
    var btn = document.getElementById('furigana-toggle');
    if (textEl) {
      textEl.classList.toggle('reading__passage--furigana', showFurigana);
    }
    if (btn) {
      btn.textContent = showFurigana ? window.i18n('reading.furiganaOn') : window.i18n('reading.furiganaOff');
    }
  }

  function toggleMeaning() {
    showMeaning = !showMeaning;
    var btn = document.getElementById('meaning-toggle');
    var box = document.getElementById('meaning-box');
    var content = document.getElementById('meaning-content');

    if (btn) {
      btn.textContent = showMeaning ? window.i18n('reading.meaningOn') : window.i18n('reading.meaningOff');
    }
    if (box) {
      box.hidden = !showMeaning;
    }
    if (content && showMeaning && passage && passage.translation) {
      var lang = window.App.getLanguage();
      var translation = passage.translation[lang] || passage.translation['en'] || '';
      content.textContent = translation;
    }
  }

  function handleFuriganaKey(e) {
    if (e.key === 'f' || e.key === 'F') {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      toggleFurigana();
    }
  }

  function handleWordClick(e) {
    var target = e.target;
    var word = '';

    if (target.tagName === 'RUBY' || target.closest('ruby')) {
      var ruby = target.tagName === 'RUBY' ? target : target.closest('ruby');
      word = ruby.firstChild ? ruby.firstChild.textContent : ruby.textContent;
    } else if (target.dataset && target.dataset.word) {
      word = target.dataset.word;
    } else {
      var selection = window.getSelection();
      word = selection.toString().trim();
    }

    if (!word) {
      var popup = document.getElementById('dictionary-popup');
      if (popup) popup.hidden = true;
      return;
    }

    lookupWord(word, e.clientX, e.clientY);
  }

  function lookupWord(word, x, y) {
    var popup = document.getElementById('dictionary-popup');
    if (!popup) return;

    popup.hidden = false;
    popup.style.left = x + 'px';
    popup.style.top = (y + 20) + 'px';
    popup.innerHTML = '<span class="dictionary-popup__loading">Looking up...</span>';

    window.API.get('/dictionary/lookup?q=' + encodeURIComponent(word))
      .then(function(data) {
        if (data && (data.meaning || data.reading)) {
          popup.innerHTML =
            '<div class="dictionary-popup__word">' + escapeHtml(data.word || word) + '</div>' +
            '<div class="dictionary-popup__reading">' + escapeHtml(data.reading || '') + '</div>' +
            '<div class="dictionary-popup__meaning">' + escapeHtml(data.meaning || '') + '</div>';
        } else {
          popup.innerHTML = '<span class="dictionary-popup__empty">No result found</span>';
        }
      })
      .catch(function() {
        popup.innerHTML = '<span class="dictionary-popup__error">Lookup failed</span>';
      });
  }

  function submitAnswers(level, id, questions) {
    var form = document.getElementById('reading-form');
    var answers = [];

    for (var i = 0; i < questions.length; i++) {
      var input = form.querySelector('[name="q' + i + '"]:checked') || form.querySelector('[name="q' + i + '"]');
      answers.push(input ? input.value : '');
    }

    window.API.post('/reading/' + encodeURIComponent(level) + '/' + encodeURIComponent(id) + '/submit', { answers: answers })
      .then(function(result) {
        renderResults(result, questions);
      })
      .catch(function(err) {
        var resultsEl = document.getElementById('reading-results');
        if (resultsEl) {
          resultsEl.hidden = false;
          resultsEl.innerHTML = '<div class="error-message">Submission failed: ' + (err.message || 'Unknown error') + '</div>';
        }
      });
  }

  function renderResults(result, questions) {
    var resultsEl = document.getElementById('reading-results');
    if (!resultsEl) return;

    var correctCount = result.correct || 0;
    var total = result.total || questions.length;
    var pct = total > 0 ? Math.round((correctCount / total) * 100) : 0;
    var correctAnswers = result.correctAnswers || [];
    var isCompleted = result.completed || (pct === 100);

    resultsEl.hidden = false;

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

    resultsEl.innerHTML =
      statusHtml +
      '<h2>' + window.i18n('result.score') + '</h2>' +
      '<p class="reading__score ' + (pct >= 80 ? 'text-success' : '') + '">' + window.i18n('result.score') + ': ' + correctCount + ' / ' + total + ' (' + pct + '%)</p>' +
      '<ul class="reading__answers">' +
        correctAnswers.map(function(ans, i) {
          var userResult = (result.results && result.results[i]) || {};
          var icon = userResult.correct ? '✓' : '✗';
          var cls = userResult.correct ? 'text-success' : 'text-danger';
          return '<li class="' + cls + '">' + icon + ' ' + (i + 1) + '. Correct answer: ' + escapeHtml(String(ans)) + '</li>';
        }).join('') +
      '</ul>' +
      '<div class="reading__actions mt-3">' +
        (isCompleted
          ? (isFromCurriculum()
              ? '<div id="curriculum-next"></div>'
              : '<a href="#/level/' + passage.level + '/reading" class="btn">' + window.i18n('activity.nextExercise') + '</a> <a href="' + getBackUrl() + '" class="btn btn--secondary">' + getBackLabel() + '</a>')
          : '<button class="btn btn--primary" id="retry-btn">' + window.i18n('activity.retry') + '</button> <a href="' + getBackUrl() + '" class="btn btn--secondary">' + getBackLabel() + '</a>') +
      '</div>';

    if (isCompleted && isFromCurriculum() && window.CurriculumNav) {
      window.CurriculumNav.renderInto('curriculum-next');
    }

    // Attach retry handler
    if (!isCompleted) {
      var retryBtn = document.getElementById('retry-btn');
      if (retryBtn) {
        retryBtn.addEventListener('click', function() {
          // Re-render the passage (reset the form)
          var route = window.Router.getCurrentRoute();
          if (route && route.params) {
            render(route.params);
          }
        });
      }
    }

    // Hide the form submit button
    var form = document.getElementById('reading-form');
    if (form) {
      var btn = form.querySelector('button[type="submit"]');
      if (btn) btn.hidden = true;
    }
  }

  function isFromCurriculum() {
    return (window.location.hash || '').indexOf('from=curriculum') !== -1;
  }

  function getBackUrl() {
    var hash = window.location.hash || '';
    var params = hash.split('?')[1] || '';
    if (params.indexOf('from=curriculum') !== -1) {
      var weekMatch = params.match(/week=(\d+)/);
      var dayMatch = params.match(/day=(\d+)/);
      if (weekMatch && dayMatch) return '#/curriculum/' + weekMatch[1] + '/' + dayMatch[1];
      return '#/curriculum';
    }
    return '#/dashboard';
  }

  function getBackLabel() {
    var hash = window.location.hash || '';
    if (hash.indexOf('from=curriculum') !== -1) return window.i18n('activity.backToCurriculum');
    return window.i18n('nav.dashboard');
  }

  function escapeHtml(str) {
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
  }

  window.Router.registerRoute('/reading/:level/:id', render);
})();
