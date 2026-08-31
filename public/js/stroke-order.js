/**
 * Japanese Learning System - Stroke Order Viewer
 *
 * Renders correct writing order for hiragana, katakana and kanji using the
 * offline KanjiVG-derived dataset (CC-BY-SA 3.0). No external libraries.
 *
 * Two modes in one component:
 *   - Diagram: all strokes shown at once with numbered start dots.
 *   - Animation: strokes drawn one-by-one in order (Play / Replay), each with
 *     a start dot so direction is clear.
 *
 * Public API (window.StrokeOrder):
 *   load()                         -> Promise, fetches + caches the dataset
 *   has(char)                      -> boolean, is stroke data available
 *   renderInto(el, char, opts)     -> draws the viewer into element `el`
 *
 * Fetched once, cached in memory + sessionStorage so it works offline.
 */
(function() {
  'use strict';

  var CACHE_KEY = 'jls-strokes-v1';
  var data = null;          // { viewBox, characters }
  var loadPromise = null;

  function i18n(key, fallback) {
    return (window.i18n && window.i18n(key)) || fallback;
  }

  function load() {
    if (data) return Promise.resolve(data);
    if (loadPromise) return loadPromise;

    // Try sessionStorage first (offline-friendly, avoids refetch on navigation)
    try {
      var cached = sessionStorage.getItem(CACHE_KEY);
      if (cached) { data = JSON.parse(cached); return Promise.resolve(data); }
    } catch (e) {}

    loadPromise = window.API.get('/kana-strokes')
      .then(function(d) {
        data = d;
        try { sessionStorage.setItem(CACHE_KEY, JSON.stringify(d)); } catch (e) {}
        return d;
      })
      .catch(function() { data = { viewBox: '0 0 109 109', characters: {} }; return data; });
    return loadPromise;
  }

  function has(ch) {
    return !!(data && data.characters && data.characters[ch] && data.characters[ch].length);
  }

  function strokesFor(ch) {
    return (data && data.characters && data.characters[ch]) || [];
  }

  // Approximate the start point of an SVG path's "d" string (the M command).
  function startPoint(d) {
    var m = /^[Mm]\s*(-?[\d.]+)[ ,]+(-?[\d.]+)/.exec(d);
    if (!m) return null;
    return { x: parseFloat(m[1]), y: parseFloat(m[2]) };
  }

  var SVGNS = 'http://www.w3.org/2000/svg';

  function el(name, attrs) {
    var e = document.createElementNS(SVGNS, name);
    if (attrs) for (var k in attrs) e.setAttribute(k, attrs[k]);
    return e;
  }

  /**
   * Build the SVG diagram: all strokes drawn, with numbered start dots.
   */
  function buildDiagram(ch, viewBox) {
    var paths = strokesFor(ch);
    var svg = el('svg', { viewBox: viewBox, class: 'strokes__svg', role: 'img' });

    // guide grid
    var vb = viewBox.split(/\s+/).map(Number);
    var w = vb[2] || 109, h = vb[3] || 109;
    svg.appendChild(el('line', { x1: w / 2, y1: 0, x2: w / 2, y2: h, class: 'strokes__grid' }));
    svg.appendChild(el('line', { x1: 0, y1: h / 2, x2: w, y2: h / 2, class: 'strokes__grid' }));

    paths.forEach(function(d, i) {
      svg.appendChild(el('path', { d: d, class: 'strokes__stroke', fill: 'none' }));
      var sp = startPoint(d);
      if (sp) {
        svg.appendChild(el('circle', { cx: sp.x, cy: sp.y, r: 3.5, class: 'strokes__dot' }));
        var num = el('text', { x: sp.x, y: sp.y - 4.5, class: 'strokes__num' });
        num.textContent = String(i + 1);
        svg.appendChild(num);
      }
    });
    return svg;
  }

  /**
   * Build the animated SVG: strokes revealed one-by-one via dash offset.
   */
  function buildAnimation(ch, viewBox) {
    var paths = strokesFor(ch);
    var svg = el('svg', { viewBox: viewBox, class: 'strokes__svg strokes__svg--anim', role: 'img' });
    var vb = viewBox.split(/\s+/).map(Number);
    var w = vb[2] || 109, h = vb[3] || 109;
    svg.appendChild(el('line', { x1: w / 2, y1: 0, x2: w / 2, y2: h, class: 'strokes__grid' }));
    svg.appendChild(el('line', { x1: 0, y1: h / 2, x2: w, y2: h / 2, class: 'strokes__grid' }));

    // faint full character underneath as a target
    paths.forEach(function(d) {
      svg.appendChild(el('path', { d: d, class: 'strokes__ghost', fill: 'none' }));
    });

    var strokeEls = paths.map(function(d) {
      var p = el('path', { d: d, class: 'strokes__stroke strokes__stroke--anim', fill: 'none' });
      svg.appendChild(p);
      return p;
    });
    var dotEls = paths.map(function(d) {
      var sp = startPoint(d);
      var c = el('circle', { cx: sp ? sp.x : 0, cy: sp ? sp.y : 0, r: 3.2, class: 'strokes__dot strokes__dot--anim' });
      svg.appendChild(c);
      return c;
    });

    return { svg: svg, strokeEls: strokeEls, dotEls: dotEls, paths: paths };
  }

  function animate(built, onStep) {
    var strokeEls = built.strokeEls, dotEls = built.dotEls;
    // Prepare each stroke as "hidden" using dash offset = its own length.
    strokeEls.forEach(function(p) {
      var len = 0;
      try { len = p.getTotalLength(); } catch (e) { len = 100; }
      p.style.transition = 'none';
      p.style.strokeDasharray = len;
      p.style.strokeDashoffset = len;
      p.dataset.len = len;
    });
    dotEls.forEach(function(c) { c.style.opacity = '0'; });

    var i = 0;
    var timer = null;
    function step() {
      if (i >= strokeEls.length) { if (onStep) onStep(strokeEls.length, strokeEls.length); return; }
      var p = strokeEls[i];
      var dot = dotEls[i];
      var len = parseFloat(p.dataset.len) || 100;
      // duration scales a little with stroke length for a natural feel
      var dur = Math.min(1.1, Math.max(0.35, len / 120));
      dot.style.opacity = '1';
      // force reflow then animate the dash offset to 0
      // eslint-disable-next-line no-unused-expressions
      p.getBoundingClientRect();
      p.style.transition = 'stroke-dashoffset ' + dur + 's ease';
      p.style.strokeDashoffset = '0';
      if (onStep) onStep(i + 1, strokeEls.length);
      i++;
      timer = setTimeout(step, dur * 1000 + 260);
    }
    step();
    return function cancel() { if (timer) clearTimeout(timer); };
  }

  /**
   * Render the full viewer (diagram + play controls) into `container`.
   * opts.compact -> smaller layout.
   */
  function renderInto(container, ch, opts) {
    opts = opts || {};
    if (!container) return;

    load().then(function() {
      if (!has(ch)) {
        container.innerHTML = '<p class="strokes__none">' + i18n('kana.strokesUnavailable', 'Stroke order not available for this character.') + '</p>';
        return;
      }
      var viewBox = data.viewBox || '0 0 109 109';
      container.innerHTML = '';
      container.className = 'strokes' + (opts.compact ? ' strokes--compact' : '');

      var stage = document.createElement('div');
      stage.className = 'strokes__stage';
      container.appendChild(stage);

      // Start in diagram mode
      var diagram = buildDiagram(ch, viewBox);
      stage.appendChild(diagram);

      var controls = document.createElement('div');
      controls.className = 'strokes__controls';
      var playBtn = document.createElement('button');
      playBtn.className = 'btn btn--sm btn--primary';
      playBtn.textContent = i18n('kana.playStrokes', 'Play stroke order');
      var status = document.createElement('span');
      status.className = 'strokes__status';
      controls.appendChild(playBtn);
      controls.appendChild(status);
      container.appendChild(controls);

      var cancelAnim = null;
      playBtn.addEventListener('click', function() {
        if (cancelAnim) { cancelAnim(); cancelAnim = null; }
        stage.innerHTML = '';
        var built = buildAnimation(ch, viewBox);
        stage.appendChild(built.svg);
        playBtn.textContent = i18n('kana.replayStrokes', 'Replay');
        cancelAnim = animate(built, function(done, total) {
          status.textContent = i18n('kana.strokeStep', 'Stroke') + ' ' + done + ' / ' + total;
          if (done === total) {
            // After finishing, restore the numbered diagram for reference
            setTimeout(function() {
              stage.innerHTML = '';
              stage.appendChild(buildDiagram(ch, viewBox));
            }, 700);
          }
        });
      });
    });
  }

  window.StrokeOrder = { load: load, has: has, renderInto: renderInto };
})();
