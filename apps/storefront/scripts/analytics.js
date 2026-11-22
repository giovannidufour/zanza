/* apps/storefront/scripts/analytics.js — shop analytics (decision 0131): PostHog EU, cookieless.

   Loaded only when site.json → analytics.key is set (build.js), right after js/posthog.js (posthog-js array build, served
   from our own domain) and before site.js, so site.js can call window.ZanzaAnalytics.track() from its first run.

   Privacy (Gio, 2026-11-22: "only solutions that need no cookies"):
   - cookieless_mode 'always' + persistence 'memory': nothing is written to the visitor's device (no cookie, no
     localStorage, no sessionStorage), so no consent banner. Visitors are counted by a daily server-side hash.
   - no session recordings, no surveys, no person profiles, no identify().
   - heatmaps (clicks, scroll depth) and web vitals on; autocapture never records what people type in fields.
   - search terms that look like an email address or a phone number are not sent.
   - never on the admin (separate app, never loads this file).

   Every event carries `template` (home, plp, search, pdp_sale, pdp_trade, bag…), from data-template on .zz-page, which
   build.js writes and the soft navigation in site.js swaps with the page: PostHog groups by template, not by URL. */
(function () {
  'use strict';
  var config = window.ZanzaAnalyticsConfig || {};
  var ph = window.posthog;

  function template() {
    var page = document.querySelector('.zz-page[data-template]');
    return page ? page.getAttribute('data-template') : 'other';
  }

  // a search term is only sent when it cannot be personal data
  function safeTerm(q) {
    var t = String(q || '').trim().toLowerCase().slice(0, 80);
    if (!t) return '';
    if (t.indexOf('@') >= 0) return '';
    if ((t.match(/\d/g) || []).length >= 6) return '';
    return t;
  }

  // the owner's own browsers (Gio, 2026-11-22: "exclude me"): ?analytics=off once per browser turns analytics off
  // there for good, ?analytics=on turns it back on. An IP filter can't work: cookieless mode drops the IP first.
  // This flag is the only thing analytics writes, and only in a browser that asked for it.
  var OFF_KEY = 'zanza-analytics-off';
  var optedOut = false;
  try {
    var flag = new URLSearchParams(location.search).get('analytics');
    if (flag === 'off') localStorage.setItem(OFF_KEY, '1');
    if (flag === 'on') localStorage.removeItem(OFF_KEY);
    optedOut = localStorage.getItem(OFF_KEY) === '1';
  } catch (e) { /* no storage: stay on */ }

  var on = !optedOut && !!(config.key && ph && typeof ph.init === 'function');
  if (on) {
    ph.init(config.key, {
      api_host: config.host || 'https://eu.i.posthog.com',
      ui_host: 'https://eu.posthog.com',
      cookieless_mode: 'always',
      persistence: 'memory',
      person_profiles: 'never',
      capture_pageview: 'history_change',   // soft navigation (site.js pushState) counts as a page view; filters do not
      capture_pageleave: true,
      autocapture: true,
      enable_heatmaps: true,
      capture_performance: { web_vitals: true },
      disable_session_recording: true,
      disable_surveys: true,
      mask_all_element_attributes: false,
      mask_all_text: false,
      // every event: which page template it happened on
      before_send: function (event) {
        if (event && event.properties) event.properties.template = template();
        return event;
      }
    });
  }

  window.ZanzaAnalytics = {
    // track('search', { term: 'roots', results: 4 }); a no-op when analytics is off
    track: function (name, props) {
      if (!on) return;
      try { ph.capture(name, props || {}); } catch (e) { /* analytics never breaks the shop */ }
    },
    safeTerm: safeTerm
  };
})();
