/**
 * Japanese Learning System - Settings Page
 */
(function() {
  'use strict';

  function renderNav(active) {
    return window.App.renderNav(active);
  }

  function render() {
    var app = document.getElementById('app');
    app.innerHTML = renderNav('settings') +
      '<div class="page page--settings">' +
        '<h1>' + window.i18n('settings.title') + '</h1>' +
        '<div class="settings__grid">' +
          '<section class="settings__section">' +
            '<h2>' + window.i18n('settings.theme') + '</h2>' +
            '<div class="form__group form__group--inline">' +
              '<label class="form__label" for="theme-toggle">' + window.i18n('settings.theme') + '</label>' +
              '<button class="btn btn--small" id="theme-toggle">' + window.i18n('settings.toggleTheme') + '</button>' +
            '</div>' +
          '</section>' +

          '<section class="settings__section">' +
            '<h2>' + window.i18n('settings.language') + '</h2>' +
            '<div class="form__group">' +
              '<label class="form__label" for="language-select">' + window.i18n('settings.language') + '</label>' +
              '<select class="form__input form__input--small" id="language-select">' +
                (window.i18n && window.i18n.languages
                  ? window.i18n.languages.map(function(l) {
                      return '<option value="' + l.code + '">' + l.flag + ' ' + l.name + '</option>';
                    }).join('')
                  : '<option value="en">🇬🇧 English</option><option value="fr">🇫🇷 Français</option>') +
              '</select>' +
            '</div>' +
          '</section>' +

          '<section class="settings__section">' +
            '<h2>' + window.i18n('settings.cardsPerDay') + '</h2>' +
            '<div class="form__group">' +
              '<label class="form__label" for="cards-per-day">' + window.i18n('settings.cardsPerDay') + '</label>' +
              '<input class="form__input form__input--small" type="number" id="cards-per-day" min="1" max="50" value="10">' +
            '</div>' +
            '<div class="form__group">' +
              '<label class="form__label" for="session-duration">' + window.i18n('settings.sessionDuration') + '</label>' +
              '<input class="form__input form__input--small" type="number" id="session-duration" min="5" max="120" value="30">' +
            '</div>' +
            '<div class="form__group form__group--inline">' +
              '<label class="form__label" for="furigana-default">' + window.i18n('settings.furigana') + '</label>' +
              '<input type="checkbox" id="furigana-default" checked>' +
            '</div>' +
            '<button class="btn btn--primary" id="save-settings-btn">' + window.i18n('settings.save') + '</button>' +
            '<span id="settings-saved" class="text-success" hidden>✓</span>' +
          '</section>' +

          '<section class="settings__section">' +
            '<h2>Data</h2>' +
            '<div class="settings__actions">' +
              '<button class="btn btn--secondary" id="export-btn">' + window.i18n('settings.export') + '</button>' +
              '<div class="form__group">' +
                '<label class="btn btn--secondary" for="import-file">' + window.i18n('settings.import') + '</label>' +
                '<input type="file" id="import-file" accept=".json" hidden>' +
              '</div>' +
            '</div>' +
            '<div id="import-status" class="form__hint" hidden></div>' +
          '</section>' +

          '<section class="settings__section">' +
            '<button class="btn btn--danger" id="logout-btn">' + window.i18n('settings.logout') + '</button>' +
          '</section>' +
        '</div>' +
      '</div>';

    attachEventListeners();
    loadCurrentSettings();
  }

  function loadCurrentSettings() {
    var cardsPerDay = localStorage.getItem('jls_cardsPerDay');
    var sessionDuration = localStorage.getItem('jls_sessionDuration');
    var furiganaDefault = localStorage.getItem('jls_furiganaDefault');
    var language = window.App.getLanguage();

    if (cardsPerDay) document.getElementById('cards-per-day').value = cardsPerDay;
    if (sessionDuration) document.getElementById('session-duration').value = sessionDuration;
    if (furiganaDefault !== null) document.getElementById('furigana-default').checked = furiganaDefault !== 'false';

    var langSelect = document.getElementById('language-select');
    if (langSelect) langSelect.value = language;
  }

  function attachEventListeners() {
    // Theme toggle
    document.getElementById('theme-toggle').addEventListener('click', function() {
      if (window.Theme && window.Theme.toggleTheme) {
        window.Theme.toggleTheme();
      }
    });

    // Language selector
    document.getElementById('language-select').addEventListener('change', function(e) {
      var lang = e.target.value;
      window.App.setLanguage(lang);
      // Persist to backend
      window.API.put('/settings', { language: lang }).catch(function() {});
    });

    // Save settings
    document.getElementById('save-settings-btn').addEventListener('click', function() {
      var cardsPerDay = document.getElementById('cards-per-day').value;
      var sessionDuration = document.getElementById('session-duration').value;
      var furiganaDefault = document.getElementById('furigana-default').checked;

      localStorage.setItem('jls_cardsPerDay', cardsPerDay);
      localStorage.setItem('jls_sessionDuration', sessionDuration);
      localStorage.setItem('jls_furiganaDefault', String(furiganaDefault));

      var savedEl = document.getElementById('settings-saved');
      savedEl.hidden = false;
      setTimeout(function() { savedEl.hidden = true; }, 2000);
    });

    // Export
    document.getElementById('export-btn').addEventListener('click', function() {
      window.API.get('/export')
        .then(function(data) {
          var blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
          var url = URL.createObjectURL(blob);
          var a = document.createElement('a');
          a.href = url;
          a.download = 'japanese-learning-export.json';
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        })
        .catch(function(err) {
          alert('Export failed: ' + (err.message || 'Unknown error'));
        });
    });

    // Import
    document.getElementById('import-file').addEventListener('change', function(e) {
      var file = e.target.files[0];
      if (!file) return;

      var statusEl = document.getElementById('import-status');
      statusEl.hidden = false;
      statusEl.textContent = 'Importing...';
      statusEl.className = 'form__hint';

      var reader = new FileReader();
      reader.onload = function(ev) {
        try {
          var data = JSON.parse(ev.target.result);
          window.API.post('/import', data)
            .then(function() {
              statusEl.textContent = 'Import successful!';
              statusEl.className = 'form__hint text-success';
            })
            .catch(function(err) {
              statusEl.textContent = 'Import failed: ' + (err.message || 'Unknown error');
              statusEl.className = 'form__hint text-danger';
            });
        } catch (parseErr) {
          statusEl.textContent = 'Invalid JSON file.';
          statusEl.className = 'form__hint text-danger';
        }
      };
      reader.readAsText(file);
    });

    // Logout
    document.getElementById('logout-btn').addEventListener('click', function() {
      window.API.post('/auth/logout', {}).then(function() {
        window.location.hash = '#/login';
      }).catch(function() {
        window.location.hash = '#/login';
      });
    });
  }

  window.Router.registerRoute('/settings', render);
})();
