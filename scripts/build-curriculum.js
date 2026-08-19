/**
 * Curriculum Generator
 * ---------------------
 * Produces content/curriculum/beginner-curriculum.json following the pattern:
 *   Foundation weeks (1-3): Hiragana, Katakana, Basic Kanji  (in-app modules)
 *   Content weeks (4-52):
 *     Day 1: Vocabulary + Reading + Grammar + Dictation (new)
 *     Day 2: Review of Day 1
 *     Day 3: Vocabulary + Reading + Grammar + Dictation (new)
 *     Day 4: Review of Day 3
 *     Day 5: Deep Dive A (onomatopoeia/collocations/idioms, tied to Day 1)
 *     Day 6: Deep Dive B (tied to Day 3)
 *     Day 7: Weekly test (review of the week)
 * Each day targets ~30-45 minutes. Each week ends with "further reading" resources.
 *
 * Run:  node scripts/build-curriculum.js
 */
const fs = require('fs');
const path = require('path');

const CONTENT = path.join(__dirname, '..', 'content');
const deepdive = JSON.parse(fs.readFileSync(path.join(CONTENT, 'deepdive', 'beginner.json'), 'utf8'));
const deepTopicIds = Object.keys(deepdive.topics);
const grammarList = JSON.parse(fs.readFileSync(path.join(CONTENT, 'grammar', 'beginner.json'), 'utf8'));
function grammarTitleOf(id) {
  var g = grammarList.find(function(x) { return x.id === id; });
  return g ? g.title : id;
}

// ── Trilingual label helpers ────────────────────────────────────────────────
const T = {
  review: { en: 'Review', fr: 'Révision', pt: 'Revisão' },
  weeklyTest: { en: 'Weekly Test', fr: 'Test hebdomadaire', pt: 'Teste semanal' },
  deepDive: { en: 'Deep Dive', fr: 'Approfondissement', pt: 'Aprofundamento' },
  setA: { en: 'Lesson A', fr: 'Leçon A', pt: 'Lição A' },
  setB: { en: 'Lesson B', fr: 'Leçon B', pt: 'Lição B' }
};

function three(en, fr, pt) { return { en: en, fr: fr, pt: pt }; }

// ── Internal exercise activity (title resolved server-side) ──────────────────
function ex(exerciseId, duration) {
  return { type: 'internal', source: 'internal', exerciseId: exerciseId, duration: duration };
}
// ── In-app lesson activity (kana/kanji) ──────────────────────────────────────
function lesson(route, title, duration) {
  return { type: 'lesson', route: route, title: title.en, titleFr: title.fr, titlePt: title.pt, duration: duration };
}
// ── Deep-dive activity ───────────────────────────────────────────────────────
function deep(topicId, duration) {
  const t = deepdive.topics[topicId];
  return {
    type: 'deepdive', route: '#/deepdive/' + topicId,
    title: t.title.en, titleFr: t.title.fr, titlePt: t.title.pt, duration: duration
  };
}
// ── Reference guide activity (numbers, counters, time, money) ────────────────
function guide(id, title, duration) {
  return { type: 'lesson', route: '#/guide/' + id, title: title.en, titleFr: title.fr, titlePt: title.pt, duration: duration };
}

// ── Drill activity (sentence building / conjugation) ─────────────────────────
function drill(id, title, duration) {
  return { type: 'lesson', route: '#/drill/' + id, title: title.en, titleFr: title.fr, titlePt: title.pt, duration: duration };
}

// ── Shadowing (speaking), SRS review, and exam activities ────────────────────
function shadow(id, title, duration) {
  return { type: 'lesson', route: '#/shadow/' + id, title: title.en, titleFr: title.fr, titlePt: title.pt, duration: duration };
}
function reviewAct(title, duration) {
  return { type: 'lesson', route: '#/review', title: title.en, titleFr: title.fr, titlePt: title.pt, duration: duration };
}
function examAct(id, title, duration) {
  return { type: 'lesson', route: '#/exam/' + id, title: title.en, titleFr: title.fr, titlePt: title.pt, duration: duration };
}

