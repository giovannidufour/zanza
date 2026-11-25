/* apps/storefront/scripts/site.js - site-level behaviour (no framework, runs on the static pages). ASCII only.

   1. Header (desktop and mobile)
      - scroll down: it follows the page 1:1 (moves up by exactly the scrolled amount until it is out), no delay
      - scroll up: it comes back sticky at the top (animated reveal, see base.css [data-revealing])
   2. Player (packages/ui Player, rendered once per page outside .hm-page)
      - a PlayerButton with data-sample-src plays its sample; the PlayerButtons of the same product are the queue
      - a [data-play-all] button (home) queues every sample of its [data-play-scope] section
      - previous / play-pause / next, the native audio controls and the Media Session (lock screen) stay in sync
      - opens by sliding up from the bottom of the viewport; the close button stops playback and slides it away
   3. Soft navigation
      - internal links load the next page with fetch and swap only .hm-page, so the player and its audio keep playing
      - anything unexpected (error, other origin, page without .hm-page) falls back to a normal page load
   4. PDP gallery
      - tracks the gallery's top in the window (--pdp-gallery-top), so pdp.css keeps its bottom at the window bottom
      - sticky scroll (desktop, decision 0119): measures the record (info + actions) for pdp.css, and brings it back from
        under "More for sale" when keyboard focus moves into it; "back to this record" card over the gallery once the
        record is covered, a click scrolls page and gallery back to the top together
   5. PLP filters
      - ticking an option filters the list (OR inside a block, AND between blocks), updates the counts, the URL and
        the breadcrumbs, and announces the number of records
      - sort (native select, mobile and desktop) reorders the list; in the URL as ?sort=
      - mobile: "Filter (n)" opens the filters layer (native modal dialog, levels main / facet); its ticks are a draft
        until Apply, close discards, Reset clears the draft (decision 0038)

   6. Bag (decision 0044)
      - the bag = the listing ids in localStorage ('highmuzik-bag'), in the order they were added; a copy is unique, so an
        id is in the bag once (no quantity). Adding does NOT hold the copy: the hold starts at checkout
      - "Add to bag" (card, PDP, player) adds and shows the toast "Added to bag." + View bag (decision 0050); then the button reads "In bag" (secondary + tick)
        and opens the bag (decision 0058); taking a copy out happens only on /bag/; the header Bag shows the count in brackets on every page
      - /bag/ (pages/bag.js) shows the lines of the bag, the subtotal of the available ones, or the empty state;
        with shipping set up: "Ship to" country (remembered), shipping estimate and total (decision 0057);
        Remove takes a line out and shows a toast with Undo (packages/ui/toast.js, decision 0049). Checkout posts to create-checkout and goes to Stripe (migration 0021, startCheckout)
   7. Live status (_context/backend.md -> Stato dal vivo)
      - the pages are static: each listing carries its status at build time (data-listing-status); with Supabase meta
        tags on the page, one read of listing_availability per page (and when the tab comes back) brings it up to date
      - reserved (someone is in Stripe Checkout, max 30 min, or held by hand): the Add buttons read "(Reserved) Notify me"
        (secondary + envelope, decision 0065) and stay active: pressing one opens the "Reserved" dialog, which explains the hold and offers "Notify me"
        (email, migration 0016). The bag line shows the notice "Reserved".
        sold: the Add buttons read "Sold out", disabled (decision 0061); the bag line: "SOLD OUT" in a red box + struck price (0064, 0078)

   7b. Home (decision 0120)
      - the view toggle switches the shelves between tiles (grid) and product cards (list), remembered in this browser
      - the counter of a tile's mobile gallery ("2/3") follows the photo in view
   7c. Newsletter dialog (decision 0121)
      - links and buttons that point to the newsletter open it as a modal (close button, Esc, backdrop close it)
   8. SelectButton focus (decision 0081)
      - the ring of a native select shows for keyboard focus only, not after a mouse pick (focus stays on the select)

   Looks live in base.css and packages/ui/components.css; this file only sets attributes and text. */
