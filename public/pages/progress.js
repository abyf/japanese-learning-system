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
    var studyDays = data.studyDays || [];
    var achievements = (data.achievements || []).map(function(a) { return a.achievement_key; });
    var xp = data.xp || 0;
    var xpLevel = data.xpLevel || 1;
    var xpIntoLevel = data.xpIntoLevel || 0;
    var xpForNext = data.xpForNextLevel || 500;

    page.innerHTML =
      '<h1>' + window.i18n('progress.title') + '</h1>' +

      renderGamifyHero(streak, xp, xpLevel, xpIntoLevel, xpForNext) +

      '<section class="progress__section">' +
        '<h2>' + window.i18n('gamify.heatmap') + '</h2>' +
        renderHeatmap(studyDays) +
      '</section>' +

      '<section class="progress__section">' +
        '<h2>' + window.i18n('gamify.badges') + ' (' + achievements.length + '/' +
          (window.AchievementsCatalog ? window.AchievementsCatalog.all.length : achievements.length) + ')</h2>' +
        renderBadges(achievements) +
      '</section>' +

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
      '</section>';
  }

  function renderGamifyHero(streak, xp, xpLevel, xpIntoLevel, xpForNext) {
    var pct = Math.round((xpIntoLevel / Math.max(1, xpForNext)) * 100);
    return '<div class="gamify-hero">' +
      '<div class="gamify-stat gamify-stat--streak">' +
        '<span class="gamify-stat__mark">\u708e</span>' +
        '<span class="gamify-stat__value">' + streak + '</span>' +
        '<span class="gamify-stat__label">' + window.i18n('gamify.streakDays') + '</span>' +
      '</div>' +
      '<div class="gamify-stat gamify-stat--xp">' +
        '<div class="gamify-xp__top">' +
          '<span class="gamify-xp__level">' + window.i18n('gamify.level') + ' ' + xpLevel + '</span>' +
          '<span class="gamify-xp__total">' + xp + ' ' + window.i18n('gamify.xp') + '</span>' +
        '</div>' +
        '<div class="progress-bar"><div class="progress-bar__fill" style="width:' + pct + '%"></div></div>' +
        '<span class="gamify-xp__next">' + xpIntoLevel + ' / ' + xpForNext + ' ' + window.i18n('gamify.toNext') + '</span>' +
      '</div>' +
    '</div>';
  }

  function renderBadges(earnedKeys) {
    if (!window.AchievementsCatalog) return '';
    var lang = window.App.getLanguage();
    var earned = {};
    earnedKeys.forEach(function(k) { earned[k] = true; });
    return '<div class="badges-grid">' +
      window.AchievementsCatalog.all.map(function(d) {
        var got = !!earned[d.key];
        return '<div class="badge' + (got ? ' badge--earned' : ' badge--locked') + '" title="' +
            escapeAttr(window.AchievementsCatalog.nameFor(d.key, lang)) + '">' +
          '<span class="badge__mark">' + d.mark + '</span>' +
          '<span class="badge__name">' + escapeHtml(window.AchievementsCatalog.nameFor(d.key, lang)) + '</span>' +
        '</div>';
      }).join('') +
    '</div>';
  }

  /**
   * GitHub-style contribution heatmap of study days (most recent ~18 weeks).
   */
  function renderHeatmap(studyDays) {
    var byDate = {};
    (studyDays || []).forEach(function(d) { byDate[d.study_date] = d.total_seconds || 0; });

    var WEEKS = 18;
    var days = WEEKS * 7;
    var today = new Date();
    // Align the grid so the last column ends on today.
    var cells = [];
    var maxSeconds = 1;
    for (var i = days - 1; i >= 0; i--) {
      var dt = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i);
      var iso = dt.toISOString().split('T')[0];
      var secs = byDate[iso] || 0;
      if (secs > maxSeconds) maxSeconds = secs;
      cells.push({ date: iso, secs: secs });
    }
    if (!studyDays || !studyDays.length) {
      return '<p class="text-secondary">' + window.i18n('gamify.noData') + '</p>' + heatmapGrid(cells, maxSeconds);
    }
    return heatmapGrid(cells, maxSeconds);
  }

  function heatmapGrid(cells, maxSeconds) {
    // Organise into columns of 7 (week columns).
    var cols = [];
    for (var i = 0; i < cells.length; i += 7) {
      cols.push(cells.slice(i, i + 7));
    }
    return '<div class="heatmap">' +
      cols.map(function(week) {
        return '<div class="heatmap__col">' +
          week.map(function(c) {
            var level = 0;
            if (c.secs > 0) {
              var ratio = c.secs / maxSeconds;
              level = ratio > 0.66 ? 4 : ratio > 0.33 ? 3 : ratio > 0.1 ? 2 : 1;
            }
            return '<span class="heatmap__cell heatmap__cell--l' + level + '" title="' + c.date +
              (c.secs ? ' (' + Math.round(c.secs / 60) + ' min)' : '') + '"></span>';
          }).join('') +
        '</div>';
      }).join('') +
    '</div>';
  }

  function escapeHtml(str) {
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(str == null ? '' : String(str)));
    return div.innerHTML;
  }
  function escapeAttr(str) { return escapeHtml(str).replace(/"/g, '&quot;'); }

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

  window.Router.registerRoute('/progress', render);
})();
