/**
 * Japanese Learning System - Dashboard Page
 * Redesigned to show curriculum-guided daily learning with progress tracking.
 */
(function() {
  'use strict';

  function renderNav(active) {
    return window.App.renderNav(active);
  }

  function t(en, fr) {
    return window.App.getLanguage() === 'fr' ? fr : en;
  }

  function render() {
    var app = document.getElementById('app');
    app.innerHTML = renderNav('dashboard') +
      '<div class="page page--dashboard">' +
        '<div class="dashboard__loading">' + t('Loading dashboard...', 'Chargement du tableau de bord...') + '</div>' +
      '</div>';
    loadData();
  }

  function loadData() {
    Promise.all([
      window.API.get('/auth/me'),
      window.API.get('/curriculum/progress'),
      window.API.get('/curriculum/today'),
      window.API.get('/curriculum/week/' + 1) // Will update after progress loads
    ]).then(function(results) {
      var user = results[0];
      var progress = results[1];
      var today = results[2];

      window.App.user = user;

      // Re-fetch current week data now that we know the week
      window.API.get('/curriculum/week/' + progress.currentWeek).then(function(weekData) {
        // Re-render nav with username
        var navEl = document.querySelector('.navbar');
        if (navEl) {
          navEl.outerHTML = renderNav('dashboard');
        }
        renderDashboard(user, progress, today, weekData);
      }).catch(function() {
        var navEl = document.querySelector('.navbar');
        if (navEl) {
          navEl.outerHTML = renderNav('dashboard');
        }
        renderDashboard(user, progress, today, null);
      });
    }).catch(function(err) {
      var page = document.querySelector('.page--dashboard');
      if (page) {
        page.innerHTML = '<div class="error-message">' + 
          t('Failed to load dashboard: ', 'Erreur de chargement : ') + 
          (err.message || 'Unknown error') + '</div>';
      }
    });
  }

  function renderDashboard(user, progress, today, weekData) {
    var page = document.querySelector('.page--dashboard');
    if (!page) return;

    var username = (user && user.username) || '';
    var lang = window.App.getLanguage();
    var isFr = lang === 'fr';

    var currentWeek = (progress && progress.currentWeek) || 1;
    var currentDay = (progress && progress.currentDay) || 1;
    var percentComplete = (progress && progress.percentComplete) || 0;
    var totalWeeks = (progress && progress.totalWeeks) || 52;

    var programTitle = isFr ? (progress && progress.titleFr) : (progress && progress.title);
    var programDesc = isFr ? (progress && progress.descriptionFr) : (progress && progress.description);

    // Today's data
    var todayTitle = today ? (isFr ? today.titleFr : today.title) : '';
    var todayTheme = today ? (isFr ? today.themeFr : today.theme) : '';
    var activities = (today && today.activities) || [];

    // Progress bar
    var barWidth = Math.min(100, percentComplete);
    var progressBar = '<div class="progress-bar"><div class="progress-bar__fill" style="width:' + barWidth + '%"></div></div>';

    // Activities list
    var activitiesHtml = activities.map(function(a, idx) {
      var actTitle = isFr ? (a.titleFr || a.title) : a.title;
      var icon = getActivityIcon(a.type);
      var sourceTag = a.source === 'external' 
        ? ' <span class="tag tag--external">' + t('External', 'Externe') + '</span>' 
        : '';
      var durationStr = a.duration ? ' (' + a.duration + 'min)' : '';
      var linkHtml = '';

      if (a.source === 'internal' && a.exerciseId) {
        var actRoute = getActivityRoute(a.type, a.exerciseId);
        linkHtml = actRoute ? ' <a href="' + actRoute + '" class="activity-link">' + t('Go', 'Aller') + ' →</a>' : '';
      } else if (a.source === 'external' && a.url) {
        linkHtml = ' <a href="' + a.url + '" target="_blank" rel="noopener" class="activity-link">' + t('Open', 'Ouvrir') + ' ↗</a>';
      }

      return '<li class="today-activity" data-idx="' + idx + '">' +
        '<span class="today-activity__icon">' + icon + '</span>' +
        '<span class="today-activity__text">' + actTitle + durationStr + sourceTag + '</span>' +
        linkHtml +
      '</li>';
    }).join('');

    // Week days status
    var weekDaysHtml = '';
    if (weekData && weekData.days) {
      var dayNames = isFr 
        ? ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']
        : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
      
      weekDaysHtml = weekData.days.map(function(d, i) {
        var status = d.completed ? '✓' : (d.current ? '●' : '○');
        var cls = d.completed ? 'day--done' : (d.current ? 'day--current' : (d.locked ? 'day--locked' : 'day--available'));
        return '<span class="week-day ' + cls + '" title="' + (isFr ? d.titleFr : d.title) + '">' + 
          dayNames[i] + ' ' + status + '</span>';
      }).join(' ');
    }

    page.innerHTML =
      // Tester banner
      '<div class="tester-banner">' +
        '<p>🙏 ' + t(
          'Thank you for testing this Japanese learning system for beginners! Please spend at least 15 minutes exploring the app, then share your feedback:',
          'Merci de tester ce système d\'apprentissage du japonais pour débutants ! Veuillez passer au moins 15 minutes à explorer l\'application, puis partagez vos retours :'
        ) + '</p>' +
        '<a href="https://forms.gle/36fpxtbzF25ntj6Y8" target="_blank" rel="noopener" class="btn btn--sm btn--accent">' +
          t('Give Feedback ↗', 'Donner un retour ↗') +
        '</a>' +
      '</div>' +

      // Welcome
      '<div class="dashboard__welcome">' +
        '<h1>' + t('Welcome, ', 'Bienvenue, ') + escapeHtml(username) + '! 🎓</h1>' +
      '</div>' +

      // Program Overview Card
      '<div class="card card--overview">' +
        '<h2 class="card__title">📘 ' + t('Program Overview', 'Aperçu du programme') + '</h2>' +
        '<p class="card__description">' + (programTitle || t('Beginner Japanese - 1 Year Program', 'Japonais Débutant - Programme d\'un an')) + '</p>' +
        '<p class="card__detail">' + (programDesc || t(
          'Complement your 210-hour online course with daily 30-minute focused practice (182 hours/year).',
          'Complétez votre cours en ligne de 210 heures avec 30 minutes de pratique quotidienne (182 heures/an).'
        )) + '</p>' +
        '<div class="card__progress">' +
          '<span class="card__progress-text">🎯 ' + t('Week', 'Semaine') + ' ' + currentWeek + ' / ' + totalWeeks + 
          '  •  ' + t('Day', 'Jour') + ' ' + currentDay + 
          '  •  ' + percentComplete + '% ' + t('complete', 'complété') + '</span>' +
          progressBar +
        '</div>' +
      '</div>' +

      // Today's Plan
      '<div class="card card--today">' +
        '<h2 class="card__title">📅 ' + t("Today's Plan", "Plan du jour") + '</h2>' +
        '<p class="card__subtitle">' + t('Week', 'Semaine') + ' ' + currentWeek + ', ' + t('Day', 'Jour') + ' ' + currentDay + ': ' + todayTitle + '</p>' +
        (todayTheme ? '<p class="card__theme">' + todayTheme + '</p>' : '') +
        '<ul class="today-activities">' + activitiesHtml + '</ul>' +
        '<div class="card__actions">' +
          '<button id="start-day-btn" class="btn btn--primary">' + t('Start Day →', 'Commencer →') + '</button>' +
          '<button id="complete-day-btn" class="btn btn--success">' + t('Mark Day Complete ✓', 'Marquer terminé ✓') + '</button>' +
        '</div>' +
      '</div>' +

      // Bottom grid
      '<div class="dashboard__grid">' +
        // Quick Links
        '<div class="card card--links">' +
          '<h3 class="card__title">' + t('Quick Links', 'Liens rapides') + '</h3>' +
          '<ul class="quick-links">' +
            '<li><a href="#/level/beginner/reading">📖 ' + t('Reading', 'Lecture') + '</a></li>' +
            '<li><a href="#/level/beginner/vocabulary">📝 ' + t('Vocabulary', 'Vocabulaire') + '</a></li>' +
            '<li><a href="#/level/beginner/listening">🎧 ' + t('Listening', 'Écoute') + '</a></li>' +
            '<li><a href="#/level/beginner/dictation">✍️ ' + t('Dictation', 'Dictée') + '</a></li>' +
            '<li><a href="#/curriculum">📅 ' + t('Full Curriculum', 'Programme complet') + '</a></li>' +
          '</ul>' +
        '</div>' +

        // This Week
        '<div class="card card--week">' +
          '<h3 class="card__title">' + t('This Week', 'Cette semaine') + ' (' + t('Week', 'Semaine') + ' ' + currentWeek + ')</h3>' +
          '<div class="week-days">' + weekDaysHtml + '</div>' +
          '<a href="#/curriculum/' + currentWeek + '" class="btn btn--sm btn--secondary mt-2">' + t('View Week', 'Voir la semaine') + '</a>' +
        '</div>' +
      '</div>';

    // Attach event listeners
    attachEvents(currentWeek, currentDay);
  }

  function attachEvents(currentWeek, currentDay) {
    var startBtn = document.getElementById('start-day-btn');
    if (startBtn) {
      startBtn.addEventListener('click', function() {
        window.location.hash = '#/curriculum/' + currentWeek + '/' + currentDay;
      });
    }

    var completeBtn = document.getElementById('complete-day-btn');
    if (completeBtn) {
      completeBtn.addEventListener('click', function() {
        completeBtn.disabled = true;
        completeBtn.textContent = '...';
        window.API.post('/curriculum/day/' + currentWeek + '/' + currentDay + '/complete', {})
          .then(function() {
            // Reload dashboard to show updated state
            render();
          })
          .catch(function(err) {
            alert(t('Failed to mark day complete', 'Erreur lors du marquage') + ': ' + (err.message || ''));
            completeBtn.disabled = false;
            completeBtn.textContent = t('Mark Day Complete ✓', 'Marquer terminé ✓');
          });
      });
    }
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

  function getActivityRoute(type, exerciseId) {
    if (!exerciseId) return '';
    var level = 'beginner';
    switch (type) {
      case 'vocabulary': return '#/vocab/' + level + '/' + exerciseId;
      case 'reading': return '#/reading/' + level + '/' + exerciseId;
      case 'listening': return '#/listening/' + level + '/' + exerciseId;
      case 'dictation': return '#/dictation/' + level + '/' + exerciseId;
      default: return '';
    }
  }

  function escapeHtml(str) {
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(str || ''));
    return div.innerHTML;
  }

  window.Router.registerRoute('/dashboard', render);
  window.Router.registerRoute('/', render);
})();
