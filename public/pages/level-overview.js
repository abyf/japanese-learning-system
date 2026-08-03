/**
 * Japanese Learning System - Level Overview Page
 */
(function() {
  'use strict';

  function renderNav(active) {
    return window.App.renderNav(active);
  }

  function renderLevelsOverview() {
    var app = document.getElementById('app');
    app.innerHTML = renderNav('levels') +
      '<div class="page page--levels">' +
        '<div class="levels__loading">Loading levels...</div>' +
      '</div>';

    window.API.get('/progress')
      .then(function(data) {
        renderLevelCards(data);
      })
      .catch(function(err) {
        var page = document.querySelector('.page--levels');
        if (page) {
          page.innerHTML = '<div class="error-message">Failed to load levels: ' + (err.message || 'Unknown error') + '</div>';
        }
      });
  }

  function renderLevelCards(data) {
    var page = document.querySelector('.page--levels');
    if (!page) return;

    var levels = [
      { key: 'beginner', name: 'Beginner', nameJa: '初級' },
      { key: 'intermediate', name: 'Intermediate', nameJa: '中級' },
      { key: 'advanced', name: 'Advanced', nameJa: '上級' }
    ];

    var levelData = (data && data.levels) || {};
    var currentLevel = (data && data.currentLevel) || 'beginner';
    var levelOrder = ['beginner', 'intermediate', 'advanced'];
    var currentLevelIdx = levelOrder.indexOf(currentLevel);

    page.innerHTML =
      '<h1>Levels</h1>' +
      '<div class="levels__grid">' +
        levels.map(function(level, idx) {
          var ld = levelData[level.key] || {};
          var completion = ld.completion || ld.overallCompletion || 0;
          var unlocked = idx <= currentLevelIdx;

          return '<div class="level-card' + (unlocked ? '' : ' level-card--locked') + '">' +
            '<div class="level-card__header">' +
              '<h2>' + level.name + ' <span class="level-card__ja">' + level.nameJa + '</span></h2>' +
              (unlocked ? '' : '<span class="level-card__lock">🔒</span>') +
            '</div>' +
            '<div class="level-card__progress">' +
              '<div class="progress-bar">' +
                '<div class="progress-bar__fill" style="width: ' + Math.round(completion) + '%"></div>' +
              '</div>' +
              '<span class="level-card__pct">' + Math.round(completion) + '%</span>' +
            '</div>' +
            (unlocked ? renderActivities(level.key) : '<p class="level-card__locked-msg text-secondary">Complete the previous level to unlock</p>') +
          '</div>';
        }).join('') +
      '</div>';
  }

  function renderActivities(level) {
    var activities = [
      { key: 'reading', name: 'Reading', icon: '📖' },
      { key: 'listening', name: 'Listening', icon: '🎧' },
      { key: 'dictation', name: 'Dictation', icon: '✍️' },
      { key: 'vocabulary', name: 'Vocabulary', icon: '📝' }
    ];

    return '<div class="level-card__activities">' +
      activities.map(function(a) {
        var href = '#/level/' + level + '/' + a.key;
        return '<a href="' + href + '" class="activity-link">' +
          '<span class="activity-link__icon">' + a.icon + '</span>' +
          '<span class="activity-link__name">' + a.name + '</span>' +
        '</a>';
      }).join('') +
    '</div>';
  }

  function renderLevelDetail(params) {
    var level = params.level;
    var app = document.getElementById('app');

    app.innerHTML = renderNav('levels') +
      '<div class="page page--level-detail">' +
        '<div class="level-detail__loading">Loading...</div>' +
      '</div>';

    window.API.get('/progress')
      .then(function(data) {
        renderDetail(level, data);
      })
      .catch(function(err) {
        var page = document.querySelector('.page--level-detail');
        if (page) {
          page.innerHTML = '<div class="error-message">Failed to load level: ' + (err.message || 'Unknown error') + '</div>';
        }
      });
  }

  function renderDetail(level, data) {
    var page = document.querySelector('.page--level-detail');
    if (!page) return;

    var levelNames = { beginner: 'Beginner 初級', intermediate: 'Intermediate 中級', advanced: 'Advanced 上級' };
    var levelName = levelNames[level] || level;

    var activities = [
      { key: 'reading', name: 'Reading', icon: '📖', route: '#/level/' + level + '/reading' },
      { key: 'listening', name: 'Listening', icon: '🎧', route: '#/level/' + level + '/listening' },
      { key: 'dictation', name: 'Dictation', icon: '✍️', route: '#/level/' + level + '/dictation' },
      { key: 'vocabulary', name: 'Vocabulary', icon: '📝', route: '#/level/' + level + '/vocabulary' }
    ];

    page.innerHTML =
      '<div class="level-detail__header">' +
        '<a href="#/levels" class="btn btn--small">← Back to Levels</a>' +
        '<h1>' + levelName + '</h1>' +
      '</div>' +
      '<div class="level-detail__activities">' +
        activities.map(function(a) {
          return '<a href="' + a.route + '" class="activity-card">' +
            '<span class="activity-card__icon">' + a.icon + '</span>' +
            '<span class="activity-card__name">' + a.name + '</span>' +
          '</a>';
        }).join('') +
      '</div>';
  }

  /**
   * Render an activity exercise list for a specific level and activity type.
   * Route: /level/:level/:activity (e.g., /level/beginner/reading)
   */
  function renderActivityList(params) {
    var level = params.level;
    var activity = params.activity;
    var app = document.getElementById('app');

    var activityNames = {
      reading: 'Reading 📖',
      listening: 'Listening 🎧',
      dictation: 'Dictation ✍️',
      vocabulary: 'Vocabulary 📝'
    };

    var activityName = activityNames[activity] || activity;

    // For vocabulary, redirect to the dedicated vocabulary list page
    if (activity === 'vocabulary') {
      window.location.hash = '#/level/' + level + '/vocabulary';
      return;
    }

    app.innerHTML = renderNav('levels') +
      '<div class="page page--activity-list">' +
        '<div class="activity-list__header">' +
          '<a href="#/level/' + level + '" class="btn btn--sm btn--secondary">← Back</a>' +
          '<h1>' + activityName + ' — ' + level.charAt(0).toUpperCase() + level.slice(1) + '</h1>' +
        '</div>' +
        '<div class="activity-list__loading">Loading exercises...</div>' +
      '</div>';

    // Fetch exercise list from API
    window.API.get('/' + activity + '/' + encodeURIComponent(level))
      .then(function(data) {
        renderExerciseList(level, activity, data);
      })
      .catch(function(err) {
        var page = document.querySelector('.page--activity-list');
        if (page) {
          page.querySelector('.activity-list__loading').innerHTML =
            '<div class="error-message">Failed to load exercises: ' + (err.message || 'Unknown error') + '</div>';
        }
      });
  }

  function renderExerciseList(level, activity, data) {
    var page = document.querySelector('.page--activity-list');
    if (!page) return;

    var loadingEl = page.querySelector('.activity-list__loading');
    if (!loadingEl) return;

    // Extract exercise list from response
    var exercises = data.passages || data.exercises || [];

    if (exercises.length === 0) {
      loadingEl.innerHTML = '<p class="text-secondary">No exercises available for this level yet.</p>';
      return;
    }

    var routePrefix = '#/' + activity + '/' + level + '/';
    var completedCount = exercises.filter(function(ex) { return ex.completed; }).length;

    loadingEl.innerHTML = 
      '<div class="exercise-list__summary mb-2">' +
        '<span class="text-secondary">' + completedCount + ' / ' + exercises.length + ' completed</span>' +
      '</div>' +
      '<div class="exercise-grid">' +
      exercises.map(function(ex, idx) {
        var id = ex.id || ('r00' + (idx + 1));
        var title = ex.title || ex.id || ('Exercise ' + (idx + 1));
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

  window.Router.registerRoute('/levels', renderLevelsOverview);
  window.Router.registerRoute('/level/:level', renderLevelDetail);
  window.Router.registerRoute('/level/:level/:activity', renderActivityList);
})();
