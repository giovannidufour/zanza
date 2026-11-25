/* packages/file-names/file-names.js — the file names of a listing's scans and clips (decision 0136).
   ONE rule for every place that names files: the admin (Edit listing → File names) and the Edge Function
   scan-targets that the macOS Scanner reads (decision 0138). The Scanner never builds a name itself.
   No dependencies, no DOM. CommonJS (build, tests), classic script (window.HighmuzikFileNames), Deno via globalThis.

   name  = <sku>_<role>_<slug> (+ the extension the file already has)
   role  = 1 label A, 2 label B, 3 other photos (then 4, 5… in gallery order); a1, b1… = the Discogs position of a
           line (a / b by line order when the listing has no release positions)
   slug  = what is in the file, for Gio in Finder only, never read by a parser: artist + title of the line (labels:
           the main line of that side; other photos: line 1). ASCII, lowercase, hyphens, & → and, ≤ 60 chars cut at
           a hyphen. A line without its own artist takes line 1's.
   lines = [{ artist, title }] in line order; artist = the credit as printed (release_lines.artist in the DB).
   positions = the Discogs positions by line ("A1", "B"…), [] = none, null = not read yet (clip rows left out). */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.HighmuzikFileNames = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  function fileSlug(text) {
    var s = String(text || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
      .replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    if (s.length > 60) { s = s.slice(0, 60); var cut = s.lastIndexOf('-'); if (cut > 30) s = s.slice(0, cut); s = s.replace(/-+$/, ''); }
    return s;
  }

  function text(v) { return String(v || '').trim(); }

  function lineSlug(lines, i) {
    var l = lines[i]; if (!l) return '';
    var artist = text(l.artist) || (i > 0 && lines[0] ? text(lines[0].artist) : '');
    return fileSlug([artist, text(l.title)].filter(Boolean).join(' '));
  }

  // [{ key, role, name }]: Label A, Label B, Other photos, then one row per line with a clip role
  function fileNames(sku, lines, positions) {
    lines = lines || [];
    function name(role, slug) { return [sku, role, slug].filter(Boolean).join('_'); }
    // "A1", "a-1", "A.1" → a1; numbers only ("1", "2", releases with no sides) give no side
    var pos = (positions || []).map(function (p) {
      var q = String(p || '').replace(/[^a-z0-9]/gi, '');
      return /^[a-z]{1,2}\d{0,2}$/i.test(q) ? q.toLowerCase() : '';
    });
    // no position names a side (e.g. Discogs tracklist 1, 2): line order, as when there is no release (Gio 2026-11-23)
    if (pos.length && pos.every(function (p) { return !p; })) pos = [];
    function sideLine(side, fallback) {
      var i = pos.findIndex(function (p) { return p.charAt(0) === side; });
      return i >= 0 ? i : lines[fallback] ? fallback : 0;
    }
    var rows = [
      { key: 'label-a', role: 'Label A', name: name('1', lineSlug(lines, sideLine('a', 0))) },
      { key: 'label-b', role: 'Label B', name: name('2', lineSlug(lines, sideLine('b', 1))) },
      { key: 'photos', role: 'Other photos (then _4, _5…)', name: name('3', lineSlug(lines, 0)) }
    ];
    if (positions === null) return rows;
    lines.forEach(function (l, i) {
      var role = pos[i] || (pos.length ? '' : i === 0 ? 'a' : i === 1 ? 'b' : '');
      if (role) rows.push({ key: 'line-' + i, role: role.toUpperCase(), name: name(role, lineSlug(lines, i)) });
    });
    return rows;
  }

  // the image name for any photo role (1, 2, 3, 4…), as the Scanner's slots need it
  function imageName(sku, lines, positions, role) {
    var rows = fileNames(sku, lines, positions || []);
    if (role === 1) return rows[0].name;
    if (role === 2) return rows[1].name;
    return [sku, String(role), lineSlug(lines || [], 0)].filter(Boolean).join('_');
  }

  return { fileSlug: fileSlug, lineSlug: lineSlug, fileNames: fileNames, imageName: imageName };
});