// ── Grammar lesson activity (title = the actual grammar point) ───────────────
function grammar(id, duration) {
  var gt = grammarTitleOf(id);
  return {
    type: 'lesson', route: '#/grammar/beginner/' + id,
    title: 'Grammar — ' + gt, titleFr: 'Grammaire — ' + gt, titlePt: 'Gramática — ' + gt,
    duration: duration
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// FOUNDATION WEEKS (1-3)
// ─────────────────────────────────────────────────────────────────────────────
const HIRA = '#/kana/hiragana';
const KATA = '#/kana/katakana';
const KANJI = '#/kana/kanji';

function foundationWeeks() {
  return [
    {
      week: 1, phase: 1,
      theme: 'Hiragana — Your First Alphabet',
      themeFr: 'Hiragana — Votre premier alphabet',
      themePt: 'Hiragana — Seu primeiro alfabeto',
      resources: resourcesFor('foundation'),
      days: [
        { day: 1, title: 'Hiragana: vowels あいうえお + K-row かきくけこ', titleFr: 'Hiragana : voyelles あいうえお + ligne K かきくけこ', titlePt: 'Hiragana: vogais あいうえお + linha K かきくけこ',
          activities: [ lesson(HIRA + '?groups=vowels,k-row', three('Learn the vowels あ い う え お and the K-row か き く け こ', 'Apprenez les voyelles あ い う え お et la ligne K か き く け こ', 'Aprenda as vogais あ い う え お e a linha K か き く け こ'), 20), ex('v001', 15) ] },
        { day: 2, title: 'Hiragana: S・T・N rows (さ〜の)', titleFr: 'Hiragana : lignes S・T・N (さ〜の)', titlePt: 'Hiragana: linhas S・T・N (さ〜の)',
          activities: [ lesson(HIRA + '?groups=s-row,t-row,n-row', three('Learn the S, T and N rows: さしすせそ・たちつてと・なにぬねの', 'Apprenez les lignes S, T et N : さしすせそ・たちつてと・なにぬねの', 'Aprenda as linhas S, T e N: さしすせそ・たちつてと・なにぬねの'), 20), ex('v001', 12) ] },
        { day: 3, title: 'Hiragana: H・M rows (は〜も)', titleFr: 'Hiragana : lignes H・M (は〜も)', titlePt: 'Hiragana: linhas H・M (は〜も)',
          activities: [ lesson(HIRA + '?groups=h-row,m-row', three('Learn the H and M rows: はひふへほ・まみむめも', 'Apprenez les lignes H et M : はひふへほ・まみむめも', 'Aprenda as linhas H e M: はひふへほ・まみむめも'), 20), ex('v003', 15) ] },
        { day: 4, title: 'Hiragana: Y・R・W rows + ん (や〜ん)', titleFr: 'Hiragana : lignes Y・R・W + ん (や〜ん)', titlePt: 'Hiragana: linhas Y・R・W + ん (や〜ん)',
          activities: [ lesson(HIRA + '?groups=y-row,r-row,w-n-row', three('Learn the Y, R and W rows plus ん: やゆよ・らりるれろ・わをん', 'Apprenez les lignes Y, R et W plus ん : やゆよ・らりるれろ・わをん', 'Aprenda as linhas Y, R e W mais ん: やゆよ・らりるれろ・わをん'), 20), ex('v002', 15) ] },
        { day: 5, title: 'Hiragana review + quiz', titleFr: 'Révision hiragana + quiz', titlePt: 'Revisão de hiragana + quiz', review: true,
          activities: [ lesson(HIRA, three('Review the full hiragana chart, then take the quiz', 'Révisez tout le tableau hiragana, puis faites le quiz', 'Revise toda a tabela de hiragana e faça o quiz'), 25), ex('v001', 12) ] },
        { day: 6, title: 'Reading hiragana words', titleFr: 'Lire des mots en hiragana', titlePt: 'Ler palavras em hiragana',
          activities: [ lesson(HIRA, three('Read whole words aloud using the full chart', 'Lisez des mots entiers à voix haute avec le tableau complet', 'Leia palavras inteiras em voz alta usando a tabela completa'), 15), ex('v003', 12), ex('v002', 10) ] },
        { day: 7, title: 'Weekly Test: Hiragana', titleFr: 'Test hebdomadaire : Hiragana', titlePt: 'Teste semanal: Hiragana', review: true,
          activities: [ lesson(HIRA, three('Hiragana quiz — aim for a perfect score', 'Quiz hiragana — visez un sans-faute', 'Quiz de hiragana — busque a nota máxima'), 20), ex('v002', 12) ] }
      ]
    },
    {
      week: 2, phase: 1,
      theme: 'Katakana — For Foreign Words',
      themeFr: 'Katakana — Pour les mots étrangers',
      themePt: 'Katakana — Para palavras estrangeiras',
      resources: resourcesFor('foundation'),
      days: [
        { day: 1, title: 'Katakana: vowels アイウエオ + K-row カキクケコ', titleFr: 'Katakana : voyelles アイウエオ + ligne K カキクケコ', titlePt: 'Katakana: vogais アイウエオ + linha K カキクケコ',
          activities: [ lesson(KATA + '?groups=vowels,k-row', three('Learn the vowels ア イ ウ エ オ and the K-row カ キ ク ケ コ', 'Apprenez les voyelles ア イ ウ エ オ et la ligne K カ キ ク ケ コ', 'Aprenda as vogais ア イ ウ エ オ e a linha K カ キ ク ケ コ'), 20), ex('v007', 15) ] },
        { day: 2, title: 'Katakana: S・T・N rows (サ〜ノ)', titleFr: 'Katakana : lignes S・T・N (サ〜ノ)', titlePt: 'Katakana: linhas S・T・N (サ〜ノ)',
          activities: [ lesson(KATA + '?groups=s-row,t-row,n-row', three('Learn the S, T and N rows: サシスセソ・タチツテト・ナニヌネノ', 'Apprenez les lignes S, T et N : サシスセソ・タチツテト・ナニヌネノ', 'Aprenda as linhas S, T e N: サシスセソ・タチツテト・ナニヌネノ'), 20), ex('v007', 12) ] },
        { day: 3, title: 'Katakana: H・M rows (ハ〜モ)', titleFr: 'Katakana : lignes H・M (ハ〜モ)', titlePt: 'Katakana: linhas H・M (ハ〜モ)',
          activities: [ lesson(KATA + '?groups=h-row,m-row', three('Learn the H and M rows: ハヒフヘホ・マミムメモ', 'Apprenez les lignes H et M : ハヒフヘホ・マミムメモ', 'Aprenda as linhas H e M: ハヒフヘホ・マミムメモ'), 20), ex('v011', 15) ] },
        { day: 4, title: 'Katakana: Y・R・W rows + ン (ヤ〜ン)', titleFr: 'Katakana : lignes Y・R・W + ン (ヤ〜ン)', titlePt: 'Katakana: linhas Y・R・W + ン (ヤ〜ン)',
          activities: [ lesson(KATA + '?groups=y-row,r-row,w-n-row', three('Learn the Y, R and W rows plus ン: ヤユヨ・ラリルレロ・ワヲン', 'Apprenez les lignes Y, R et W plus ン : ヤユヨ・ラリルレロ・ワヲン', 'Aprenda as linhas Y, R e W mais ン: ヤユヨ・ラリルレロ・ワヲン'), 20), ex('v011', 15) ] },
        { day: 5, title: 'Katakana review + quiz', titleFr: 'Révision katakana + quiz', titlePt: 'Revisão de katakana + quiz', review: true,
          activities: [ lesson(KATA, three('Review the full katakana chart, then take the quiz', 'Révisez tout le tableau katakana, puis faites le quiz', 'Revise toda a tabela de katakana e faça o quiz'), 25), ex('v007', 12) ] },
        { day: 6, title: 'Loanwords in katakana', titleFr: 'Mots empruntés en katakana', titlePt: 'Estrangeirismos em katakana',
          activities: [ lesson(KATA, three('Read loanwords with the full chart (コーヒー, テレビ…)', 'Lisez des mots empruntés avec le tableau complet (コーヒー, テレビ…)', 'Leia estrangeirismos com a tabela completa (コーヒー, テレビ…)'), 15), deep('shopping-phrases', 15) ] },
        { day: 7, title: 'Weekly Test: Katakana', titleFr: 'Test hebdomadaire : Katakana', titlePt: 'Teste semanal: Katakana', review: true,
          activities: [ lesson(KATA, three('Katakana quiz — aim for a perfect score', 'Quiz katakana — visez un sans-faute', 'Quiz de katakana — busque a nota máxima'), 20), ex('v011', 12) ] }
      ]
    },
    {
      week: 3, phase: 1,
      theme: 'First Kanji + Kana Consolidation',
      themeFr: 'Premiers kanji + consolidation des kana',
      themePt: 'Primeiros kanji + consolidação dos kana',
      resources: resourcesFor('foundation'),
      days: [
        { day: 1, title: 'Kanji: Numbers 一〜十 + counters & money', titleFr: 'Kanji : Nombres 一〜十 + compteurs & argent', titlePt: 'Kanji: Números 一〜十 + contadores & dinheiro',
          activities: [ lesson(KANJI + '?groups=numbers', three('Learn the number kanji 一 二 三 … 十 百 千 万 円', 'Apprenez les nombres 一 二 三 … 十 百 千 万 円', 'Aprenda os números 一 二 三 … 十 百 千 万 円'), 18), guide('numbers', three('Numbers, counters, time & money reference', 'Nombres, compteurs, heure & argent', 'Números, contadores, horas & dinheiro'), 12), ex('v002', 12) ] },
        { day: 2, title: 'Kanji: Time & Days 日月火水木金土', titleFr: 'Kanji : Temps & Jours 日月火水木金土', titlePt: 'Kanji: Tempo & Dias 日月火水木金土',
          activities: [ lesson(KANJI + '?groups=time', three('Learn the time & weekday kanji: 日 月 火 水 木 金 土 年 時 分 半', 'Apprenez les kanji du temps et des jours : 日 月 火 水 木 金 土 年 時 分 半', 'Aprenda os kanji de tempo e dias: 日 月 火 水 木 金 土 年 時 分 半'), 20), ex('v003', 15) ] },
        { day: 3, title: 'Kanji: People & Family 人男女子父母', titleFr: 'Kanji : Personnes & Famille 人男女子父母', titlePt: 'Kanji: Pessoas & Família 人男女子父母',
          activities: [ lesson(KANJI + '?groups=people', three('Learn the people & family kanji: 人 男 女 子 父 母 兄 弟 友 先 生', 'Apprenez les kanji des personnes et de la famille : 人 男 女 子 父 母 兄 弟 友 先 生', 'Aprenda os kanji de pessoas e família: 人 男 女 子 父 母 兄 弟 友 先 生'), 20), ex('v004', 15) ] },
        { day: 4, title: 'Kanji: Nature & Position 山川上下中', titleFr: 'Kanji : Nature & Position 山川上下中', titlePt: 'Kanji: Natureza & Posição 山川上下中',
          activities: [ lesson(KANJI + '?groups=nature,position', three('Learn the nature & position kanji: 山 川 田 花 天 空 上 下 中 外 前 後', 'Apprenez les kanji de la nature et de la position : 山 川 田 花 天 空 上 下 中 外 前 後', 'Aprenda os kanji de natureza e posição: 山 川 田 花 天 空 上 下 中 外 前 後'), 20), ex('v015', 15) ] },
        { day: 5, title: 'Kanji review + quiz', titleFr: 'Révision kanji + quiz', titlePt: 'Revisão de kanji + quiz', review: true,
          activities: [ lesson(KANJI, three('Review all the kanji you learned this week, then quiz', 'Révisez tous les kanji de la semaine, puis quiz', 'Revise todos os kanji da semana e faça o quiz'), 25), ex('v004', 12) ] },
        { day: 6, title: 'Mixed reading + sentence building', titleFr: 'Lecture mixte + construction de phrases', titlePt: 'Leitura mista + construção de frases',
          activities: [ ex('r001', 12), drill('sentence-basic', three('Sentence building: X は Y です', 'Construction : X は Y です', 'Construção: X は Y です'), 15), deep('greetings', 12) ] },
        { day: 7, title: 'Foundation Test', titleFr: 'Test des fondations', titlePt: 'Teste de base', review: true,
          activities: [ lesson(KANJI, three('Kanji quiz — recognize the meanings', 'Quiz kanji — reconnaissez les sens', 'Quiz de kanji — reconheça os significados'), 15), ex('v001', 10), ex('v002', 10) ] }
      ]
    }
  ];
}

// ─────────────────────────────────────────────────────────────────────────────
// CONTENT WEEK THEMES (weeks 4-52 → 49 themes)
// ─────────────────────────────────────────────────────────────────────────────
const THEMES = [
  three('Particles は・が + Family', 'Particules は・が + Famille', 'Partículas は・が + Família'),
  three('Particles を・に・で + Basic Verbs', 'Particules を・に・で + Verbes de base', 'Partículas を・に・で + Verbos básicos'),
  three('ます-form + Daily Verbs', 'Forme ます + Verbes du quotidien', 'Forma ます + Verbos do dia a dia'),
  three('い-Adjectives + Time', 'Adjectifs en い + Temps', 'Adjetivos い + Tempo'),
  three('な-Adjectives + School', 'Adjectifs en な + École', 'Adjetivos な + Escola'),
  three('Question Words + Calendar', 'Mots interrogatifs + Calendrier', 'Palavras interrogativas + Calendário'),
  three('Food & Drink', 'Nourriture & Boisson', 'Comida & Bebida'),
  three('Weather & Nature', 'Météo & Nature', 'Clima & Natureza'),
  three('Directions & Transport', 'Directions & Transport', 'Direções & Transporte'),
  three('Shopping & Money', 'Shopping & Argent', 'Compras & Dinheiro'),
  three('Home & Position Words', 'Maison & Position', 'Casa & Posição'),
  three('Body & Health', 'Corps & Santé', 'Corpo & Saúde'),
  three('Animals & Nature', 'Animaux & Nature', 'Animais & Natureza'),
  three('Clothing & Counters', 'Vêtements & Compteurs', 'Roupas & Contadores'),
  three('て-form + Existence Verbs', 'Forme て + Verbes d\'existence', 'Forma て + Verbos de existência'),
  three('Hobbies & Interests', 'Loisirs & Intérêts', 'Hobbies & Interesses'),
  three('Feelings & Emotions', 'Sentiments & Émotions', 'Sentimentos & Emoções'),
  three('Jobs & Occupations', 'Métiers & Professions', 'Profissões'),
  three('Giving & Receiving', 'Donner & Recevoir', 'Dar & Receber'),
  three('Comparisons & Reasons', 'Comparaisons & Raisons', 'Comparações & Razões'),
  three('Daily Routines', 'Routines quotidiennes', 'Rotinas diárias'),
  three('Plans & Seasons', 'Projets & Saisons', 'Planos & Estações'),
  three('Past Tense', 'Temps passé', 'Tempo passado'),
  three('Negatives', 'Formes négatives', 'Formas negativas'),
  three('Wants & Abilities', 'Envies & Capacités', 'Desejos & Habilidades'),
  three('Opinions', 'Opinions', 'Opiniões'),
  three('Basic Kanji Reading 1', 'Lecture de kanji 1', 'Leitura de kanji 1'),
  three('Basic Kanji Reading 2', 'Lecture de kanji 2', 'Leitura de kanji 2'),
  three('Basic Kanji Reading 3', 'Lecture de kanji 3', 'Leitura de kanji 3'),
  three('Extended Reading', 'Lecture approfondie', 'Leitura estendida'),
  three('Conjunctions & Longer Sentences', 'Conjonctions & Phrases longues', 'Conjunções & Frases longas'),
  three('Travel Japanese', 'Japonais du voyage', 'Japonês de viagem'),
  three('Technology & Modern Life', 'Technologie & Vie moderne', 'Tecnologia & Vida moderna'),
  three('Polite Forms & Keigo Basics', 'Formes polies & bases du keigo', 'Formas polidas & noções de keigo'),
  three('Restaurant & Ordering', 'Restaurant & Commander', 'Restaurante & Pedidos'),
  three('At the Station', 'À la gare', 'Na estação'),
  three('Communication & Phone', 'Communication & Téléphone', 'Comunicação & Telefone'),
  three('Japanese Culture & Festivals', 'Culture & Fêtes japonaises', 'Cultura & Festivais japoneses'),
  three('Everyday Situations', 'Situations quotidiennes', 'Situações do dia a dia'),
  three('Describing People & Places', 'Décrire personnes & lieux', 'Descrever pessoas & lugares'),
  three('Health & Emergencies', 'Santé & Urgences', 'Saúde & Emergências'),
  three('Work & Study Life', 'Travail & Études', 'Trabalho & Estudos'),
  three('JLPT N5 Grammar Review 1', 'Révision grammaire N5 (1)', 'Revisão de gramática N5 (1)'),
  three('JLPT N5 Grammar Review 2', 'Révision grammaire N5 (2)', 'Revisão de gramática N5 (2)'),
  three('JLPT N5 Vocabulary Review', 'Révision vocabulaire N5', 'Revisão de vocabulário N5'),
  three('JLPT N5 Reading Practice', 'Entraînement lecture N5', 'Prática de leitura N5'),
  three('JLPT N5 Listening Practice', 'Entraînement écoute N5', 'Prática de escuta N5'),
  three('JLPT N5 Mock Test', 'Examen blanc N5', 'Simulado N5'),
  three('Final Review & Next Steps', 'Révision finale & suite', 'Revisão final & próximos passos')
];

// ── Phase-based further-reading resources (trilingual) ───────────────────────
function res(title, url) { return { title: title.en, titleFr: title.fr, titlePt: title.pt, url: url }; }
function resourcesFor(phase) {
  if (phase === 'foundation') {
    return [
      res(three('Tofugu: Learn Hiragana guide', 'Tofugu : guide Hiragana', 'Tofugu: guia de Hiragana'), 'https://www.tofugu.com/japanese/learn-hiragana/'),
      res(three('Tofugu: Learn Katakana guide', 'Tofugu : guide Katakana', 'Tofugu: guia de Katakana'), 'https://www.tofugu.com/japanese/learn-katakana/'),
      res(three('NHK: Easy Japanese lessons', 'NHK : leçons de japonais facile', 'NHK: lições de japonês fácil'), 'https://www.nhk.or.jp/lesson/en/')
    ];
  }
  if (phase === 'grammar') {
    return [
      res(three('Tae Kim: Guide to Japanese Grammar', 'Tae Kim : guide de grammaire', 'Tae Kim: guia de gramática'), 'https://guidetojapanese.org/learn/grammar'),
      res(three('Bunpro: N5 grammar path', 'Bunpro : parcours grammaire N5', 'Bunpro: trilha de gramática N5'), 'https://bunpro.jp/'),
      res(three('NHK Easy News (graded reading)', 'NHK Easy News (lecture graduée)', 'NHK Easy News (leitura graduada)'), 'https://www3.nhk.or.jp/news/easy/')
    ];
  }
  if (phase === 'applied') {
    return [
      res(three('Tadoku: free graded readers', 'Tadoku : lecteurs gradués gratuits', 'Tadoku: leitores graduados gratuitos'), 'https://tadoku.org/japanese/en/free-books-en/'),
      res(three('NHK Easy News', 'NHK Easy News', 'NHK Easy News'), 'https://www3.nhk.or.jp/news/easy/'),
      res(three('Tofugu: article archive', 'Tofugu : archives d\'articles', 'Tofugu: arquivo de artigos'), 'https://www.tofugu.com/')
    ];
  }
  // jlpt
  return [
    res(three('JLPT Sensei: N5 resources', 'JLPT Sensei : ressources N5', 'JLPT Sensei: recursos N5'), 'https://jlptsensei.com/jlpt-n5-study-material/'),
    res(three('Official JLPT: sample questions', 'JLPT officiel : questions types', 'JLPT oficial: questões de exemplo'), 'https://www.jlpt.jp/e/samples/forlearners.html'),
    res(three('Tadoku graded readers', 'Tadoku lecteurs gradués', 'Tadoku leitores graduados'), 'https://tadoku.org/japanese/en/free-books-en/')
  ];
}

function phaseForWeek(w) {
  if (w <= 3) return 1;
  if (w <= 16) return 2;
  if (w <= 30) return 3;
  if (w <= 44) return 4;
  return 5;
}
function resourcePhase(w) {
  if (w <= 16) return 'grammar';
  if (w <= 44) return 'applied';
  return 'jlpt';
}

// ─────────────────────────────────────────────────────────────────────────────
// CONTENT WEEKS (4-52)
// ─────────────────────────────────────────────────────────────────────────────
function pad(n, p) { return String(n).padStart(3, '0').length ? p + String(n).padStart(3, '0') : p; }
function vId(i) { return 'v' + String(((i - 1) % 85) + 1).padStart(3, '0'); }
function rId(i) { return 'r' + String(((i - 1) % 85) + 1).padStart(3, '0'); }
function gId(i) { return 'g' + String(((i - 1) % grammarList.length) + 1).padStart(3, '0'); }
function dId(i) { return 'd' + String(((i - 1) % 15) + 1).padStart(3, '0'); }

function combineTitle(theme, suffix) {
  return { en: theme.en + ' — ' + suffix.en, fr: theme.fr + ' — ' + suffix.fr, pt: theme.pt + ' — ' + suffix.pt };
}
function reviewTitle(theme, suffix) {
  return { en: T.review.en + ': ' + suffix.en, fr: T.review.fr + ' : ' + suffix.fr, pt: T.review.pt + ': ' + suffix.pt };
}

function newContentDay(dayNum, theme, setLabel, vi, ri, gi, di) {
  return {
    day: dayNum,
    title: combineTitle(theme, setLabel).en,
    titleFr: combineTitle(theme, setLabel).fr,
    titlePt: combineTitle(theme, setLabel).pt,
    activities: [
      ex(vId(vi), 10),
      ex(rId(ri), 12),
      grammar(gId(gi), 8),
      ex(dId(di), 10)
    ]
  };
}
function reviewDay(dayNum, theme, setLabel, vi, ri, gi, di) {
  return {
    day: dayNum,
    title: reviewTitle(theme, setLabel).en,
    titleFr: reviewTitle(theme, setLabel).fr,
    titlePt: reviewTitle(theme, setLabel).pt,
    review: true,
    activities: [
      ex(vId(vi), 8),
      ex(rId(ri), 10),
      grammar(gId(gi), 6),
      ex(dId(di), 8)
    ]
  };
}

function contentWeek(weekNum, themeIdx, counters) {
  const theme = THEMES[themeIdx];
  // Day 1 new content (Set A)
  const a = { v: counters.v, r: counters.r, g: counters.g, d: counters.d };
  counters.v++; counters.r++; counters.g++; counters.d++;
  // Day 3 new content (Set B)
  const b = { v: counters.v, r: counters.r, g: counters.g, d: counters.d };
  counters.v++; counters.r++; counters.g++; counters.d++;

  const topicA = deepTopicIds[counters.dd % deepTopicIds.length]; counters.dd++;
  const topicB = deepTopicIds[counters.dd % deepTopicIds.length]; counters.dd++;

  const days = [
    newContentDay(1, theme, T.setA, a.v, a.r, a.g, a.d),
    reviewDay(2, theme, T.setA, a.v, a.r, a.g, a.d),
    newContentDay(3, theme, T.setB, b.v, b.r, b.g, b.d),
    reviewDay(4, theme, T.setB, b.v, b.r, b.g, b.d),
    // Day 5 Deep Dive A
    { day: 5,
      title: T.deepDive.en + ' A — ' + deepdive.topics[topicA].title.en,
      titleFr: T.deepDive.fr + ' A — ' + deepdive.topics[topicA].title.fr,
      titlePt: T.deepDive.pt + ' A — ' + deepdive.topics[topicA].title.pt,
      activities: [ deep(topicA, 15), ex(vId(a.v), 12), ex(dId(a.d), 8) ] },
    // Day 6 Deep Dive B
    { day: 6,
      title: T.deepDive.en + ' B — ' + deepdive.topics[topicB].title.en,
      titleFr: T.deepDive.fr + ' B — ' + deepdive.topics[topicB].title.fr,
      titlePt: T.deepDive.pt + ' B — ' + deepdive.topics[topicB].title.pt,
      activities: [ deep(topicB, 15), ex(vId(b.v), 12), ex(dId(b.d), 8) ] },
    // Day 7 Weekly Test
    { day: 7,
      title: T.weeklyTest.en + ': ' + theme.en,
      titleFr: T.weeklyTest.fr + ' : ' + theme.fr,
      titlePt: T.weeklyTest.pt + ': ' + theme.pt,
      review: true,
      activities: [ ex(vId(a.v), 10), ex(vId(b.v), 10), ex(rId(a.r), 10), ex(rId(b.r), 10) ] }
  ];

  return {
    week: weekNum,
    phase: phaseForWeek(weekNum),
    theme: theme.en, themeFr: theme.fr, themePt: theme.pt,
    resources: resourcesFor(resourcePhase(weekNum)),
    days: days
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// BUILD
// ─────────────────────────────────────────────────────────────────────────────
const weeks = foundationWeeks();
const counters = { v: 5, r: 1, g: 1, d: 1, dd: 0 }; // vocab starts at v005 (v001-4 used in foundation)
for (let w = 4; w <= 52; w++) {
  const themeIdx = w - 4; // 0..48
  weeks.push(contentWeek(w, themeIdx, counters));
}

// ─────────────────────────────────────────────────────────────────────────────
// ENRICHMENT: weave drills, shadowing, SRS review and the mock exam into the plan
// ─────────────────────────────────────────────────────────────────────────────
function dayOf(wk, dy) {
  var w = weeks.filter(function(x) { return x.week === wk; })[0];
  return w ? w.days.filter(function(d) { return d.day === dy; })[0] : null;
}
function setDay(wk, dy, title, activities) {
  var d = dayOf(wk, dy);
  if (!d) return;
  if (title) { d.title = title.en; d.titleFr = title.fr; d.titlePt = title.pt; }
  d.activities = activities;
}

// Drills (sentence building + conjugation) on the Day-6 slots of relevant weeks
setDay(5, 6, three('Sentence building: particles を・に・で', 'Construction : particules を・に・で', 'Construção: partículas を・に・で'),
  [ ex('r005', 12), drill('sentence-particles', three('Sentence building: particles', 'Construction : particules', 'Construção: partículas'), 15), deep('weather-expressions', 12) ]);
setDay(6, 6, three('Conjugation drill: ます-form', 'Conjugaison : forme ます', 'Conjugação: forma ます'),
  [ ex('r006', 12), drill('conjugation-masu', three('Conjugation drill: ます-form', 'Conjugaison : forme ます', 'Conjugação: forma ます'), 15), deep('daily-verbs', 12) ]);
setDay(15, 6, three('Conjugation drill: て-form', 'Conjugaison : forme て', 'Conjugação: forma て'),
  [ ex('r015', 12), drill('conjugation-te', three('Conjugation drill: て-form', 'Conjugaison : forme て', 'Conjugação: forma て'), 15), deep('feelings-idioms', 12) ]);

// Shadowing (speaking practice)
setDay(4, 6, three('Speaking: greetings', 'Expression orale : salutations', 'Fala: saudações'),
  [ ex('r004', 12), shadow('greetings', three('Speaking: greetings', 'Expression orale : salutations', 'Fala: saudações'), 15), deep('greetings', 12) ]);
setDay(12, 6, three('Speaking: self-introduction', 'Expression orale : se présenter', 'Fala: apresentar-se'),
  [ ex('r012', 12), shadow('self-intro', three('Speaking: self-introduction', 'Expression orale : se présenter', 'Fala: apresentar-se'), 15), deep('feelings-idioms', 12) ]);
setDay(30, 6, three('Speaking: daily phrases', 'Expression orale : phrases du quotidien', 'Fala: frases do dia a dia'),
  [ ex('r030', 12), shadow('daily', three('Speaking: daily phrases', 'Expression orale : phrases du quotidien', 'Fala: frases do dia a dia'), 15), deep('polite-requests', 12) ]);

// Weekly spaced-repetition review woven into the Day-7 test of selected weeks
[8, 16, 24, 32, 40, 44].forEach(function(wk) {
  var d = dayOf(wk, 7);
  if (d && d.activities.length) {
    d.activities[d.activities.length - 1] = reviewAct(three('Spaced review (SRS)', 'Révision espacée (SRS)', 'Revisão espaçada (SRS)'), 10);
  }
});

// JLPT N5 mock exam near the end of the program
setDay(50, 1, three('JLPT N5 Mock Exam', 'Examen blanc JLPT N5', 'Simulado JLPT N5'),
  [ examAct('n5-mock', three('JLPT N5 Mock Exam', 'Examen blanc JLPT N5', 'Simulado JLPT N5'), 40) ]);
var d48 = dayOf(48, 7);
if (d48 && d48.activities.length) {
  d48.activities[d48.activities.length - 1] = examAct('n5-mock', three('JLPT N5 Mock Exam', 'Examen blanc JLPT N5', 'Simulado JLPT N5'), 12);
}

const curriculum = {
  level: 'beginner',
  title: 'Beginner Japanese - 1 Year Program',
  titleFr: "Japonais Débutant - Programme d'un an",
  titlePt: 'Japonês para Iniciantes - Programa de 1 Ano',
  description: 'A structured 52-week program: master the kana and basic kanji first, then build vocabulary, grammar, reading, and listening through a proven weekly rhythm of new content, review, deep dives, and weekly tests.',
  descriptionFr: "Un programme structuré de 52 semaines : maîtrisez d'abord les kana et les kanji de base, puis développez vocabulaire, grammaire, lecture et écoute grâce à un rythme hebdomadaire éprouvé (nouveau contenu, révision, approfondissements et tests hebdomadaires).",
  descriptionPt: 'Um programa estruturado de 52 semanas: domine primeiro os kana e os kanji básicos, depois desenvolva vocabulário, gramática, leitura e escuta com um ritmo semanal comprovado de novo conteúdo, revisão, aprofundamentos e testes semanais.',
  targetHoursPerYear: 182,
  minutesPerDay: 35,
  totalWeeks: 52,
  weeks: weeks
};

const outPath = path.join(CONTENT, 'curriculum', 'beginner-curriculum.json');
fs.writeFileSync(outPath, JSON.stringify(curriculum, null, 2), 'utf8');
console.log('Wrote', outPath);
console.log('Weeks:', weeks.length, '| Foundation:', 3, '| Content:', weeks.length - 3);
