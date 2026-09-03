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
    var lang = window.App.getLanguage();
    if (lang === 'fr') return fr || en;
    if (lang === 'en') return en;
    // For other languages, try i18n key lookup by matching the English text
    // This is a bridge: pages still call t('English','French') but we check i18n for other languages
    if (window.i18n) {
      var allKeys = window.i18n.getAll(lang);
      // Search for a key whose English value matches
      var enAll = window.i18n.getAll('en');
      for (var key in enAll) {
        if (enAll[key] === en && allKeys[key]) return allKeys[key];
      }
    }
    return en; // fallback to English
  }

  // Which view of the dashboard to render: 'home' | 'plan' | 'explore'
  var currentView = 'home';

  function render() {
    var app = document.getElementById('app');
    app.innerHTML = renderNav('dashboard') +
      '<div class="page page--dashboard">' +
        '<div class="dashboard__loading">' + t('Loading dashboard...', 'Chargement du tableau de bord...') + '</div>' +
      '</div>';
    loadData();
  }

  // Route handlers set the view, then load + render — but only after the
  // entitlement guard confirms the learner has paid access. Non-subscribers
  // are routed to the course landing/paywall.
  function guarded(view) {
    return function() {
      if (window.EntitlementGuard && window.EntitlementGuard.require) {
        window.EntitlementGuard.require('japanese-beginner').then(function(ok) {
          if (ok) { currentView = view; render(); }
        });
      } else {
        currentView = view; render();
      }
    };
  }
  function renderHome() { guarded('home')(); }
  function renderPlan() { guarded('plan')(); }
  function renderExplore() { guarded('explore')(); }

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

    var currentWeek = (progress && progress.currentWeek) || 1;
    var currentDay = (progress && progress.currentDay) || 1;
    var percentComplete = (progress && progress.percentComplete) || 0;
    var totalWeeks = (progress && progress.totalWeeks) || 52;

    var programTitle = progress && progress.title;
    var programDesc = progress && progress.description;
    if (lang === 'fr') {
      programTitle = (progress && progress.titleFr) || programTitle;
      programDesc = (progress && progress.descriptionFr) || programDesc;
    } else if (lang !== 'en') {
      // For other languages (pt, etc.), use i18n key lookup
      programTitle = window.i18n('general.programTitle');
      programDesc = window.i18n('general.programDesc');
    }

    // Today's data
    var todayTitle = today ? today.title : '';
    var todayTheme = today ? today.theme : '';
    if (lang === 'fr' && today) {
      todayTitle = today.titleFr || todayTitle;
      todayTheme = today.themeFr || todayTheme;
    } else if (lang === 'pt' && today) {
      todayTitle = today.titlePt || todayTitle;
      todayTheme = today.themePt || todayTheme;
    }
    var activities = (today && today.activities) || [];

    // Progress bar
    var barWidth = Math.min(100, percentComplete);
    var progressBar = '<div class="progress-bar"><div class="progress-bar__fill" style="width:' + barWidth + '%"></div></div>';

    // First not-yet-completed activity; later ones stay locked until it's done.
    var firstIncomplete = -1;
    for (var fi = 0; fi < activities.length; fi++) {
      if (!activities[fi].completed) { firstIncomplete = fi; break; }
    }
    if (firstIncomplete === -1) firstIncomplete = activities.length;

    // Shared curriculum context for links (so lessons show Finish + return here)
    var ctxQs = 'from=curriculum&week=' + currentWeek + '&day=' + currentDay;

    // Activities list
    var activitiesHtml = activities.map(function(a, idx) {
      var actTitle = a.title || a.exerciseId || '';
      if (lang === 'fr') actTitle = a.titleFr || actTitle;
      else if (lang === 'pt') actTitle = a.titlePt || actTitle;
      var isLesson = (a.type === 'lesson' || a.type === 'deepdive') && a.route;
      var icon = isLesson ? getLessonIcon(a.route) : getActivityIcon(a.type);
      var durationStr = a.duration ? ' (' + a.duration + 'min)' : '';
      var locked = idx > firstIncomplete;
      var linkHtml = '';

      if (!locked) {
        // Active or completed (completed items remain revisitable) — build a link
        if (isLesson) {
          var sep = a.route.indexOf('?') !== -1 ? '&' : '?';
          linkHtml = ' <a href="' + a.route + sep + ctxQs + '&idx=' + idx + '" class="activity-link">' + t('Go', 'Aller') + ' →</a>';
        } else if ((a.source === 'internal' || a.type === 'internal') && a.exerciseId) {
          var actRoute = getActivityRoute(a.type, a.exerciseId);
          linkHtml = actRoute ? ' <a href="' + actRoute + '?' + ctxQs + '&idx=' + idx + '" class="activity-link">' + t('Go', 'Aller') + ' →</a>' : '';
        } else if (a.source === 'external' && a.url) {
          linkHtml = ' <a href="' + a.url + '" target="_blank" rel="noopener" class="activity-link">' + t('Open', 'Ouvrir') + ' ↗</a>';
        }
      } else if (locked) {
        linkHtml = ' <span class="today-activity__lock">' + window.i18n('curriculum.locked') + '</span>';
      }

      var statusMark = a.completed
        ? '<span class="today-activity__status today-activity__status--done">\u2713</span>'
        : '<span class="today-activity__status">\u25CB</span>';
      return '<li class="today-activity' + (a.completed ? ' today-activity--done' : '') + (locked ? ' today-activity--locked' : '') + '" data-idx="' + idx + '">' +
        statusMark +
        '<span class="today-activity__icon">' + icon + '</span>' +
        '<span class="today-activity__text">' + actTitle + durationStr + '</span>' +
        linkHtml +
      '</li>';
    }).join('');

    // Week days status
    var weekDaysHtml = '';
    if (weekData && weekData.days) {
      var dayNames = lang === 'fr' 
        ? ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']
        : lang === 'pt'
        ? ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']
        : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
      
      weekDaysHtml = weekData.days.map(function(d, i) {
        var status = d.completed ? '✓' : (d.current ? '●' : '○');
        var cls = d.completed ? 'day--done' : (d.current ? 'day--current' : (d.locked ? 'day--locked' : 'day--available'));
        var dayLabel = lang === 'fr' ? d.titleFr : (lang === 'pt' ? (d.titlePt || d.title) : d.title);
        return '<span class="week-day ' + cls + '" title="' + dayLabel + '">' + 
          dayNames[i] + ' ' + status + '</span>';
      }).join(' ');
    }

    var mode = window.App.getMode();

    // ── Reusable sections ────────────────────────────────────────────────
    var heroHtml =
      '<div class="hero">' +
        '<div class="hero__mascot">' + renderMascot() + '</div>' +
        '<div class="hero__text">' +
          '<h1 class="hero__greeting">' + window.i18n('home.greeting') + ', ' + escapeHtml(username) + '</h1>' +
          '<p class="hero__intro">' + window.i18n('home.intro') + '</p>' +
        '</div>' +
      '</div>';

    var testerHtml =
      '<div class="tester-banner">' +
        '<p>' + window.i18n('tester.message') + '</p>' +
        '<a href="https://forms.gle/36fpxtbzF25ntj6Y8" target="_blank" rel="noopener" class="btn btn--sm btn--accent">' +
          window.i18n('tester.button') +
        '</a>' +
      '</div>';

    var modeCardsHtml = renderModeCards(mode);

    var overviewHtml =
      '<div class="card card--overview">' +
        '<h2 class="card__title">' + t('Program Overview', 'Aperçu du programme') + '</h2>' +
        '<p class="card__description">' + (programTitle || t('Beginner Japanese - 1 Year Program', 'Japonais Débutant - Programme d\'un an')) + '</p>' +
        '<p class="card__detail">' + (programDesc || t(
          'Complement your 210-hour online course with daily 30-minute focused practice (182 hours/year).',
          'Complétez votre cours en ligne de 210 heures avec 30 minutes de pratique quotidienne (182 heures/an).'
        )) + '</p>' +
        '<div class="card__progress">' +
          '<span class="card__progress-text">' + t('Week', 'Semaine') + ' ' + currentWeek + ' / ' + totalWeeks +
          '  •  ' + t('Day', 'Jour') + ' ' + currentDay +
          '  •  ' + percentComplete + '% ' + t('complete', 'complété') + '</span>' +
          progressBar +
        '</div>' +
      '</div>';

    var doneCount = activities.filter(function(a) { return a.completed; }).length;
    var allComplete = (today && today.allComplete) || (activities.length > 0 && doneCount === activities.length);
    var todayHtml =
      '<div class="card card--today">' +
        '<h2 class="card__title">' + t("Today's Plan", "Plan du jour") + '</h2>' +
        '<p class="card__subtitle">' + t('Week', 'Semaine') + ' ' + currentWeek + ', ' + t('Day', 'Jour') + ' ' + currentDay + ': ' + todayTitle + '</p>' +
        (todayTheme ? '<p class="card__theme">' + todayTheme + '</p>' : '') +
        '<ul class="today-activities">' + activitiesHtml + '</ul>' +
        '<div class="today-progress">' +
          '<div class="progress-bar"><div class="progress-bar__fill" style="width:' + Math.round((doneCount / Math.max(1, activities.length)) * 100) + '%"></div></div>' +
          '<span class="today-progress__text">' + doneCount + ' / ' + activities.length + ' ' + t('completed', 'terminé(s)') + '</span>' +
        '</div>' +
        '<div class="card__actions">' +
          '<button id="start-day-btn" class="btn btn--primary">' + t('Start Day →', 'Commencer →') + '</button>' +
          '<button id="complete-day-btn" class="btn btn--success"' + (allComplete ? '' : ' disabled') + '>' + t('Mark Day Complete', 'Marquer le jour terminé') + '</button>' +
        '</div>' +
        (allComplete ? '' : '<p class="card__hint text-secondary text-sm">' + t('Finish every activity to complete the day.', 'Terminez toutes les activités pour compléter le jour.') + '</p>') +
      '</div>';

    var quickLinksHtml =
      '<div class="card card--links">' +
        '<h3 class="card__title">' + t('Quick Links', 'Liens rapides') + '</h3>' +
        '<ul class="quick-links">' +
          '<li><a href="#/kana/hiragana">あ ' + window.i18n('kana.hiragana') + '</a></li>' +
          '<li><a href="#/kana/katakana">ア ' + window.i18n('kana.katakana') + '</a></li>' +
          '<li><a href="#/kana/kanji">漢 ' + window.i18n('kana.kanji') + '</a></li>' +
          '<li><a href="#/level/beginner/reading">' + t('Reading', 'Lecture') + '</a></li>' +
          '<li><a href="#/level/beginner/vocabulary">' + t('Vocabulary', 'Vocabulaire') + '</a></li>' +
          '<li><a href="#/level/beginner/listening">' + t('Listening', 'Écoute') + '</a></li>' +
          '<li><a href="#/level/beginner/dictation">' + t('Dictation', 'Dictée') + '</a></li>' +
          '<li><a href="#/curriculum">' + t('Full Curriculum', 'Programme complet') + '</a></li>' +
        '</ul>' +
      '</div>';

    var thisWeekHtml =
      '<div class="card card--week">' +
        '<h3 class="card__title">' + t('This Week', 'Cette semaine') + ' (' + t('Week', 'Semaine') + ' ' + currentWeek + ')</h3>' +
        '<div class="week-days">' + weekDaysHtml + '</div>' +
        '<a href="#/curriculum/' + currentWeek + '" class="btn btn--sm btn--secondary mt-2">' + t('View Week', 'Voir la semaine') + '</a>' +
      '</div>';

    // ── View-based rendering ─────────────────────────────────────────────
    // HOME  : tester banner + welcome hero + mode choices ONLY.
    // PLAN  : the guided interface (overview + today's plan + this week).
    // EXPLORE: the open exploration grid.
    // The learner only sees an interface after choosing a mode on the home.
    var modeSwitchHtml =
      '<div class="mode-switch">' +
        '<a href="#/dashboard" class="btn btn--sm btn--secondary">\u2039 ' + window.i18n('home.change') + '</a>' +
        '<span class="mode-switch__label">' +
          (currentView === 'explore' ? window.i18n('home.exploreTitle') : window.i18n('home.guidedTitle')) +
        '</span>' +
      '</div>';

    if (currentView === 'plan') {
      page.innerHTML = modeSwitchHtml + '<div id="gamify-chip"></div>' + overviewHtml + todayHtml +
        '<div class="dashboard__grid">' + thisWeekHtml + '</div>';
      attachGamifyChip();
    } else if (currentView === 'explore') {
      page.innerHTML = modeSwitchHtml + renderExploreGrid() +
        '<div class="dashboard__grid">' + overviewHtml + thisWeekHtml + '</div>';
    } else {
      // home
      page.innerHTML = testerHtml + '<div id="audio-notice"></div>' + heroHtml + modeCardsHtml;
      attachAudioNotice();
    }

    // Attach event listeners (only relevant in plan view)
    attachEvents(currentWeek, currentDay);
  }

  /**
   * Compact streak + XP chip shown at the top of the guided plan view.
   * Links to the full progress page.
   */
  function attachGamifyChip() {
    var slot = document.getElementById('gamify-chip');
    if (!slot) return;
    window.API.get('/progress').then(function(p) {
      var streak = p.streak || 0;
      var xpLevel = p.xpLevel || 1;
      var xp = p.xp || 0;
      slot.innerHTML =
        '<a href="#/progress" class="gamify-chip">' +
          '<span class="gamify-chip__item"><span class="gamify-chip__mark">\u708e</span>' + streak + ' ' + window.i18n('gamify.streakDays') + '</span>' +
          '<span class="gamify-chip__item">' + window.i18n('gamify.level') + ' ' + xpLevel + '</span>' +
          '<span class="gamify-chip__item">' + xp + ' ' + window.i18n('gamify.xp') + '</span>' +
        '</a>';
    }).catch(function() { /* non-critical */ });
  }

  /**
   * Inject a dismissible banner when no Japanese TTS voice is available,
   * so learners know how to enable pronunciation on their device.
   * Status is resolved asynchronously via TTS.onReady.
   */
  function attachAudioNotice() {
    if (!window.TTS || typeof window.TTS.onReady !== 'function') return;
    var DISMISS_KEY = 'jls-audio-dismissed';
    try { if (localStorage.getItem(DISMISS_KEY) === '1') return; } catch (e) {}

    window.TTS.onReady(function(status) {
      if (status === 'ok') return; // Japanese voice available, nothing to warn about
      var slot = document.getElementById('audio-notice');
      if (!slot) return;
      var help = status === 'unsupported'
        ? window.i18n('audio.unsupportedHelp')
        : window.i18n('audio.noVoiceHelp');
      slot.innerHTML =
        '<div class="audio-notice" role="status">' +
          '<span class="audio-notice__icon" aria-hidden="true">\u266A</span>' +
          '<div class="audio-notice__body">' +
            '<strong class="audio-notice__title">' + window.i18n('audio.noVoiceTitle') + '</strong>' +
            '<p class="audio-notice__help">' + help + '</p>' +
          '</div>' +
          '<button type="button" class="audio-notice__dismiss" id="audio-notice-dismiss">' +
            window.i18n('audio.dismiss') +
          '</button>' +
        '</div>';
      var btn = document.getElementById('audio-notice-dismiss');
      if (btn) {
        btn.addEventListener('click', function() {
          try { localStorage.setItem(DISMISS_KEY, '1'); } catch (e) {}
          slot.innerHTML = '';
        });
      }
    });
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
            if (window.Feedback) window.Feedback.celebrate();
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
      case 'vocabulary': return '語';
      case 'reading': return '読';
      case 'listening': return '聞';
      case 'dictation': return '書';
      case 'writing': return '書';
      default: return '本';
    }
  }

  /**
   * Inline animated teacher mascot (SVG + CSS animation, fully offline).
   */
  function renderMascot() {
    return '' +
      '<svg viewBox="0 0 170 150" class="mascot__svg" role="img" aria-label="teacher">' +
        '<g class="mascot__bob">' +
          // speech bubble
          '<g class="mascot__bubble">' +
            '<rect x="104" y="6" width="60" height="34" rx="11" class="mascot__bubble-bg"/>' +
            '<path d="M116 40 l-6 13 l17 -9 Z" class="mascot__bubble-bg"/>' +
            '<text x="134" y="28" text-anchor="middle" class="mascot__bubble-text">こんにちは</text>' +
          '</g>' +
          // body
          '<path d="M38 150 Q38 106 72 102 Q106 106 106 150 Z" class="mascot__body"/>' +
          // head
          '<circle cx="72" cy="70" r="31" class="mascot__skin"/>' +
          // hair
          '<path d="M40 66 Q42 36 72 36 Q102 36 104 66 Q95 52 72 52 Q49 52 40 66 Z" class="mascot__hair"/>' +
          // graduation cap
          '<g class="mascot__cap">' +
            '<path d="M44 46 L72 34 L100 46 L72 58 Z" class="mascot__cap-fill"/>' +
            '<path d="M96 48 L96 60" class="mascot__cap-line"/>' +
            '<circle cx="96" cy="61" r="2.6" class="mascot__cap-fill"/>' +
          '</g>' +
          // eyes
          '<circle cx="62" cy="72" r="3.4" class="mascot__face"/>' +
          '<circle cx="82" cy="72" r="3.4" class="mascot__face"/>' +
          // smile
          '<path d="M61 83 Q72 92 83 83" class="mascot__smile"/>' +
          // waving arm
          '<g class="mascot__wave">' +
            '<rect x="98" y="104" width="30" height="10" rx="5" class="mascot__body"/>' +
            '<circle cx="130" cy="102" r="7" class="mascot__skin"/>' +
          '</g>' +
        '</g>' +
      '</svg>';
  }

  /**
   * The two learning-mode selection cards.
   */
  function renderModeCards(mode) {
    function card(key, title, desc) {
      var active = mode === key;
      var icon = (window.Icons && window.Icons[key]) ? window.Icons[key]() : '';
      return '<button type="button" class="mode-card' + (active ? ' mode-card--active' : '') + '" onclick="window.App.selectMode(\'' + key + '\')">' +
        (active ? '<span class="mode-card__badge">' + window.i18n('home.active') + '</span>' : '') +
        '<span class="mode-card__label">' + icon + '</span>' +
        '<h3 class="mode-card__title">' + title + '</h3>' +
        '<p class="mode-card__desc">' + desc + '</p>' +
        '<span class="mode-card__cta">' + (active ? window.i18n('home.active') : window.i18n('home.choose')) + '</span>' +
      '</button>';
    }
    return '<div class="mode-select">' +
      '<h2 class="mode-select__title">' + window.i18n('home.chooseMode') + '</h2>' +
      '<p class="mode-select__hint">' + window.i18n('home.chooseHint') + '</p>' +
      '<div class="mode-select__cards">' +
        card('guided', window.i18n('home.guidedTitle'), window.i18n('home.guidedDesc')) +
        card('explore', window.i18n('home.exploreTitle'), window.i18n('home.exploreDesc')) +
      '</div>' +
    '</div>';
  }

  /**
   * Free-exploration grid of all learning areas.
   */
  function renderExploreGrid() {
    var tiles = [
      { href: '#/kana/hiragana', mark: 'あ', label: window.i18n('kana.hiragana') },
      { href: '#/kana/katakana', mark: 'ア', label: window.i18n('kana.katakana') },
      { href: '#/kana/kanji', mark: '漢', label: window.i18n('kana.kanji') },
      { href: '#/level/beginner/vocabulary', mark: '語', label: t('Vocabulary', 'Vocabulaire') },
      { href: '#/level/beginner/reading', mark: '読', label: t('Reading', 'Lecture') },
      { href: '#/level/beginner/listening', mark: '聞', label: t('Listening', 'Écoute') },
      { href: '#/level/beginner/dictation', mark: '書', label: t('Dictation', 'Dictée') },
      { href: '#/guide/numbers', mark: '数', label: t('Numbers & Counters', 'Nombres & compteurs') },
      { href: '#/drill/sentence-basic', mark: '組', label: t('Sentence Drills', 'Exercices de phrases') },
      { href: '#/review', mark: '復', label: window.i18n('review.title') },
      { href: '#/shadow/greetings', mark: '声', label: window.i18n('shadow.title') },
      { href: '#/exam/placement', mark: '級', label: window.i18n('exam.placement') },
      { href: '#/exam/n5-mock', mark: '試', label: window.i18n('exam.mock') },
      { href: '#/curriculum', mark: '暦', label: t('Full Curriculum', 'Programme complet') }
    ];
    return '<div class="card card--explore">' +
      '<h2 class="card__title">' + window.i18n('home.exploreHeading') + '</h2>' +
      '<p class="card__subtitle">' + window.i18n('home.exploreSub') + '</p>' +
      '<div class="explore-grid">' +
        tiles.map(function(tl) {
          return '<a href="' + tl.href + '" class="explore-tile">' +
            '<span class="explore-tile__mark">' + tl.mark + '</span>' +
            '<span class="explore-tile__label">' + tl.label + '</span>' +
          '</a>';
        }).join('') +
      '</div>' +
    '</div>';
  }

  function getLessonIcon(route) {
    if (!route) return '本';
    if (route.indexOf('/grammar/') !== -1) return '文';
    if (route.indexOf('/deepdive/') !== -1) return '深';
    if (route.indexOf('/guide/') !== -1) return '数';
    if (route.indexOf('/drill/') !== -1) return '組';
    if (route.indexOf('/shadow/') !== -1) return '声';
    if (route.indexOf('/review') !== -1) return '復';
    if (route.indexOf('/exam/') !== -1) return '試';
    if (route.indexOf('/kana/') !== -1) return '字';
    return '本';
  }

  function getActivityRoute(type, exerciseId) {
    if (!exerciseId) return '';
    var level = 'beginner';
    // Curriculum exercises use type 'internal' — derive real type from the ID prefix
    var effectiveType = type;
    if (type === 'internal' || !type) {
      var p = exerciseId.charAt(0);
      effectiveType = p === 'v' ? 'vocabulary' : p === 'r' ? 'reading' : p === 'l' ? 'listening' : p === 'd' ? 'dictation' : '';
    }
    switch (effectiveType) {
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

  window.Router.registerRoute('/dashboard', renderHome);
  window.Router.registerRoute('/', renderHome);
  window.Router.registerRoute('/plan', renderPlan);
  window.Router.registerRoute('/explore', renderExplore);
})();
