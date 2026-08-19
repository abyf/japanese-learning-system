/**
 * Curriculum navigation helper.
 * After an exercise/lesson is completed inside the Guided Plan, this figures out
 * the next step (next activity, or "day complete" guidance) and renders it.
 */
(function() {
  'use strict';

  function parseCtx() {
    var params = (window.location.hash || '').split('?')[1] || '';
    if (params.indexOf('from=curriculum') === -1) return null;
    var w = params.match(/week=(\d+)/);
    var d = params.match(/day=(\d+)/);
    var i = params.match(/idx=(\d+)/);
    if (!w || !d) return null;
    return { week: parseInt(w[1], 10), day: parseInt(d[1], 10), idx: i ? parseInt(i[1], 10) : null };
  }

  function titleOf(a) {
    var lang = window.App.getLanguage();
    if (lang === 'fr') return a.titleFr || a.title || '';
    if (lang === 'pt') return a.titlePt || a.title || '';
    return a.title || '';
  }

  function routeFor(a, week, day, idx) {
    var q = 'from=curriculum&week=' + week + '&day=' + day + '&idx=' + idx;
    if ((a.type === 'lesson' || a.type === 'deepdive') && a.route) {
      var sep = a.route.indexOf('?') !== -1 ? '&' : '?';
      return a.route + sep + q;
    }
    if (a.exerciseId) {
      var p = a.exerciseId.charAt(0);
      var base = p === 'v' ? '#/vocab/beginner/' :
                 p === 'r' ? '#/reading/beginner/' :
                 p === 'l' ? '#/listening/beginner/' : '#/dictation/beginner/';
      return base + a.exerciseId + '?' + q;
    }
    return null;
  }

  function escapeHtml(s) {
    var d = document.createElement('div');
    d.appendChild(document.createTextNode(s == null ? '' : String(s)));
    return d.innerHTML;
  }

  /**
   * Fill an element with the appropriate "next" call-to-action.
   * @param {string} elId - id of the container to fill
   */
  function renderInto(elId) {
    var el = document.getElementById(elId);
    if (!el) return;
    var ctx = parseCtx();

    if (!ctx) {
      el.innerHTML = '<a href="#/dashboard" class="btn btn--secondary">' + window.i18n('nav.dashboard') + '</a>';
      return;
    }

    var dayHref = '#/curriculum/' + ctx.week + '/' + ctx.day;

    window.API.get('/curriculum/week/' + ctx.week).then(function(wd) {
      var day = (wd.days || []).filter(function(d) { return d.day === ctx.day; })[0];
      if (!day) {
        el.innerHTML = '<a href="' + dayHref + '" class="btn btn--primary">' + window.i18n('activity.backToCurriculum') + '</a>';
        return;
      }
      var acts = day.activities || [];
      var nextIdx = -1;
      for (var k = 0; k < acts.length; k++) {
        if (!acts[k].completed) { nextIdx = k; break; }
      }

      if (nextIdx === -1) {
        // Whole day complete → guide to next day / week plan
        var isLastDay = ctx.day >= 7;
        var nextDayHref = isLastDay ? '#/curriculum/' + (ctx.week + 1) + '/1' : '#/curriculum/' + ctx.week + '/' + (ctx.day + 1);
        el.innerHTML =
          '<div class="next-cta next-cta--done">' +
            '<p class="next-cta__title">' + window.i18n('next.dayComplete') + '</p>' +
            '<div class="next-cta__actions">' +
              '<a href="' + nextDayHref + '" class="btn btn--primary btn--lg">' + window.i18n('next.nextDay') + ' →</a>' +
              '<a href="#/curriculum/' + ctx.week + '" class="btn btn--secondary">' + window.i18n('next.weekPlan') + '</a>' +
            '</div>' +
          '</div>';
        return;
      }

      var na = acts[nextIdx];
      var route = routeFor(na, ctx.week, ctx.day, nextIdx);
      var title = titleOf(na);
      el.innerHTML =
        '<div class="next-cta">' +
          (route ? '<a href="' + route + '" class="btn btn--primary btn--lg">' + window.i18n('next.next') + ': ' + escapeHtml(title) + ' →</a>' : '') +
          ' <a href="' + dayHref + '" class="btn btn--secondary">' + window.i18n('activity.backToCurriculum') + '</a>' +
        '</div>';
    }).catch(function() {
      el.innerHTML = '<a href="' + dayHref + '" class="btn btn--primary">' + window.i18n('activity.backToCurriculum') + '</a>';
    });
  }

  window.CurriculumNav = { renderInto: renderInto, parseCtx: parseCtx };
})();
