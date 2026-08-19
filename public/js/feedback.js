/**
 * Japanese Learning System - Reward Feedback Module
 *
 * Fully offline "game feel" feedback:
 *   - Sound effects synthesised with the Web Audio API (no audio files).
 *   - Canvas confetti bursts for celebrations.
 *
 * Sounds and confetti are purely decorative and degrade silently when
 * unsupported. Sound can be muted via localStorage key 'jls-sound-muted'.
 *
 * Public API (window.Feedback):
 *   correct()             short pleasant chime
 *   incorrect()           soft low tone
 *   celebrate(options)    confetti burst + success fanfare
 *   confetti(options)     confetti burst only
 *   isMuted() / setMuted(bool)
 */
(function() {
  'use strict';

  var MUTE_KEY = 'jls-sound-muted';
  var audioCtx = null;

  function isMuted() {
    try { return localStorage.getItem(MUTE_KEY) === '1'; } catch (e) { return false; }
  }

  function setMuted(muted) {
    try { localStorage.setItem(MUTE_KEY, muted ? '1' : '0'); } catch (e) {}
  }

  function getCtx() {
    if (isMuted()) return null;
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    if (!audioCtx) {
      try { audioCtx = new AC(); } catch (e) { return null; }
    }
    // Autoplay policies suspend the context until a user gesture; resume it.
    if (audioCtx.state === 'suspended' && audioCtx.resume) {
      try { audioCtx.resume(); } catch (e) {}
    }
    return audioCtx;
  }

  /**
   * Play a single tone.
   * @param {number} freq       frequency in Hz
   * @param {number} startAt    offset (seconds) from now
   * @param {number} duration   seconds
   * @param {string} type       oscillator type
   * @param {number} gain       peak gain (0-1)
   */
  function tone(ctx, freq, startAt, duration, type, gain) {
    var osc = ctx.createOscillator();
    var g = ctx.createGain();
    osc.type = type || 'sine';
    osc.frequency.value = freq;
    var t0 = ctx.currentTime + startAt;
    var peak = gain == null ? 0.14 : gain;
    // Quick attack, smooth exponential release for a soft, non-harsh sound.
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(peak, t0 + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    osc.connect(g);
    g.connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + duration + 0.02);
  }

  function correct() {
    var ctx = getCtx();
    if (!ctx) return;
    // Two rising notes — a friendly confirmation.
    tone(ctx, 660, 0, 0.12, 'sine', 0.12);      // E5
    tone(ctx, 880, 0.09, 0.16, 'sine', 0.12);   // A5
  }

  function incorrect() {
    var ctx = getCtx();
    if (!ctx) return;
    // Low, soft two-tone — noticeable but not punishing.
    tone(ctx, 220, 0, 0.14, 'triangle', 0.10);  // A3
    tone(ctx, 175, 0.1, 0.2, 'triangle', 0.10); // F3
  }

  function fanfare() {
    var ctx = getCtx();
    if (!ctx) return;
    // Bright major arpeggio C-E-G-C.
    var notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach(function(f, i) {
      tone(ctx, f, i * 0.11, 0.28, 'triangle', 0.13);
    });
  }

  // ── Confetti ─────────────────────────────────────────────────────────
  var CONFETTI_COLORS = ['#e4572e', '#4361ee', '#f7a1c4', '#f4b942', '#2a9d8f', '#7c3aed'];

  function prefersReducedMotion() {
    return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function confetti(options) {
    if (prefersReducedMotion()) return;
    var opts = options || {};
    var count = opts.count || 90;

    var canvas = document.createElement('canvas');
    canvas.className = 'confetti-canvas';
    canvas.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:9999;';
    document.body.appendChild(canvas);

    var ctx = canvas.getContext('2d');
    var dpr = window.devicePixelRatio || 1;
    function resize() {
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
    }
    resize();

    var W = window.innerWidth;
    var H = window.innerHeight;
    // Burst originates near the top-centre and rains down.
    var originX = opts.x != null ? opts.x : W / 2;
    var originY = opts.y != null ? opts.y : H * 0.28;

    var parts = [];
    for (var i = 0; i < count; i++) {
      var angle = (Math.PI * 2) * (i / count) + Math.random();
      var speed = 4 + Math.random() * 7;
      parts.push({
        x: originX,
        y: originY,
        vx: Math.cos(angle) * speed * (0.6 + Math.random()),
        vy: Math.sin(angle) * speed - (2 + Math.random() * 3),
        size: 5 + Math.random() * 7,
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        rot: Math.random() * Math.PI,
        vr: (Math.random() - 0.5) * 0.3,
        life: 0
      });
    }

    var gravity = 0.22;
    var maxLife = 90; // frames (~1.5s at 60fps)
    var raf;

    function frame() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      var alive = false;
      for (var j = 0; j < parts.length; j++) {
        var p = parts[j];
        p.life++;
        if (p.life > maxLife) continue;
        alive = true;
        p.vy += gravity;
        p.x += p.vx;
        p.y += p.vy;
        p.rot += p.vr;
        var alpha = Math.max(0, 1 - p.life / maxLife);
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.translate(p.x * dpr, p.y * dpr);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2 * dpr, -p.size / 2 * dpr, p.size * dpr, p.size * dpr);
        ctx.restore();
      }
      if (alive) {
        raf = requestAnimationFrame(frame);
      } else {
        cancelAnimationFrame(raf);
        if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
      }
    }
    raf = requestAnimationFrame(frame);

    // Safety cleanup in case the tab is backgrounded.
    setTimeout(function() {
      if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
    }, 4000);
  }

  function celebrate(options) {
    confetti(options);
    fanfare();
  }

  window.Feedback = {
    correct: correct,
    incorrect: incorrect,
    celebrate: celebrate,
    confetti: confetti,
    isMuted: isMuted,
    setMuted: setMuted
  };
})();
