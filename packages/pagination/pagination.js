/* packages/pagination/pagination.js — which page numbers a PLP pagination shows (decision 0179, Figma page
   `pagination`, set `pagination`). ONE calculation for the build (apps/storefront/pages/plp.js → packages/ui
   Pagination) and the browser (scripts/site.js re-draws it after every filter / sort / page change). No dependencies,
   no DOM. Works as a CommonJS module and as a classic script (window.HighmuzikPagination).

   Rules (Gio 2026-11-24, Figma proposal accepted):
   · always the first and the last page, the current one and its neighbours: `siblings` = 1 on desktop, 0 on mobile
   · a gap "…" stands for 2 or more pages; a single missing page is shown as its number
   · a fixed number of slots (2 × siblings + 5: desktop 7, mobile 5), so the bar does not change while paging
   · Previous / Next exist only when there is a page to go to (never disabled: disabled = sold out, struck label) */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.HighmuzikPagination = factory();
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var DEFAULT_PER_PAGE = 20;   // admin → Settings → Records per page (shop_settings.records_per_page, migration 0039)
  var DEVICES = { desktop: 1, mobile: 0 };   // siblings of the current page on each device (Figma variants)

  // how many pages for `count` records
  function pageCount(count, perPage) {
    var per = perPage > 0 ? perPage : DEFAULT_PER_PAGE;
    return Math.max(1, Math.ceil(count / per));
  }
  // a page number from anywhere (URL, input) → 1 … total
  function clamp(page, total) {
    var n = parseInt(page, 10);
    if (!(n >= 1)) n = 1;
    return Math.min(n, Math.max(1, total));
  }

  // the page numbers of one device, in order, with 'gap' where pages are left out
  function pages(current, total, siblings) {
    var slots = 2 * siblings + 5, out = [], i;
    if (total <= slots) { for (i = 1; i <= total; i++) out.push(i); return out; }
    if (current <= siblings + 3) {                       // near the start: 1 2 3 4 5 … 12
      for (i = 1; i <= 2 * siblings + 3; i++) out.push(i);
      return out.concat(['gap', total]);
    }
    if (current >= total - siblings - 2) {               // near the end: 1 … 8 9 10 11 12
      out = [1, 'gap'];
      for (i = total - 2 * siblings - 2; i <= total; i++) out.push(i);
      return out;
    }
    out = [1, 'gap'];                                    // in the middle: 1 … 5 6 7 … 12
    for (i = current - siblings; i <= current + siblings; i++) out.push(i);
    return out.concat(['gap', total]);
  }

  // one list for every device (the markup is rendered once; CSS shows each item on its devices):
  // [{ kind: 'previous' | 'page' | 'current' | 'gap' | 'next', page?, devices: ['desktop', 'mobile'] }]
  function items(current, total) {
    var names = Object.keys(DEVICES);
    var sets = {}, all = {};
    names.forEach(function (d) {
      sets[d] = pages(current, total, DEVICES[d]).filter(function (p) { return p !== 'gap'; });
      sets[d].forEach(function (p) { all[p] = true; });
    });
    var nums = Object.keys(all).map(Number).sort(function (a, b) { return a - b; });
    var out = [], last = {};
    if (current > 1) out.push({ kind: 'previous', page: current - 1, devices: names.slice() });
    nums.forEach(function (p) {
      names.forEach(function (d) {
        if (sets[d].indexOf(p) === -1) return;
        if (last[d] && p - last[d] > 1) {
          var prev = out[out.length - 1];
          if (prev && prev.kind === 'gap') prev.devices.push(d);   // the other device's gap at the same place: one item
          else out.push({ kind: 'gap', devices: [d] });
        }
        last[d] = p;
      });
      out.push({ kind: p === current ? 'current' : 'page', page: p,
        devices: names.filter(function (d) { return sets[d].indexOf(p) !== -1; }) });
    });
    if (current < total) out.push({ kind: 'next', page: current + 1, devices: names.slice() });
    return out;
  }

  return { DEFAULT_PER_PAGE: DEFAULT_PER_PAGE, pageCount: pageCount, clamp: clamp, pages: pages, items: items };
}));
