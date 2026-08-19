/**
 * Japanese Learning System - Achievements Catalog (frontend)
 *
 * Trilingual names/descriptions and emoji-free Japanese-mark icons for each
 * achievement key defined in modules/achievements.js. The backend stores only
 * the achievement_key; this catalog supplies presentation for all three
 * interface languages (en/fr/pt).
 */
(function() {
  'use strict';

  var DEFS = [
    { key: 'streak_7',      mark: '7',   en: '7-Day Streak',        fr: 'S\u00e9rie de 7 jours',        pt: 'Sequ\u00eancia de 7 dias' },
    { key: 'streak_30',     mark: '30',  en: '30-Day Streak',       fr: 'S\u00e9rie de 30 jours',       pt: 'Sequ\u00eancia de 30 dias' },
    { key: 'streak_100',    mark: '100', en: '100-Day Streak',      fr: 'S\u00e9rie de 100 jours',      pt: 'Sequ\u00eancia de 100 dias' },
    { key: 'cards_100',     mark: '\u8a9e', en: 'Century Club',     fr: 'Club des 100',                 pt: 'Clube dos 100' },
    { key: 'cards_500',     mark: '\u6975', en: 'Word Wizard',      fr: 'Ma\u00eetre des mots',         pt: 'Mestre das palavras' },
    { key: 'level_beginner',    mark: '\u521d', en: 'Beginner Complete',     fr: 'D\u00e9butant termin\u00e9',      pt: 'Iniciante conclu\u00eddo' },
    { key: 'level_intermediate', mark: '\u4e2d', en: 'Intermediate Complete', fr: 'Interm\u00e9diaire termin\u00e9', pt: 'Intermedi\u00e1rio conclu\u00eddo' },
    { key: 'level_advanced',    mark: '\u5352', en: 'Master Scholar',        fr: '\u00c9rudit accompli',           pt: 'Erudito mestre' },
    { key: 'perfect_reading',   mark: '\u8aad', en: 'Perfect Reader',   fr: 'Lecteur parfait',      pt: 'Leitor perfeito' },
    { key: 'perfect_listening', mark: '\u805e', en: 'Perfect Listener', fr: '\u00c9coute parfaite', pt: 'Ouvinte perfeito' },
    { key: 'perfect_dictation', mark: '\u66f8', en: 'Perfect Scribe',   fr: 'Scribe parfait',       pt: 'Escriba perfeito' },
    { key: 'first_review',  mark: '\u6b69', en: 'First Steps',      fr: 'Premiers pas',         pt: 'Primeiros passos' },
    { key: 'reviews_1000',  mark: '\u5343', en: 'Review Master',    fr: 'Ma\u00eetre des r\u00e9visions', pt: 'Mestre das revis\u00f5es' },
    { key: 'first_export',  mark: '\u4fdd', en: 'Data Guardian',    fr: 'Gardien des donn\u00e9es', pt: 'Guardi\u00e3o dos dados' },
    { key: 'all_activities', mark: '\u5168', en: 'Well-Rounded',    fr: 'Polyvalent',           pt: 'Completo' },
    { key: 'study_10_hours', mark: '\u6642', en: 'Dedicated Student', fr: '\u00c9tudiant assidu', pt: 'Estudante dedicado' }
  ];

  var byKey = {};
  DEFS.forEach(function(d) { byKey[d.key] = d; });

  function nameFor(key, lang) {
    var d = byKey[key];
    if (!d) return key;
    return d[lang] || d.en;
  }

  function markFor(key) {
    var d = byKey[key];
    return d ? d.mark : '\u2606';
  }

  window.AchievementsCatalog = {
    all: DEFS,
    nameFor: nameFor,
    markFor: markFor
  };
})();
