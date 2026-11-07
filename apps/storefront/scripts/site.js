/* apps/storefront/scripts/site.js - site-level behaviour (no framework, runs on the static pages). ASCII only.

   1. Header (desktop and mobile)
      - scroll down: it follows the page 1:1 (moves up by exactly the scrolled amount until it is out), no delay
      - scroll up: it comes back sticky at the top (animated reveal, see base.css [data-revealing])
   2. Player (packages/ui Player, rendered once per page outside .zz-page)
      - a PlayerButton with data-sample-src plays its sample; the PlayerButtons of the same product are the queue
      - previous / play-pause / next, the native audio controls and the Media Session (lock screen) stay in sync
      - opens by sliding up from the bottom of the viewport; the close button stops playback and slides it away
   3. Soft navigation
      - internal links load the next page with fetch and swap only .zz-page, so the player and its audio keep playing
      - anything unexpected (error, other origin, page without .zz-page) falls back to a normal page load

   Looks live in base.css and packages/ui/components.css; this file only sets attributes and text. */
(function () {
  'use strict';

  /* ---------------------------------------------------------------- 1. header */

  var headerCleanup = null;

  function initHeader() {
    if (headerCleanup) headerCleanup();
    headerCleanup = null;
    var header = document.querySelector('.site-header');
    if (!header) return;

    var REVEAL_AFTER = 4;         // px of upward scroll before revealing, so trackpad / iOS bounce jitter doesn't flicker it
    var lastY = Math.max(window.scrollY, 0);
    var offset = 0;               // how far the header is pushed up, 0 ... header height
    var upwards = 0;              // upward scroll accumulated since the last downward move

    function apply() {
      header.style.transform = offset ? 'translateY(' + (-offset) + 'px)' : '';
      if (offset >= header.offsetHeight) header.setAttribute('data-hidden', ''); else header.removeAttribute('data-hidden');
    }
    function reveal() {
      if (!offset) return;
      header.setAttribute('data-revealing', '');
      offset = 0;
      apply();
    }
    function onScroll() {
      var y = Math.max(window.scrollY, 0);
      var delta = y - lastY;
      lastY = y;
      if (delta > 0) {
        upwards = 0;
        if (header.contains(document.activeElement)) return;   // never push it away while keyboard focus is inside
        header.removeAttribute('data-revealing');               // follow the page: no transition
        offset = Math.min(header.offsetHeight, offset + delta);
        apply();
      } else if (delta < 0) {
        upwards -= delta;
        if (upwards >= REVEAL_AFTER || y === 0) reveal();
      }
    }
    function onTransitionEnd() { header.removeAttribute('data-revealing'); }

    window.addEventListener('scroll', onScroll, { passive: true });
    header.addEventListener('focusin', reveal);   // keyboard: tabbing into a hidden header brings it back
    header.addEventListener('transitionend', onTransitionEnd);
    headerCleanup = function () { window.removeEventListener('scroll', onScroll); };
  }

  /* ---------------------------------------------------------------- 2. player */

  var player = document.querySelector('.site-player');
  var audio = player && player.querySelector('.zz-player__audio');
  var queue = [];      // [{ src, title, track, product, image, href }]
  var index = -1;      // position in queue of the loaded sample
  var lastTrigger = null;

  function q(sel) { return player.querySelector(sel); }
  function setText(sel, text) { var el = q(sel); if (el) el.textContent = text || ''; }
  function isPlaying() { return !!audio && !audio.paused && !audio.ended; }
  function current() { return queue[index] || null; }

  function sampleFrom(btn) {
    return {
      src: btn.getAttribute('data-sample-src'),
      title: btn.getAttribute('data-sample-title') || '',
      track: btn.getAttribute('data-sample-track') || '',
      product: btn.getAttribute('data-product-name') || '',
      image: btn.getAttribute('data-product-image') || '',
      href: btn.getAttribute('data-product-href') || ''
    };
  }
  // the queue of a sample button = the playable sample buttons of the same group (ProductInfo samples)
  function queueFor(btn) {
    var group = btn.closest('.zz-product-info__samples') || btn.parentNode;
    return Array.prototype.slice.call(group.querySelectorAll('[data-sample-src]')).map(sampleFrom);
  }

  // every PlayerButton on the page reflects the player: the loaded sample shows pause while it plays
  function syncButtons() {
    var cur = current();
    var playing = isPlaying();
    Array.prototype.forEach.call(document.querySelectorAll('[data-sample-src]'), function (btn) {
      var on = !!cur && playing && btn.getAttribute('data-sample-src') === cur.src;
      btn.setAttribute('data-playing', on ? 'true' : 'false');
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
  }

  function render() {
    var cur = current();
    var playing = isPlaying();
    player.setAttribute('data-playing', playing ? 'true' : 'false');
    var toggleBtn = q('.zz-player__toggle');
    if (toggleBtn) toggleBtn.setAttribute('aria-label', playing ? 'Pause' : 'Play');
    if (cur) {
      setText('.zz-player__track', cur.track);
      setText('.zz-player__sample', cur.title);
      setText('.zz-player__product', cur.product);
      setText('.zz-player__position', (index + 1) + ' of ' + queue.length);
      var box = q('.zz-player__image');
      if (box) {
        var img = box.querySelector('img');
        if (cur.image) {
          if (!img) { img = document.createElement('img'); img.width = 48; img.height = 48; box.appendChild(img); }
          if (img.getAttribute('src') !== cur.image) img.src = cur.image;
          img.alt = cur.product;
        } else if (img) box.removeChild(img);
      }
      var view = q('.site-player__view');
      if (view && cur.href) view.setAttribute('href', cur.href);
      q('.zz-player__previous').disabled = index <= 0;
      q('.zz-player__next').disabled = index >= queue.length - 1;
    }
    syncButtons();
    mediaSession(cur, playing);
  }

  function mediaSession(cur, playing) {
    if (!('mediaSession' in navigator)) return;
    var ms = navigator.mediaSession;
    if (cur && typeof window.MediaMetadata === 'function') {
      ms.metadata = new window.MediaMetadata({
        title: cur.title, artist: cur.product,
        artwork: cur.image ? [{ src: cur.image, sizes: '512x512' }] : []
      });
    }
    ms.playbackState = cur ? (playing ? 'playing' : 'paused') : 'none';
  }

  function measure() {
    document.documentElement.style.setProperty('--site-player-height', player.offsetHeight + 'px');
  }
  function open() {
    if (player.hasAttribute('data-open')) return;
    player.setAttribute('data-open', '');
    document.body.setAttribute('data-player-open', '');
    measure();
  }
  function close() {
    if (!player.hasAttribute('data-open')) return;
    var hadFocus = player.contains(document.activeElement);
    audio.pause();
    player.removeAttribute('data-open');
    document.body.removeAttribute('data-player-open');
    // focus must not stay on a hidden control: back to the button that started playback, or the page
    if (hadFocus) {
      if (lastTrigger && document.contains(lastTrigger)) lastTrigger.focus();
      else { var main = document.querySelector('main'); if (main) { main.setAttribute('tabindex', '-1'); main.focus(); } }
    }
    render();
  }

  function play() {
    var p = audio.play();
    if (p && p.catch) p.catch(function () { render(); });   // refused or bad URL: stay paused, controls still work
  }
  function load(i, autoplay) {
    if (i < 0 || i >= queue.length) return;
    index = i;
    var cur = queue[i];
    if (audio.getAttribute('src') !== cur.src) audio.src = cur.src;
    open();
    render();
    if (autoplay) play();
  }
  function toggle() {
    if (!current()) return;
    if (isPlaying()) audio.pause(); else play();
  }
  function previous() { if (index > 0) load(index - 1, true); }
  function next() { if (index < queue.length - 1) load(index + 1, true); }

  // a PlayerButton: same sample -> play/pause; another sample -> its product's samples become the queue
  function onSampleClick(btn) {
    lastTrigger = btn;
    var src = btn.getAttribute('data-sample-src');
    var cur = current();
    if (cur && cur.src === src) { open(); toggle(); return; }
    queue = queueFor(btn);
    var i = 0;
    while (i < queue.length && queue[i].src !== src) i++;
    load(i, true);
  }

  if (player && audio) {
    document.addEventListener('click', function (e) {
      var btn = e.target.closest && e.target.closest('[data-sample-src]');
      if (btn && !btn.disabled) onSampleClick(btn);
    });
    q('.zz-player__toggle').addEventListener('click', toggle);
    q('.zz-player__previous').addEventListener('click', previous);
    q('.zz-player__next').addEventListener('click', next);
    q('.zz-player__close').addEventListener('click', close);
    // the native controls drive the same element: listen to the element, not to our buttons
    ['play', 'pause', 'ended', 'emptied'].forEach(function (t) { audio.addEventListener(t, render); });
    audio.addEventListener('ended', function () { if (index < queue.length - 1) next(); });
    if ('ResizeObserver' in window) new ResizeObserver(measure).observe(player);
    if ('mediaSession' in navigator) {
      var ms = navigator.mediaSession;
      try {
        ms.setActionHandler('play', toggle);
        ms.setActionHandler('pause', toggle);
        ms.setActionHandler('previoustrack', previous);
        ms.setActionHandler('nexttrack', next);
      } catch (err) { /* an action is not supported by this browser */ }
    }
  }

  /* ---------------------------------------------------------------- 3. soft navigation */

  function shouldIntercept(e, a) {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return false;
    if (!a || !a.href || (a.target && a.target !== '_self') || a.hasAttribute('download')) return false;
    var url = new URL(a.href, location.href);
    if (url.origin !== location.origin) return false;
    if (url.pathname === location.pathname && url.search === location.search && url.hash) return false;   // in-page anchor
    return true;
  }

  function addMissingStyles(doc) {
    var have = {};
    Array.prototype.forEach.call(document.querySelectorAll('link[rel="stylesheet"]'), function (l) { have[l.href] = true; });
    Array.prototype.forEach.call(doc.querySelectorAll('link[rel="stylesheet"]'), function (l) {
      var href = new URL(l.getAttribute('href'), location.href).href;
      if (!have[href]) { var n = document.createElement('link'); n.rel = 'stylesheet'; n.href = href; document.head.appendChild(n); }
    });
  }

  var navToken = 0;
  function navigate(href, push) {
    var token = ++navToken;
    return fetch(href, { credentials: 'same-origin' }).then(function (res) {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.text();
    }).then(function (html) {
      if (token !== navToken) return;   // a newer navigation started
      var doc = new DOMParser().parseFromString(html, 'text/html');
      var incoming = doc.querySelector('.zz-page');
      var page = document.querySelector('.zz-page');
      if (!incoming || !page) throw new Error('no .zz-page');
      addMissingStyles(doc);
      page.parentNode.replaceChild(document.importNode(incoming, true), page);
      document.title = doc.title;
      if (push) history.pushState({ soft: true }, '', href);
      var url = new URL(href, location.href);
      var target = url.hash && document.getElementById(decodeURIComponent(url.hash.slice(1)));
      if (target) target.scrollIntoView(); else window.scrollTo(0, 0);
      initHeader();
      if (player && audio) render();
      // screen readers and keyboard: start from the new page's main heading, like a full load would
      var focusEl = document.querySelector('main h1') || document.querySelector('main');
      if (focusEl) { focusEl.setAttribute('tabindex', '-1'); focusEl.focus({ preventScroll: true }); }
    }).catch(function () {
      if (token === navToken) location.href = href;   // anything unexpected: a normal page load
    });
  }

  if (window.fetch && window.DOMParser && window.history && history.pushState) {
    document.addEventListener('click', function (e) {
      var a = e.target.closest && e.target.closest('a[href]');
      if (!shouldIntercept(e, a)) return;
      e.preventDefault();
      if (a.href === location.href) return;
      navigate(a.href, true);
    });
    history.replaceState({ soft: true }, '', location.href);
    window.addEventListener('popstate', function () { navigate(location.href, false); });
  }

  initHeader();
})();