(function () {
  'use strict';

  // analytics (decision 0131, scripts/analytics.js): named events, a no-op when analytics is off
  function track(name, props) { if (window.HighmuzikAnalytics) window.HighmuzikAnalytics.track(name, props); }

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

    var root = document.documentElement;

    // --site-header-visible: how much of the header is on screen, so sticky page parts (PLP filters) sit below it.
    // data-header-revealing on <html> lets them follow the animated reveal with the same transition.
    function setRevealing(on) {
      if (on) { header.setAttribute('data-revealing', ''); root.setAttribute('data-header-revealing', ''); }
      else { header.removeAttribute('data-revealing'); root.removeAttribute('data-header-revealing'); }
    }
    function apply() {
      header.style.transform = offset ? 'translateY(' + (-offset) + 'px)' : '';
      if (offset >= header.offsetHeight) header.setAttribute('data-hidden', ''); else header.removeAttribute('data-hidden');
      root.style.setProperty('--site-header-visible', Math.max(0, header.offsetHeight - offset) + 'px');
    }
    function reveal() {
      if (!offset) return;
      setRevealing(true);
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
        setRevealing(false);                                    // follow the page: no transition
        offset = Math.min(header.offsetHeight, offset + delta);
        apply();
      } else if (delta < 0) {
        upwards -= delta;
        if (upwards >= REVEAL_AFTER || y === 0) reveal();
      }
    }
    function onTransitionEnd(e) { if (e.target === header) setRevealing(false); }

    apply();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', apply);
    header.addEventListener('focusin', reveal);   // keyboard: tabbing into a hidden header brings it back
    header.addEventListener('transitionend', onTransitionEnd);
    headerCleanup = function () { window.removeEventListener('scroll', onScroll); window.removeEventListener('resize', apply); };
  }


  /* ---------------------------------------------------------------- 2. player */

  var player = document.querySelector('.site-player');
  var audio = player && player.querySelector('.hm-player__audio');
  var queue = [];      // [{ src, title, track, product, image, href }]
  var index = -1;      // position in queue of the loaded sample
  var lastTrigger = null;

  function q(sel) { return player.querySelector(sel); }
  function setText(sel, text) { var el = q(sel); if (el) el.textContent = text || ''; }
  function isPlaying() { return !!audio && !audio.paused && !audio.ended; }
  function current() { return queue[index] || null; }

  function sampleFrom(btn) {
    // the copy's status at build time travels with the sample (owner 2026-11-15): the player keeps playing across pages,
    // where that copy may not be on the page, and its "Add to bag" must still read "Sold out" for a sold copy
    var id = btn.getAttribute('data-listing-id');
    if (id && btn.getAttribute('data-listing-status')) heard[id] = btn.getAttribute('data-listing-status');
    return {
      src: btn.getAttribute('data-sample-src'),
      title: btn.getAttribute('data-sample-title') || '',
      product: btn.getAttribute('data-product-name') || '',
      image: btn.getAttribute('data-product-image') || '',
      href: btn.getAttribute('data-product-href') || '',
      listing: btn.getAttribute('data-listing-id') || '',
      section: btn.getAttribute('data-listing-section') || 'sale',
      offers: btn.getAttribute('data-price-mode') === 'offers'   // best offer (0158): no Add to bag, as trade
    };
  }
  // the queue of a sample button = the playable sample buttons of the same group (ProductInfo samples)
  function queueFor(btn) {
    var group = btn.closest('.hm-product-info__samples') || btn.parentNode;
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
    var toggleBtn = q('.hm-player__toggle');
    if (toggleBtn) toggleBtn.setAttribute('aria-label', playing ? 'Pause' : 'Play');
    if (cur) {
      setText('.hm-player__number', String(index + 1));   // the sample's place in the queue (decision 0056)
      setText('.hm-player__sample', cur.title);
      setText('.hm-player__product', cur.product);
      setText('.hm-player__position', (index + 1) + ' of ' + queue.length);
      var box = q('.hm-player__image');
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
      var add = q('.site-player__add');
      // trade listings (decision 0068): no "Add to bag" in the player, the offer is made on the record's page
      // best offer (decision 0158): no "Add to bag" either, the offer is made on the record's page; reserved or sold, its
      // button acts as any copy's: "(Reserved) Notify me", "Sold out" (0189)
      var noBag = cur.section === 'trade' || (cur.offers && statusFor(cur.listing) === 'available');
      if (add) {
        if (cur.offers) add.setAttribute('data-offer-href', (cur.href || '').replace(/\/?$/, '/') + 'offer/'); else add.removeAttribute('data-offer-href');
        add.hidden = noBag; add.disabled = !cur.listing; if (!noBag) syncAddButton(add, cur.listing);
      }
      q('.hm-player__previous').disabled = index <= 0;
      q('.hm-player__next').disabled = index >= queue.length - 1;
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
    if (autoplay) {
      play();
      track('sample_played', { listing_id: cur.listing, sample: index + 1, section: cur.section });
    }
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

  // "Play all" (home, decisions 0085, 0120): every playable sample of its section ([data-play-scope]) becomes the queue,
  // in page order, from the first one
  function onPlayAll(btn) {
    var scope = btn.closest('[data-play-scope]') || document;
    // only the samples on screen: a home shelf renders both views (tiles and cards), one of them hidden (0120)
    var items = Array.prototype.slice.call(scope.querySelectorAll('[data-sample-src]'))
      .filter(function (b) { return !b.disabled && b.getClientRects().length > 0; }).map(sampleFrom);
    if (!items.length) return;
    lastTrigger = btn;
    queue = items;
    load(0, true);
  }

  if (player && audio) {
    document.addEventListener('click', function (e) {
      var all = e.target.closest && e.target.closest('[data-play-all]');
      if (all) { onPlayAll(all); return; }
      var btn = e.target.closest && e.target.closest('[data-sample-src]');
      if (btn && !btn.disabled) onSampleClick(btn);
    });
    q('.hm-player__toggle').addEventListener('click', toggle);
    q('.hm-player__previous').addEventListener('click', previous);
    q('.hm-player__next').addEventListener('click', next);
    q('.hm-player__close').addEventListener('click', close);
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

  /* -- mobile menu (Figma page `menu`, SiteMenu in pages/shell.js) --------- */
  // The hamburger opens a native modal dialog: focus trapped, Esc closes, focus returns to the hamburger.
  // Following a link closes it first; the soft navigation then swaps the page (header and menu included).
  function initMenu() {
    var btn = document.querySelector('[data-menu-open]');
    var menu = document.querySelector('[data-site-menu]');
    if (!btn || !menu || !menu.showModal) return;
    btn.addEventListener('click', function () {
      menu.showModal();
      btn.setAttribute('aria-expanded', 'true');
      menu.focus();   // as the filters layer (decision 0043): the dialog takes focus, screen readers hear "Menu"
    });
    menu.addEventListener('close', function () {
      btn.setAttribute('aria-expanded', 'false');
      if (document.contains(btn)) btn.focus();
    });
    menu.querySelector('[data-menu-close]').addEventListener('click', function () { menu.close(); });
    menu.addEventListener('click', function (e) {
      if (e.target.closest && e.target.closest('a[href]') && menu.open) menu.close();
    });
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

  /* -- PDP gallery (pages/pdp.js, pdp.css, decision 0036) ----------------- */
  var galleryCleanup = null;
  function initGallery() {
    if (galleryCleanup) galleryCleanup();
    galleryCleanup = null;
    var gallery = document.querySelector('.pdp-content__gallery');
    if (!gallery) return;
    // --pdp-gallery-top = the gallery's top in the window (negative once scrolled past). pdp.css: max height = window
    // bottom - this, so the box always ends at the window bottom: as the page scrolls, it grows until both images
    // show whole, and the container never crops image 2 while page content is visible below it.
    var frame = 0;
    function measure() {
      frame = 0;
      gallery.style.setProperty('--pdp-gallery-top', Math.round(gallery.getBoundingClientRect().top) + 'px');
    }
    function schedule() { if (!frame) frame = window.requestAnimationFrame(measure); }
    measure();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(measure);   // web fonts can change the header height
    window.addEventListener('resize', schedule);
    window.addEventListener('scroll', schedule, { passive: true });
    galleryCleanup = function () {
      window.removeEventListener('resize', schedule);
      window.removeEventListener('scroll', schedule);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }

  /* -- PDP sticky scroll (decision 0119, pdp.css data-record-stack) -------
     --pdp-record-height = the taller of info and actions (row 1 keeps the height it had before they spanned 2 rows).
     Focus moving into a record
     covered by the list scrolls the page back until the record shows (WCAG 2.4.11, focus not obscured). */
  var recordCleanup = null;
  var scrollTopAnimation = null;   // the running back-card scroll to the top, if any
  function initRecordStack() {
    if (recordCleanup) recordCleanup();
    recordCleanup = null;
    var content = document.querySelector('.pdp-content');
    var related = content && content.querySelector('.pdp-content__related');
    if (!related) return;
    var parts = Array.prototype.filter.call(content.querySelectorAll('.pdp-content__info, .pdp-content__actions'), function (el) { return el.parentNode === content; });
    if (!parts.length) return;
    var frame = 0;
    function measure() {
      frame = 0;
      var height = Math.max.apply(null, parts.map(function (el) { return el.offsetHeight; }));
      content.style.setProperty('--pdp-record-height', Math.ceil(height) + 'px');
      var band = related.querySelector('.hm-related-products__title');
      if (band) document.documentElement.style.setProperty('--pdp-related-band', Math.ceil(band.offsetHeight) + 'px');
      content.setAttribute('data-record-stack', '');
    }
    function schedule() { if (!frame) frame = window.requestAnimationFrame(measure); }
    function onFocusIn(e) {
      if (!e.target.closest || !e.target.closest('.pdp-content__info, .pdp-content__actions')) return;
      if (getComputedStyle(parts[0]).position !== 'sticky') return;   // mobile: normal flow
      var bottom = Math.max.apply(null, parts.map(function (el) { return el.getBoundingClientRect().bottom; }));
      var gap = parseFloat(getComputedStyle(content).rowGap) || 0;
      var over = bottom + gap - related.getBoundingClientRect().top;
      if (over > 0) window.scrollBy(0, -over);
    }
    // "back to this record" card (pdp.js, pdp.css): shows once the "More for sale" band sits at its anchor (the record
    // is fully covered); a click scrolls the page to the top and the gallery to its first photo, then focus goes to
    // the record's title, so keyboard and screen reader users land where the card took them.
    var back = content.querySelector('[data-record-back]');
    var gallery = content.querySelector('.pdp-content__gallery');
    var band = related.querySelector('.hm-related-products__title');
    var visFrame = 0;
    function updateBack() {
      visFrame = 0;
      if (!back || !band) return;
      var anchor = parseFloat(getComputedStyle(band).top) || 0;
      var covered = getComputedStyle(band).position === 'sticky' && band.getBoundingClientRect().top <= anchor + 1;
      if (covered) back.setAttribute('data-visible', ''); else back.removeAttribute('data-visible');
      if (gallery) back.style.setProperty('--pdp-gallery-height', gallery.offsetHeight + 'px');
    }
    function scheduleBack() { if (!visFrame) visFrame = window.requestAnimationFrame(updateBack); }
    function focusRecord() {
      var title = content.querySelector('.pdp-content__info .hm-product-info__name');
      if (!title) return;
      title.setAttribute('tabindex', '-1');
      title.focus({ preventScroll: true });
    }
    function onBackClick(e) {
      if (!back || !e.target.closest || !e.target.closest('.hm-return-card')) return;
      var g = gallery || { scrollTop: 0 };
      var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (scrollTopAnimation) scrollTopAnimation.stop();
      if (reduce) { window.scrollTo(0, 0); g.scrollTop = 0; focusRecord(); return; }
      // one animation drives both, so page and gallery start and land together whatever their distances (Gio
      // 2026-11-18). Native smooth scroll picks its own duration per distance, so it is not used here.
      // TODO motion: no duration/easing in Figma - 600ms ease-in-out is a placeholder.
      var DURATION = 600, page0 = window.scrollY, gallery0 = g.scrollTop, start = 0;
      function ease(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
      function step(now) {
        if (!start) start = now;
        var k = 1 - ease(Math.min(1, (now - start) / DURATION));
        window.scrollTo(0, page0 * k);
        g.scrollTop = gallery0 * k;
        if (k > 0) frameId = window.requestAnimationFrame(step); else { stop(); focusRecord(); }
      }
      // the user takes over (wheel, touch, keys): the animation stops where it is
      function stop() {
        window.cancelAnimationFrame(frameId);
        ['wheel', 'touchstart', 'keydown'].forEach(function (t) { window.removeEventListener(t, stop); });
        scrollTopAnimation = null;
      }
      var frameId = window.requestAnimationFrame(step);
      ['wheel', 'touchstart', 'keydown'].forEach(function (t) { window.addEventListener(t, stop, { passive: true }); });
      scrollTopAnimation = { stop: stop };
    }
    measure();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(schedule);
    var ro = window.ResizeObserver ? new ResizeObserver(schedule) : null;
    if (ro) parts.concat(related.querySelector('.hm-related-products__title') || []).forEach(function (el) { ro.observe(el); });
    window.addEventListener('resize', schedule);
    content.addEventListener('focusin', onFocusIn);
    content.addEventListener('click', onBackClick);
    window.addEventListener('scroll', scheduleBack, { passive: true });
    window.addEventListener('resize', scheduleBack);
    if (ro && gallery) ro.observe(gallery);
    updateBack();
    recordCleanup = function () {
      if (ro) ro.disconnect();
      window.removeEventListener('resize', schedule);
      content.removeEventListener('focusin', onFocusIn);
      content.removeEventListener('click', onBackClick);
      window.removeEventListener('scroll', scheduleBack);
      window.removeEventListener('resize', scheduleBack);
      if (visFrame) window.cancelAnimationFrame(visFrame);
      if (scrollTopAnimation) scrollTopAnimation.stop();
      if (frame) window.cancelAnimationFrame(frame);
    };
  }

  /* -- PLP filters (pages/plp.js, Figma page `filters`) --------------------
     OR inside a block, AND between blocks. Counts = records you would see by ticking that option, given the other
     blocks; an option at 0 is hidden unless ticked. State lives in the URL (?genre=Roots&format=7"), so a
     filtered list can be shared and Back restores it. Active filter row (0041, in place of the breadcrumbs) = the filter
     reached from a link: artist / label (no checkbox) or the genre / tag a card's tag linked to, one removable chip.
     Links from before decision 0048 (?subgenre=Roots) are rewritten to ?genre= in place.
     The column's checkboxes are the applied state. On mobile (Figma `filters layer`, 2026-11-10) the layer has its
     own checkboxes: a draft, copied from the column when the layer opens and back to it on Apply; closing discards
     it. Levels: main (applied recap + one row per facet) and facet (the options of one facet). */
  // Search (Figma page `Search`, 2026-11-12): the query and each card's data-search text (pages/plp.js searchTextOf)
  // are normalised the same way: no accents, lower case, punctuation = space. Every word of the query must start a
  // word of the record ("greg isa" finds Gregory Isaacs); a catalogue number also matches without its spaces or
  // dashes ("tw001" finds "TW-001").
  function searchWords(s) {
    return String(s || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  }
  function searchMatcher(q) {
    var words = searchWords(q);
    if (!words) return null;
    var tokens = words.split(' ');
    var compact = words.replace(/ /g, '');
    return function (text) {
      var hay = ' ' + text;
      if (tokens.every(function (t) { return hay.indexOf(' ' + t) !== -1; })) return true;
      return compact.length > 2 && text.replace(/ /g, '').indexOf(compact) !== -1;
    };
  }
  // the search fields (header on desktop, under the header on /search/ on mobile): GET forms to /search/?q=…, sent
  // through the soft navigation so the player keeps playing; an empty query stays where it is
  function initSearch() {
    var q = new URLSearchParams(location.search).get('q') || '';
    var onSearch = !!document.querySelector('[data-search-page]');
    Array.prototype.forEach.call(document.querySelectorAll('[data-search-input]'), function (input) {
      input.value = onSearch ? q : '';
    });
  }
  // × in the search field (Figma `input` type=search, state=filled): empties it and keeps focus in it
  document.addEventListener('click', function (e) {
    var clear = e.target.closest && e.target.closest('.hm-input__clear');
    if (!clear) return;
    var input = clear.parentNode.querySelector('input');
    if (!input) return;
    input.value = '';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.focus();
  });
  document.addEventListener('submit', function (e) {
    var form = e.target.closest && e.target.closest('form[data-site-search]');
    if (!form) return;
    e.preventDefault();
    var input = form.querySelector('[data-search-input]');
    var q = input ? input.value.trim() : '';
    if (!q) { if (input) input.focus(); return; }
    var href = new URL(form.getAttribute('action'), location.href);
    href.search = '?q=' + encodeURIComponent(q);
    if (input) input.blur();   // mobile: closes the keyboard so the results are in view
    if (typeof navigate === 'function' && window.fetch && window.DOMParser) navigate(href.href, true);
    else location.href = href.href;
  });

  function initFilters() {
    var root = document.querySelector('[data-plp-filters]');
    if (!root) return;
    var items = Array.prototype.slice.call(document.querySelectorAll('.plp-item'));
    var list = items.length ? items[0].parentNode : null;
    // "Show sold out" (owner 2026-11-12): not a facet. Ticked by default; unticked = ?sold=hide. It never counts as an
    // applied filter and Reset ticks it again.
    var soldBox = root.querySelector('input[data-show-sold]');
    var boxes = Array.prototype.slice.call(root.querySelectorAll('input[type="checkbox"]')).filter(function (b) { return b !== soldBox; });
    var keys = []; boxes.forEach(function (b) { if (keys.indexOf(b.name) === -1) keys.push(b.name); });
    // hidden facets (label): no checkbox; the value comes from the URL and shows as a removable chip
    var hidden = []; try { hidden = JSON.parse(root.getAttribute('data-hidden-facets') || '[]'); } catch (e) { hidden = []; }
    hidden.forEach(function (f) { if (keys.indexOf(f.key) === -1) keys.push(f.key); });
    var params = new URLSearchParams(location.search);
    // search page: the query (?q=); no query = only the hint (Figma `Search - mobile / empty`)
    var searchPage = document.querySelector('[data-search-page]');
    var query = searchPage ? (params.get('q') || '').trim() : '';
    var matcher = searchMatcher(query);
    var baseTitle = document.title;   // as built: "Search · <store name>"
    // Check your wantlist (decision 0152): the page shows only the cards initWantlist marked data-want="exact|other",
    // grouped (exact first) under the two group headings; the match is read from the card at each apply
    var wantPage = document.querySelector('[data-wantlist-page]');
    var values = items.map(function (el) {
      var v = {}; keys.forEach(function (k) { try { v[k] = JSON.parse(el.getAttribute('data-' + k) || '[]'); } catch (e) { v[k] = []; } });
      v.__q = !searchPage || (!!matcher && matcher(el.getAttribute('data-search') || ''));
      return v;
    });
    // sold: read from the card at each apply (site.js updates data-listing-status live)
    function soldNow() {
      items.forEach(function (el, i) {
        if (wantPage) values[i].__want = el.getAttribute('data-want') || '';
        var card = el.querySelector('[data-listing-status]');
        var st = card ? card.getAttribute('data-listing-status') : 'available';
        values[i].__sold = st === 'sold' || st === 'traded';
      });
    }
    if (soldBox) soldBox.checked = params.get('sold') !== 'hide';
    if (params.has('subgenre')) {   // subgenre was renamed genre (0048): old shared links keep working
      params.getAll('subgenre').forEach(function (v) { params.append('genre', v); });
      params.delete('subgenre');
      history.replaceState(history.state, '', location.pathname + '?' + params.toString() + location.hash);
    }
    boxes.forEach(function (b) { b.checked = params.getAll(b.name).indexOf(b.value) !== -1; });
    var hiddenSel = {}; hidden.forEach(function (f) { hiddenSel[f.key] = params.getAll(f.key); });
    // the link filter (0041): a page opened on exactly one genre / tag value (a card's tag link: a new click replaces
    // it) shows that value as a chip until it is unticked. Decided once per history entry and kept in history.state,
    // so reload and Back keep it, while ticking the same option by hand never makes a chip.
    var linked = null;
    var st = history.state || {};
    if (st.plpLinkedDone) linked = st.plpLinked || null;
    else {
      var vals = []; params.forEach(function (v, k) { if (keys.indexOf(k) !== -1) vals.push({ key: k, value: v }); });
      var box = vals.length === 1 && boxes.filter(function (b) { return b.name === vals[0].key && b.value === vals[0].value; })[0];
      if (box) linked = vals[0];
      history.replaceState(Object.assign({}, st, { plpLinkedDone: true, plpLinked: linked }), '');
    }
    var sortSelects = Array.prototype.slice.call(document.querySelectorAll('[data-plp-sort]'));
    var sort = params.get('sort') || 'newest';
    var P = window.HighmuzikPagination;
    var perPage = list ? parseInt(list.getAttribute('data-per-page'), 10) || 0 : 0;
    var page = parseInt(params.get('page'), 10) || 1, pages = 1, lastShown = 0;

    function selectionOf(checkboxes, hiddenState, sold) {
      var s = {}; keys.forEach(function (k) { s[k] = []; });
      s.__showSold = sold ? sold.checked : true;
      checkboxes.forEach(function (b) { if (b.checked) s[b.name].push(b.value); });
      hidden.forEach(function (f) { s[f.key] = hiddenState[f.key].slice(); });
      return s;
    }
    function selected() { return selectionOf(boxes, hiddenSel, soldBox); }
    var lastSel = null;   // the selection of the last apply(), for analytics
    function matches(v, s, skip) {
      if (!v.__q) return false;
      if (wantPage && !v.__want) return false;
      if (v.__sold && !s.__showSold) return false;
      return keys.every(function (k) {
        if (k === skip || !s[k].length) return true;
        return s[k].some(function (x) { return v[k].indexOf(x) !== -1; });
      });
    }
    function shownFor(s) { var n = 0; values.forEach(function (v) { if (matches(v, s)) n++; }); return n; }
    function appliedCount(s) { var n = 0; keys.forEach(function (k) { n += s[k].length; }); return n; }
    // counts and visibility of a set of checkboxes for selection s (column or layer)
    function refreshOptions(checkboxes, s, scope) {
      checkboxes.forEach(function (b) {
        var n = 0; values.forEach(function (v) { if (v[b.name].indexOf(b.value) !== -1 && matches(v, s, b.name)) n++; });
        var count = b.closest('.hm-filter').querySelector('.hm-filter__count');
        if (count) count.textContent = n;
        b.closest('.hm-filter').hidden = n === 0 && !b.checked;
      });
      // a block shows only when something in the current view can be picked (owner, 2026-11-10)
      Array.prototype.forEach.call(scope.querySelectorAll('.hm-filter-block'), function (block) {
        block.setAttribute('data-empty', block.querySelector('.hm-filter:not([hidden])') ? 'false' : 'true');
        if (scope === root) block.hidden = block.getAttribute('data-empty') === 'true';
      });
    }
    // a removable chip: "Label: Kesta" (hidden facet) or the option's label
    function chipsOf(s, checkboxes) {
      var out = [];
      hidden.forEach(function (f) { s[f.key].forEach(function (x) { out.push({ key: f.key, value: x, text: f.label + ': ' + ((f.names || {})[x] || x) }); }); });
      return out;
    }
    var LINK_LABEL = { genre: 'Genre', tag: 'Tag' };
    // the row's chips: the hidden-facet chips, else the linked genre / tag while still ticked. A genre / tag chip shows
    // only the value ("Street Soul", owner 2026-11-14, decision 0073); the type stays in the remove button's name.
    function rowChipsOf(s) {
      var out = chipsOf(s);
      if (linked && s[linked.key] && s[linked.key].indexOf(linked.value) !== -1) {
        var b = boxes.filter(function (x) { return x.name === linked.key && x.value === linked.value; })[0];
        var shown = (b && b.getAttribute('data-facet-label')) || linked.value;
        out.push({ key: linked.key, value: linked.value, box: b, text: shown,
          name: (LINK_LABEL[linked.key] || linked.key) + ': ' + shown });
      }
      return out;
    }
    // name: the accessible name when the visible text drops the filter type (genre / tag chips)
    function makeChip(template, text, onRemove, name) {
      var chip = template.content.firstElementChild.cloneNode(true);
      chip.querySelector('.hm-entity-chip__label').textContent = text;
      var btn = chip.querySelector('.hm-entity-chip__remove');
      btn.setAttribute('aria-label', 'Remove filter ' + (name || text));
      btn.removeAttribute('tabindex');
      btn.addEventListener('click', onRemove);
      return chip;
    }

    // the active filter row (Figma `active filter`, 0041): two chips per filter from the template (medium desktop,
    // large mobile; plp.css shows one)
    var chipTemplate = document.querySelector('template[data-plp-chip]');
    function activeChips(c) {
      var frag = document.createDocumentFragment();
      Array.prototype.forEach.call(chipTemplate.content.children, function (tpl) {
        var holder = document.createElement('template'); holder.content.appendChild(tpl.cloneNode(true));
        frag.appendChild(makeChip(holder, c.text, function () {
          if (c.box) c.box.checked = false;
          else hiddenSel[c.key] = hiddenSel[c.key].filter(function (x) { return x !== c.value; });
          apply(true);
          var next = root.querySelector('input');
          if (next) next.focus();   // the removed button is gone: keep keyboard focus on the page
        }, c.name));
      });
      return frag;
    }
    // sold now: the card's live state (site.js updates data-listing-status), else the build's data-sold
    function soldEl(el) {
      var card = el.querySelector('[data-listing-status]');
      var st = card ? card.getAttribute('data-listing-status') : null;
      return st ? (st === 'sold' || st === 'traded' ? 1 : 0) : (el.hasAttribute('data-sold') ? 1 : 0);
    }
    function applySort() {
      if (!list) return;
      var group = function (el) { return el.getAttribute('data-want') === 'other' ? 1 : 0; };
      var sorted = items.slice().sort(function (a, b) {
        if (wantPage && group(a) !== group(b)) return group(a) - group(b);
        // every sort: for sale first, sold at the end (Gio 2026-11-24, decision 0174)
        var sa = soldEl(a), sb = soldEl(b);
        if (sa !== sb) return sa - sb;
        var pa = +a.getAttribute('data-price'), pb = +b.getAttribute('data-price');
        var oa = +a.getAttribute('data-order'), ob = +b.getAttribute('data-order');
        if (sort === 'price-asc') return (pa - pb) || (oa - ob);
        if (sort === 'price-desc') return (pb - pa) || (oa - ob);
        return oa - ob;
      });
      var empty = list.querySelector('[data-plp-empty]');
      sorted.forEach(function (el) { list.insertBefore(el, empty); });
    }
    function apply(announce) {
      soldNow();
      var s = selected(), shown = 0;
      // analytics: each value the visitor just added (not the ones from the URL at load)
      if (announce && lastSel) keys.forEach(function (k) {
        s[k].forEach(function (x) { if (!lastSel[k] || lastSel[k].indexOf(x) === -1) track('filter_applied', { filter: k, value: x, search: !!searchPage }); });
      });
      lastSel = s;
      var matched = [];
      items.forEach(function (el, i) { var ok = matches(values[i], s); el.hidden = !ok; if (ok) { shown++; matched.push(el); } });
      // pagination (decision 0179): a change of filters starts again from page 1; then only the current page's cards
      if (announce) page = 1;
      paginate(matched);
      lastShown = shown;
      refreshOptions(boxes, s, root);
      var empty = document.querySelector('[data-plp-empty]'); if (empty) empty.hidden = shown > 0;
      if (searchPage) renderSearch(shown);
      if (wantPage) {
        // each group heading right before the first card of its group still shown; none = hidden
        ['exact', 'other'].forEach(function (g) {
          var heading = list && list.querySelector('[data-wantlist-group="' + g + '"]');
          if (!heading) return;
          var first = items.filter(function (el) { return !el.hidden && (el.getAttribute('data-want') || '') === g; })
            .sort(function (a, b) { return a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1; })[0];
          heading.hidden = !first;
          if (first) list.insertBefore(heading, first);
        });
        if (wantPage.__onApply) wantPage.__onApply(shown);
      }
      var status = root.querySelector('[data-plp-status]');
      if (status && announce) status.textContent = shown + (shown === 1 ? ' record' : ' records');
      // mobile trigger: "Filter" + the number of applied filters as suffix (Figma `PLP header`, 0029)
      if (trigger) setSuffix(trigger, appliedCount(s) ? '(' + appliedCount(s) + ')' : null);
      // URL
      var q = new URLSearchParams();
      if (query) q.set('q', query);
      keys.forEach(function (k) { s[k].forEach(function (x) { q.append(k, x); }); });
      if (!s.__showSold) q.set('sold', 'hide');
      if (sort !== 'newest') q.set('sort', sort);
      var qs = q.toString();   // without the page: the collection chip's link and the pagination's links start from it
      renderPagination(qs);
      var withPage = page > 1 ? (qs ? qs + '&' : '') + 'page=' + page : qs;
      history.replaceState(history.state, '', location.pathname + (withPage ? '?' + withPage : '') + location.hash);
      // active filter row (0041): the link filter's chip; hidden when there is none
      var row = document.querySelector('[data-plp-active]');
      var holder = row && row.querySelector('.hm-active-filter__row');
      if (holder && chipTemplate) {
        // the collection chip (built in the page, decision 0178) stays; its remove link keeps filters and sort on /sale/
        var fixed = Array.prototype.slice.call(holder.querySelectorAll('[data-plp-fixed]'));
        holder.textContent = '';
        fixed.forEach(function (el) {
          var a = el.querySelector('a.hm-entity-chip__remove');
          if (a) a.setAttribute('href', a.getAttribute('href').split('?')[0] + (qs ? '?' + qs : ''));
          holder.appendChild(el);
        });
        var chips = rowChipsOf(s);
        chips.forEach(function (c) { holder.appendChild(activeChips(c)); });
        row.hidden = !chips.length && !fixed.length;
      }
    }
    // pagination (decision 0179, Figma `pagination`; packages/pagination decides which numbers show): `perPage` records a
    // page (admin → Settings → Records per page, on the list as data-per-page), the page in ?page=. The cards of the other
    // pages are hidden like filtered ones. A page link is a normal link to the same page with ?page=N: the soft
    // navigation loads it (new history entry, back to the top, the player keeps playing) and this code runs again.
    function paginate(matched) {
      if (!perPage || !P) return;
      var ordered = matched.slice().sort(function (a, b) { return a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1; });
      pages = P.pageCount(ordered.length, perPage);
      page = P.clamp(page, pages);
      var from = (page - 1) * perPage, to = from + perPage;
      ordered.forEach(function (el, i) { if (i < from || i >= to) el.hidden = true; });
    }
    // re-draws the nav from its template (one <li> per kind, rendered by the build with packages/ui Pagination)
    function renderPagination(qs) {
      var nav = document.querySelector('[data-plp-pagination]');
      var tpl = document.querySelector('template[data-pagination-template]');
      if (!nav || !tpl || !P) return;
      nav.hidden = pages <= 1;
      var ul = nav.querySelector('.hm-pagination__list');
      if (!ul) return;
      ul.textContent = '';
      if (pages <= 1) return;
      var base = location.pathname + '?' + (qs ? qs + '&' : '');
      P.items(page, pages).forEach(function (it) {
        var src = tpl.content.querySelector('[data-kind="' + it.kind + '"]');
        if (!src) return;
        var li = src.cloneNode(true);
        if (it.devices.length === 1) li.setAttribute('data-device', it.devices[0]); else li.removeAttribute('data-device');
        var a = li.querySelector('a');
        if (a) {
          a.setAttribute('href', it.page === 1 ? base.replace(/[?&]$/, '') : base + 'page=' + it.page);   // page 1 = no ?page=
          if (it.kind === 'page' || it.kind === 'current') {
            a.setAttribute('aria-label', 'Page ' + it.page);
            var label = a.querySelector('.hm-button__label');
            if (label) label.textContent = String(it.page);
          }
        }
        ul.appendChild(li);
      });
    }
    // Figma `search heading` + `search message`: "N results for “q”" / "No results for “q”"; no query = the hint only
    function renderSearch(shown) {
      var title = searchPage.querySelector('[data-search-title]');
      var hint = searchPage.querySelector('[data-search-hint]');
      var results = searchPage.querySelector('[data-search-results]');
      var quoted = '\u201c' + query + '\u201d';
      if (title) {
        title.hidden = !query;
        title.textContent = !query ? 'Search' : shown ? shown + (shown === 1 ? ' result for ' : ' results for ') + quoted : 'No results for ' + quoted;
      }
      if (hint) hint.hidden = !!query;
      if (results) results.hidden = !query;
      document.title = (query ? query + ' \u00b7 ' : '') + baseTitle;
      var plpHeader = document.querySelector('.plp-header'); if (plpHeader) plpHeader.hidden = !query;
    }
    // Button suffix (packages/ui Button `suffix`): created or removed in place
    function setSuffix(button, text) {
      var label = button.querySelector('.hm-button__label');
      var el = label && label.querySelector('.hm-button__suffix');
      if (text === null) { if (el) el.remove(); return; }
      if (!el && label) { el = document.createElement('span'); el.className = 'hm-button__suffix'; label.appendChild(el); }
      if (el) el.textContent = text;
    }

    // -- mobile: trigger, sort, layer --
    var trigger = document.querySelector('[data-plp-open]');
    var layer = document.querySelector('[data-plp-layer]');
    // sort: a native select on mobile (PLP header) and on desktop (top of the column), kept in sync
    sortSelects.forEach(function (sel) {
      sel.value = sort;
      if (sel.value !== sort) { sort = 'newest'; sel.value = sort; }
    });
    var syncSort = function () {
      sortSelects.forEach(function (sel) {
        sel.value = sort;
        var label = sel.parentNode.querySelector('[data-select-label]');
        if (label && sel.selectedIndex >= 0) label.textContent = sel.options[sel.selectedIndex].text;
      });
    };
    syncSort();
    sortSelects.forEach(function (sel) {
      sel.addEventListener('change', function (e) { e.stopPropagation(); sort = sel.value; page = 1; syncSort(); applySort(); apply(false); track('sort_changed', { sort: sort }); });
    });
    if (layer && trigger && layer.showModal) {
      var draftSold = layer.querySelector('input[data-show-sold]');
      var draftBoxes = Array.prototype.slice.call(layer.querySelectorAll('input[type="checkbox"]')).filter(function (b) { return b !== draftSold; });
      var draftHidden = {};
      var rows = Array.prototype.slice.call(layer.querySelectorAll('[data-facet]'));
      var blocks = Array.prototype.slice.call(layer.querySelectorAll('[data-facet-block]'));
      var panel = layer.querySelector('.hm-filters-layer');
      var title = layer.querySelector('[data-layer-title]');
      var back = layer.querySelector('[data-layer-back]');
      var appliedBox = layer.querySelector('[data-layer-applied]');
      var chipsBox = layer.querySelector('[data-layer-chips]');
      var applyBtn = layer.querySelector('[data-layer-apply]');
      var layerChip = layer.querySelector('template[data-layer-chip]');
      var currentFacet = null;
      var draft = function () { return selectionOf(draftBoxes, draftHidden, draftSold); };
      var labelOf = function (b) { return b.getAttribute('data-facet-label') || b.value; };

      var renderDraft = function () {
        var s = draft();
        refreshOptions(draftBoxes, s, layer);
        // facet rows: value = ticked options; a facet with nothing to pick in this view is hidden (as the column)
        rows.forEach(function (row) {
          var key = row.getAttribute('data-facet');
          var picked = draftBoxes.filter(function (b) { return b.name === key && b.checked; }).map(labelOf);
          var value = row.querySelector('.hm-filter-facet__value');
          if (picked.length) {
            if (!value) { value = document.createElement('span'); value.className = 'hm-filter-facet__value body-small'; row.insertBefore(value, row.querySelector('.hm-filter-facet__chevron')); }
            value.textContent = picked.join(', ');
          } else if (value) value.remove();
          row.setAttribute('aria-label', row.getAttribute('data-facet-label') + (picked.length ? ', ' + picked.join(', ') : ''));
          var block = blocks.filter(function (bl) { return bl.getAttribute('data-facet-block') === key; })[0];
          row.hidden = block && block.getAttribute('data-empty') === 'true';
        });
        // "Applied" recap: every ticked option, then label / artist (Figma order)
        chipsBox.textContent = '';
        draftBoxes.forEach(function (b) {
          if (!b.checked) return;
          chipsBox.appendChild(makeChip(layerChip, labelOf(b), function () { b.checked = false; renderDraft(); focusAfterRemove(); }));
        });
        chipsOf(s).forEach(function (c) {
          chipsBox.appendChild(makeChip(layerChip, c.text, function () {
            draftHidden[c.key] = draftHidden[c.key].filter(function (x) { return x !== c.value; });
            renderDraft(); focusAfterRemove();
          }));
        });
        appliedBox.hidden = currentFacet !== null || !chipsBox.firstChild;
        // Apply + the records the draft gives (suffix, 0029). 0 stays enabled: the page shows its empty state.
        setSuffix(applyBtn, String(shownFor(s)));
      };
      var focusAfterRemove = function () {
        var next = chipsBox.querySelector('.hm-entity-chip__remove') || rows.filter(function (r) { return !r.hidden; })[0] || applyBtn;
        if (next) next.focus();
      };
      var showLevel = function (key) {
        currentFacet = key;
        panel.setAttribute('data-level', key ? 'facet' : 'main');
        var row = key && rows.filter(function (r) { return r.getAttribute('data-facet') === key; })[0];
        title.textContent = key ? row.getAttribute('data-facet-label') : 'Filter';   // owner 2026-11-10: "Filter", as the trigger
        back.hidden = !key;
        layer.querySelector('[data-layer-facets]').hidden = !!key;
        var soldRow = layer.querySelector('[data-layer-sold]'); if (soldRow) soldRow.hidden = !!key;
        blocks.forEach(function (bl) { bl.hidden = bl.getAttribute('data-facet-block') !== key; });
        renderDraft();
        layer.querySelector('.hm-filters-layer__body').scrollTop = 0;
      };
      var open = function () {
        draftBoxes.forEach(function (d) {
          d.checked = boxes.some(function (b) { return b.name === d.name && b.value === d.value && b.checked; });
        });
        hidden.forEach(function (f) { draftHidden[f.key] = hiddenSel[f.key].slice(); });
        if (draftSold) draftSold.checked = soldBox ? soldBox.checked : true;
        showLevel(null);
        layer.showModal();
        // no control is focused on open (decision 0043): the dialog itself takes focus, so screen readers hear
        // "Filter" and Tab starts inside it, with nothing pre-selected on screen
        layer.focus();
      };
      var close = function () { if (layer.open) layer.close(); };
      trigger.addEventListener('click', open);
      layer.addEventListener('close', function () { trigger.focus(); });
      layer.querySelector('[data-layer-close]').addEventListener('click', close);
      back.addEventListener('click', function () {
        var from = currentFacet;
        showLevel(null);
        var row = rows.filter(function (r) { return r.getAttribute('data-facet') === from; })[0];
        if (row) row.focus();
      });
      rows.forEach(function (row) {
        row.addEventListener('click', function () {
          showLevel(row.getAttribute('data-facet'));
          // the tapped row is now hidden: focus goes to the level's title, not to its first option (decision 0043)
          title.setAttribute('tabindex', '-1');
          title.focus();
        });
      });
      layer.addEventListener('change', renderDraft);
      // Reset: clears the draft (every facet), the layer stays open; Apply confirms
      layer.querySelector('[data-layer-reset]').addEventListener('click', function () {
        draftBoxes.forEach(function (d) { d.checked = false; });
        hidden.forEach(function (f) { draftHidden[f.key] = []; });
        if (draftSold) draftSold.checked = true;
        renderDraft();
      });
      applyBtn.addEventListener('click', function () {
        boxes.forEach(function (b) {
          b.checked = draftBoxes.some(function (d) { return d.name === b.name && d.value === b.value && d.checked; });
        });
        hidden.forEach(function (f) { hiddenSel[f.key] = draftHidden[f.key].slice(); });
        if (soldBox && draftSold) soldBox.checked = draftSold.checked;
        apply(true);
        close();
        window.scrollTo(0, 0);
      });
    }

    root.addEventListener('change', function () { apply(true); });
    applySort();
    apply(false);
    // the wantlist check marks the cards later: it calls this to sort and show them
    if (wantPage) wantPage.__reapply = function () { applySort(); apply(false); };
    // analytics: one search per results page; 0 results = what people look for and the shop doesn't have
    if (searchPage && query && window.HighmuzikAnalytics) {
      var term = window.HighmuzikAnalytics.safeTerm(query);
      var results = lastShown;
      track('search', { term: term || '[redacted]', results: results, no_results: results === 0 });
    }
  }

  /* ------------------------------------------------------- 5b. check your wantlist */
  /* /wantlist/ (pages/plp.js → WantlistTop, Figma page `Wantlist`, decision 0152). Discogs OAuth 1.0a through the
     function discogs-oauth, which only does what needs the app's secret: the request token, the access token, and
     signing read URLs. This browser then reads the wantlist straight from api.discogs.com and compares it with the
     cards of the page: the wantlist never reaches the shop's server and is never saved, only kept in memory while the
     check runs. The visitor's Discogs permission lives in sessionStorage (this tab only, no cookie) until the tab is
     closed or Disconnect is pressed. Matches: release id = "Exact matches" (data-want="exact"), else master id =
     "Other pressings" (data-want="other"). */
  var WANT_REQ = 'highmuzik-wantlist-request', WANT_ACCESS = 'highmuzik-wantlist-access';
  var wantRun = 0;   // the running check; a new one (or Disconnect, or leaving the page) makes the old one stop
  function sessionGet(k) { try { return JSON.parse(sessionStorage.getItem(k) || 'null'); } catch (e) { return null; } }
  function sessionSet(k, v) { try { if (v === null) sessionStorage.removeItem(k); else sessionStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* no storage: the check still runs once */ } }
  function initWantlist() {
    wantRun++;
    var page = document.querySelector('[data-wantlist-page]');
    var top = page && page.querySelector('[data-wantlist]');
    if (!top) return;
    var endpoint = top.getAttribute('data-endpoint');
    var connect = top.querySelector('[data-wantlist-connect]');
    var heading = top.querySelector('[data-wantlist-heading]');
    var title = top.querySelector('[data-wantlist-title]');
    var errorBox = top.querySelector('[data-wantlist-error]');
    var start = top.querySelector('[data-wantlist-start]');
    var results = [page.querySelector('.plp-content'), page.querySelector('.plp-header'), page.querySelector('[data-plp-active]')];
    var items = Array.prototype.slice.call(page.querySelectorAll('.plp-item'));
    var callback = location.origin + location.pathname;
    var state = { checking: false, total: 0 };
    var count = function (n) { return n.toLocaleString('en-GB'); };

    function call(body) {
      return fetch(endpoint, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
        .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { if (!r.ok) throw new Error(j.error || r.status); return j; }); });
    }
    function show(view, message) {
      connect.hidden = view !== 'connect';
      heading.hidden = view === 'connect';
      results.forEach(function (el) { if (el) el.hidden = view !== 'results'; });
      errorBox.hidden = !message; errorBox.textContent = message || '';
      if (start) start.removeAttribute('aria-busy');
    }
    function forget() { sessionSet(WANT_ACCESS, null); sessionSet(WANT_REQ, null); }
    function unmark() { items.forEach(function (el) { el.removeAttribute('data-want'); }); if (page.__reapply) page.__reapply(); }
    // the heading follows the filters ("N records from your wantlist"); before the check ends it shows the progress
    page.__onApply = function (shown) {
      if (state.checking || heading.hidden) return;
      title.textContent = shown ? count(shown) + (shown === 1 ? ' record from your wantlist' : ' records from your wantlist')
        : 'None of the ' + count(state.total) + ' records on your wantlist are here right now';
    };

    // Connect: a request token, then Discogs' "Authorize" page; Discogs sends the visitor back here
    if (start) start.addEventListener('click', function () {
      start.setAttribute('aria-busy', 'true');
      call({ action: 'start', callback: callback }).then(function (j) {
        sessionSet(WANT_REQ, { token: j.token, secret: j.secret });
        track('wantlist_connect', {});
        location.href = j.authorizeUrl;
      }, function () { show('connect', 'Discogs can’t be reached right now. Try again in a minute.'); });
    });
    top.querySelector('[data-wantlist-disconnect]').addEventListener('click', function () {
      wantRun++; forget(); unmark(); state.checking = false;
      show('connect');
      track('wantlist_disconnect', {});
      if (start) start.focus();
    });

    // back from Discogs: ?oauth_token=…&oauth_verifier=… (or ?denied=… when the visitor said no)
    var params = new URLSearchParams(location.search);
    var verifier = params.get('oauth_verifier'), req = sessionGet(WANT_REQ);
    if (params.has('oauth_token') || params.has('denied')) history.replaceState(history.state, '', location.pathname);
    if (params.has('denied')) { forget(); show('connect', 'You said no on Discogs, so nothing was checked.'); return; }
    if (verifier && req && req.token === params.get('oauth_token')) {
      sessionSet(WANT_REQ, null);
      show('checking'); title.textContent = 'Connecting to Discogs…';
      call({ action: 'finish', token: req.token, secret: req.secret, verifier: verifier }).then(function (acc) {
        sessionSet(WANT_ACCESS, { token: acc.token, secret: acc.secret });
        check(acc);
      }, function () { show('connect', 'Discogs didn’t confirm the connection. Try again.'); });
      return;
    }
    var acc = sessionGet(WANT_ACCESS);
    if (acc) check(acc); else show('connect');

    function check(acc) {
      var run = ++wantRun;
      var alive = function () { return run === wantRun && document.body.contains(page); };
      var releases = {}, masters = {};   // the wantlist, in memory only, gone when the check ends
      state.checking = true;
      show('checking'); title.textContent = 'Checking your wantlist…';
      var sign = function (requests) { return call({ action: 'sign', token: acc.token, secret: acc.secret, requests: requests }).then(function (j) { return j.urls; }); };
      // one page of Discogs; 429 = too fast (60 requests a minute): wait and ask again for a freshly signed URL
      var get = function (request, tries) {
        return sign([request]).then(function (urls) { return fetch(urls[0]); }).then(function (r) {
          if (r.status === 429 && (tries || 0) < 6) return new Promise(function (ok) { setTimeout(ok, 10000); }).then(function () { return get(request, (tries || 0) + 1); });
          if (r.status === 401 || r.status === 403) { var e = new Error('denied'); e.denied = true; throw e; }
          if (!r.ok) throw new Error(String(r.status));
          return r.json();
        });
      };
      var progress = function (done) {
        title.textContent = 'Checking your wantlist… ' + count(Math.min(done, state.total)) + ' of ' + count(state.total) + ' records';
      };
      get({ path: '/oauth/identity' }).then(function (me) {
        var path = '/users/' + encodeURIComponent(me.username) + '/wants';
        var pageOf = function (n) { return get({ path: path, query: { page: String(n), per_page: '100' } }); };
        var take = function (data) {
          (data.wants || []).forEach(function (w) {
            var b = w.basic_information || {};
            if (w.id || b.id) releases[String(w.id || b.id)] = true;
            if (b.master_id) masters[String(b.master_id)] = true;
          });
        };
        return pageOf(1).then(function (first) {
          if (!alive()) return null;
          var pages = (first.pagination && first.pagination.pages) || 1;
          state.total = (first.pagination && first.pagination.items) || (first.wants || []).length;
          take(first); progress(100);
          var n = 2;
          var next = function () {
            if (!alive()) return null;
            if (n > pages) return true;
            return pageOf(n).then(function (data) { take(data); progress(n * 100); n++; return next(); });
          };
          return next();
        });
      }).then(function (done) {
        if (!done || !alive()) return;
        var exact = 0, other = 0;
        items.forEach(function (el) {
          var r = el.getAttribute('data-release'), m = el.getAttribute('data-master');
          var want = r && releases[r] ? 'exact' : m && masters[m] ? 'other' : '';
          if (want) el.setAttribute('data-want', want); else el.removeAttribute('data-want');
          if (want === 'exact') exact++; else if (want === 'other') other++;
        });
        releases = masters = null;
        state.checking = false;
        show('results');
        if (page.__reapply) page.__reapply();
        track('wantlist_checked', { wants: state.total, exact: exact, other: other });
      }, function (e) {
        releases = masters = null;
        state.checking = false;
        if (!alive()) return;
        unmark();
        if (e && e.denied) { forget(); show('connect', 'Discogs no longer lets this shop read your wantlist. Connect again.'); }
        else show('connect', 'The check stopped: Discogs can’t be reached right now. Try again in a minute.');
      });
    }
  }

  /* ---------------------------------------------------------------- 6. bag */

  var BAG_KEY = 'highmuzik-bag';
  // storage can be missing or refuse (private window, blocked site data): the bag is then empty, never an error
  function readBag() {
    try {
      var v = JSON.parse(window.localStorage.getItem(BAG_KEY) || '[]');
      return Array.isArray(v) ? v.filter(function (x) { return typeof x === 'string' && x; }) : [];
    } catch (e) { return []; }
  }
  function writeBag(ids) {
    try { window.localStorage.setItem(BAG_KEY, JSON.stringify(ids)); } catch (e) { /* not saved: stays for this page */ }
    renderBag();
  }
  // accepted offers (decision 0188): each email link opened in this browser, by listing id: { t: token, a: amount in
  // cents, e: end of the hold } (0190: the record's page remembers the offer after a Remove). The Bag prices the line with
  // the token and create-checkout checks it again. Only the offer's inbox gets the link: it is the proof.
  var OFFERS_KEY = 'highmuzik-offers';
  function readOffers() {
    try {
      var v = JSON.parse(window.localStorage.getItem(OFFERS_KEY) || '{}');
      if (!v || typeof v !== 'object' || Array.isArray(v)) return {};
      Object.keys(v).forEach(function (id) { if (typeof v[id] === 'string') v[id] = { t: v[id] }; });   // 0188 kept the token alone
      return v;
    } catch (e) { return {}; }
  }
  function writeOffers(map) {
    try { window.localStorage.setItem(OFFERS_KEY, JSON.stringify(map)); return true; } catch (e) { return false; }
  }
  function readOfferTokens() {
    var all = readOffers(), out = {};
    Object.keys(all).forEach(function (id) { if (all[id] && all[id].t) out[id] = all[id].t; });
    return out;
  }
  // this browser's accepted offer for a copy, while its hold runs (null otherwise)
  function heldOffer(id) {
    var o = id && readOffers()[id];
    if (!o || !o.t) return null;
    if (o.e && new Date(o.e).getTime() <= Date.now()) return null;
    return o;
  }
  // same rule as formatPrice in pages/shell.js: whole euros without decimals (12, 12.50) + the euro sign
  function formatPrice(cents) { return (cents % 100 === 0 ? cents / 100 : (cents / 100).toFixed(2)) + '\u20ac'; }

  // a polite live region, once per document (outside .hm-page, so the soft navigation keeps it)
  var bagStatus = null;
  function announce(text) {
    if (!bagStatus) {
      bagStatus = document.createElement('p');
      bagStatus.className = 'hm-visually-hidden';
      bagStatus.setAttribute('role', 'status');
      document.body.appendChild(bagStatus);
    }
    bagStatus.textContent = '';
    window.setTimeout(function () { bagStatus.textContent = text; }, 50);
  }

  function addToBag(id) {
    if (!id) return;
    var ids = readBag();
    if (ids.indexOf(id) === -1) { ids.push(id); writeBag(ids); track('bag_add', { listing_id: id, bag_size: ids.length }); }
    // a toast too (owner, decision 0050), even if the button and the header count already change: View bag = the header
    // Bag link (soft navigation keeps the player), so the toast closes after 6 s like a text-only one
    if (window.HighmuzikToast) {
      window.HighmuzikToast.show({ message: 'Added to bag.', actionLabel: 'View bag', actionElsewhere: true, onAction: function () {
        var link = document.querySelector('a[data-bag-count]');
        if (link) link.click();
      } });
    } else announce('Added to bag. ' + ids.length + (ids.length === 1 ? ' record' : ' records') + ' in the bag.');
  }
  function removeFromBag(id) {
    var ids = readBag().filter(function (x) { return x !== id; });
    writeBag(ids);
    track('bag_remove', { listing_id: id, bag_size: ids.length });
  }

  // the header Bag button: "(n)" in its suffix, on every page
  function renderBagCount(n) {
    Array.prototype.forEach.call(document.querySelectorAll('[data-bag-count] .hm-button__suffix'), function (el) {
      el.textContent = '(' + n + ')';
    });
    Array.prototype.forEach.call(document.querySelectorAll('[data-bag-count]'), function (el) {
      el.setAttribute('aria-label', 'Bag, ' + n + (n === 1 ? ' record' : ' records'));
    });
  }

  // /bag/: show the lines of the bag in order, the subtotal of the available ones, or the empty state
  function renderBagPage(ids) {
    var root = document.querySelector('[data-bag-page]');
    if (!root) return ids;
    var list = root.querySelector('[data-bag-list]');
    var lines = {};
    Array.prototype.forEach.call(list.querySelectorAll('[data-bag-line]'), function (li) {
      lines[li.getAttribute('data-bag-line')] = li;
      li.hidden = true;
    });
    // ids with no line are listings that left the shop (unpublished, archived, deleted): drop them from the bag
    var known = ids.filter(function (id) { return !!lines[id]; });
    // a paid offer (another tab, another device) leaves the bag like a paid checkout
    known = known.filter(function (id) { return !(bagOffers && bagOffers[id] && bagOffers[id].state === 'paid' && lines[id].getAttribute('data-price-mode') === 'offers'); });
    var count = 0, cents = 0, sold = 0, held = 0, heldByHand = 0, expired = 0, offers = 0;
    known.forEach(function (id) {
      var li = lines[id];
      li.hidden = false;
      list.appendChild(li);   // in the order they were added
      if (li.getAttribute('data-available') === 'true') {
        count++; cents += parseInt(li.getAttribute('data-price'), 10) || 0;
        if (li.getAttribute('data-price-mode') === 'offers') offers++;
      }
      else if (li.querySelector('.hm-bag-item[data-status="sold"]')) sold++;
      else if (li.querySelector('.hm-bag-item[data-status="offer-expired"]')) expired++;
      else if (li.getAttribute('data-price-mode') === 'offers') { held++; heldByHand++; }   // no token here: no 30 min hint
      else { held++; if (holdKind && holdKind[id] === 'manual') heldByHand++; }
    });
    root.setAttribute('data-bag-offers', String(offers));
    // sold and reserved lines are not in the order: say it above Checkout, in full sentences, so a partial checkout
    // is explicit (decisions 0064, 0065; owner 2026-11-12). A checkout hold ends within 30 min; a hold by hand has no end.
    var soldNote = root.querySelector('[data-bag-sold-out]');
    if (soldNote) {
      var notes = [];
      if (sold) notes.push(sold === 1 ? '1 record is sold out and won\u2019t be in this order.'
        : sold + ' records are sold out and won\u2019t be in this order.');
      if (expired) notes.push(expired === 1 ? '1 offer has expired and won\u2019t be in this order.'
        : expired + ' offers have expired and won\u2019t be in this order.');
      if (held) notes.push((held === 1 ? '1 record is reserved and won\u2019t be in this order.'
        : held + ' records are reserved and won\u2019t be in this order.') +
        (heldByHand === held ? '' : held === 1 ? ' It may be back within 30 minutes.' : ' They may be back within 30 minutes.'));
      soldNote.hidden = notes.length === 0;
      soldNote.textContent = notes.join(' ');
    }
    var empty = known.length === 0;
    list.hidden = empty;
    root.querySelector('[data-bag-summary]').hidden = empty;
    root.querySelector('[data-bag-empty]').hidden = !empty;
    root.querySelector('[data-bag-subtotal-label]').textContent = 'Subtotal (' + count + (count === 1 ? ' record)' : ' records)');
    root.querySelector('[data-bag-subtotal]').textContent = formatPrice(cents);
    var served = renderShipping(root, known.filter(function (id) { return lines[id].getAttribute('data-available') === 'true'; })
      .map(function (id) { return lines[id]; }), cents);
    var below = renderMinimum(root, count, cents);
    var checkout = root.querySelector('[data-bag-checkout]');
    if (checkout) checkout.disabled = count === 0 || !served || below;
    return known;
  }

  // minimum order (decision 0072, Figma `bag summary` minimum=below): the available records' subtotal, shipping
  // excluded, must reach the minimum set on the admin page Shipping. Under it: the note says the minimum and what is
  // missing, Checkout is disabled and described by the note (never an unexplained disabled button); the note is a
  // live region and reaching the minimum is announced. create-checkout checks again on the server (shipping.js minimumOrder).
  // Returns true while the bag is under the minimum.
  var minimumWasBelow = null;
  function renderMinimum(root, count, cents) {
    var summary = root.querySelector('[data-bag-summary]');
    var note = root.querySelector('[data-bag-minimum]');
    var checkout = root.querySelector('[data-bag-checkout]');
    var min = summary ? parseInt(summary.getAttribute('data-min-order-cents'), 10) || 0 : 0;
    // an accepted offer never had a minimum (0158), so a bag with one has none either (0186)
    var withOffer = (parseInt(root.getAttribute('data-bag-offers'), 10) || 0) > 0;
    var below = min > 0 && count > 0 && cents < min && !withOffer;
    if (note) {
      note.hidden = !below;
      note.textContent = below ? 'Minimum order ' + formatPrice(min) + '. Add ' + formatPrice(min - cents) + ' more to check out.' : '';
    }
    if (checkout && note) {
      if (below) checkout.setAttribute('aria-describedby', note.id);
      else if (checkout.getAttribute('aria-describedby') === note.id) checkout.removeAttribute('aria-describedby');
    }
    // the note is its own polite live region (bag.js), so "Add 3€ more" is heard when it appears or changes, next to
    // the bag's own "Removed from bag." Reaching the minimum hides it: say that in the bag's status instead.
    if (minimumWasBelow === true && !below && min > 0 && count > 0) announce('Minimum order reached. You can check out.');
    minimumWasBelow = below;
    return below;
  }

  // shipping estimate (decision 0057, Figma `bag summary` destination=served | not served): the page carries the
  // config (admin page Shipping), packages/shipping/shipping.js does the maths, the country is remembered.
  // Returns false when the bag cannot go to checkout for this country (not served, too heavy). No config on the
  // page = shipping not set up: "Calculated at checkout", as before.
  var SHIP_KEY = 'highmuzik-ship-to';
  function readShipTo() { try { return window.localStorage.getItem(SHIP_KEY); } catch (e) { return null; } }
  function renderShipping(root, availableLines, subtotal) {
    var select = root.querySelector('[data-bag-ship-to]');
    var configEl = root.querySelector('[data-shipping-config]');
    if (!select || !configEl || !window.HighmuzikShipping) return true;
    var config;
    try { config = JSON.parse(configEl.textContent); } catch (e) { return true; }
    var stored = readShipTo();
    if (stored && select.value !== stored && select.querySelector('option[value="' + stored + '"]')) select.value = stored;
    var country = select.value, name = select.options[select.selectedIndex] ? select.options[select.selectedIndex].text : country;
    var items = availableLines.map(function (li) {
      return { format: li.getAttribute('data-format'), weight_g: parseInt(li.getAttribute('data-weight'), 10) || null };
    });
    var est = window.HighmuzikShipping.estimate(config, items, country);
    var shipping = root.querySelector('[data-bag-shipping]'), total = root.querySelector('[data-bag-total]');
    var note = root.querySelector('[data-bag-note]');
    var totalRow = total && total.closest('.hm-bag-summary__row');
    var served = est.status === 'ok' || est.status === 'empty';
    if (est.status === 'ok') {
      shipping.textContent = formatPrice(est.price_cents);
      total.textContent = formatPrice(subtotal + est.price_cents);
    } else if (est.status === 'empty') {
      shipping.textContent = '\u2014';
      total.textContent = formatPrice(subtotal);
    } else shipping.textContent = 'Not available';
    if (totalRow) totalRow.hidden = !served;
    if (note) note.textContent = served
      ? 'Shipping is an estimate for your country. You enter the address and pay on Stripe. Records aren\u2019t held: if someone pays for one first, you aren\u2019t charged.'
      : est.status === 'not-served' ? 'We don\u2019t ship to ' + name + ' yet.'
      : 'This bag is too big for one parcel. Remove a few records to check out.';
    return served;
  }
  // a new country: remember it, recompute, and say the result (the rows change silently otherwise)
  document.addEventListener('change', function (e) {
    var select = e.target.closest && e.target.closest('[data-bag-ship-to]');
    if (!select) return;
    try { window.localStorage.setItem(SHIP_KEY, select.value); } catch (err) { /* ignore */ }
    renderBag();
    var root = document.querySelector('[data-bag-page]'), sh = root && root.querySelector('[data-bag-shipping]');
    if (sh) announce('Shipping to ' + select.options[select.selectedIndex].text + ': ' + sh.textContent + '.');
  });

  // the accepted offers of the bag's Best offer copies (decision 0188): each token kept by this browser is read with the
  // function `offer` (pay-info: state ready | expired | paid | closed, amount, expires_at). null = not read yet, {} = none.
  // Read on the Bag page when the bag has a Best offer copy; read again when a checkout finds an offer gone.
  var bagOffers = null, bagOffersReading = false;
  function readBagOffers(force) {
    if (bagOffersReading || (bagOffers !== null && !force)) return;
    var root = document.querySelector('[data-bag-page]');
    if (!root) return;
    var endpoint = root.getAttribute('data-offer-endpoint'), tokens = readOfferTokens();
    var ids = readBag().filter(function (id) {
      var li = root.querySelector('[data-bag-line="' + id + '"]');
      return li && li.getAttribute('data-price-mode') === 'offers' && tokens[id];
    });
    if (!ids.length || !endpoint || !window.fetch) { if (bagOffers === null && ids.length) { bagOffers = {}; renderBag(); } return; }
    bagOffersReading = true;
    Promise.all(ids.map(function (id) {
      return offerPost(endpoint, { action: 'pay-info', token: tokens[id] }).then(function (r) { return [id, r.data]; }, function () { return [id, null]; });
    })).then(function (rows) {
      bagOffersReading = false;
      bagOffers = {};
      rows.forEach(function (r) { if (r[1] && r[1].state && r[1].state !== 'invalid') bagOffers[r[0]] = r[1]; });
      renderBag();
    });
  }
  function renderBag() {
    var ids = readBag();
    readBagOffers(false);
    applyStatus();
    var known = renderBagPage(ids);
    if (known.length !== ids.length) {
      try { window.localStorage.setItem(BAG_KEY, JSON.stringify(known)); } catch (e) { /* ignore */ }
      ids = known;
    }
    // a token whose offer is paid leaves with its line
    if (bagOffers) {
      var all = readOffers(), drop = Object.keys(all).filter(function (id) { return bagOffers[id] && bagOffers[id].state === 'paid'; });
      if (drop.length) { drop.forEach(function (id) { delete all[id]; }); writeOffers(all); }
    }
    renderBagCount(ids.length);
    syncAddButtons(ids);
  }

  function initBag() { renderBag(); checkoutReturn(); offerAddedNotice(); }

  /* checkout (migration 0021, _context/backend.md → Checkout con hold): Checkout posts the AVAILABLE ids of the bag and
     the country to create-checkout, which holds the copies for 33 min and answers the Stripe Checkout URL. The session
     and its ids are remembered ('highmuzik-checkout'): back on the bag (cancel link or browser Back) the session is expired at
     once and the copies are free again, for the buyer too (checkoutReturn); on the thanks page ([data-checkout-thanks]) the bought ids leave the bag.
     TODO Figma: Button has no loading state; while the request runs Checkout is aria-disabled and ignores clicks,
     with no visual change (a disabled Button is struck through = unavailable, decision 0058). */
  var CHECKOUT_KEY = 'highmuzik-checkout';
  var checkoutBusy = false;
  function checkoutMessage(text) { if (window.HighmuzikToast) window.HighmuzikToast.show({ message: text }); else announce(text); }
  function startCheckout(btn) {
    if (checkoutBusy) return;
    var endpoint = btn.getAttribute('data-endpoint');
    if (!endpoint || !window.fetch) { checkoutMessage('Checkout isn\u2019t open yet.'); return; }
    var root = document.querySelector('[data-bag-page]');
    var ids = Array.prototype.filter.call(root.querySelectorAll('[data-bag-line]'), function (li) {
      return !li.hidden && li.getAttribute('data-available') === 'true';
    }).map(function (li) { return li.getAttribute('data-bag-line'); });
    var select = root.querySelector('[data-bag-ship-to]');
    if (!ids.length) return;
    checkoutBusy = true;
    btn.setAttribute('aria-disabled', 'true');
    announce('Starting checkout\u2026');
    function done() { checkoutBusy = false; btn.removeAttribute('aria-disabled'); }
    // accepted offers in the bag (0188): the tokens of their email links tell create-checkout which offers they are
    var tokens = readOfferTokens();
    var offers = ids.map(function (id) { return tokens[id]; }).filter(Boolean);
    fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' },
      // previous: a session of ours that is still open (its end on return failed): the server ends it before holding
      body: JSON.stringify({ ids: ids, country: select ? select.value : '', previous: (readCheckout() || {}).session, offers: offers }) })
      .then(function (res) { return res.json().catch(function () { return {}; }).then(function (b) { return { status: res.status, body: b }; }); })
      .then(function (r) {
        var b = r.body || {};
        if (r.status === 200 && b.url) {
          try { window.localStorage.setItem(CHECKOUT_KEY, JSON.stringify({ session: b.session, ids: ids })); } catch (e) { /* ignore */ }
          track('checkout_started', { records: ids.length, country: select ? select.value : '' });
          window.location.href = b.url;   // keeps aria-disabled: the page is leaving
          return;
        }
        done();
        if (b.error === 'already_paid') {
          var paid = readCheckout();
          if (paid && Array.isArray(paid.ids)) writeBag(readBag().filter(function (id) { return paid.ids.indexOf(id) === -1; }));
          forgetCheckout();
          readLive(true);
          checkoutMessage('Your previous checkout is already paid. You\u2019ll get a confirmation email.');
        } else if (b.error === 'unavailable') {
          readLive(true);   // the lines that were just taken turn Sold out / Reserved
          readBagOffers(true);   // and an offer that just ran out turns Expired
          checkoutMessage('Some records were just taken. Your bag is updated: check it and try again.');
        } else if (b.error === 'below_minimum') {
          readLive(true);
          checkoutMessage('Your order is under the minimum of ' + formatPrice(b.min_cents || 0) + '.');
        } else if (b.error === 'shipping') {
          checkoutMessage(b.status === 'not-served' ? 'We don\u2019t ship to this country yet.' : 'Shipping for this bag can\u2019t be calculated. Remove a few records and try again.');
        } else checkoutMessage('Checkout couldn\u2019t start. Please try again in a moment.');
      })
      .catch(function () { done(); checkoutMessage('Checkout couldn\u2019t start. Check your connection and try again.'); });
  }
  function readCheckout() {
    try { var v = JSON.parse(window.localStorage.getItem(CHECKOUT_KEY) || 'null'); return v && typeof v === 'object' ? v : null; } catch (e) { return null; }
  }
  function forgetCheckout() { try { window.localStorage.removeItem(CHECKOUT_KEY); } catch (e) { /* ignore */ } }
  function checkoutReturn() {
    var pending = readCheckout();
    // thanks page: the paid records leave the bag
    if (document.querySelector('[data-checkout-thanks]')) {
      if (pending && Array.isArray(pending.ids)) writeBag(readBag().filter(function (id) { return pending.ids.indexOf(id) === -1; }));
      forgetCheckout();
      thanksResult(pending);
      return;
    }
    if (!document.querySelector('[data-bag-page]')) return;
    var cancelled = /[?&]checkout=cancelled\b/.test(window.location.search);
    if (cancelled) { try { window.history.replaceState(window.history.state, '', window.location.pathname); } catch (e) { /* ignore */ } }
    // Back on the bag with a checkout of ours still open: Stripe's cancel link, the browser's Back (no ?checkout=, often
    // from the back-forward cache) or the bag opened again. The buyer is not paying in this tab any more: the session is
    // expired and its copies are free again at once, for them and for everyone (otherwise their own records read
    // "Reserved" for up to 33 min). The server frees them only once Stripe confirms the session can't be paid.
    var btn = document.querySelector('[data-bag-checkout]');
    var endpoint = btn && btn.getAttribute('data-endpoint');
    if (pending && pending.session && endpoint && window.fetch) {
      fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'cancel', session: pending.session }) })
        .then(function (res) { return res.json().catch(function () { return {}; }); })
        .then(function (r) {
          if (r.paid) {   // paid meanwhile (another tab): as on the thanks page
            if (Array.isArray(pending.ids)) writeBag(readBag().filter(function (id) { return pending.ids.indexOf(id) === -1; }));
            forgetCheckout();
            checkoutMessage('Your order is paid. You\u2019ll get a confirmation email.');
          } else if (r.ok && !r.kept) {
            forgetCheckout();
            if (!cancelled) checkoutMessage('Checkout cancelled. Your records are still in your bag.');
          }   // kept (Stripe not reachable): remembered, Checkout ends it first (startCheckout sends it as previous)
          readLive(true);
        }).catch(function () { /* offline: remembered, ended by the next Checkout or by itself within 33 min */ });
    } else if (pending) forgetCheckout();
    if (cancelled) checkoutMessage('Checkout cancelled. Your records are still in your bag.');
  }
  // First to pay wins (decision 0116): Stripe sends every buyer here, but stripe-webhook may find that someone paid for a
  // record a moment earlier ('lost': the authorization is cancelled, nothing charged). Ask checkout_result (migration
  // 0028) a few times; on 'lost' the page says so and the records go back in the bag (they read Sold out there).
  // Figma: page Checkout → Checkout not completed - desktop / mobile (`order thanks` with message override, show note off).
  function thanksResult(pending) {
    var m = /[?&]session_id=(cs_(?:test|live)_[A-Za-z0-9]+)/.exec(window.location.search);
    var base = document.querySelector('meta[name="hm-supabase-url"]');
    var key = document.querySelector('meta[name="hm-supabase-key"]');
    if (!m || !base || !key || !window.fetch) return;
    var tries = 0;
    (function ask() {
      fetch(base.content + '/rest/v1/rpc/checkout_result', { method: 'POST',
        headers: { apikey: key.content, 'Content-Type': 'application/json' }, body: JSON.stringify({ p_session: m[1] }) })
        .then(function (res) { return res.ok ? res.json() : null; })
        .then(function (r) {
          if (r === 'pending' && ++tries < 10) { window.setTimeout(ask, 2000); return; }
          if (r !== 'lost') return;
          var main = document.querySelector('[data-checkout-thanks]');
          var title = main.querySelector('h1');
          var msg = main.querySelector('.bag-empty > p');
          if (title) title.textContent = 'Order not completed';
          if (msg) msg.textContent = 'Sorry: someone else bought a record in your order a moment before you. You were not charged, and nothing was sold to you.';
          Array.prototype.forEach.call(main.querySelectorAll('.bag-empty > p ~ *:not(.hm-button)'), function (el) { el.hidden = true; });
          if (pending && Array.isArray(pending.ids)) writeBag(readBag().concat(pending.ids.filter(function (id) { return readBag().indexOf(id) === -1; })));
          announce(msg ? msg.textContent : 'Order not completed');
        }).catch(function () { /* the email tells them */ });
    })();
  }

  // the browser's Back from Stripe can restore the bag from the back-forward cache: no script runs again, Checkout is
  // still aria-disabled from the click that left the page. Reset it and end the checkout as above.
  window.addEventListener('pageshow', function (e) {
    if (!e.persisted) return;
    checkoutBusy = false;
    var btn = document.querySelector('[data-bag-checkout]');
    if (btn) btn.removeAttribute('aria-disabled');
    checkoutReturn();
  });

  // a copy already in the bag: its Add buttons become "In bag" (owner 2026-11-12, decision 0058, replaces "Remove" of
  // 0054). Same Button: hierarchy secondary (the PDP CTA drops from primary), leading icon = tick (Figma `leading icon`
  // on, icon-tick-large-thin), label "In bag", accessible name "In bag, view bag". Pressing it opens the bag: taking a
  // copy out happens only in the bag. Never disabled: struck through means unavailable (sold). The defaults are kept
  // in data-*-default so they come back when the copy leaves the bag.
  // Reserved (decisions 0059, 0065): a copy held by a checkout (or by hand) reads "(Reserved) Notify me": prefix
  // "(Reserved)", label "Notify me", hierarchy secondary, trailing icon = envelope, no leading icon. Pressing it opens
  // the "Reserved" dialog (explains the hold, asks the email). It wins over "In bag". Never disabled (struck = sold, 0058).
  function syncAddButton(btn, id, ids) {
    var label = btn.querySelector('.hm-button__label');
    // the label's own text node (a prefix span may sit before it, 0065)
    var text = label && Array.prototype.filter.call(label.childNodes, function (n) { return n.nodeType === 3; })[0];
    if (!text || text.nodeType !== 3) return;
    if (!btn.hasAttribute('data-label-default')) btn.setAttribute('data-label-default', text.nodeValue);
    if (!btn.hasAttribute('data-hierarchy-default')) btn.setAttribute('data-hierarchy-default', btn.getAttribute('data-hierarchy') || 'primary');
    var st = id ? statusFor(id) : 'available';
    // sold (owner 2026-11-12, Figma page `Search`): "Sold out", disabled — struck through = unavailable (decision 0058)
    var sold = st === 'sold' || st === 'traded';
    var reserved = !sold && st === 'reserved';
    var inBag = !sold && !reserved && !!id && (ids || readBag()).indexOf(id) !== -1;
    // a Best offer copy (data-offer-href, decision 0189): reserved = "(Reserved) Notify me" as any copy; the buyer of the
    // accepted offer (its link opened in this browser, 0188) reads "Add to bag", or "In bag" once it is there (0190)
    var mine = false;
    if (btn.hasAttribute('data-offer-href')) {
      mine = reserved && !!heldOffer(id);
      inBag = mine && (ids || readBag()).indexOf(id) !== -1;
      if (mine) reserved = false;
    }
    if ('disabled' in btn) btn.disabled = sold;
    text.nodeValue = sold ? 'Sold out' : reserved ? '' : inBag ? 'In bag' : mine ? 'Add to bag' : btn.getAttribute('data-label-default');
    setReservedLabel(label, text, reserved);
    btn.setAttribute('data-hierarchy', sold || reserved || inBag ? 'secondary' : btn.getAttribute('data-hierarchy-default'));
    btn.setAttribute('data-in-bag', inBag ? 'true' : 'false');
    btn.setAttribute('data-reserved', reserved ? 'true' : 'false');
    if (reserved) btn.setAttribute('aria-label', 'Reserved. Notify me if it is back');
    else if (inBag) btn.setAttribute('aria-label', 'In bag, view bag');
    else btn.removeAttribute('aria-label');
    setLeadingIcon(btn, label, inBag ? 'hm-icon-tick' : null);
    setTrailingIcon(btn, reserved ? 'hm-icon-envelope' : null);
  }
  // "(Reserved) Notify me" (decision 0065): Button prefix "(Reserved)" + label "Notify me". On mobile only "Reserved"
  // shows (owner 2026-11-12): the brackets and "Notify me" are spans that base.css hides at the mobile breakpoint, so the
  // label follows the viewport without JS. The label's own text node is left empty meanwhile.
  function setReservedLabel(label, text, on) {
    var cur = label.querySelector('[data-reserved-label]');
    if (!on) { Array.prototype.forEach.call(label.querySelectorAll('[data-reserved-label]'), function (n) { label.removeChild(n); }); return; }
    if (cur) return;
    var prefix = document.createElement('span');
    prefix.className = 'hm-button__prefix'; prefix.setAttribute('data-reserved-label', '');
    prefix.innerHTML = '<span class="site-reserved__bracket">(</span>Reserved<span class="site-reserved__bracket">)</span>';
    var action = document.createElement('span');
    action.className = 'site-reserved__action'; action.setAttribute('data-reserved-label', ''); action.textContent = 'Notify me';
    label.insertBefore(prefix, text); label.insertBefore(action, text);
  }
  // the Button's trailing icon slot (only ever set by these states; the Add buttons have none by default)
  function setTrailingIcon(btn, templateId) {
    var cur = btn.querySelector('[data-trailing-icon]');
    if (cur && cur.getAttribute('data-trailing-icon') === templateId) return;
    if (cur) cur.parentNode.removeChild(cur);
    var tpl = templateId && document.getElementById(templateId);
    if (!tpl || !tpl.content.firstElementChild) return;
    var icon = tpl.content.firstElementChild.cloneNode(true);
    icon.setAttribute('data-trailing-icon', templateId);
    btn.appendChild(icon);
  }
  // the Button's leading icon slot: one icon at a time, cloned from a <template> on the page (build.js)
  function setLeadingIcon(btn, label, templateId) {
    var cur = btn.querySelector('[data-leading-icon]');
    if (cur && cur.getAttribute('data-leading-icon') === templateId) return;
    if (cur) cur.parentNode.removeChild(cur);
    var tpl = templateId && document.getElementById(templateId);
    if (!tpl || !tpl.content.firstElementChild) return;
    var icon = tpl.content.firstElementChild.cloneNode(true);
    icon.setAttribute('data-leading-icon', templateId);
    btn.insertBefore(icon, label);
  }
  function syncAddButtons(ids) {
    Array.prototype.forEach.call(document.querySelectorAll('[data-listing-id] .hm-product-card__add'), function (b) {
      var holder = b.closest('[data-listing-id]');
      if (holder.getAttribute('data-listing-section') === 'trade') return;   // a link to the offer page or a state, not a bag button (0068)
      if (holder.getAttribute('data-price-mode') === 'offers') {   // best offer (0158): the link stays a link; a reserved copy's button acts as any (0189)
        if (b.tagName === 'A') return;
        b.setAttribute('data-offer-href', holder.getAttribute('data-offer-href') || '');
      }
      syncAddButton(b, holder.getAttribute('data-listing-id'), ids);
    });
    Array.prototype.forEach.call(document.querySelectorAll('[data-add-to-bag]'), function (b) {
      syncAddButton(b, b.getAttribute('data-add-to-bag'), ids);
    });
    var add = player && player.querySelector('.site-player__add');
    var cur = typeof current === 'function' ? current() : null;
    if (add && cur && cur.section !== 'trade' && !(cur.offers && statusFor(cur.listing) === 'available')) syncAddButton(add, cur.listing, ids);
  }
  // the Add buttons: Add to bag, or open the bag when the copy is already in it (decision 0058). The header Bag link
  // does the opening, so the soft navigation keeps the player; no toast (decision 0050)
  // offerHref: the button of a Best offer copy (0189): open → its offer page; reserved → Notify me, or for the buyer of
  // the accepted offer Add to bag / open the bag (0190)
  function addOrOpen(id, offerHref) {
    if (!id) return;
    var st = statusFor(id);
    if (st === 'sold' || st === 'traded') return;
    if (offerHref && st === 'available') { location.href = offerHref; return; }
    if (st === 'reserved' && !(offerHref && heldOffer(id))) { openNotify(id, !!offerHref); return; }
    if (offerHref && st !== 'reserved') return;
    if (readBag().indexOf(id) === -1) { addToBag(id); return; }
    var link = document.querySelector('a[data-bag-count]');
    if (link) link.click();
  }
  // take a copy out of the bag with a toast + Undo (decision 0049); Undo puts it back where it was
  function removeWithUndo(id, returnFocus, onUndo) {
    var at = readBag().indexOf(id);
    removeFromBag(id);
    if (!window.HighmuzikToast) { announce('Removed from bag.'); return; }
    window.HighmuzikToast.show({ message: 'Removed from bag.', actionLabel: 'Undo', returnFocus: returnFocus, onAction: function () {
      var ids = readBag();
      if (ids.indexOf(id) === -1) { ids.splice(at < 0 ? ids.length : Math.min(at, ids.length), 0, id); writeBag(ids); }
      window.HighmuzikToast.show({ message: 'Undone.' });
      if (onUndo) onUndo();
      else if (returnFocus && document.contains(returnFocus)) returnFocus.focus();
    } });
  }

  /* ---------------------------------------------------------------- 7. live status */

  var seeded = {};      // listing id -> status written in this page at build time
  var live = {};        // listing id -> status read from Supabase (fresher: wins over the page)
  var heard = {};       // listing id -> build-time status of a copy queued in the player (kept across pages)
  var holdKind = {};    // listing id -> 'checkout' | 'manual' (reserved copies only)
  var lastLiveRead = 0;
  var LIVE_MIN_GAP = 30000;   // ms between two reads (page load, soft navigation, tab back in view)
  function statusFor(id) { return live[id] || seeded[id] || heard[id] || 'available'; }
  function listingIdOf(el) {
    return el.getAttribute('data-listing-id') || el.getAttribute('data-add-to-bag') || el.getAttribute('data-bag-line');
  }
  function seedStatus() {
    seeded = {};
    Array.prototype.forEach.call(document.querySelectorAll('[data-listing-status]'), function (el) {
      var id = listingIdOf(el);
      if (id) seeded[id] = el.getAttribute('data-listing-status');
    });
  }
  // Reserved -> the "Reserved" dialog (proposal, design/open.md): explains the hold and offers "Notify me" (one email
  // when the copy is available again, migration 0016). Without Supabase on the page: the explanation in a toast.
  // two kinds of hold (listing_availability.checkout_hold, migration 0016): a checkout (ends within 30 min) or a manual
  // one (owner holds it for someone, no end). Without the column (before 0016) a hold reads as a checkout.
  var RESERVED_TEXT = {
    checkout: 'Someone is checking out this record. If they don\u2019t buy it, it\u2019s back within 30 minutes.',
    manual: 'This record is on hold for someone. If it falls through, it\u2019s back in the shop.',
    offer: 'An offer was accepted. If it isn\u2019t paid within 48 h, the record is back and open to offers.'   // Best offer (0189)
  };
  function reservedText(id, offer) { return RESERVED_TEXT[offer ? 'offer' : holdKind[id] === 'manual' ? 'manual' : 'checkout']; }
  var notifyFor = null, notifyReturn = null, notifyBusy = false;
  function supabaseConfig() {
    var base = document.querySelector('meta[name="hm-supabase-url"]');
    var key = document.querySelector('meta[name="hm-supabase-key"]');
    return base && key ? { url: base.content, key: key.content } : null;
  }
  function notifyParts() {
    var d = document.querySelector('[data-notify-dialog]');
    if (!d) return null;
    var input = d.querySelector('[data-notify-email]');
    var field = input && input.closest('.hm-input');
    return { dialog: d, input: input, field: field, support: field && field.querySelector('[id$="-support"]'),
      confirm: d.querySelector('.hm-dialog__actions .hm-button:not([data-dialog-cancel])') };
  }
  var NOTIFY_SUPPORT = 'One email, only for this record. Then we delete your address.';
  function setNotifyError(p, text) {
    if (p.field) { if (text) p.field.setAttribute('data-invalid', 'true'); else p.field.removeAttribute('data-invalid'); }
    if (text) p.input.setAttribute('aria-invalid', 'true'); else p.input.removeAttribute('aria-invalid');
    if (p.support) p.support.textContent = text || NOTIFY_SUPPORT;
  }
  function openNotify(id, offer) {
    var p = notifyParts();
    if (!p || !p.dialog.showModal || !supabaseConfig()) {
      if (window.HighmuzikToast) window.HighmuzikToast.show({ message: reservedText(id, offer) }); else announce(reservedText(id, offer));
      return;
    }
    notifyFor = id;
    var body = p.dialog.querySelector('.hm-dialog__body');
    if (body) body.textContent = reservedText(id, offer) + ' Leave your email and we\u2019ll tell you.';
    notifyReturn = document.activeElement;
    setNotifyError(p, null);
    p.dialog.showModal();
    p.input.focus();
  }
  function closeNotify() {
    var p = notifyParts();
    if (p && p.dialog.open) p.dialog.close();
    notifyFor = null; notifyBusy = false;
    if (p && p.confirm) p.confirm.removeAttribute('aria-busy');
    if (notifyReturn && document.contains(notifyReturn)) notifyReturn.focus();
  }
  function sendNotify() {
    var p = notifyParts(), cfg = supabaseConfig();
    if (!p || !cfg || !notifyFor || notifyBusy) return;
    var email = p.input.value.trim();
    if (!email || (p.input.checkValidity && !p.input.checkValidity())) {
      setNotifyError(p, 'Enter an email address, like name@example.com.');
      p.input.focus();
      return;
    }
    notifyBusy = true;
    p.confirm.setAttribute('aria-busy', 'true');
    var id = notifyFor;
    fetch(cfg.url + '/rest/v1/rpc/request_back_in_stock', {
      method: 'POST',
      headers: { apikey: cfg.key, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ p_listing_id: id, p_email: email })
    }).then(function (res) {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.json();
    }).then(function (answer) {
      closeNotify();
      var msg = answer === 'available' ? 'It\u2019s available again: you can add it to the bag.'
        : answer === 'unavailable' ? 'Sorry, this record is no longer available.'
        : 'We\u2019ll email you if it\u2019s back.';
      if (answer !== 'ok') { live[id] = answer === 'available' ? 'available' : 'sold'; renderBag(); }
      if (window.HighmuzikToast) window.HighmuzikToast.show({ message: msg }); else announce(msg);
    }).catch(function () {
      notifyBusy = false;
      p.confirm.removeAttribute('aria-busy');
      setNotifyError(p, 'That didn\u2019t work. Check the address and try again.');
      p.input.focus();
    });
  }
  document.addEventListener('click', function (e) {
    var d = e.target && e.target.closest && e.target.closest('[data-notify-dialog]');
    if (!d) return;
    if (e.target.closest('[data-dialog-cancel]')) closeNotify();
    else if (e.target.closest('.hm-dialog__actions .hm-button')) sendNotify();
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && e.target && e.target.hasAttribute && e.target.hasAttribute('data-notify-email')) { e.preventDefault(); sendNotify(); }
  });
  // Esc: the native dialog closes itself; keep our state in step
  document.addEventListener('cancel', function (e) {
    if (e.target && e.target.hasAttribute && e.target.hasAttribute('data-notify-dialog')) { e.preventDefault(); closeNotify(); }
  }, true);
  // a bag line follows the live status, as pages/bag.js renders it: available (price), sold / reserved (name plain,
  // "SOLD OUT" / "RESERVED" in a red inline Alert beside the struck price, decisions 0064, 0065, 0078)
  var BAG_STATUS = { available: 'available', sold: 'sold', traded: 'sold' };
  // An accepted offer's line (decisions 0186, 0188, Figma `bag item` status=offer | offer expired): a Best offer copy is
  // priced from its email link's token (bagOffers, pay-info): ready = the offer's amount + "Your offer · held until …",
  // expired = "EXPIRED" beside the struck amount + "Your offer expired on …", closed / sold = SOLD OUT. No token in this
  // browser = RESERVED with "Open the link in the email of your offer", out of the order.
  function offerWhen(iso) {
    try { return new Date(iso).toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }); }
    catch (e) { return String(iso).slice(0, 16).replace('T', ' '); }
  }
  function offerLine(li, id) {
    var o = bagOffers && bagOffers[id];
    var status = statusFor(id);
    if (status === 'sold' || status === 'traded' || status === 'gone' || (o && o.state === 'closed')) return { line: 'sold' };
    if (o && o.state === 'ready') return { line: 'offer', cents: o.amount_cents, note: 'Your offer \u00b7 held until ' + offerWhen(o.expires_at) };
    if (o && o.state === 'expired') return { line: 'offer-expired', cents: o.amount_cents, note: 'Your offer expired on ' + offerWhen(o.expires_at) };
    return { line: 'reserved', note: bagOffers === null ? null : 'Your offer: open the link in its email to buy it at your price.' };
  }
  function setOfferNote(item, text) {
    var info = item.querySelector('.hm-bag-item__info');
    var note = item.querySelector('.hm-bag-item__offer-note');
    if (!text) { if (note) note.parentNode.removeChild(note); return; }
    if (!note && info) {
      note = document.createElement('p');
      note.className = 'hm-bag-item__offer-note body-small';   // = BagItem offerNote
      info.insertBefore(note, info.firstChild);
    }
    if (!note) return;
    note.textContent = text;
  }
  function syncBagLine(li) {
    var id = li.getAttribute('data-bag-line');
    var status = statusFor(id);
    var line = BAG_STATUS[status] || 'reserved';
    var offer = li.getAttribute('data-price-mode') === 'offers' ? offerLine(li, id) : null;
    if (offer) {
      line = offer.line;
      li.setAttribute('data-price', offer.cents || 0);
    }
    var available = line === 'available' || line === 'offer';
    li.setAttribute('data-listing-status', status);
    li.setAttribute('data-available', available ? 'true' : 'false');
    var item = li.querySelector('.hm-bag-item');
    if (!item) return;
    item.setAttribute('data-status', line);
    if (offer || item.querySelector('.hm-bag-item__offer-note')) setOfferNote(item, offer && offer.note);
    // sold and reserved (0064, 0065): no notice on top; the word beside the struck price
    var notice = item.querySelector('.hm-bag-item__notice');
    if (notice) notice.parentNode.removeChild(notice);
    var purchase = item.querySelector('.hm-bag-item__purchase');
    var price = item.querySelector('.hm-bag-item__price');
    if (purchase) {
      if (!price) {
        price = document.createElement('p');
        price.className = 'hm-bag-item__price body-large body-medium--mobile';   // = BagItem responsive (CARD_TYPE.head)
        purchase.insertBefore(price, purchase.firstChild);
      }
      var text = formatPrice(parseInt(li.getAttribute('data-price'), 10) || 0);
      price.textContent = '';
      if (!available) {
        // as BagItem: "SOLD OUT" / "RESERVED" + (screen readers) "not in your order" + the struck price
        // the word in an inline Alert (red box, decision 0078): same classes as Alert layout=inline
        var label = document.createElement('span'); label.textContent = line === 'sold' ? 'SOLD OUT' : line === 'offer-expired' ? 'EXPIRED' : 'RESERVED';
        label.className = 'hm-alert body-small hm-bag-item__status'; label.setAttribute('data-layout', 'inline');
        var sr = document.createElement('span'); sr.className = 'hm-visually-hidden'; sr.textContent = ', not in your order, ';
        price.appendChild(label); price.appendChild(sr);
        if (!offer || offer.cents) { var s = document.createElement('s'); s.textContent = text; price.appendChild(s); }
      } else price.textContent = text;
    }
  }
  function applyStatus() {
    Array.prototype.forEach.call(document.querySelectorAll('[data-bag-line]'), syncBagLine);
    Array.prototype.forEach.call(document.querySelectorAll('[data-reserved-note]'), function (p) {
      var id = p.getAttribute('data-reserved-note');
      p.hidden = statusFor(id) !== 'reserved';
      if (!p.hidden) p.textContent = reservedText(id);
    });
    // the price slot of a Best offer copy (card, tile, PDP, return card): "Your offer · 25€" for the buyer of the accepted
    // offer while the hold runs, else empty and hidden (decision 0191)
    Array.prototype.forEach.call(document.querySelectorAll('[data-offer-price]'), function (s) {
      var id = s.getAttribute('data-offer-price'), o = statusFor(id) === 'reserved' && heldOffer(id);
      s.textContent = o && o.a ? 'Your offer \u00b7 ' + formatPrice(o.a) : '';
      s.hidden = !(o && o.a);
    });
    // the PDP line of a Best offer copy (Figma `offer actions`): for the buyer of the accepted offer, state=accepted (0190)
    Array.prototype.forEach.call(document.querySelectorAll('[data-offer-note]'), function (p) {
      var id = p.getAttribute('data-offer-note'), o = statusFor(id) === 'reserved' && heldOffer(id);
      if (!p.hasAttribute('data-text-default')) p.setAttribute('data-text-default', p.textContent);
      p.textContent = o ? 'Your offer' + (o.a ? ' of ' + formatPrice(o.a) : '') + ' was accepted. It\u2019s held for you' +
        (o.e ? ' until ' + offerWhen(o.e) : '') + ': add it to your bag and pay when you like.' : p.getAttribute('data-text-default');
    });
    Array.prototype.forEach.call(document.querySelectorAll('[data-listing-status]'), function (el) {
      var id = listingIdOf(el);
      if (id && !el.hasAttribute('data-bag-line')) el.setAttribute('data-listing-status', statusFor(id));
    });
  }
  function readLive(force) {
    var base = document.querySelector('meta[name="hm-supabase-url"]');
    var key = document.querySelector('meta[name="hm-supabase-key"]');
    if (!base || !key || !window.fetch) return;
    if (!force && Date.now() - lastLiveRead < LIVE_MIN_GAP) return;
    var ids = Object.keys(seeded).concat(readBag());
    var cur = typeof current === 'function' ? current() : null;
    if (cur && cur.listing) ids.push(cur.listing);
    ids = ids.filter(function (id, i) { return /^[A-Za-z0-9_-]{1,64}$/.test(id) && ids.indexOf(id) === i; });
    if (!ids.length) return;
    lastLiveRead = Date.now();
    fetch(base.content + '/rest/v1/listing_availability?select=*&id=in.(' + ids.join(',') + ')', {
      headers: { apikey: key.content, Accept: 'application/json' }
    }).then(function (res) { return res.ok ? res.json() : []; }).then(function (rows) {
      var seen = {};
      rows.forEach(function (r) {
        live[r.id] = r.status; seen[r.id] = true;
        if (r.status === 'reserved') holdKind[r.id] = r.checkout_hold === false ? 'manual' : 'checkout';
      });
      // not returned = no longer public (unpublished, archived, deleted): unavailable, like a copy that left the shop
      ids.forEach(function (id) { if (!seen[id]) live[id] = 'gone'; });
      renderBag();
    }).catch(function () { /* offline or blocked: keep the build-time status */ });
  }
  function initStatus() { seedStatus(); readLive(true); }
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible') readLive(false); });

  document.addEventListener('click', function (e) {
    var t = e.target;
    if (!t || !t.closest) return;
    var card = t.closest('.hm-product-card__add');
    if (card) {
      var holder = card.closest('[data-listing-id]');
      if (holder && holder.getAttribute('data-listing-section') === 'trade') return;   // offer link, or a reserved/traded state (0068)
      if (holder && holder.getAttribute('data-price-mode') === 'offers' && card.tagName === 'A') return;   // Make an offer (0158)
      if (holder) addOrOpen(holder.getAttribute('data-listing-id'), card.getAttribute('data-offer-href'));
      return;
    }
    var cta = t.closest('[data-add-to-bag]');
    if (cta) { addOrOpen(cta.getAttribute('data-add-to-bag'), cta.getAttribute('data-offer-href')); return; }
    var padd = t.closest('.site-player__add');
    if (padd) { var cur = typeof current === 'function' ? current() : null; if (cur && cur.section !== 'trade') addOrOpen(cur.listing, padd.getAttribute('data-offer-href')); return; }
    var checkoutBtn = t.closest('[data-bag-checkout]');
    if (checkoutBtn) { if (!checkoutBtn.disabled) startCheckout(checkoutBtn); return; }
    var remove = t.closest('.hm-bag-item__remove');
    if (remove) {
      var li = remove.closest('[data-bag-line]');
      if (!li) return;
      // focus goes to the next line's Remove, else the previous one's, else the page title (nothing left)
      var lines = Array.prototype.filter.call(document.querySelectorAll('[data-bag-line]'), function (x) { return !x.hidden; });
      var i = lines.indexOf(li);
      var next = lines[i + 1] || lines[i - 1];
      var id = li.getAttribute('data-bag-line');
      var focusEl = next ? next.querySelector('.hm-bag-item__remove') : document.querySelector('[data-bag-page] h1');
      removeWithUndo(id, focusEl, function () {
        var back = document.querySelector('[data-bag-line="' + id + '"] .hm-bag-item__remove');
        if (back) back.focus();
      });
      if (focusEl) { if (!next) focusEl.setAttribute('tabindex', '-1'); focusEl.focus(); }
    }
  });
  // another tab changed the bag
  window.addEventListener('storage', function (e) { if (e.key === BAG_KEY) renderBag(); });


  /* ── Trade offer (Figma page `Trade`, decision 0068) ───────────────────────
     /products/<slug>/offer/: "Add another record" clones the template (max 5), Remove renumbers, Send validates and posts JSON to the trade-offer function (site.json → trade.offerEndpoint). Nothing is stored
     in the browser. On success the form makes way for "Offer sent". */
  /* "Which record" as a Discogs release search (Figma `which record`, decision 0069). ARIA 1.2 combobox: the input
     keeps focus, arrows move aria-activedescendant, Enter picks, Escape closes. Typing 3+ letters asks the
     discogs-search function (debounced, the previous request aborted); a pasted discogs.com/release/<id> link resolves
     to that release. Picking shows the chosen release (Change = back). The text stays free: a trader can always type
     artist – title. Nothing from Discogs is stored (API terms); "Data from Discogs" is always under the list. */
  var pickerUid = 0;
  function initReleasePicker(rec, endpoint) {
    var picker = rec.querySelector('[data-release-picker]');
    if (!endpoint || !picker || picker.hasAttribute('data-ready')) return;
    picker.setAttribute('data-ready', '');
    var input = picker.querySelector('[data-release-input]');
    var inputBox = input.closest('.hm-input');
    var hidden = picker.querySelector('[data-release-id]');
    var chosenBox = picker.querySelector('[data-release-chosen]');
    var uid = 'release-picker-' + (++pickerUid);
    var box = document.createElement('div');
    box.className = 'hm-release-list release-picker__list';
    box.hidden = true;
    inputBox.parentNode.insertBefore(box, inputBox.nextSibling);
    var live = document.createElement('p');
    live.className = 'hm-visually-hidden';
    live.setAttribute('aria-live', 'polite');
    picker.appendChild(live);
    input.setAttribute('role', 'combobox');
    input.setAttribute('aria-autocomplete', 'list');
    input.setAttribute('aria-expanded', 'false');
    input.setAttribute('aria-controls', uid + '-list');
    var results = [], active = -1, timer = null, ctrl = null;

    function el(tag, cls, text) { var n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; }
    function thumb(src) {
      if (!src) { var s = el('span', 'hm-release-option__thumb'); s.setAttribute('aria-hidden', 'true'); return s; }
      var i = el('img', 'hm-release-option__thumb'); i.src = src; i.alt = ''; i.width = 40; i.height = 40; return i;
    }
    function textCol(r) {
      var t = el('span', 'hm-release-option__text');
      t.appendChild(el('span', 'hm-release-option__title body-medium', r.title));
      if (r.meta) t.appendChild(el('span', 'hm-release-option__meta body-small', r.meta));
      return t;
    }
    function close() {
      clearTimeout(timer);
      if (ctrl) { ctrl.abort(); ctrl = null; }
      box.hidden = true; box.textContent = ''; active = -1;
      input.setAttribute('aria-expanded', 'false');
      input.removeAttribute('aria-activedescendant');
    }
    function footer() { box.appendChild(el('p', 'hm-release-list__source body-small', 'Data from Discogs')); }
    function showMessage(text) {
      results = []; box.textContent = '';
      box.appendChild(el('p', 'hm-release-list__message body-small', text));
      footer();
      box.hidden = false;
      input.setAttribute('aria-expanded', 'false');   // no listbox to go into, only a message
      live.textContent = text;
    }
    function showResults(list) {
      results = list; active = -1; box.textContent = '';
      if (!list.length) { showMessage('No match on Discogs. Write it as you like: artist – title.'); return; }
      var ul = el('ul', 'hm-release-list__options');
      ul.id = uid + '-list';
      ul.setAttribute('role', 'listbox');
      ul.setAttribute('aria-label', 'Releases on Discogs');
      list.forEach(function (r, i) {
        var li = el('li', 'hm-release-option');
        li.id = uid + '-opt-' + i;
        li.setAttribute('role', 'option');
        li.setAttribute('aria-selected', 'false');
        li.appendChild(thumb(r.thumb));
        li.appendChild(textCol(r));
        li.addEventListener('click', function () { choose(r); });
        ul.appendChild(li);
      });
      box.appendChild(ul);
      footer();
      box.hidden = false;
      input.setAttribute('aria-expanded', 'true');
      live.textContent = list.length + (list.length === 1 ? ' release' : ' releases') + ' found. Use the arrow keys to choose.';
    }
    function highlight(i) {
      var opts = box.querySelectorAll('[role="option"]');
      if (!opts.length) return;
      active = (i + opts.length) % opts.length;
      Array.prototype.forEach.call(opts, function (o, k) {
        var on = k === active;
        o.setAttribute('aria-selected', on ? 'true' : 'false');
        if (on) o.setAttribute('data-highlighted', 'true'); else o.removeAttribute('data-highlighted');
      });
      input.setAttribute('aria-activedescendant', opts[active].id);
      opts[active].scrollIntoView({ block: 'nearest' });
    }
    function ask(params) {
      if (ctrl) ctrl.abort();
      ctrl = typeof AbortController === 'function' ? new AbortController() : null;
      var u = endpoint + (endpoint.indexOf('?') < 0 ? '?' : '&') + params;
      return fetch(u, ctrl ? { signal: ctrl.signal } : {}).then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      });
    }
    function failed(err) {
      if (err && err.name === 'AbortError') return;
      showMessage('Discogs isn’t answering right now. Write it as you like: artist – title.');
    }
    function choose(r) {
      hidden.value = String(r.id);
      input.value = r.title + (r.meta ? ' (' + r.meta + ')' : '');
      close();
      chosenBox.textContent = '';
      chosenBox.appendChild(el('p', 'body-small', 'Which record'));
      var card = el('div', 'hm-chosen-release');
      card.appendChild(thumb(r.thumb));
      var t = textCol(r);
      if (r.uri) {
        var a = el('a', 'hm-chosen-release__link body-small', 'On Discogs');
        a.href = r.uri; a.target = '_blank'; a.rel = 'noopener';
        var arrow = el('span', null, ' ↗'); arrow.setAttribute('aria-hidden', 'true'); a.appendChild(arrow);
        a.appendChild(el('span', 'hm-visually-hidden', ' (opens in a new tab)'));
        t.appendChild(a);
      }
      card.appendChild(t);
      var change = el('button', 'hm-chosen-release__change body-small', 'Change');
      change.type = 'button';
      change.setAttribute('aria-label', 'Change record: ' + r.title);
      change.addEventListener('click', function () {
        hidden.value = ''; input.value = '';
        chosenBox.hidden = true; chosenBox.textContent = '';
        inputBox.hidden = false;
        input.focus();
      });
      card.appendChild(change);
      chosenBox.appendChild(card);
      inputBox.hidden = true;
      chosenBox.hidden = false;
      live.textContent = 'Chosen: ' + r.title;
      change.focus();
    }
    input.addEventListener('input', function () {
      hidden.value = '';
      clearTimeout(timer);
      var q = input.value.trim();
      var link = q.match(/discogs\.com\/(?:[a-z-]+\/)?(release|master)\/(\d+)/i);
      if (link && link[1].toLowerCase() === 'master') {
        if (ctrl) ctrl.abort();
        showMessage('That link is the master (every pressing). Search the title here and pick your pressing, or paste its release link.');
        return;
      }
      if (link) {
        ask('release=' + link[2]).then(function (d) {
          if (d && d.release) choose(d.release); else showMessage('Can’t find that release on Discogs. Check the link, or write artist – title.');
        }, failed);
        return;
      }
      if (q.length < 3) { if (ctrl) ctrl.abort(); close(); return; }
      timer = setTimeout(function () {
        ask('q=' + encodeURIComponent(q)).then(function (d) { showResults((d && d.results) || []); }, failed);
      }, 350);
    });
    input.addEventListener('keydown', function (e) {
      var open = !box.hidden && results.length;
      if (e.key === 'ArrowDown' && open) { e.preventDefault(); highlight(active + 1); }
      else if (e.key === 'ArrowUp' && open) { e.preventDefault(); highlight(active - 1); }
      else if (e.key === 'Enter' && open && active >= 0) { e.preventDefault(); choose(results[active]); }
      else if (e.key === 'Escape' && !box.hidden) { e.preventDefault(); close(); }
    });
    // a click in the list must not blur the input first (that would close the list before the click lands)
    box.addEventListener('mousedown', function (e) { e.preventDefault(); });
    input.addEventListener('blur', function () { close(); });
  }

  var OFFER_MAX_RECORDS = 5;
  function initOffer() {
    var form = document.querySelector('[data-offer-form]');
    if (!form || form.hasAttribute('data-ready')) return;
    form.setAttribute('data-ready', '');
    var list = form.querySelector('[data-offer-records]');
    var tpl = form.querySelector('[data-offer-record-template]');
    var addBtn = form.querySelector('[data-offer-add]');
    var errorEl = form.querySelector('[data-offer-error]');
    var sendBtn = form.querySelector('[data-offer-send]');
    var uid = 0;
    function records() { return Array.prototype.slice.call(list.querySelectorAll('[data-offer-record]')); }
    // every clone gets its own ids, so each <label for> still names its own field
    function reId(root) {
      uid++;
      Array.prototype.forEach.call(root.querySelectorAll('[id]'), function (el) {
        var old = el.id, next = old + '-r' + uid;
        el.id = next;
        Array.prototype.forEach.call(root.querySelectorAll('[for="' + old + '"]'), function (l) { l.setAttribute('for', next); });
        Array.prototype.forEach.call(root.querySelectorAll('[aria-describedby="' + old + '"]'), function (l) { l.setAttribute('aria-describedby', next); });
      });
    }
    function renumber() {
      var rs = records();
      rs.forEach(function (r, i) {
        r.querySelector('[data-offer-record-title]').textContent = 'Record ' + (i + 1);
        r.querySelector('[data-offer-record-remove]').hidden = i === 0;
      });
      addBtn.hidden = rs.length >= OFFER_MAX_RECORDS;
    }
    addBtn.addEventListener('click', function () {
      if (records().length >= OFFER_MAX_RECORDS) return;
      var frag = tpl.content.cloneNode(true);
      var rec = frag.querySelector('[data-offer-record]');
      reId(rec);
      list.appendChild(frag);
      renumber();
      initReleasePicker(rec, form.getAttribute('data-search-endpoint'));
      var first = rec.querySelector('input, select');
      if (first) first.focus();
    });
    list.addEventListener('click', function (e) {
      var rm = e.target.closest && e.target.closest('[data-offer-record-remove]');
      if (!rm) return;
      var rec = rm.closest('[data-offer-record]');
      var prev = rec.previousElementSibling;
      rec.parentNode.removeChild(rec);
      renumber();
      var f = prev && prev.querySelector('input');
      if (f) f.focus();
    });
    function val(root, name) { var el = root.querySelector('[name="' + name + '"]'); return el ? String(el.value || '').trim() : ''; }
    function mark(el, bad) {
      if (!el) return;
      el.setAttribute('aria-invalid', bad ? 'true' : 'false');
      var box = el.closest('.hm-input');
      if (box) box.setAttribute('data-invalid', bad ? 'true' : 'false');
    }
    function fail(text, el) {
      errorEl.textContent = text;
      errorEl.hidden = false;
      if (el) el.focus();
    }
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      errorEl.hidden = true;
      var firstBad = null, bad;
      function check(el, ok) { mark(el, !ok); if (!ok && !firstBad) firstBad = el; }
      var recs = records().map(function (r) {
        check(r.querySelector('[name="record"]'), !!val(r, 'record'));
        check(r.querySelector('[name="media"]'), !!val(r, 'media'));
        return { record: val(r, 'record'), release: val(r, 'release'), media: val(r, 'media'), sleeve: val(r, 'sleeve') };
      });
      check(form.querySelector('[name="about"]'), !!val(form, 'about'));
      // Discogs, plus Instagram or Facebook (owner 2026-11-13): only to prove who they are; we talk by email
      check(form.querySelector('[name="discogs"]'), !!val(form, 'discogs'));
      var hasSocial = !!(val(form, 'instagram') || val(form, 'facebook'));
      check(form.querySelector('[name="instagram"]'), hasSocial);
      check(form.querySelector('[name="facebook"]'), hasSocial);
      var email = form.querySelector('[name="email"]');
      check(email, !!val(form, 'email') && email.checkValidity());
      bad = firstBad;
      if (bad) { fail('Fill in the marked fields: each record and its condition, a few words about you, your Discogs, your Instagram or Facebook, and your email.', bad); return; }
      var endpoint = form.getAttribute('data-endpoint');
      if (!endpoint) { fail('Offers aren’t switched on yet. Try again soon.'); return; }
      var payload = {
        listing: form.getAttribute('data-listing-slug'),
        records: recs, pitch: val(form, 'pitch'), about: val(form, 'about'),
        discogs: val(form, 'discogs'), instagram: val(form, 'instagram'), facebook: val(form, 'facebook'),
        inPerson: !!(form.querySelector('[name="inPerson"]') || {}).checked, email: val(form, 'email'), website: val(form, 'website')
      };
      var label = sendBtn.querySelector('.hm-button__label');
      var idle = label ? label.textContent : '';
      sendBtn.disabled = true;
      if (label) label.textContent = 'Sending…';
      fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
        .then(function (res) { if (!res.ok) throw new Error('HTTP ' + res.status); return res.json().catch(function () { return {}; }); })
        .then(function (d) {
          track('trade_offer_sent', { listing: payload.listing, records: recs.length });
          var sent = document.querySelector('[data-offer-sent]');
          // decision 0070: the phrase to send from each profile (in quotes), and the buttons for the networks they gave
          var phraseEl = sent && sent.querySelector('[data-offer-phrase]');
          var phrase = (d && (d.phrase || d.code)) || '';
          if (phraseEl) phraseEl.textContent = phrase ? '\u201c' + phrase + '\u201d' : '';
          if (sent) Array.prototype.forEach.call(sent.querySelectorAll('[data-verify]'), function (b) {
            var k = b.getAttribute('data-verify');
            b.hidden = k !== 'discogs' && !payload[k];
          });
          form.hidden = true;
          if (sent) sent.hidden = false;
          var title = document.querySelector('[data-offer-title]');
          if (title) { title.textContent = 'Offer sent'; title.setAttribute('tabindex', '-1'); title.focus(); }
          window.scrollTo(0, 0);
        })
        .catch(function () {
          sendBtn.disabled = false;
          if (label) label.textContent = idle;
          fail('Your offer didn’t go through. Check your connection and try again.');
        });
    });
    renumber();
    var searchEndpoint = form.getAttribute('data-search-endpoint');
    records().forEach(function (r) { initReleasePicker(r, searchEndpoint); });
  }

  // Invisible proof of work (decision 0132): GET the endpoint for a signed puzzle, find n < max with
  // sha256(salt + n) = challenge, in batches so the page stays responsive. Resolves to the answer, or null.
  function solvePuzzle(endpoint) {
    if (!window.crypto || !crypto.subtle || !window.TextEncoder) return Promise.resolve(null);
    var enc = new TextEncoder();
    function hex(buf) {
      return Array.prototype.map.call(new Uint8Array(buf), function (b) { return (b < 16 ? '0' : '') + b.toString(16); }).join('');
    }
    return fetch(endpoint, { method: 'GET' })
      .then(function (res) { if (!res.ok) throw new Error('HTTP ' + res.status); return res.json(); })
      .then(function (p) {
        function batch(from) {
          if (from > p.max) return null;
          var tries = [];
          for (var n = from; n < from + 500 && n <= p.max; n++) {
            tries.push(crypto.subtle.digest('SHA-256', enc.encode(p.salt + n)));
          }
          return Promise.all(tries).then(function (hashes) {
            for (var i = 0; i < hashes.length; i++) {
              if (hex(hashes[i]) === p.challenge) {
                return { salt: p.salt, challenge: p.challenge, signature: p.signature, number: from + i };
              }
            }
            return batch(from + 500);
          });
        }
        return batch(0);
      })
      .catch(function () { return null; });
  }

  // /contact/ (decision 0093): checks Email and Message, posts JSON to the Supabase function `contact`
  // (site.json → contact.endpoint), then shows the thanks line in place of the form. Nothing is stored.
  // Bots: honeypot `website` + the invisible puzzle, started as the page opens (decision 0132).
  function initContact() {
    var form = document.querySelector('[data-contact-form]');
    if (!form || form.hasAttribute('data-ready')) return;
    form.setAttribute('data-ready', '');
    var errorEl = form.querySelector('[data-contact-error]');
    var sendBtn = form.querySelector('[data-contact-send]');
    function field(name) { return form.querySelector('[name="' + name + '"]'); }
    function val(name) { var el = field(name); return el ? String(el.value || '').trim() : ''; }
    function mark(el, bad) {
      el.setAttribute('aria-invalid', bad ? 'true' : 'false');
      var box = el.closest('.hm-input');
      if (box) box.setAttribute('data-invalid', bad ? 'true' : 'false');
    }
    function fail(text, el) { errorEl.textContent = text; errorEl.hidden = false; if (el) el.focus(); }
    var puzzleEndpoint = form.getAttribute('data-endpoint');
    var puzzle = puzzleEndpoint ? solvePuzzle(puzzleEndpoint) : null;
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      errorEl.hidden = true;
      var email = field('email'), message = field('message');
      var badEmail = !val('email') || !email.checkValidity(), badMessage = !val('message');
      mark(email, badEmail); mark(message, badMessage);
      if (badEmail || badMessage) { fail('Fill in your email and your message.', badEmail ? email : message); return; }
      var endpoint = form.getAttribute('data-endpoint');
      if (!endpoint) { fail('The form isn\u2019t switched on yet: please write to the email above.'); return; }
      var label = sendBtn.querySelector('.hm-button__label');
      var idle = label ? label.textContent : '';
      sendBtn.disabled = true;
      if (label) label.textContent = 'Sending\u2026';
      // a puzzle is good for one message: the next one (after an error) gets a fresh one
      var answer = puzzle || solvePuzzle(endpoint);
      puzzle = null;
      answer.then(function (pow) {
        return fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: val('name'), email: val('email'), message: val('message'), website: val('website'), pow: pow }) });
      })
        .then(function (res) { if (!res.ok) throw new Error('HTTP ' + res.status); })
        .then(function () {
          track('contact_sent');
          form.hidden = true;
          var sent = document.querySelector('[data-contact-sent]');
          if (sent) sent.hidden = false;
          var title = document.querySelector('[data-contact-title]');
          if (title) { title.textContent = 'Message sent'; title.setAttribute('tabindex', '-1'); title.focus(); }
        })
        .catch(function () {
          sendBtn.disabled = false;
          if (label) label.textContent = idle;
          fail('Your message didn\u2019t go through. Try again, or write to the email above.');
        });
    });
  }

  /* ---------------------------------------------------------------- best offer (migration 0034, decision 0158) */
  // the Supabase function `offer` (site.json → offers.endpoint, on each page's root as data-endpoint)
  function offerPost(endpoint, body) {
    return fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      .then(function (res) { return res.json().catch(function () { return {}; }).then(function (data) { return { ok: res.ok, status: res.status, data: data }; }); });
  }
  function offerToken() { var m = /[?&]t=([0-9a-f]{64})(?:&|$)/.exec(location.search); return m ? m[1] : ''; }
  function showOfferState(root, state) {
    Array.prototype.forEach.call(root.querySelectorAll('[data-offer-state]'), function (el) { el.hidden = el.getAttribute('data-offer-state') !== state; });
  }
  // the record on the confirm / pay pages, from the function's answer (Figma `offer target`)
  function fillOfferTarget(root, info, label) {
    var t = root.querySelector('[data-offer-target]');
    if (!t || !info || !info.name) return;
    t.hidden = false;
    t.querySelector('[data-offer-target-name]').textContent = info.name;
    if (label) t.querySelector('[data-offer-target-label]').textContent = label;
    var link = t.querySelector('[data-offer-target-link]');
    link.setAttribute('href', (root.getAttribute('data-products-base') || '/products/') + info.slug + '/');
    var back = root.querySelector('[data-offer-back]');
    if (back) back.setAttribute('href', link.getAttribute('href'));
    var img = t.querySelector('[data-offer-target-image]');
    if (img && info.image) { img.src = info.image; img.hidden = false; }
  }

  // /products/<slug>/offer/ of a best-offer copy: checks the fields, posts with the puzzle (0132), then "Check your email"
  function initPriceOffer() {
    var form = document.querySelector('[data-price-offer-form]');
    if (!form || form.hasAttribute('data-ready')) return;
    form.setAttribute('data-ready', '');
    var errorEl = form.querySelector('[data-offer-error]');
    var sendBtn = form.querySelector('[data-offer-send]');
    var endpoint = form.getAttribute('data-endpoint');
    var puzzle = endpoint ? solvePuzzle(endpoint) : null;
    function field(name) { return form.querySelector('[name="' + name + '"]'); }
    function val(name) { var el = field(name); return el ? String(el.value || '').trim() : ''; }
    function mark(el, bad) {
      el.setAttribute('aria-invalid', bad ? 'true' : 'false');
      var box = el.closest('.hm-input');
      if (box) box.setAttribute('data-invalid', bad ? 'true' : 'false');
    }
    function fail(text, el) { errorEl.textContent = text; errorEl.hidden = false; if (el) el.focus(); }
    function cents(text) {
      var t = text.replace(/\s|€/g, '').replace(',', '.');
      return /^\d+(\.\d{1,2})?$/.test(t) ? Math.round(Number(t) * 100) : NaN;
    }
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      errorEl.hidden = true;
      var amount = field('amount'), email = field('email'), country = field('country');
      var c = cents(val('amount'));
      var badAmount = !(c > 0) || c > 1000000, badEmail = !val('email') || !email.checkValidity(), badCountry = !/^[A-Za-z]{2}$/.test(val('country'));
      mark(amount, badAmount); mark(email, badEmail); mark(country, badCountry);
      if (badAmount) { fail('Enter your offer in euros, for example 25.', amount); return; }
      if (badCountry) { fail('Choose where the record ships to.', country); return; }
      if (badEmail) { fail('Enter your email: the confirmation link goes there.', email); return; }
      if (!endpoint) { fail('Offers aren’t switched on yet.'); return; }
      var label = sendBtn.querySelector('.hm-button__label');
      var idle = label ? label.textContent : '';
      sendBtn.disabled = true;
      if (label) label.textContent = 'Sending…';
      var answer = puzzle || solvePuzzle(endpoint);
      puzzle = null;   // one puzzle per send: after an error the next send solves a new one
      answer.then(function (pow) {
        return offerPost(endpoint, { action: 'submit', listing: form.getAttribute('data-listing-id'), amount: val('amount'),
          country: val('country'), email: val('email'), note: val('note'), website: val('website'), pow: pow });
      }).then(function (r) {
        if (!r.ok) throw r;
        track('price_offer_sent', { listing: form.getAttribute('data-listing-id') });
        form.hidden = true;
        var sent = document.querySelector('[data-price-offer-sent]');
        if (sent) {
          sent.querySelector('[data-offer-sent-email]').textContent = val('email');
          sent.querySelector('[data-offer-sent-amount]').textContent = formatPrice(c);
          sent.hidden = false;
        }
        var title = document.querySelector('[data-offer-title]');
        if (title) { title.textContent = 'Offer sent'; title.setAttribute('tabindex', '-1'); title.focus(); }
      }).catch(function (r) {
        sendBtn.disabled = false;
        if (label) label.textContent = idle;
        var err = r && r.data && r.data.error;
        fail(err === 'unavailable' ? 'This record isn’t taking offers right now: it may have been sold or reserved.'
          : err === 'too_many' ? 'You’ve sent a few offers already today. Try again tomorrow, or write to me.'
          : err === 'amount' ? 'Enter your offer in euros, for example 25.'
          : 'Your offer didn’t go through. Try again in a moment.');
      });
    });
  }

  // /offer/confirm/?t=… (the link of the email): confirms the offer as the page opens
  function initOfferConfirm() {
    var root = document.querySelector('[data-offer-confirm-page]');
    if (!root || root.hasAttribute('data-ready')) return;
    root.setAttribute('data-ready', '');
    var endpoint = root.getAttribute('data-endpoint'), token = offerToken();
    if (!endpoint || !token) { showOfferState(root, 'invalid'); return; }
    offerPost(endpoint, { action: 'confirm', token: token }).then(function (r) {
      var d = r.data || {};
      if (d.result === 'confirmed') {
        fillOfferTarget(root, d);
        root.querySelector('[data-offer-state="confirmed"] [data-offer-amount]').textContent = formatPrice(d.amount_cents);
        root.querySelector('[data-offer-state="confirmed"] [data-offer-name]').textContent = d.name;
        showOfferState(root, 'confirmed');
        track('price_offer_confirmed');
      } else showOfferState(root, d.result === 'expired' ? 'expired' : 'invalid');
    }).catch(function () { showOfferState(root, 'invalid'); });
  }

  // /offer/pay/?t=… (the acceptance email, decision 0188): reads the offer; ready → the copy goes in the Bag with the
  // link's token (no sign-in: only the offer's inbox gets the link) and the Bag opens. If the token can't be kept (no
  // storage) the page stays on "ready" with Go to your Bag. States (Figma `offer pay`): loading · ready · expired · paid ·
  // closed · invalid.
  function initOfferPay() {
    var root = document.querySelector('[data-offer-pay-page]');
    if (!root || root.hasAttribute('data-ready')) return;
    root.setAttribute('data-ready', '');
    var endpoint = root.getAttribute('data-endpoint'), token = offerToken();
    if (!endpoint || !token) { showOfferState(root, 'invalid'); return; }
    function fill(sel, text) { Array.prototype.forEach.call(root.querySelectorAll(sel), function (el) { el.textContent = text; }); }
    offerPost(endpoint, { action: 'pay-info', token: token }).then(function (r) {
      var d = r.data || {};
      if (!d.state) { showOfferState(root, 'invalid'); return; }
      fillOfferTarget(root, d, 'Yours for ' + formatPrice(d.amount_cents));
      if (d.state !== 'ready') { showOfferState(root, d.state); return; }
      fill('[data-offer-amount]', formatPrice(d.amount_cents));
      fill('[data-offer-held]', d.expires_at ? 'Held for you until ' + offerWhen(d.expires_at) + '. Then the record is back open to offers.' : '');
      var all = readOffers();
      all[d.listing_id] = { t: token, a: d.amount_cents, e: d.expires_at };
      var kept = writeOffers(all);
      var ids = readBag();
      if (ids.indexOf(d.listing_id) === -1) { ids.push(d.listing_id); writeBag(ids); }
      track('price_offer_to_bag');
      if (kept && readBag().indexOf(d.listing_id) !== -1) { location.href = (root.getAttribute('data-bag-url') || '/bag/') + '?offer=added'; return; }
      showOfferState(root, 'ready');
    }).catch(function () { showOfferState(root, 'invalid'); });
  }

  // back on the Bag from the email link of an accepted offer (0186): say it, once
  function offerAddedNotice() {
    if (!document.querySelector('[data-bag-page]') || !/[?&]offer=added\b/.test(location.search)) return;
    try { window.history.replaceState(window.history.state, '', window.location.pathname); } catch (e) { /* ignore */ }
    checkoutMessage('Your offer is in your bag, at the price we agreed.');
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
      var incoming = doc.querySelector('.hm-page');
      var page = document.querySelector('.hm-page');
      if (!incoming || !page) throw new Error('no .hm-page');
      addMissingStyles(doc);
      page.parentNode.replaceChild(document.importNode(incoming, true), page);
      document.title = doc.title;
      if (push) history.pushState({ soft: true }, '', href);
      var url = new URL(href, location.href);
      var target = url.hash && document.getElementById(decodeURIComponent(url.hash.slice(1)));
      if (target) target.scrollIntoView(); else window.scrollTo(0, 0);
      initHeader();
      initMenu();
      initGallery();
      initRecordStack();
      initSearch();
      initWantlist();   // before initFilters: it reads Discogs' ?oauth_… before the filters rewrite the URL
      initFilters();
      initStatus();
      initBag();
      initOffer();
      initPriceOffer();
      initOfferConfirm();
      initOfferPay();
      initContact();
      initHome();
      if (window.HighmuzikAccount) window.HighmuzikAccount.init();   // customer account (scripts/account.js, decision 0101)
      if (player && audio) render();
      // screen readers and keyboard: start from the new page's main heading, like a full load would
      var focusEl = document.querySelector('main h1') || document.querySelector('.hm-page h1:not([hidden])') || document.querySelector('main');
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
      // a link to the page you are on reloads it, as a plain link would (e.g. logo / store name on the home, decision
      // 0175), but softly: fresh content, back to the top, the player keeps playing; no new history entry
      if (a.href === location.href) { navigate(a.href, false); return; }
      navigate(a.href, true);
    });
    history.replaceState({ soft: true }, '', location.href);
    window.addEventListener('popstate', function () { navigate(location.href, false); });
  }

  /* ---------------------------------------------------------------- 7b. home (decision 0120) */

  // grid | list: the view toggle flips .home-content[data-view] (home.css shows one view); the choice is remembered in
  // this browser (a convenience: storage may be blocked, then every visit starts in grid). Desktop only (mobile = tiles).
  var HOME_VIEW_KEY = 'hm-home-view';
  function initHome() {
    var home = document.querySelector('.home-content[data-view]');
    if (!home) return;
    var saved = null;
    try { saved = window.localStorage.getItem(HOME_VIEW_KEY); } catch (e) { /* storage blocked */ }
    if (saved === 'grid' || saved === 'list') home.setAttribute('data-view', saved);
  }
  document.addEventListener('click', function (e) {
    var t = e.target.closest && e.target.closest('[data-home-toggle]');
    if (!t) return;
    var home = t.closest('.home-content');
    if (!home) return;
    var view = t.getAttribute('data-home-toggle');
    home.setAttribute('data-view', view);
    try { window.localStorage.setItem(HOME_VIEW_KEY, view); } catch (err) { /* storage blocked */ }
    // the pressed button is now hidden: keep the keyboard on the toggle that replaced it, in the same shelf (0126)
    var other = (t.closest('.home-view-toggle') || home).querySelector('[data-home-toggle="' + (view === 'grid' ? 'list' : 'grid') + '"]');
    if (other) other.focus();
  });
  // ProductTile mobile gallery: the counter follows the photo snapped in view ("2/3"). Scroll does not bubble: one
  // capturing listener on the document serves every tile, also after a soft navigation.
  document.addEventListener('scroll', function (e) {
    var g = e.target;
    if (!g || !g.hasAttribute || !g.hasAttribute('data-tile-gallery')) return;
    var counter = g.parentNode.querySelector('[data-tile-counter]');
    if (!counter) return;
    var total = g.children.length;
    var i = Math.min(total, Math.max(1, Math.round(g.scrollLeft / Math.max(1, g.clientWidth)) + 1));
    counter.textContent = i + '/' + total;
  }, true);

  /* ---------------------------------------------------------------- 7c. newsletter dialog (decision 0121) */

  // any link or button that points to the newsletter (href ending in #newsletter, or data-newsletter-open) opens the
  // newsletter dialog instead of scrolling. Close: its close button, Esc (native), a click on the backdrop. Focus goes
  // back to the opener. No dialog on the page (or no showModal): the link does what it always did.
  var newsletterReturn = null;
  function newsletterDialog() { return document.querySelector('[data-newsletter-dialog]'); }
  function closeNewsletter() {
    var d = newsletterDialog();
    if (d && d.open) d.close();
  }
  document.addEventListener('click', function (e) {
    var t = e.target;
    if (!t || !t.closest) return;
    var d = newsletterDialog();
    if (!d || !d.showModal) return;
    var opener = t.closest('a[href$="#newsletter"], [data-newsletter-open]');
    if (opener && !d.contains(opener)) {
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      e.preventDefault();
      newsletterReturn = opener;
      if (!d.open) d.showModal();
      var email = d.querySelector('input[type="email"]');
      if (email && !email.closest('[hidden]')) email.focus();
      return;
    }
    if (t.closest('[data-dialog-close]') && d.contains(t)) { closeNewsletter(); return; }
    if (t === d) {   // a click on the backdrop lands on the <dialog> itself: close only if it is outside its box
      var r = d.getBoundingClientRect();
      if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) closeNewsletter();
    }
  });
  document.addEventListener('close', function (e) {
    if (e.target !== newsletterDialog()) return;
    if (newsletterReturn && document.contains(newsletterReturn)) newsletterReturn.focus();
    newsletterReturn = null;
  }, true);

  /* ---------------------------------------------------------------- 8. select button focus (decision 0081) */

  // Browsers count a native <select> as a "keyboard input" control, so it matches :focus-visible even when it was
  // opened with the mouse: the ring stayed after picking an option or clicking away. Focus itself stays on the select
  // (no blur: keyboard and screen-reader users keep their place); only the ring is hidden, via data-focus-source on
  // the SelectButton, while the last input was a pointer. Any key press brings the ring back (components.css).
  function initSelectFocus() {
    document.addEventListener('pointerdown', function (e) {
      var box = e.target.closest && e.target.closest('.hm-select-button');
      if (box) box.setAttribute('data-focus-source', 'pointer');
    }, true);
    document.addEventListener('keydown', function (e) {
      var box = e.target.closest && e.target.closest('.hm-select-button');
      if (box) box.removeAttribute('data-focus-source');
    }, true);
    document.addEventListener('focusout', function (e) {
      var box = e.target.closest && e.target.closest('.hm-select-button');
      if (box) box.removeAttribute('data-focus-source');
    }, true);
  }

  initHeader();
  initMenu();
  initGallery();
  initRecordStack();
  initSearch();
  initWantlist();
  initFilters();
  initStatus();
  initBag();
  initOffer();
  initPriceOffer();
  initOfferConfirm();
  initOfferPay();
  initContact();
  initHome();
  if (window.HighmuzikAccount) window.HighmuzikAccount.init();
  initSelectFocus();
})();
