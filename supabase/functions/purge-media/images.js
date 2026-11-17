/* packages/images/images.js — the smaller copies of every listing photo (decision 0108).
   The admin resizes each photo in the browser before the upload: the photo itself (webp, long side 1600) plus one
   copy per width below, next to it in R2 with the width in the key:
     photos/<uuid>.webp        the photo (PDP gallery on large screens, the fallback everywhere)
     photos/<uuid>-w800.webp   long side 800 …
   The shop then lets the browser pick the smallest file that is sharp enough for the spot (srcset + sizes).
   ONE list of widths for the four places that need it: the admin (upload + "Make small sizes" in Settings), the
   storefront build (srcset), and the Edge Functions sign-upload (which keys it signs) and purge-media (what it deletes).
   No dependencies, no DOM. CommonJS (build), classic script (window.ZanzaImages) and Deno (globalThis). */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ZanzaImages = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  // long side in px, smallest first. 200: player 48, bag 96, mobile card 96 (all at 2×) · 400: cards on desktop ·
  // 800: large cards, the PDP gallery on mobile and on laptops. The photo itself (1600) covers the rest.
  var WIDTHS = [200, 400, 800];
  var FULL = 1600;
  // only photos the admin made: photos/<uuid>.webp (older test content and outside URLs have no copies)
  var PHOTO = /^(.*\/)?photos\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.webp$/;

  function hasSizes(keyOrUrl) { return PHOTO.test(String(keyOrUrl || '').split('?')[0]); }
  // the key (or URL) of the copy `width` px wide: photos/<uuid>.webp → photos/<uuid>-w400.webp
  function sizedKey(keyOrUrl, width) {
    if (!hasSizes(keyOrUrl) || WIDTHS.indexOf(width) < 0) return null;
    return String(keyOrUrl).replace(/\.webp$/, '-w' + width + '.webp');
  }
  // every copy key of one photo (purge-media deletes them with the photo)
  function sizedKeys(key) { return hasSizes(key) ? WIDTHS.map(function (w) { return sizedKey(key, w); }) : []; }
  // <img srcset>: "…-w200.webp 200w, …-w400.webp 400w, …-w800.webp 800w, ….webp 1600w"
  function srcSet(url) {
    if (!hasSizes(url)) return null;
    return WIDTHS.map(function (w) { return sizedKey(url, w) + ' ' + w + 'w'; }).concat([url + ' ' + FULL + 'w']).join(', ');
  }
  // the smallest copy at least `px` wide (the player's 48 px cover reads the 200 copy, not the 1600 photo)
  function smallest(url, px) {
    if (!hasSizes(url)) return url;
    for (var i = 0; i < WIDTHS.length; i++) if (WIDTHS[i] >= px) return sizedKey(url, WIDTHS[i]);
    return url;
  }
  // the copy the uploads finish with: when it exists, all the others do too (the admin uploads them smallest first)
  function lastKey(key) { return sizedKey(key, WIDTHS[WIDTHS.length - 1]); }

  return { WIDTHS: WIDTHS, FULL: FULL, hasSizes: hasSizes, sizedKey: sizedKey, sizedKeys: sizedKeys, srcSet: srcSet, smallest: smallest, lastKey: lastKey };
});
