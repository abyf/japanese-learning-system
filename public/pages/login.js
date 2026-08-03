/**
 * Japanese Learning System - Login Page
 */
(function() {
  'use strict';

  function render() {
    var app = document.getElementById('app');
    app.innerHTML =
      '<div class="page page--auth">' +
        '<div class="auth-card">' +
          '<h1 class="auth-card__title">ログイン</h1>' +
          '<p class="auth-card__subtitle">Japanese Learning System</p>' +
          '<form id="login-form" class="form" novalidate>' +
            '<div class="form__group">' +
              '<label class="form__label" for="username">Username</label>' +
              '<input class="form__input" type="text" id="username" name="username" autocomplete="username" required>' +
            '</div>' +
            '<div class="form__group">' +
              '<label class="form__label" for="password">Password</label>' +
              '<input class="form__input" type="password" id="password" name="password" autocomplete="current-password" required>' +
            '</div>' +
            '<div id="login-error" class="form__error" role="alert" hidden></div>' +
            '<button class="btn btn--primary btn--block" type="submit">Login</button>' +
          '</form>' +
          '<p class="auth-card__footer">' +
            'Don\'t have an account? <a href="#/register">Register</a>' +
          '</p>' +
        '</div>' +
      '</div>';

    document.getElementById('login-form').addEventListener('submit', handleSubmit);
  }

  function handleSubmit(e) {
    e.preventDefault();
    var username = document.getElementById('username').value.trim();
    var password = document.getElementById('password').value;
    var errorEl = document.getElementById('login-error');

    errorEl.hidden = true;
    errorEl.textContent = '';

    if (!username || !password) {
      errorEl.textContent = 'Please enter username and password.';
      errorEl.hidden = false;
      return;
    }

    window.API.post('/auth/login', { username: username, password: password })
      .then(function() {
        window.location.hash = '#/dashboard';
      })
      .catch(function() {
        errorEl.textContent = 'Invalid username or password';
        errorEl.hidden = false;
      });
  }

  window.Router.registerRoute('/login', render);
})();
