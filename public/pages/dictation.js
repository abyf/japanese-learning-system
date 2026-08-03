/**
 * Japanese Learning System - Dictation Activity Page
 */
(function() {
  'use strict';

  var exercise = null;
  var audioEl = null;

  function renderNav(active) {
    return window.App.renderNav(active);
  }

  function render(params) {
    var level = params.level;
    var id = (params.id || '').split('?')[0];
    var app = document.getElementById('app');

    app.innerHTML = renderNav('levels') +
      '<div class="page page--dictation">' +
        '<div class="dictation__loading">Loading exercise...</div>' +
      '</div>';

    window.API.get('/dictation/' + encodeURIComponent(level) + '/' + encodeURIComponent(id))
      .then(function(data) {
        exercise = data;
        renderExercise(level, id);
      })
      .catch(function(err) {
        var page = document.querySelector('.page--dictation');
        if (page) {
          page.innerHTML = '<div class="error-message">Failed to load exercise: ' + (err.message || 'Unknown error') + '</div>';
        }
      });
  }

  function renderExercise(level, id) {
    var page = document.querySelector('.page--dictation');
    if (!page || !exercise) return;

    var title = exercise.title || 'Dictation Exercise';
    var audioSrc = exercise.audioUrl || exercise.audio || '';

    page.innerHTML =
      '<div class="dictation__header">' +
        '<h1>' + escapeHtml(title) + '</h1>' +
      '</div>' +
      '<div class="dictation__player">' +
        '<input type="hidden" id="dictation-audio-text" value="' + escapeHtml(exercise.speechText || '') + '">' +
        '<div class="audio-controls">' +
          '<button class="btn btn--primary" id="play-btn">▶ Play</button>' +
          '<button class="btn btn--secondary" id="replay-btn">↺ Replay</button>' +
        '</div>' +
      '</div>' +
      '<form id="dictation-form" class="dictation__form">' +
        '<label class="form__label" for="dictation-input">Type what you hear:</label>' +
        '<textarea class="form__textarea dictation__input" id="dictation-input" name="text" rows="6" placeholder="日本語で入力してください..."></textarea>' +
        '<div class="form__actions mt-3">' +
          '<button class="btn btn--primary" type="submit">Submit</button>' +
          ' <a href="#/level/' + level + '/dictation" class="btn btn--secondary">← Back</a>' +
        '</div>' +
      '</form>' +
      '<div id="dictation-results" class="dictation__results" hidden></div>';

    audioEl = document.getElementById('dictation-audio');
    document.getElementById('play-btn').addEventListener('click', togglePlay);
    document.getElementById('replay-btn').addEventListener('click', replayAudio);

    document.getElementById('dictation-form').addEventListener('submit', function(e) {
      e.preventDefault();
      submitDictation(level, id);
    });
  }

  function togglePlay() {
    var btn = document.getElementById('play-btn');
    if (window.TTS.isSpeaking()) {
      window.TTS.stop();
      btn.textContent = '▶ Play';
    } else {
      // Use the hint or a generic prompt - actual text is hidden until submission
      // We'll fetch the audio text from a data attribute set during render
      var audioText = document.getElementById('dictation-audio-text');
      var text = audioText ? audioText.value : '';
      window.TTS.speak(text, { onEnd: function() {
        btn.textContent = '▶ Play';
      }});
      btn.textContent = '⏸ Stop';
    }
  }

  function replayAudio() {
    window.TTS.stop();
    var audioText = document.getElementById('dictation-audio-text');
    var text = audioText ? audioText.value : '';
    var btn = document.getElementById('play-btn');
    window.TTS.speak(text, { onEnd: function() {
      if (btn) btn.textContent = '▶ Play';
    }});
    if (btn) btn.textContent = '⏸ Stop';
  }

  function submitDictation(level, id) {
    var text = document.getElementById('dictation-input').value;

    window.API.post('/dictation/' + encodeURIComponent(level) + '/' + encodeURIComponent(id) + '/submit', { attempt: text })
      .then(function(result) {
        renderResults(result);
      })
      .catch(function(err) {
        var resultsEl = document.getElementById('dictation-results');
        if (resultsEl) {
          resultsEl.hidden = false;
          resultsEl.innerHTML = '<div class="error-message">Submission failed: ' + (err.message || 'Unknown error') + '</div>';
        }
      });
  }

  function renderResults(result) {
    var resultsEl = document.getElementById('dictation-results');
    if (!resultsEl) return;

    var accuracy = result.accuracy || 0;
    var pct = Math.round(accuracy * 100);
    var diff = result.charDiffs || result.diff || [];
    var expected = result.expected || '';
    var isCompleted = result.completed || (pct === 100);
    var cls = pct >= 80 ? 'text-success' : (pct >= 50 ? '' : 'text-danger');

    var statusHtml = '';
    if (isCompleted) {
      statusHtml = '<div class="result-banner result-banner--success">' +
        '<span class="result-banner__icon">🎉</span>' +
        '<span class="result-banner__text">Exercise Completed!</span>' +
      '</div>';
    } else {
      statusHtml = '<div class="result-banner result-banner--retry">' +
        '<span class="result-banner__icon">📝</span>' +
        '<span class="result-banner__text">Not quite — try again to complete this exercise</span>' +
      '</div>';
    }

    resultsEl.hidden = false;
    resultsEl.innerHTML =
      statusHtml +
      '<h2>Results</h2>' +
      '<p class="dictation__accuracy ' + cls + '">Accuracy: <strong>' + pct + '%</strong></p>' +
      '<div class="dictation__diff">' +
        '<h3>Character Comparison</h3>' +
        '<div class="diff-display">' + renderDiff(diff) + '</div>' +
      '</div>' +
      (expected ? '<div class="dictation__expected mt-2"><h3>Expected Text</h3><p class="dictation__expected-text">' + escapeHtml(expected) + '</p></div>' : '') +
      '<div class="reading__actions mt-3">' +
        (isCompleted
          ? '<a href="#/level/' + (exercise ? exercise.level : 'beginner') + '/dictation" class="btn">Next Exercise →</a>'
          : '<button class="btn btn--primary" id="retry-btn">Retry</button>') +
        ' <a href="#/dashboard" class="btn btn--secondary">Dashboard</a>' +
      '</div>';

    // Hide the form
    var form = document.getElementById('dictation-form');
    if (form) {
      var btn = form.querySelector('button[type="submit"]');
      if (btn) btn.hidden = true;
    }

    // Retry handler
    if (!isCompleted) {
      var retryBtn = document.getElementById('retry-btn');
      if (retryBtn) {
        retryBtn.addEventListener('click', function() {
          var route = window.Router.getCurrentRoute();
          if (route && route.params) render(route.params);
        });
      }
    }
  }

  function renderDiff(diff) {
    if (!diff || !diff.length) return '<span class="text-secondary">No diff available</span>';

    return diff.map(function(item) {
      var char = item.expected || item.actual || item.char || item.character || ' ';
      var displayChar = escapeHtml(char);
      var status = item.status || 'correct';

      if (status === 'correct') {
        return '<span class="diff-char diff-char--correct">' + displayChar + '</span>';
      } else if (status === 'missing') {
        return '<span class="diff-char diff-char--incorrect" title="missing">' + displayChar + '</span>';
      } else if (status === 'extra') {
        return '<span class="diff-char diff-char--extra" title="extra">' + escapeHtml(item.actual || '') + '</span>';
      } else {
        return '<span class="diff-char diff-char--incorrect">' + displayChar + '</span>';
      }
    }).join('');
  }

  function escapeHtml(str) {
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
  }

  window.Router.registerRoute('/dictation/:level/:id', render);
})();
