/**
 * Japanese Learning System - Curriculum Page
 * Shows the full 52-week curriculum overview and individual day views.
 * Routes: /curriculum, /curriculum/:week, /curriculum/:week/:day
 */
(function() {
  'use strict';

  function renderNav(active) {
    return window.App.renderNav(active);
  }

  function t(en, fr) {
    var lang = window.App.getLanguage();
    if (lang === 'fr') return fr || en;
    if (lang === 'en') return en;
    if (window.i18n) {
      var allKeys = window.i18n.getAll(lang);
      var enAll = window.i18n.getAll('en');
      for (var key in enAll) {
        if (enAll[key] === en && allKeys[key]) return allKeys[key];
      }
    }
    return en;
  }

  function escapeHtml(str) {
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(str || ''));
    return div.innerHTML;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Route: /curriculum — Full curriculum overview (all 52 weeks)
  // ─────────────────────────────────────────────────────────────────────────

  function renderCurriculumOverview() {
    var app = document.getElementById('app');
    app.innerHTML = renderNav('curriculum') +
      '<div class="page page--curriculum">' +
        '<div class="curriculum__header">' +
          '<h1>📅 ' + t('Curriculum', 'Programme') + '</h1>' +
          '<p class="text-secondary">' + t(
            'Beginner Japanese - 52 Week Program',
            'Japonais Débutant - Programme de 52 semaines'
          ) + '</p>' +
        '</div>' +
        '<div class="curriculum__loading">' + t('Loading curriculum...', 'Chargement...') + '</div>' +
      '</div>';

    // Load user progress to know current position
    window.API.get('/curriculum/progress').then(function(progress) {
      window.App.user = window.App.user || {};
      renderWeeksList(progress);
    }).catch(function(err) {
      var container = document.querySelector('.curriculum__loading');
      if (container) {
        container.innerHTML = '<div class="error-message">' + t('Failed to load curriculum', 'Erreur de chargement') + '</div>';
      }
    });
  }

  function renderWeeksList(progress) {
    var container = document.querySelector('.curriculum__loading');
    if (!container) return;

    var lang = window.App.getLanguage();
    var currentWeek = progress.currentWeek || 1;
    var currentDay = progress.currentDay || 1;

    // We'll load weeks in batches to avoid too many API calls
    // For the overview, show a simplified view based on progress data
    var totalWeeks = progress.totalWeeks || 52;
    var completedDays = progress.completedDays || 0;

    var html = '<div class="curriculum__progress-summary">' +
      '<div class="progress-bar"><div class="progress-bar__fill" style="width:' + progress.percentComplete + '%"></div></div>' +
      '<p>' + t('Week', 'Semaine') + ' ' + currentWeek + ' / ' + totalWeeks + 
      ' • ' + completedDays + ' ' + t('days completed', 'jours complétés') + 
      ' • ' + progress.percentComplete + '%</p>' +
    '</div>';

    html += '<div class="curriculum__weeks">';

    // Generate week cards — we show all 52 weeks with basic info
    // Load detailed data for the first few weeks and current week area
    for (var w = 1; w <= totalWeeks; w++) {
      var weekStatus = '';
      var weekClass = 'week-card';

      if (w < currentWeek) {
        weekStatus = '✓';
        weekClass += ' week-card--completed';
      } else if (w === currentWeek) {
        weekStatus = '●';
        weekClass += ' week-card--current';
      } else {
        weekStatus = '🔒';
        weekClass += ' week-card--locked';
      }

      html += '<div class="' + weekClass + '" data-week="' + w + '">' +
        '<a href="#/curriculum/' + w + '" class="week-card__link">' +
          '<span class="week-card__number">' + t('Week', 'Sem.') + ' ' + w + '</span>' +
          '<span class="week-card__status">' + weekStatus + '</span>' +
        '</a>' +
      '</div>';
    }

    html += '</div>';

    container.outerHTML = html;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Route: /curriculum/:week — Week detail view
  // ─────────────────────────────────────────────────────────────────────────

  function renderWeekDetail(params) {
    var weekNum = parseInt(params.week, 10);
    var app = document.getElementById('app');
    app.innerHTML = renderNav('curriculum') +
      '<div class="page page--curriculum-week">' +
        '<div class="curriculum__header">' +
          '<a href="#/curriculum" class="btn btn--sm btn--secondary">← ' + t('Back to Curriculum', 'Retour au programme') + '</a>' +
          '<h1>' + t('Week', 'Semaine') + ' ' + weekNum + '</h1>' +
        '</div>' +
        '<div class="curriculum-week__loading">' + t('Loading...', 'Chargement...') + '</div>' +
      '</div>';

    window.API.get('/curriculum/week/' + weekNum).then(function(weekData) {
      renderWeekContent(weekNum, weekData);
    }).catch(function(err) {
      var container = document.querySelector('.curriculum-week__loading');
      if (container) {
        container.innerHTML = '<div class="error-message">' + t('Failed to load week data', 'Erreur de chargement') + '</div>';
      }
    });
  }

  function renderWeekContent(weekNum, weekData) {
    var container = document.querySelector('.curriculum-week__loading');
    if (!container) return;

    var lang = window.App.getLanguage();
    var theme = lang === 'fr' ? weekData.themeFr : (lang === 'pt' ? (weekData.themePt || weekData.theme) : weekData.theme);

    var html = '<p class="curriculum-week__theme">🎯 ' + escapeHtml(theme) + '</p>';
    html += '<div class="curriculum-week__days">';

    weekData.days.forEach(function(day) {
      var dayTitle = lang === 'fr' ? day.titleFr : (lang === 'pt' ? (day.titlePt || day.title) : day.title);
      var statusIcon = day.completed ? '✅' : (day.current ? '🟡' : (day.locked ? '🔒' : '⬜'));
      var dayClass = 'day-card';
      if (day.completed) dayClass += ' day-card--completed';
      else if (day.current) dayClass += ' day-card--current';
      else if (day.locked) dayClass += ' day-card--locked';

      html += '<div class="' + dayClass + '">' +
        '<div class="day-card__header">' +
          '<span class="day-card__status">' + statusIcon + '</span>' +
          '<span class="day-card__title">' + t('Day', 'Jour') + ' ' + day.day + ': ' + escapeHtml(dayTitle) + '</span>' +
          (day.review ? '<span class="tag tag--review">' + t('Review', 'Révision') + '</span>' : '') +
        '</div>' +
        '<div class="day-card__activities">';

      day.activities.forEach(function(a) {
        var actTitle = lang === 'fr' ? (a.titleFr || a.title) : (lang === 'pt' ? (a.titlePt || a.title) : a.title);
        var icon = getActivityIcon(a.type);
        var duration = a.duration ? ' (' + a.duration + 'min)' : '';
        var sourceTag = (a.type === 'external' || a.source === 'external')
          ? ' <span class="tag tag--external-sm">' + t('ext', 'ext') + '</span>' 
          : '';
        html += '<div class="day-card__activity' + (a.completed ? ' day-card__activity--done' : '') + '">' + 
          (a.completed ? '✅ ' : '⬜ ') + icon + ' ' + escapeHtml(actTitle) + duration + sourceTag + '</div>';
      });

      html += '</div>';

      // Action button for unlocked/current days
      if (!day.locked) {
        html += '<div class="day-card__actions">' +
          '<a href="#/curriculum/' + weekNum + '/' + day.day + '" class="btn btn--sm btn--primary">' + 
            t('View Day', 'Voir le jour') + '</a>' +
        '</div>';
      }

      html += '</div>';
    });

    html += '</div>';
    container.outerHTML = html;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Route: /curriculum/:week/:day — Individual day view
  // ─────────────────────────────────────────────────────────────────────────

  function renderDayDetail(params) {
    var weekNum = parseInt(params.week, 10);
    var dayNum = parseInt(params.day, 10);
    var app = document.getElementById('app');
    app.innerHTML = renderNav('curriculum') +
      '<div class="page page--curriculum-day">' +
        '<div class="curriculum__header">' +
          '<a href="#/curriculum/' + weekNum + '" class="btn btn--sm btn--secondary">← ' + t('Back to Week', 'Retour à la semaine') + ' ' + weekNum + '</a>' +
          '<h1>' + t('Week', 'Semaine') + ' ' + weekNum + ', ' + t('Day', 'Jour') + ' ' + dayNum + '</h1>' +
        '</div>' +
        '<div class="curriculum-day__loading">' + t('Loading...', 'Chargement...') + '</div>' +
      '</div>';

    window.API.get('/curriculum/week/' + weekNum).then(function(weekData) {
      var dayData = weekData.days.find(function(d) { return d.day === dayNum; });
      if (dayData) {
        renderDayContent(weekNum, dayNum, weekData, dayData);
      } else {
        var container = document.querySelector('.curriculum-day__loading');
        if (container) container.innerHTML = '<div class="error-message">' + t('Day not found', 'Jour non trouvé') + '</div>';
      }
    }).catch(function(err) {
      var container = document.querySelector('.curriculum-day__loading');
      if (container) container.innerHTML = '<div class="error-message">' + t('Failed to load', 'Erreur') + '</div>';
    });
  }

  function renderDayContent(weekNum, dayNum, weekData, dayData) {
    var container = document.querySelector('.curriculum-day__loading');
    if (!container) return;

    var lang = window.App.getLanguage();
    var dayTitle = lang === 'fr' ? dayData.titleFr : (lang === 'pt' ? (dayData.titlePt || dayData.title) : dayData.title);
    var theme = lang === 'fr' ? weekData.themeFr : (lang === 'pt' ? (weekData.themePt || weekData.theme) : weekData.theme);
    var totalMinutes = dayData.activities.reduce(function(sum, a) { return sum + (a.duration || 0); }, 0);

    var html = '<div class="curriculum-day__info">' +
      '<h2>' + escapeHtml(dayTitle) + '</h2>' +
      '<p class="text-secondary">' + escapeHtml(theme) + '</p>' +
      '<p class="curriculum-day__duration">⏱ ' + totalMinutes + ' ' + t('minutes total', 'minutes au total') + '</p>' +
      (dayData.review ? '<p class="tag tag--review">' + t('Review Day', 'Jour de révision') + '</p>' : '') +
      (dayData.completed ? '<p class="curriculum-day__status status--done">✅ ' + t('Completed', 'Terminé') + '</p>' : '') +
    '</div>';

    html += '<div class="curriculum-day__activities">';
    html += '<h3>' + t('Activities', 'Activités') + '</h3>';

    dayData.activities.forEach(function(a, idx) {
      var actTitle = lang === 'fr' ? (a.titleFr || a.title) : (lang === 'pt' ? (a.titlePt || a.title) : a.title);
      var actDesc = lang === 'fr' ? (a.descriptionFr || a.description || '') : (lang === 'pt' ? (a.descriptionPt || a.description || '') : (a.description || ''));
      var icon = getActivityIcon(a.type);
      var duration = a.duration ? a.duration + ' min' : '';

      html += '<div class="activity-card' + (a.completed ? ' activity-card--done' : '') + '">' +
        '<div class="activity-card__header">' +
          '<span class="activity-card__icon">' + (a.completed ? '✅' : icon) + '</span>' +
          '<span class="activity-card__title">' + escapeHtml(actTitle) + '</span>' +
          '<span class="activity-card__duration">' + duration + '</span>' +
        '</div>';

      if (actDesc) {
        html += '<p class="activity-card__desc">' + escapeHtml(actDesc) + '</p>';
      }

      // Action button - check both old format (a.source) and new format (a.type)
      var isInternal = (a.source === 'internal' || a.type === 'internal') && a.exerciseId;
      var isExternal = (a.source === 'external' || a.type === 'external') && a.url;

      if (isInternal) {
        var route = getInternalRoute(a.type, a.exerciseId);
        if (!route) {
          // New format: type is 'internal', need to determine activity type from exerciseId
          var actType = a.exerciseId.charAt(0) === 'v' ? 'vocabulary' : 
                        a.exerciseId.charAt(0) === 'r' ? 'reading' : 
                        a.exerciseId.charAt(0) === 'l' ? 'listening' : 'dictation';
          route = getInternalRoute(actType, a.exerciseId);
        }
        if (route) {
          html += '<a href="' + route + '?from=curriculum&week=' + weekNum + '&day=' + dayNum + '" class="btn btn--sm ' + (a.completed ? 'btn--secondary' : 'btn--primary') + '">' + 
            (a.completed ? t('Review Again', 'Revoir') : t('Start Exercise', 'Commencer')) + '</a>';
        }
      } else if (isExternal) {
        html += '<a href="' + escapeHtml(a.url) + '" target="_blank" rel="noopener" class="btn btn--sm btn--secondary">' + 
          t('Open Resource ↗', 'Ouvrir ↗') + '</a>';
        if (!a.completed) {
          html += ' <button class="btn btn--sm btn--outline mark-external-done" data-idx="' + idx + '" data-week="' + weekNum + '" data-day="' + dayNum + '">' + 
            t('Mark as Done', 'Marquer fait') + '</button>';
        } else {
          html += ' <span class="btn btn--sm btn--success" disabled>✓ ' + t('Done', 'Fait') + '</span>';
        }
      }

      html += '</div>';
    });

    html += '</div>';

    // Complete day button
    if (!dayData.completed) {
      html += '<div class="curriculum-day__complete">' +
        '<button id="complete-day-btn" class="btn btn--success btn--lg">' + 
          t('✓ Mark Day as Complete', '✓ Marquer le jour terminé') + '</button>' +
        '<p class="text-secondary text-sm mt-1">' + 
          t('Mark this day complete when you\'ve finished all internal activities.',
            'Marquez ce jour terminé quand vous avez fini toutes les activités internes.') + '</p>' +
      '</div>';
    }

    container.outerHTML = html;

    // Attach complete button event
    var completeBtn = document.getElementById('complete-day-btn');
    if (completeBtn) {
      completeBtn.addEventListener('click', function() {
        completeBtn.disabled = true;
        completeBtn.textContent = '...';
        window.API.post('/curriculum/day/' + weekNum + '/' + dayNum + '/complete', {})
          .then(function() {
            // Reload page to show updated state
            renderDayDetail({ week: String(weekNum), day: String(dayNum) });
          })
          .catch(function(err) {
            alert(t('Error', 'Erreur') + ': ' + (err.message || ''));
            completeBtn.disabled = false;
            completeBtn.textContent = t('✓ Mark Day as Complete', '✓ Marquer le jour terminé');
          });
      });
    }

    // Attach mark-as-done buttons for external activities
    var markBtns = document.querySelectorAll('.mark-external-done');
    markBtns.forEach(function(btn) {
      btn.addEventListener('click', function() {
        var actIdx = parseInt(btn.getAttribute('data-idx'), 10);
        var w = parseInt(btn.getAttribute('data-week'), 10);
        var d = parseInt(btn.getAttribute('data-day'), 10);
        btn.disabled = true;
        btn.textContent = '...';
        
        window.API.post('/curriculum/external-done', { week: w, day: d, activityIndex: actIdx })
          .then(function() {
            btn.textContent = '✓ ' + t('Done', 'Fait');
            btn.classList.add('btn--success');
            btn.classList.remove('btn--outline');
            // Also mark the activity card as done
            var card = btn.closest('.activity-card');
            if (card) card.classList.add('activity-card--done');
          })
          .catch(function() {
            btn.textContent = t('Mark as Done', 'Marquer fait');
            btn.disabled = false;
          });
      });
    });
  }

  function getActivityIcon(type) {
    switch (type) {
      case 'vocabulary': return '📝';
      case 'reading': return '📖';
      case 'listening': return '🎧';
      case 'dictation': return '✍️';
      case 'writing': return '✏️';
      default: return '📚';
    }
  }

  function getInternalRoute(type, exerciseId) {
    var level = 'beginner';
    switch (type) {
      case 'vocabulary': return '#/vocab/' + level + '/' + exerciseId;
      case 'reading': return '#/reading/' + level + '/' + exerciseId;
      case 'listening': return '#/listening/' + level + '/' + exerciseId;
      case 'dictation': return '#/dictation/' + level + '/' + exerciseId;
      default: return '';
    }
  }

  // Register routes
  window.Router.registerRoute('/curriculum', renderCurriculumOverview);
  window.Router.registerRoute('/curriculum/:week', renderWeekDetail);
  window.Router.registerRoute('/curriculum/:week/:day', renderDayDetail);
})();
