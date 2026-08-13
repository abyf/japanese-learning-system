(function() {
  'use strict';

  var translations = {
    en: {
      // Navigation
      'nav.dashboard': 'Dashboard',
      'nav.curriculum': 'Curriculum',
      'nav.progress': 'Progress',
      'nav.settings': 'Settings',
      
      // Dashboard
      'dashboard.welcome': 'Welcome, ',
      'dashboard.programOverview': 'Program Overview',
      'dashboard.todaysPlan': "Today's Plan",
      'dashboard.quickLinks': 'Quick Links',
      'dashboard.thisWeek': 'This Week',
      'dashboard.week': 'Week',
      'dashboard.day': 'Day',
      'dashboard.complete': 'complete',
      'dashboard.startDay': 'Start Day \u2192',
      'dashboard.markComplete': 'Mark Day Complete \u2713',
      
      // Activities
      'activity.reading': 'Reading',
      'activity.vocabulary': 'Vocabulary',
      'activity.listening': 'Listening',
      'activity.dictation': 'Dictation',
      'activity.start': 'Start Exercise',
      'activity.openResource': 'Open Resource \u2197',
      'activity.markDone': 'Mark as Done',
      'activity.done': 'Done',
      'activity.reviewAgain': 'Review Again',
      'activity.back': '\u2190 Back',
      'activity.backToCurriculum': 'Back to Curriculum',
      'activity.submit': 'Submit Answers',
      'activity.retry': 'Retry',
      'activity.nextExercise': 'Next Exercise \u2192',
      
      // Results
      'result.completed': 'Exercise Completed!',
      'result.notQuite': 'Not quite \u2014 try again to complete this exercise',
      'result.score': 'Score',
      'result.correct': 'correct',
      'result.accuracy': 'Accuracy',
      
      // Curriculum
      'curriculum.title': 'Curriculum',
      'curriculum.program': 'Beginner Japanese - 52 Week Program',
      'curriculum.daysCompleted': 'days completed',
      'curriculum.viewDay': 'View Day',
      'curriculum.activities': 'Activities',
      'curriculum.minutesTotal': 'minutes total',
      'curriculum.review': 'Review',
      'curriculum.completed': 'Completed',
      'curriculum.ext': 'ext',
      
      // Reading
      'reading.furiganaOn': 'Furigana: ON',
      'reading.furiganaOff': 'Furigana: OFF',
      'reading.meaningOn': 'Meaning: ON',
      'reading.meaningOff': 'Meaning: OFF',
      'reading.comprehension': 'Comprehension Questions',
      
      // Settings
      'settings.title': 'Settings',
      'settings.language': 'Interface Language',
      'settings.theme': 'Dark Theme',
      'settings.toggleTheme': 'Toggle Theme',
      'settings.cardsPerDay': 'New Cards Per Day',
      'settings.sessionDuration': 'Session Duration (minutes)',
      'settings.furigana': 'Show Furigana by Default',
      'settings.save': 'Save Settings',
      'settings.export': 'Export Data (JSON)',
      'settings.import': 'Import Data (JSON)',
      'settings.logout': 'Logout',
      
      // Tester banner
      'tester.message': 'Thank you for testing this Japanese learning system for beginners! Please spend at least 15 minutes exploring the app, then share your feedback:',
      'tester.button': 'Give Feedback \u2197',
      
      // Dictation
      'dictation.typeHear': 'Type what you hear:',
      'dictation.comparison': 'Character Comparison',
      'dictation.expected': 'Expected Text',
      
      // Progress
      'progress.title': 'Progress & Statistics',
      'progress.completion': 'Completion by Level & Activity',
      'progress.accuracy': 'Accuracy',
      'progress.studyTime': 'Study Time',
      'progress.streak': 'Streak',
      'progress.today': 'Today',
      'progress.thisWeek': 'This Week',
      'progress.thisMonth': 'This Month',
      'progress.days': 'days',
      
      // Auth
      'auth.login': 'Login',
      'auth.register': 'Register',
      'auth.username': 'Username',
      'auth.email': 'Email',
      'auth.password': 'Password',
      'auth.confirmPassword': 'Confirm Password',
      'auth.minChars': 'Minimum 4 characters',
      'auth.noAccount': "Don't have an account?",
      'auth.hasAccount': 'Already have an account?',
      'auth.invalidCredentials': 'Invalid username or password',
      
      // General
      'general.loading': 'Loading...',
      'general.error': 'Error',
      'general.fullCurriculum': 'Full Curriculum',
      'general.external': 'External',
      'general.go': 'Go',
      'general.open': 'Open',
      'general.viewWeek': 'View Week',
      'general.loadingDashboard': 'Loading dashboard...',
      'general.programDesc': 'Complement your 210-hour online course with daily 30-minute focused practice (182 hours/year).',
      'general.programTitle': 'Beginner Japanese - 1 Year Program',
      'general.failedLoad': 'Failed to load dashboard: ',
      'general.failedMark': 'Failed to mark day complete',
      
      // Curriculum extra
      'curriculum.backToWeek': 'Back to Week',
      'curriculum.reviewDay': 'Review Day',
      'curriculum.markDayComplete': '\u2713 Mark Day as Complete',
      'curriculum.loadingCurriculum': 'Loading curriculum...',
      'curriculum.failedLoad': 'Failed to load curriculum',
      'curriculum.dayNotFound': 'Day not found',
      'curriculum.failedLoadWeek': 'Failed to load week data'
    },
    
    fr: {
      'nav.dashboard': 'Tableau de bord',
      'nav.curriculum': 'Programme',
      'nav.progress': 'Progr\u00e8s',
      'nav.settings': 'Param\u00e8tres',
      'dashboard.welcome': 'Bienvenue, ',
      'dashboard.programOverview': 'Aper\u00e7u du programme',
      'dashboard.todaysPlan': 'Plan du jour',
      'dashboard.quickLinks': 'Liens rapides',
      'dashboard.thisWeek': 'Cette semaine',
      'dashboard.week': 'Semaine',
      'dashboard.day': 'Jour',
      'dashboard.complete': 'compl\u00e9t\u00e9',
      'dashboard.startDay': 'Commencer \u2192',
      'dashboard.markComplete': 'Marquer termin\u00e9 \u2713',
      'activity.reading': 'Lecture',
      'activity.vocabulary': 'Vocabulaire',
      'activity.listening': '\u00c9coute',
      'activity.dictation': 'Dict\u00e9e',
      'activity.start': 'Commencer',
      'activity.openResource': 'Ouvrir \u2197',
      'activity.markDone': 'Marquer fait',
      'activity.done': 'Fait',
      'activity.reviewAgain': 'Revoir',
      'activity.back': '\u2190 Retour',
      'activity.backToCurriculum': 'Retour au programme',
      'activity.submit': 'Soumettre',
      'activity.retry': 'R\u00e9essayer',
      'activity.nextExercise': 'Exercice suivant \u2192',
      'result.completed': 'Exercice termin\u00e9 !',
      'result.notQuite': 'Pas tout \u00e0 fait \u2014 r\u00e9essayez pour compl\u00e9ter cet exercice',
      'result.score': 'Score',
      'result.correct': 'correct',
      'result.accuracy': 'Pr\u00e9cision',
      'curriculum.title': 'Programme',
      'curriculum.program': 'Japonais D\u00e9butant - Programme de 52 semaines',
      'curriculum.daysCompleted': 'jours compl\u00e9t\u00e9s',
      'curriculum.viewDay': 'Voir le jour',
      'curriculum.activities': 'Activit\u00e9s',
      'curriculum.minutesTotal': 'minutes au total',
      'curriculum.review': 'R\u00e9vision',
      'curriculum.completed': 'Termin\u00e9',
      'curriculum.ext': 'ext',
      'reading.furiganaOn': 'Furigana : OUI',
      'reading.furiganaOff': 'Furigana : NON',
      'reading.meaningOn': 'Sens : OUI',
      'reading.meaningOff': 'Sens : NON',
      'reading.comprehension': 'Questions de compr\u00e9hension',
      'settings.title': 'Param\u00e8tres',
      'settings.language': "Langue de l'interface",
      'settings.theme': 'Th\u00e8me sombre',
      'settings.toggleTheme': 'Changer de th\u00e8me',
      'settings.cardsPerDay': 'Nouvelles cartes par jour',
      'settings.sessionDuration': 'Dur\u00e9e de session (minutes)',
      'settings.furigana': 'Afficher furigana par d\u00e9faut',
      'settings.save': 'Enregistrer',
      'settings.export': 'Exporter (JSON)',
      'settings.import': 'Importer (JSON)',
      'settings.logout': 'D\u00e9connexion',
      'tester.message': "Merci de tester ce syst\u00e8me d'apprentissage du japonais pour d\u00e9butants ! Veuillez passer au moins 15 minutes \u00e0 explorer l'application, puis partagez vos retours :",
      'tester.button': 'Donner un retour \u2197',
      'dictation.typeHear': '\u00c9crivez ce que vous entendez :',
      'dictation.comparison': 'Comparaison des caract\u00e8res',
      'dictation.expected': 'Texte attendu',
      'progress.title': 'Progr\u00e8s et statistiques',
      'progress.completion': 'Compl\u00e9tion par niveau et activit\u00e9',
      'progress.accuracy': 'Pr\u00e9cision',
      'progress.studyTime': "Temps d'\u00e9tude",
      'progress.streak': 'S\u00e9rie',
      'progress.today': "Aujourd'hui",
      'progress.thisWeek': 'Cette semaine',
      'progress.thisMonth': 'Ce mois',
      'progress.days': 'jours',
      'auth.login': 'Connexion',
      'auth.register': 'Inscription',
      'auth.username': "Nom d'utilisateur",
      'auth.email': 'E-mail',
      'auth.password': 'Mot de passe',
      'auth.confirmPassword': 'Confirmer le mot de passe',
      'auth.minChars': 'Minimum 4 caract\u00e8res',
      'auth.noAccount': 'Pas de compte ?',
      'auth.hasAccount': 'D\u00e9j\u00e0 un compte ?',
      'auth.invalidCredentials': "Nom d'utilisateur ou mot de passe invalide",
      'general.loading': 'Chargement...',
      'general.error': 'Erreur',
      'general.fullCurriculum': 'Programme complet',
      'general.external': 'Externe',
      'general.go': 'Aller',
      'general.open': 'Ouvrir',
      'general.viewWeek': 'Voir la semaine',
      'general.loadingDashboard': 'Chargement du tableau de bord...',
      'general.programDesc': "Complétez votre cours en ligne de 210 heures avec une pratique quotidienne de 30 minutes (182 heures/an).",
      'general.programTitle': "Japonais Débutant - Programme d'un an",
      'general.failedLoad': 'Erreur de chargement : ',
      'general.failedMark': 'Erreur lors du marquage',
      'curriculum.backToWeek': 'Retour \u00e0 la semaine',
      'curriculum.reviewDay': 'Jour de r\u00e9vision',
      'curriculum.markDayComplete': '\u2713 Marquer le jour termin\u00e9',
      'curriculum.loadingCurriculum': 'Chargement...',
      'curriculum.failedLoad': 'Erreur de chargement',
      'curriculum.failedLoadWeek': 'Erreur de chargement',
      'curriculum.dayNotFound': 'Jour non trouv\u00e9'
    },
    
    pt: {
      'nav.dashboard': 'Painel',
      'nav.curriculum': 'Curr\u00edculo',
      'nav.progress': 'Progresso',
      'nav.settings': 'Configura\u00e7\u00f5es',
      'dashboard.welcome': 'Bem-vindo(a), ',
      'dashboard.programOverview': 'Vis\u00e3o geral do programa',
      'dashboard.todaysPlan': 'Plano de hoje',
      'dashboard.quickLinks': 'Links r\u00e1pidos',
      'dashboard.thisWeek': 'Esta semana',
      'dashboard.week': 'Semana',
      'dashboard.day': 'Dia',
      'dashboard.complete': 'conclu\u00eddo',
      'dashboard.startDay': 'Iniciar dia \u2192',
      'dashboard.markComplete': 'Marcar como conclu\u00eddo \u2713',
      'activity.reading': 'Leitura',
      'activity.vocabulary': 'Vocabul\u00e1rio',
      'activity.listening': 'Compreens\u00e3o auditiva',
      'activity.dictation': 'Ditado',
      'activity.start': 'Iniciar exerc\u00edcio',
      'activity.openResource': 'Abrir recurso \u2197',
      'activity.markDone': 'Marcar como feito',
      'activity.done': 'Feito',
      'activity.reviewAgain': 'Revisar',
      'activity.back': '\u2190 Voltar',
      'activity.backToCurriculum': 'Voltar ao curr\u00edculo',
      'activity.submit': 'Enviar respostas',
      'activity.retry': 'Tentar novamente',
      'activity.nextExercise': 'Pr\u00f3ximo exerc\u00edcio \u2192',
      'result.completed': 'Exerc\u00edcio conclu\u00eddo!',
      'result.notQuite': 'Quase l\u00e1 \u2014 tente novamente para completar este exerc\u00edcio',
      'result.score': 'Pontua\u00e7\u00e3o',
      'result.correct': 'correto',
      'result.accuracy': 'Precis\u00e3o',
      'curriculum.title': 'Curr\u00edculo',
      'curriculum.program': 'Japon\u00eas para Iniciantes - Programa de 52 semanas',
      'curriculum.daysCompleted': 'dias conclu\u00eddos',
      'curriculum.viewDay': 'Ver dia',
      'curriculum.activities': 'Atividades',
      'curriculum.minutesTotal': 'minutos no total',
      'curriculum.review': 'Revis\u00e3o',
      'curriculum.completed': 'Conclu\u00eddo',
      'curriculum.ext': 'ext',
      'reading.furiganaOn': 'Furigana: LIGADO',
      'reading.furiganaOff': 'Furigana: DESLIGADO',
      'reading.meaningOn': 'Significado: LIGADO',
      'reading.meaningOff': 'Significado: DESLIGADO',
      'reading.comprehension': 'Quest\u00f5es de compreens\u00e3o',
      'settings.title': 'Configura\u00e7\u00f5es',
      'settings.language': 'Idioma da interface',
      'settings.theme': 'Tema escuro',
      'settings.toggleTheme': 'Alternar tema',
      'settings.cardsPerDay': 'Novas cartas por dia',
      'settings.sessionDuration': 'Dura\u00e7\u00e3o da sess\u00e3o (minutos)',
      'settings.furigana': 'Mostrar furigana por padr\u00e3o',
      'settings.save': 'Salvar',
      'settings.export': 'Exportar (JSON)',
      'settings.import': 'Importar (JSON)',
      'settings.logout': 'Sair',
      'tester.message': 'Obrigado por testar este sistema de aprendizado de japon\u00eas para iniciantes! Por favor, passe pelo menos 15 minutos explorando o aplicativo e depois compartilhe seu feedback:',
      'tester.button': 'Dar feedback \u2197',
      'dictation.typeHear': 'Digite o que voc\u00ea ouve:',
      'dictation.comparison': 'Compara\u00e7\u00e3o de caracteres',
      'dictation.expected': 'Texto esperado',
      'progress.title': 'Progresso e Estat\u00edsticas',
      'progress.completion': 'Conclus\u00e3o por n\u00edvel e atividade',
      'progress.accuracy': 'Precis\u00e3o',
      'progress.studyTime': 'Tempo de estudo',
      'progress.streak': 'Sequ\u00eancia',
      'progress.today': 'Hoje',
      'progress.thisWeek': 'Esta semana',
      'progress.thisMonth': 'Este m\u00eas',
      'progress.days': 'dias',
      'auth.login': 'Entrar',
      'auth.register': 'Registrar',
      'auth.username': 'Nome de usu\u00e1rio',
      'auth.email': 'E-mail',
      'auth.password': 'Senha',
      'auth.confirmPassword': 'Confirmar senha',
      'auth.minChars': 'M\u00ednimo 4 caracteres',
      'auth.noAccount': 'N\u00e3o tem uma conta?',
      'auth.hasAccount': 'J\u00e1 tem uma conta?',
      'auth.invalidCredentials': 'Nome de usu\u00e1rio ou senha inv\u00e1lidos',
      'general.loading': 'Carregando...',
      'general.error': 'Erro',
      'general.fullCurriculum': 'Curr\u00edculo completo',
      'general.external': 'Externo',
      'general.go': 'Ir',
      'general.open': 'Abrir',
      'general.viewWeek': 'Ver semana',
      'general.loadingDashboard': 'Carregando painel...',
      'general.programDesc': 'Complemente seu curso online de 210 horas com pr\u00e1tica di\u00e1ria focada de 30 minutos (182 horas/ano).',
      'general.programTitle': 'Japon\u00eas para Iniciantes - Programa de 1 Ano',
      'general.failedLoad': 'Falha ao carregar o painel: ',
      'general.failedMark': 'Falha ao marcar dia como conclu\u00eddo',
      'curriculum.backToWeek': 'Voltar \u00e0 semana',
      'curriculum.reviewDay': 'Dia de revis\u00e3o',
      'curriculum.markDayComplete': '\u2713 Marcar dia como conclu\u00eddo',
      'curriculum.loadingCurriculum': 'Carregando curr\u00edculo...',
      'curriculum.failedLoad': 'Falha ao carregar curr\u00edculo',
      'curriculum.failedLoadWeek': 'Falha ao carregar dados da semana',
      'curriculum.dayNotFound': 'Dia n\u00e3o encontrado'
    }
  };

  /**
   * Get translated string by key.
   * Falls back to English if not found in current language.
   * Also supports legacy t(en, fr) format for backward compatibility.
   */
  window.i18n = function(key) {
    var lang = window.App ? window.App.getLanguage() : (localStorage.getItem('jls-language') || 'en');
    
    // Check if it's a key-based lookup
    if (translations[lang] && translations[lang][key]) {
      return translations[lang][key];
    }
    // Fallback to English
    if (translations.en && translations.en[key]) {
      return translations.en[key];
    }
    // Return key itself as last resort
    return key;
  };

  /**
   * Get all supported languages.
   */
  window.i18n.languages = [
    { code: 'en', name: 'English', flag: '\ud83c\uddec\ud83c\udde7' },
    { code: 'fr', name: 'Fran\u00e7ais', flag: '\ud83c\uddeb\ud83c\uddf7' },
    { code: 'pt', name: 'Portugu\u00eas', flag: '\ud83c\udde7\ud83c\uddf7' }
  ];

  /**
   * Get translations object for a language (for content that needs it).
   */
  window.i18n.getAll = function(lang) {
    return translations[lang] || translations.en;
  };

})();
