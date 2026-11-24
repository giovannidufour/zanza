/* packages/collections/collections.js — which records are in a collection (decision 0174, migration 0038).
   ONE rule for the shop build (the home cards and /collections/<slug>/) and the admin (Collections: the records
   column and the list's summary). No dependencies, no DOM. CommonJS (build, tests), classic script (window.ZanzaCollections).

   collection = { years: ['1960s', '1983'], genres: ['Roots'], tags: ['Digi'] }   (genre / tag NAMES: callers resolve
                the ids of public.collections with the genres and tags tables; an id that is gone is simply left out)
   record     = { year, year_precision ('year' | 'decade'), genres: [names], tags: [names] }   (a release)

   A record is in when it matches every rule that is filled in; inside a rule any value is enough (the PLP filters,
   decision 0028). Names compare without case. Years: "1960s" = 1960–1969; "1983" = that year only. A record dated by
   its decade only (year_precision 'decade', "1980s", decision 0082) matches its decade, never an exact year. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.ZanzaCollections = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var YEAR = /^(\d{4})(s?)$/;

  // "1960s" → { from: 1960, to: 1969, decade: true }; "1983" → { from: 1983, to: 1983 }; anything else → null.
  // A decade must start on a round year ("1965s" is not one).
  function parseYear(value) {
    var m = YEAR.exec(String(value || '').trim().toLowerCase());
    if (!m) return null;
    var y = Number(m[1]);
    if (m[2]) return y % 10 === 0 ? { from: y, to: y + 9, decade: true } : null;
    return { from: y, to: y, decade: false };
  }

  function lower(list) { return (list || []).map(function (x) { return String(x).toLowerCase(); }); }
  function anyOf(have, wanted) {
    var h = lower(have);
    return lower(wanted).some(function (w) { return h.indexOf(w) !== -1; });
  }

  function yearMatches(record, values) {
    var y = Number(record.year);
    if (!record.year || !isFinite(y)) return false;
    var decadeOnly = record.year_precision === 'decade';
    return values.some(function (v) {
      var r = parseYear(v);
      if (!r) return false;
      if (decadeOnly) return r.decade && r.from === Math.floor(y / 10) * 10;
      return y >= r.from && y <= r.to;
    });
  }

  function hasRule(c) { return !!((c.years || []).length || (c.genres || []).length || (c.tags || []).length); }

  function matches(c, record) {
    if (!hasRule(c)) return false;
    if ((c.years || []).length && !yearMatches(record, c.years)) return false;
    if ((c.genres || []).length && !anyOf(record.genres, c.genres)) return false;
    if ((c.tags || []).length && !anyOf(record.tags, c.tags)) return false;
    return true;
  }

  // the list's Rules column: "Years: 1960s, 1970s · Tags: Digi, Dancehall Digi"
  function summary(c) {
    return [['Years', c.years], ['Genres', c.genres], ['Tags', c.tags]]
      .filter(function (r) { return (r[1] || []).length; })
      .map(function (r) { return r[0] + ': ' + r[1].join(', '); }).join(' · ');
  }

  // years as typed in the admin → the stored values, sorted (decades before the years inside them); bad ones listed
  function cleanYears(values) {
    var ok = [], bad = [];
    (values || []).forEach(function (v) {
      var s = String(v || '').trim().toLowerCase();
      if (!s) return;
      if (parseYear(s)) { if (ok.indexOf(s) === -1) ok.push(s); } else bad.push(String(v).trim());
    });
    ok.sort(function (a, b) { return parseYear(a).from - parseYear(b).from || (parseYear(b).decade ? 1 : 0) - (parseYear(a).decade ? 1 : 0); });
    return { years: ok, bad: bad };
  }

  // a public.collections row + the genres and tags tables ([{ id, name }]) → a collection with names
  function resolve(row, genres, tags) {
    function names(ids, list) {
      return (ids || []).map(function (id) { var x = (list || []).filter(function (t) { return t.id === id; })[0]; return x ? x.name : null; })
        .filter(Boolean);
    }
    return { id: row.id, name: row.name, slug: row.slug, on_home: row.on_home !== false, sort_order: row.sort_order,
      years: row.years || [], genres: names(row.genre_ids, genres), tags: names(row.tag_ids, tags) };
  }

  return { parseYear: parseYear, matches: matches, hasRule: hasRule, summary: summary, cleanYears: cleanYears, resolve: resolve };
});
