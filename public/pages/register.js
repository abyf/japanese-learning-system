/**
 * Japanese Learning System - Registration Page
 */
(function() {
  'use strict';

  function render() {
    var app = document.getElementById('app');
    app.innerHTML =
      '<div class="page page--auth">' +
        '<div class="auth-card">' +
          '<h1 class="auth-card__title">新規登録</h1>' +
          '<p class="auth-card__subtitle">Create your account</p>' +
          '<form id="register-form" class="form" novalidate>' +
            '<div class="form__group">' +
              '<label class="form__label" for="username">Username</label>' +
              '<input class="form__input" type="text" id="username" name="username" autocomplete="username" required>' +
            '</div>' +
            '<div class="form__group">' +
              '<label class="form__label" for="email">Email</label>' +
              '<input class="form__input" type="email" id="email" name="email" autocomplete="email" required placeholder="your@email.com">' +
            '</div>' +
            '<div class="form__group">' +
              '<label class="form__label" for="password">Password</label>' +
              '<input class="form__input" type="password" id="password" name="password" autocomplete="new-password" required>' +
              '<span class="form__hint">Minimum 4 characters</span>' +
            '</div>' +
            '<div class="form__group">' +
              '<label class="form__label" for="confirm-password">Confirm Password</label>' +
              '<input class="form__input" type="password" id="confirm-password" name="confirm-password" autocomplete="new-password" required>' +
            '</div>' +
            '<div id="register-error" class="form__error" role="alert" hidden></div>' +
            '<button class="btn btn--primary btn--block" type="submit">Register</button>' +
          '</form>' +
          '<p class="auth-card__footer">' +
            'Already have an account? <a href="#/login">Login</a>' +
          '</p>' +
        '</div>' +
      '</div>';

    document.getElementById('register-form').addEventListener('submit', handleSubmit);
  }

  function handleSubmit(e) {
    e.preventDefault();
    var username = document.getElementById('username').value.trim();
    var email = document.getElementById('email').value.trim();
    var password = document.getElementById('password').value;
    var confirmPassword = document.getElementById('confirm-password').value;
    var errorEl = document.getElementById('register-error');

    errorEl.hidden = true;
    errorEl.textContent = '';

    if (!username || !password || !confirmPassword) {
      errorEl.textContent = 'All fields are required.';
      errorEl.hidden = false;
      return;
    }

    if (password.length < 4) {
      errorEl.textContent = 'Password must be at least 4 characters.';
      errorEl.hidden = false;
      return;
    }

    if (password !== confirmPassword) {
      errorEl.textContent = 'Passwords do not match.';
      errorEl.hidden = false;
      return;
    }

    window.API.post('/auth/register', { username: username, email: email, password: password })
      .then(function() {
        window.location.hash = '#/dashboard';
      })
      .catch(function(err) {
        errorEl.textContent = err.message || 'Registration failed. Please try again.';
        errorEl.hidden = false;
      });
  }

  window.Router.registerRoute('/register', render);
})();
