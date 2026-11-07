/* apps/storefront/scripts/site.js — site-level behaviour (no framework, runs on the static pages).
   Header: scrolls away on scroll down, comes back (sticky) on scroll up. Desktop and mobile.
   The look lives in base.css (.site-header, [data-hidden]); this file only toggles the attribute. */
(function () {
  'use strict';
  var header = document.querySelector('.site-header');
  if (!header) return;

  var THRESHOLD = 4;            // px of scroll ignored, so small jitters (trackpad, iOS bounce) don't toggle it
  var lastY = window.scrollY;
  var ticking = false;

  function show() { header.removeAttribute('data-hidden'); }
  function hide() { header.setAttribute('data-hidden', ''); }

  function update() {
    ticking = false;
    var y = Math.max(window.scrollY, 0);
    var delta = y - lastY;
    if (Math.abs(delta) < THRESHOLD) return;
    // hide only once the header has scrolled past, and never while keyboard focus is inside it
    if (delta > 0 && y > header.offsetHeight && !header.contains(document.activeElement)) hide();
    else if (delta < 0) show();
    lastY = y;
  }

  window.addEventListener('scroll', function () {
    if (!ticking) { ticking = true; window.requestAnimationFrame(update); }
  }, { passive: true });

  // keyboard: tabbing into a hidden header brings it back
  header.addEventListener('focusin', show);
})();
