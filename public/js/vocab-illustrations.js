/**
 * Japanese Learning System - Vocabulary Illustrations
 *
 * A small library of clean, offline SVG pictures for common concrete beginner
 * nouns (nature, body, food, animals, everyday objects). Concrete nouns are
 * learned much faster with a picture, so these reinforce meaning.
 *
 * Each entry has match tokens (English keywords + Japanese words/readings) and
 * an SVG string. Illustrations use currentColor + one accent so they adapt to
 * light/dark themes.
 *
 * Public API:
 *   window.VocabArt.for(...strings) -> svg string | null
 *   window.VocabArt.render(svg, size?) -> wrapped svg string
 */
(function() {
  'use strict';

  var A = '#e4572e'; // accent (vermilion)
  var B = '#4361ee'; // secondary (indigo)

  function svg(inner) {
    return '<svg viewBox="0 0 64 64" width="100%" height="100%" role="img" aria-hidden="true">' + inner + '</svg>';
  }

  var ITEMS = [
    { t: ['water', 'eau', '\u00e1gua', '\u6c34', '\u307f\u305a'],
      s: svg('<path d="M32 8 C20 26 16 34 16 42 a16 16 0 0 0 32 0 c0-8-4-16-16-34 Z" fill="' + B + '" opacity="0.85"/><path d="M38 40 a6 6 0 0 1-6 6" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round"/>') },
    { t: ['book', 'livre', 'livro', '\u672c', '\u307b\u3093'],
      s: svg('<path d="M12 14 h18 a4 4 0 0 1 4 4 v34 h-18 a4 4 0 0 1-4-4 Z" fill="' + B + '"/><path d="M52 14 h-18 a4 4 0 0 0-4 4 v34 h18 a4 4 0 0 0 4-4 Z" fill="' + A + '"/><path d="M32 20 v30" stroke="#fff" stroke-width="2"/>') },
    { t: ['train', '\u96fb\u8eca', '\u3067\u3093\u3057\u3083'],
      s: svg('<rect x="14" y="12" width="36" height="34" rx="6" fill="' + B + '"/><rect x="19" y="18" width="26" height="12" rx="2" fill="#fff"/><circle cx="23" cy="38" r="3" fill="#fff"/><circle cx="41" cy="38" r="3" fill="#fff"/><path d="M22 50 l-4 6 M42 50 l4 6" stroke="' + A + '" stroke-width="3" stroke-linecap="round"/>') },
    { t: ['station', '\u99c5', '\u3048\u304d'],
      s: svg('<path d="M10 30 L32 14 L54 30 Z" fill="' + A + '"/><rect x="16" y="30" width="32" height="22" fill="' + B + '"/><rect x="28" y="38" width="8" height="14" fill="#fff"/>') },
    { t: ['house', 'home', 'maison', 'casa', '\u5bb6', '\u3044\u3048'],
      s: svg('<path d="M32 12 L54 30 H46 V52 H18 V30 H10 Z" fill="' + A + '"/><rect x="27" y="36" width="10" height="16" fill="#fff"/>') },
    { t: ['school', '\u00e9cole', 'escola', '\u5b66\u6821', '\u304c\u3063\u3053\u3046'],
      s: svg('<rect x="12" y="26" width="40" height="26" fill="' + B + '"/><path d="M12 26 L32 12 L52 26 Z" fill="' + A + '"/><rect x="28" y="38" width="8" height="14" fill="#fff"/><path d="M32 12 v-4 h6" stroke="#fff" stroke-width="2" fill="none"/>') },
    { t: ['mountain', 'montagne', 'montanha', '\u5c71', '\u3084\u307e'],
      s: svg('<path d="M6 52 L24 20 L34 36 L42 24 L58 52 Z" fill="' + B + '"/><path d="M20 28 L24 20 L29 28 Z" fill="#fff"/>') },
    { t: ['river', 'rivi\u00e8re', 'rio', '\u5ddd', '\u304b\u308f'],
      s: svg('<path d="M18 8 C10 24 26 32 18 48 M32 8 C24 24 40 32 32 48 M46 8 C38 24 54 32 46 48" fill="none" stroke="' + B + '" stroke-width="5" stroke-linecap="round"/>') },
    { t: ['tree', 'wood', 'arbre', '\u00e1rvore', '\u6728', '\u304d'],
      s: svg('<rect x="29" y="34" width="6" height="18" fill="' + A + '"/><circle cx="32" cy="24" r="16" fill="' + B + '"/>') },
    { t: ['fish', 'poisson', 'peixe', '\u9b5a', '\u3055\u304b\u306a'],
      s: svg('<path d="M10 32 C22 18 40 18 48 32 C40 46 22 46 10 32 Z" fill="' + B + '"/><path d="M48 32 L58 24 V40 Z" fill="' + A + '"/><circle cx="20" cy="30" r="2.5" fill="#fff"/>') },
    { t: ['dog', 'chien', 'cachorro', 'c\u00e3o', '\u72ac', '\u3044\u306c'],
      s: svg('<circle cx="32" cy="34" r="16" fill="' + A + '"/><path d="M18 20 L22 34 L14 32 Z M46 20 L42 34 L50 32 Z" fill="' + A + '"/><circle cx="26" cy="32" r="2.5" fill="#fff"/><circle cx="38" cy="32" r="2.5" fill="#fff"/><circle cx="32" cy="40" r="3" fill="#fff"/>') },
    { t: ['cat', 'chat', 'gato', '\u732b', '\u306d\u3053'],
      s: svg('<path d="M18 18 L24 32 L14 30 Z M46 18 L40 32 L50 30 Z" fill="' + B + '"/><circle cx="32" cy="36" r="15" fill="' + B + '"/><circle cx="27" cy="34" r="2.5" fill="#fff"/><circle cx="37" cy="34" r="2.5" fill="#fff"/><path d="M24 40 h-8 M40 40 h8" stroke="#fff" stroke-width="1.5"/>') },
    { t: ['bird', 'oiseau', 'p\u00e1ssaro', '\u9ce5', '\u3068\u308a'],
      s: svg('<circle cx="30" cy="32" r="14" fill="' + B + '"/><path d="M44 30 L56 26 L46 36 Z" fill="' + A + '"/><circle cx="26" cy="28" r="2.5" fill="#fff"/><path d="M20 44 l-4 8 M30 46 l0 8" stroke="' + A + '" stroke-width="2.5" stroke-linecap="round"/>') },
    { t: ['hand', 'main', 'm\u00e3o', '\u624b', '\u3066'],
      s: svg('<path d="M24 52 V30 M30 52 V22 M36 52 V22 M42 50 V26 M24 34 c-4 0-6 4-4 8 l4 10 h20 V30" fill="none" stroke="' + A + '" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>') },
    { t: ['eye', 'oeil', 'olho', '\u76ee', '\u3081'],
      s: svg('<path d="M8 32 C20 18 44 18 56 32 C44 46 20 46 8 32 Z" fill="none" stroke="' + B + '" stroke-width="3"/><circle cx="32" cy="32" r="8" fill="' + A + '"/><circle cx="32" cy="32" r="3" fill="#fff"/>') },
    { t: ['ear', 'oreille', 'orelha', '\u8033', '\u307f\u307f'],
      s: svg('<path d="M22 20 a14 14 0 0 1 22 8 c0 8-8 10-8 18 a6 6 0 0 1-12 0" fill="none" stroke="' + A + '" stroke-width="4" stroke-linecap="round"/>') },
    { t: ['mouth', 'bouche', 'boca', '\u53e3', '\u304f\u3061'],
      s: svg('<path d="M12 32 q20 18 40 0 q-20-18-40 0 Z" fill="' + A + '"/><path d="M20 32 h24" stroke="#fff" stroke-width="2"/>') },
    { t: ['sun', 'day', 'soleil', 'sol', '\u65e5', '\u3072'],
      s: svg('<circle cx="32" cy="32" r="12" fill="' + A + '"/><g stroke="' + A + '" stroke-width="3" stroke-linecap="round"><path d="M32 8 v8 M32 48 v8 M8 32 h8 M48 32 h8 M15 15 l6 6 M43 43 l6 6 M49 15 l-6 6 M15 49 l6-6"/></g>') },
    { t: ['moon', 'month', 'lune', 'lua', '\u6708', '\u3064\u304d'],
      s: svg('<path d="M40 8 a24 24 0 1 0 16 40 A20 20 0 0 1 40 8 Z" fill="' + B + '"/>') },
    { t: ['car', 'voiture', 'carro', '\u8eca', '\u304f\u308b\u307e'],
      s: svg('<path d="M10 40 l4-12 h36 l4 12 Z" fill="' + A + '"/><rect x="8" y="38" width="48" height="8" rx="3" fill="' + A + '"/><circle cx="20" cy="48" r="5" fill="' + B + '"/><circle cx="44" cy="48" r="5" fill="' + B + '"/>') },
    { t: ['flower', 'fleur', 'flor', '\u82b1', '\u306f\u306a'],
      s: svg('<g fill="' + A + '"><circle cx="32" cy="18" r="7"/><circle cx="20" cy="28" r="7"/><circle cx="44" cy="28" r="7"/><circle cx="25" cy="40" r="7"/><circle cx="39" cy="40" r="7"/></g><circle cx="32" cy="30" r="6" fill="#f4b942"/>') },
    { t: ['rice', 'meal', 'riz', 'arroz', 'refei\u00e7\u00e3o', '\u3054\u98ef', '\u3054\u306f\u3093', '\u7c73'],
      s: svg('<path d="M12 34 h40 a20 20 0 0 1-40 0 Z" fill="' + B + '"/><ellipse cx="32" cy="30" rx="18" ry="6" fill="#fff"/>') },
    { t: ['tea', 'th\u00e9', 'ch\u00e1', '\u304a\u8336', '\u3061\u3083'],
      s: svg('<path d="M16 28 h28 v8 a14 14 0 0 1-28 0 Z" fill="' + B + '"/><path d="M44 30 a8 6 0 0 1 0 12" fill="none" stroke="' + B + '" stroke-width="3"/><path d="M26 20 q2-4 4 0 M34 20 q2-4 4 0" stroke="' + A + '" stroke-width="2" fill="none"/>') },
    { t: ['money', 'argent', 'dinheiro', '\u304a\u91d1', '\u304a\u304b\u306d'],
      s: svg('<circle cx="32" cy="32" r="18" fill="#f4b942"/><circle cx="32" cy="32" r="18" fill="none" stroke="' + A + '" stroke-width="2"/><path d="M32 22 v20 M26 28 h12 M26 34 h12" stroke="' + A + '" stroke-width="3" stroke-linecap="round"/>') }
  ];

  function normalize(s) {
    return String(s == null ? '' : s).toLowerCase().trim();
  }

  /**
   * Return an SVG for the first item whose tokens are found in any of the
   * provided candidate strings (English meaning, Japanese word, reading...).
   */
  function forWord() {
    var candidates = [];
    for (var i = 0; i < arguments.length; i++) {
      if (arguments[i]) candidates.push(normalize(arguments[i]));
    }
    if (!candidates.length) return null;

    for (var k = 0; k < ITEMS.length; k++) {
      var toks = ITEMS[k].t;
      for (var j = 0; j < toks.length; j++) {
        var tok = normalize(toks[j]);
        for (var c = 0; c < candidates.length; c++) {
          var cand = candidates[c];
          // English tokens: word-boundary-ish contains; Japanese: substring.
          if (/[a-z]/.test(tok)) {
            var re = new RegExp('(^|[^a-z])' + tok + '([^a-z]|$)');
            if (re.test(cand)) return ITEMS[k].s;
          } else if (cand.indexOf(tok) !== -1) {
            return ITEMS[k].s;
          }
        }
      }
    }
    return null;
  }

  function renderWrap(svgStr, size) {
    if (!svgStr) return '';
    var px = size || 56;
    return '<span class="vocab-art" style="width:' + px + 'px;height:' + px + 'px">' + svgStr + '</span>';
  }

  window.VocabArt = { for: forWord, render: renderWrap };
})();
