/**
 * Japanese Learning System - API Client Wrapper
 * Handles all fetch calls with auth redirect, loading states, and error handling.
 */
(function() {
  'use strict';

  var loadingCount = 0;
  var loadingEl = null;

  /**
   * Get or create the loading overlay element.
   */
  function getLoadingEl() {
    if (!loadingEl) {
      loadingEl = document.getElementById('loading-overlay');
      if (!loadingEl) {
        loadingEl = document.createElement('div');
        loadingEl.id = 'loading-overlay';
        loadingEl.className = 'loading loading--overlay loading--hidden';
        loadingEl.setAttribute('aria-live', 'polite');
        loadingEl.setAttribute('aria-label', 'Loading');
        loadingEl.textContent = 'Loading...';
        document.body.appendChild(loadingEl);
      }
    }
    return loadingEl;
  }

  /**
   * Show the loading indicator.
   */
  function showLoading() {
    loadingCount++;
    if (loadingCount === 1) {
      getLoadingEl().classList.remove('loading--hidden');
    }
  }

  /**
   * Hide the loading indicator.
   */
  function hideLoading() {
    loadingCount = Math.max(0, loadingCount - 1);
    if (loadingCount === 0) {
      getLoadingEl().classList.add('loading--hidden');
    }
  }

  /**
   * Core request function.
   * @param {string} method - HTTP method
   * @param {string} path - API path (e.g., '/auth/me')
   * @param {object|null} body - Request body for POST/PUT
   * @returns {Promise<any>} Parsed JSON response
   */
  function request(method, path, body) {
    showLoading();

    var url = '/api' + path;
    var options = {
      method: method,
      credentials: 'same-origin',
      headers: {}
    };

    if (body && (method === 'POST' || method === 'PUT')) {
      options.headers['Content-Type'] = 'application/json';
      options.body = JSON.stringify(body);
    }

    return fetch(url, options)
      .then(function(res) {
        hideLoading();

        // Handle 401 - redirect to login
        if (res.status === 401) {
          window.location.hash = '#/login';
          return Promise.reject(new Error('Unauthorized'));
        }

        // Parse response body
        return res.text().then(function(text) {
          var data;
          try {
            data = text ? JSON.parse(text) : null;
          } catch (e) {
            data = null;
          }

          if (!res.ok) {
            var errorMsg = (data && data.error) || (data && data.message) || 'Request failed (' + res.status + ')';
            return Promise.reject(new Error(errorMsg));
          }

          return data;
        });
      })
      .catch(function(err) {
        hideLoading();
        throw err;
      });
  }

  /**
   * GET request.
   * @param {string} path - API path
   * @returns {Promise<any>}
   */
  function get(path) {
    return request('GET', path, null);
  }

  /**
   * POST request.
   * @param {string} path - API path
   * @param {object} body - Request body
   * @returns {Promise<any>}
   */
  function post(path, body) {
    return request('POST', path, body);
  }

  /**
   * PUT request.
   * @param {string} path - API path
   * @param {object} body - Request body
   * @returns {Promise<any>}
   */
  function put(path, body) {
    return request('PUT', path, body);
  }

  // Export to global namespace
  window.API = {
    get: get,
    post: post,
    put: put
  };

})();
