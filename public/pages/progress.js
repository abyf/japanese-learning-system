/**
 * Japanese Learning System - Progress Statistics Page
 */
(function() {
  'use strict';

  function renderNav(active) {
    return window.App.renderNav(active);
  }

  function render() {
    var app = document.getElementById('app');
    app.innerHTML = renderNav('progress') +
      '<div class="page page--progress">' +
        '<div class="progress__loading">' + window.i18n('general.loading') + '</div>' +
      '</div>';

    window.API.get('/progress')
      .then(function(data) {
        renderProgress(data);
      })
      .catch(function(err) {
        var page = document.querySelector('.page--progress');
        if (page) {
          page.innerHTML = '<div class="error-message">Failed to load progress: ' + (err.message || 'Unknown error') + '</div>';
        }
      });
  }

  function renderProgress(data) {
    var page = document.querySelector('.page--progress');
    if (!page) return;

    var levels = data.completionByLevel || data.levels || {};
    var accuracy = data.accuracyByActivity || data.accuracy || {};
    var rawStudyTime = data.studyTime || {};
    // Convert seconds to minutes
    var studyTime = {
      today: Math.round((rawStudyTime.daily || rawStudyTime.today || 0) / 60),
      week: Math.round((rawStudyTime.weekly || rawStudyTime.week || 0) / 60),
      month: Math.round((rawStudyTime.monthly || rawStudyTime.month || 0) / 60)
    };
    var streak = data.streak || 0;
    var streakCalendar = data.streakCalendar || [];

    page.innerHTML =
      '<h1>' + window.i18n('progress.title') + '</h1>' +

      '<section class="progress__section">' +
        '<h2>' + window.i18n('progress.completion') + '</h2>' +
        renderLevelProgress(levels) +
      '</section>' +

      '<section class="progress__section">' +
        '<h2>' + window.i18n('progress.accuracy') + '</h2>' +
        '<div class="accuracy-grid">' +
          renderAccuracyItem(window.i18n('activity.reading'), accuracy.reading) +
          renderAccuracyItem(window.i18n('activity.listening'), accuracy.listening) +
          renderAccuracyItem(window.i18n('activity.dictation'), accuracy.dictation) +
          renderAccuracyItem(window.i18n('activity.vocabulary'), accuracy.vocabulary) +
        '</div>' +
      '</section>' +

      '<section class="progress__section">' +
        '<h2>' + window.i18n('progress.studyTime') + '</h2>' +
        '<div class="study-time-grid">' +
          '<div class="study-time__item">' +
            '<span class="study-time__label">' + window.i18n('progress.today') + '</span>' +
            '<span class="study-time__value">' + (studyTime.today || 0) + ' min</span>' +
          '</div>' +
          '<div class="study-time__item">' +
            '<span class="study-time__label">' + window.i18n('progress.thisWeek') + '</span>' +
            '<span class="study-time__value">' + (studyTime.week || 0) + ' min</span>' +
          '</div>' +
          '<div class="study-time__item">' +
            '<span class="study-time__label">' + window.i18n('progress.thisMonth') + '</span>' +
            '<span class="study-time__value">' + (studyTime.month || 0) + ' min</span>' +
          '</div>' +
        '</div>' +
      '</section>' +

      '<section class="progress__section">' +
        '<h2>' + window.i18n('progress.streak') + '</h2>' +
        '<div class="streak-display">' +
          '<span class="streak-display__count">\ud83d\udd25 ' + streak + ' ' + window.i18n('progress.days') + '</span>' +
          '<div class="streak-calendar">' + renderStreakCalendar(streakCalendar) + '</div>' +
        '</div>' +
      '</section>';
  }

  function renderLevelProgress(levels) {
    var levelNames = ['beginner', 'intermediate', 'advanced'];
    var activities = ['reading', 'listening', 'dictation', 'vocabulary'];
    var activityLabels = {
      reading: window.i18n('activity.reading'),
      listening: window.i18n('activity.listening'),
      dictation: window.i18n('activity.dictation'),
      vocabulary: window.i18n('activity.vocabulary')
    };

    var html = '<div class="level-progress">';
    levelNames.forEach(function(level) {
      var levelData = levels[level] || {};
      html += '<div class="level-progress__level">' +
        '<h3>' + level.charAt(0).toUpperCase() + level.slice(1) + '</h3>';

      activities.forEach(function(activity) {
        var pct = (levelData[activity] && levelData[activity].completion) || levelData[activity] || 0;
        html += '<div class="progress-bar-row">' +
          '<span class="progress-bar-row__label">' + activityLabels[activity] + '</span>' +
          '<div class="progress-bar">' +
            '<div class="progress-bar__fill" style="width: ' + Math.round(pct) + '%"></div>' +
          '</div>' +
          '<span class="progress-bar-row__value">' + Math.round(pct) + '%</span>' +
        '</div>';
      });

      html += '</div>';
    });
    html += '</div>';
    return html;
  }

  function renderAccuracyItem(label, value) {
    var pct = Math.round((value || 0) * 100);
    return '<div class="accuracy-item">' +
      '<span class="accuracy-item__label">' + label + '</span>' +
      '<span class="accuracy-item__value">' + pct + '%</span>' +
    '</div>';
  }

  function renderStreakCalendar(calendar) {
    if (!calendar || !calendar.length) return '<span class="text-secondary">No streak data yet</span>';

    return '<div class="streak-calendar__grid">' +
      calendar.map(function(day) {
        var cls = day.active ? 'streak-calendar__day--active' : 'streak-calendar__day--inactive';
        return '<span class="streak-calendar__day ' + cls + '" title="' + (day.date || '') + '"></span>';
      }).join('') +
    '</div>';
  }

  window.Router.registerRoute('/progress', render);
})();
