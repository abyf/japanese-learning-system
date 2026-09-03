/**
 * Platform Auth - Browser-side Supabase Auth bridge (Task 3.2)
 *
 * Loads the Supabase client (from CDN), initializes it with the public config
 * fetched from /api/platform/config, and exposes a simple auth API:
 *
 *   window.PlatformAuth.init()                      -> Promise (call once on boot)
 *   window.PlatformAuth.signUp({email, password, displayName}) -> Promise
 *   window.PlatformAuth.signIn({email, password})   -> Promise
 *   window.PlatformAuth.signOut()                   -> Promise
 *   window.PlatformAuth.resetPassword(email)        -> Promise
 *   window.PlatformAuth.getSession()                -> { user, accessToken } | null
 *   window.PlatformAuth.onAuthChange(callback)      -> subscription
 *   window.PlatformAuth.getAccessToken()            -> string | null
 *   window.PlatformAuth.isReady()                   -> boolean
 *
 * The access token is kept in memory (auto-refreshed by the Supabase client).
 * Other modules (e.g., api.js) call getAccessToken() to attach it to requests.
 */
(function() {
  'use strict';

  var supabase = null;
  var currentSession = null;
  var ready = false;
  var authChangeCbs = [];

  /**
   * Initialize: fetch public config, load the Supabase CDN script, create client.
   * Called once on app boot. Safe to call multiple times (idempotent).
   */
  function init() {
    if (ready && supabase) return Promise.resolve();

    return fetch('/api/platform/config')
      .then(function(r) { return r.json(); })
      .then(function(cfg) {
        if (!cfg.supabaseUrl || !cfg.supabaseAnonKey) {
          console.warn('[platform-auth] Supabase not configured; platform auth disabled.');
          return;
        }
        return loadSupabaseScript().then(function() {
          if (!window.supabase || !window.supabase.createClient) {
            console.error('[platform-auth] supabase-js not loaded.');
            return;
          }
          supabase = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey);

          // Listen for auth state changes (login, logout, token refresh).
          supabase.auth.onAuthStateChange(function(_event, session) {
            currentSession = session;
            authChangeCbs.forEach(function(cb) {
              try { cb(session ? { user: session.user, accessToken: session.access_token } : null); } catch (e) {}
            });
          });

          // Grab the initial session (may be persisted from a previous visit).
          return supabase.auth.getSession().then(function(res) {
            currentSession = res.data.session;
            ready = true;
          });
        });
      })
      .catch(function(err) {
        console.warn('[platform-auth] Init failed:', err.message || err);
      });
  }

  /**
   * Load the Supabase JS CDN script (once).
   */
  function loadSupabaseScript() {
    if (window.supabase && window.supabase.createClient) return Promise.resolve();

    return new Promise(function(resolve, reject) {
      var s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js';
      s.onload = resolve;
      s.onerror = function() { reject(new Error('Failed to load supabase-js from CDN')); };
      document.head.appendChild(s);
    });
  }

  function signUp(opts) {
    if (!supabase) return Promise.reject(new Error('Not initialized'));
    return supabase.auth.signUp({
      email: opts.email,
      password: opts.password,
      options: {
        data: { display_name: opts.displayName || opts.email.split('@')[0] }
      }
    }).then(function(res) {
      if (res.error) throw res.error;
      return res.data;
    });
  }

  function signIn(opts) {
    if (!supabase) return Promise.reject(new Error('Not initialized'));
    return supabase.auth.signInWithPassword({
      email: opts.email,
      password: opts.password
    }).then(function(res) {
      if (res.error) throw res.error;
      currentSession = res.data.session;
      return res.data;
    });
  }

  function signOut() {
    if (!supabase) return Promise.reject(new Error('Not initialized'));
    return supabase.auth.signOut().then(function(res) {
      currentSession = null;
      if (res.error) throw res.error;
    });
  }

  function resetPassword(email) {
    if (!supabase) return Promise.reject(new Error('Not initialized'));
    return supabase.auth.resetPasswordForEmail(email).then(function(res) {
      if (res.error) throw res.error;
    });
  }

  function getSession() {
    if (!currentSession) return null;
    return {
      user: currentSession.user,
      accessToken: currentSession.access_token
    };
  }

  function getAccessToken() {
    return currentSession ? currentSession.access_token : null;
  }

  function onAuthChange(cb) {
    authChangeCbs.push(cb);
    // Return an unsubscribe function.
    return { unsubscribe: function() { authChangeCbs = authChangeCbs.filter(function(c) { return c !== cb; }); } };
  }

  function isReady() { return ready; }

  window.PlatformAuth = {
    init: init,
    signUp: signUp,
    signIn: signIn,
    signOut: signOut,
    resetPassword: resetPassword,
    getSession: getSession,
    getAccessToken: getAccessToken,
    onAuthChange: onAuthChange,
    isReady: isReady
  };
})();
