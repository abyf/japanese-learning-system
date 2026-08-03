/**
 * Japanese Learning System - Vocabulary Exercise Page
 * 
 * Replaces the old flashcard-based review with exercise-based learning.
 * Supports question types: kanji_recognition, word_match, sentence_completion, flashcard.
 */
(function() {
  'use strict';

  function renderNav(active) {
    return window.App.renderNav(active);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Route: /vocabulary — redirect to level-based vocabulary list
  // ─────────────────────────────────────────────────────────────────────────

  function renderVocabularyRedirect() {
    // Redirect to the current user's level vocabulary list
    window.API.get('/progress')
      .then(function(data) {
        var level = (data && data.currentLevel) || 'beginner';
        window.location.hash = '#/level/' + level + '/vocabulary';
      })
      .catch(function() {
        window.location.hash = '#/level/beginner/vocabulary';
      });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Route: /level/:level/vocabulary — exercise list
  // ─────────────────────────────────────────────────────────────────────────

  function renderVocabularyList(params) {
    var level = params.level;
    var app = document.getElementById('app');

    app.innerHTML = renderNav('levels') +
      '<div class="page page--activity-list">' +
        '<div class="activity-list__header">' +
          '<a href="#/level/' + level + '" class="btn btn--sm btn--secondary">← Back</a>' +
          '<h1>Vocabulary 📝 — ' + level.charAt(0).toUpperCase() + level.slice(1) + '</h1>' +
        '</div>' +
        '<div class="activity-list__loading">Loading exercises...</div>' +
      '</div>';

    window.API.get('/vocab-exercises/' + encodeURIComponent(level))
      .then(function(data) {
        renderExerciseList(level, data);
      })
      .catch(function(err) {
        var page = document.querySelector('.page--activity-list');
        if (page) {
          page.querySelector('.activity-list__loading').innerHTML =
            '<div class="error-message">Failed to load exercises: ' + (err.message || 'Unknown error') + '</div>';
        }
      });
  }

  function renderExerciseList(level, data) {
    var page = document.querySelector('.page--activity-list');
    if (!page) return;

    var loadingEl = page.querySelector('.activity-list__loading');
    if (!loadingEl) return;

    var exercises = data.exercises || [];

    if (exercises.length === 0) {
      loadingEl.innerHTML = '<p class="text-secondary">No vocabulary exercises available for this level yet.</p>';
      return;
    }

    var routePrefix = '#/vocab/' + level + '/';
    var completedCount = exercises.filter(function(ex) { return ex.completed; }).length;

    loadingEl.innerHTML =
      '<div class="exercise-list__summary mb-2">' +
        '<span class="text-secondary">' + completedCount + ' / ' + exercises.length + ' completed</span>' +
      '</div>' +
      '<div class="exercise-grid">' +
      exercises.map(function(ex, idx) {
        var id = ex.id || ('v' + String(idx + 1).padStart(3, '0'));
        var title = ex.title || ('Exercise ' + (idx + 1));
        var completed = ex.completed;
        var icon = completed ? '✓' : (idx + 1);
        var cardClass = 'exercise-card' + (completed ? ' exercise-card--completed' : '');

        return '<a href="' + routePrefix + id + '" class="' + cardClass + '">' +
          '<span class="exercise-card__number' + (completed ? ' exercise-card__number--done' : '') + '">' + icon + '</span>' +
          '<span class="exercise-card__title">' + title + '</span>' +
          (completed ? '<span class="exercise-card__badge">✓ Done</span>' : '') +
        '</a>';
      }).join('') +
    '</div>';
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Route: /vocab/:level/:id — individual exercise
  // ─────────────────────────────────────────────────────────────────────────

  var exerciseData = null;
  var selectedAnswers = [];
  var submitted = false;

  function renderVocabExercise(params) {
    var level = params.level;
    var id = (params.id || '').split('?')[0];
    exerciseData = null;
    selectedAnswers = [];
    submitted = false;

    var app = document.getElementById('app');
    app.innerHTML = renderNav('levels') +
      '<div class="page page--vocab-exercise">' +
        '<div class="vocab-exercise__loading">Loading exercise...</div>' +
      '</div>';

    window.API.get('/vocab-exercises/' + encodeURIComponent(level) + '/' + encodeURIComponent(id))
      .then(function(data) {
        exerciseData = data;
        selectedAnswers = new Array(data.questions.length).fill(null);
        renderExercise();
      })
      .catch(function(err) {
        var page = document.querySelector('.page--vocab-exercise');
        if (page) {
          page.innerHTML = '<div class="error-message">Failed to load exercise: ' + (err.message || 'Unknown error') + '</div>';
        }
      });
  }

  function renderExercise() {
    var page = document.querySelector('.page--vocab-exercise');
    if (!page || !exerciseData) return;

    var level = exerciseData.level;
    var questions = exerciseData.questions || [];

    var html =
      '<div class="vocab-exercise__header">' +
        '<a href="#/level/' + level + '/vocabulary" class="btn btn--sm btn--secondary">← Back</a>' +
        '<h1>' + (exerciseData.title || exerciseData.titleEn || 'Vocabulary Exercise') + '</h1>' +
      '</div>' +
      '<div class="vocab-exercise__questions">';

    questions.forEach(function(q, idx) {
      html += renderQuestion(q, idx);
    });

    html += '</div>' +
      '<div class="vocab-exercise__actions">' +
        '<button class="btn btn--primary" id="submit-vocab-btn">Submit Answers</button>' +
      '</div>';

    page.innerHTML = html;

    // Bind option clicks using event delegation (more reliable)
    var questionsContainer = page.querySelector('.vocab-exercise__questions');
    if (questionsContainer) {
      questionsContainer.addEventListener('click', function(e) {
        var btn = e.target;
        if (!btn.classList.contains('vocab-option')) {
          btn = btn.closest('.vocab-option');
        }
        if (!btn || submitted) return;
        var qIdx = parseInt(btn.getAttribute('data-question'), 10);
        var oIdx = parseInt(btn.getAttribute('data-option'), 10);
        if (!isNaN(qIdx) && !isNaN(oIdx)) {
          selectAnswer(qIdx, oIdx);
        }
      });
    }

    // Bind submit
    document.getElementById('submit-vocab-btn').addEventListener('click', submitExercise);
  }

  function renderQuestion(question, idx) {
    var type = question.type || 'word_match';
    var lang = window.App.getLanguage();
    var prompt = (lang === 'fr' && question.prompt_fr) ? question.prompt_fr : question.prompt;
    var sentence = (lang === 'fr' && question.sentence_fr) ? question.sentence_fr : question.sentence;
    var html = '<div class="vocab-question" data-question-idx="' + idx + '">';

    html += '<div class="vocab-question__header">' +
      '<span class="vocab-question__number">Q' + (idx + 1) + '</span>' +
      '<span class="vocab-question__type vocab-question__type--' + type + '">' + formatType(type) + '</span>' +
    '</div>';

    // Prompt area varies by type
    if (type === 'kanji_recognition') {
      html += '<div class="vocab-question__prompt">' +
        '<span class="vocab-question__prompt-text">' + escapeHtml(prompt) + '</span>' +
        '<div class="vocab-question__kanji-display">' + escapeHtml(question.kanji) + '</div>' +
      '</div>';
    } else if (type === 'sentence_completion') {
      html += '<div class="vocab-question__prompt">' +
        '<span class="vocab-question__prompt-text">' + escapeHtml(prompt) + '</span>' +
        '<div class="vocab-question__sentence">' + escapeHtml(sentence || '') + '</div>' +
      '</div>';
    } else if (type === 'flashcard') {
      html += '<div class="vocab-question__prompt">' +
        '<span class="vocab-question__prompt-text">' + escapeHtml(prompt) + '</span>' +
        '<div class="vocab-question__kanji-display">' + escapeHtml(question.front || '') + '</div>' +
      '</div>';
    } else {
      // word_match
      html += '<div class="vocab-question__prompt">' +
        '<span class="vocab-question__prompt-text">' + escapeHtml(prompt) + '</span>' +
        '<div class="vocab-question__word-display">' + escapeHtml(question.word || '') + '</div>' +
      '</div>';
    }

    // Options (all types use multiple choice) — use French options if available and language is French
    var lang = window.App.getLanguage();
    var options = (lang === 'fr' && question.options_fr) ? question.options_fr : (question.options || []);
    html += '<div class="vocab-question__options">';
    options.forEach(function(opt, oIdx) {
      html += '<button class="vocab-option" data-question="' + idx + '" data-option="' + oIdx + '">' +
        escapeHtml(opt) +
      '</button>';
    });
    html += '</div>';

    html += '</div>';
    return html;
  }

  function selectAnswer(questionIdx, optionIdx) {
    selectedAnswers[questionIdx] = optionIdx;

    // Update UI: highlight selected option
    var questionEl = document.querySelector('[data-question-idx="' + questionIdx + '"]');
    if (!questionEl) return;

    var options = questionEl.querySelectorAll('.vocab-option');
    for (var i = 0; i < options.length; i++) {
      options[i].classList.remove('vocab-option--selected');
    }

    var selectedBtn = questionEl.querySelector('[data-option="' + optionIdx + '"]');
    if (selectedBtn) {
      selectedBtn.classList.add('vocab-option--selected');
    }
  }

  function submitExercise() {
    if (submitted || !exerciseData) return;

    // Check all questions answered
    var unanswered = selectedAnswers.filter(function(a) { return a === null; });
    if (unanswered.length > 0) {
      alert('Please answer all questions before submitting.');
      return;
    }

    submitted = true;
    var level = exerciseData.level;
    var id = exerciseData.id;

    var submitBtn = document.getElementById('submit-vocab-btn');
    if (submitBtn) submitBtn.disabled = true;

    window.API.post('/vocab-exercises/' + encodeURIComponent(level) + '/' + encodeURIComponent(id) + '/submit', {
      answers: selectedAnswers.map(String),
      duration: 0
    })
      .then(function(result) {
        renderResults(result);
      })
      .catch(function(err) {
        alert('Error submitting answers: ' + (err.message || 'Unknown error'));
        submitted = false;
        if (submitBtn) submitBtn.disabled = false;
      });
  }

  function renderResults(result) {
    var page = document.querySelector('.page--vocab-exercise');
    if (!page || !exerciseData) return;

    var level = exerciseData.level;
    var questions = exerciseData.questions || [];
    var results = result.results || [];
    var score = result.score;
    var isCompleted = result.completed;

    var html =
      '<div class="vocab-exercise__header">' +
        '<a href="#/level/' + level + '/vocabulary" class="btn btn--sm btn--secondary">← Back</a>' +
        '<h1>' + (exerciseData.title || 'Vocabulary Exercise') + '</h1>' +
      '</div>';

    // Completion banner
    if (isCompleted) {
      html += '<div class="vocab-exercise__banner vocab-exercise__banner--success">' +
        '🎉 Exercise Completed! Perfect score!' +
      '</div>';
    }

    // Score summary
    html += '<div class="vocab-exercise__score">' +
      '<span class="vocab-exercise__score-value">' + result.correct + ' / ' + result.total + '</span>' +
      '<span class="vocab-exercise__score-label"> correct (' + Math.round(score * 100) + '%)</span>' +
    '</div>';

    // Results per question
    html += '<div class="vocab-exercise__results">';
    questions.forEach(function(q, idx) {
      var r = results[idx] || {};
      var isCorrect = r.correct;
      var icon = isCorrect ? '✓' : '✗';
      var cssClass = isCorrect ? 'vocab-result--correct' : 'vocab-result--wrong';

      html += '<div class="vocab-result ' + cssClass + '">' +
        '<span class="vocab-result__icon">' + icon + '</span>' +
        '<div class="vocab-result__detail">' +
          '<span class="vocab-result__question">Q' + (idx + 1) + ': ' + escapeHtml(q.prompt) + '</span>' +
          (!isCorrect ? '<span class="vocab-result__correct">Correct: ' + escapeHtml(r.correctAnswer || '') + '</span>' : '') +
        '</div>' +
      '</div>';
    });
    html += '</div>';

    // Actions
    html += '<div class="vocab-exercise__actions">';
    if (!isCompleted) {
      html += '<button class="btn btn--primary" id="retry-vocab-btn">Retry</button>';
    }
    // Check if user came from curriculum (via URL params)
    var backUrl = '#/level/' + level + '/vocabulary';
    var hashParams = window.location.hash.split('?')[1] || '';
    if (hashParams.indexOf('from=curriculum') !== -1) {
      var weekMatch = hashParams.match(/week=(\d+)/);
      var dayMatch = hashParams.match(/day=(\d+)/);
      if (weekMatch && dayMatch) {
        backUrl = '#/curriculum/' + weekMatch[1] + '/' + dayMatch[1];
      } else {
        backUrl = '#/curriculum';
      }
    }
    html += '<a href="' + backUrl + '" class="btn btn--secondary">' + (hashParams.indexOf('from=curriculum') !== -1 ? 'Back to Curriculum' : 'Back to List') + '</a>';
    html += '</div>';

    page.innerHTML = html;

    // Bind retry
    var retryBtn = document.getElementById('retry-vocab-btn');
    if (retryBtn) {
      retryBtn.addEventListener('click', function() {
        submitted = false;
        selectedAnswers = new Array(exerciseData.questions.length).fill(null);
        renderExercise();
      });
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Helpers
  // ─────────────────────────────────────────────────────────────────────────

  function formatType(type) {
    var names = {
      'kanji_recognition': 'Kanji',
      'word_match': 'Match',
      'sentence_completion': 'Fill-in',
      'flashcard': 'Flashcard'
    };
    return names[type] || type;
  }

  function escapeHtml(str) {
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(str || ''));
    return div.innerHTML;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Route Registration
  // ─────────────────────────────────────────────────────────────────────────

  window.Router.registerRoute('/vocabulary', renderVocabularyRedirect);
  window.Router.registerRoute('/level/:level/vocabulary', renderVocabularyList);
  window.Router.registerRoute('/vocab/:level/:id', renderVocabExercise);
})();
