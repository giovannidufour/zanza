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
   4. PDP gallery
      - tracks the gallery's top in the window (--pdp-gallery-top), so pdp.css keeps its bottom at the window bottom
   5. PLP filters
      - ticking an option filters the list (OR inside a block, AND between blocks), updates the counts, the URL and
        the breadcrumbs, and announces the number of records
      - sort (native select, mobile and desktop) reorders the list; in the URL as ?sort=
      - mobile: "Filter (n)" opens the filters layer (native modal dialog, levels main / facet); its ticks are a draft
        until Apply, close discards, Reset clears the draft (decision 0038)

   6. Bag (decision 0044)
      - the bag = the listing ids in localStorage ('zanza-bag'), in the order they were added; a copy is unique, so an
        id is in the bag once (no quantity). Adding does NOT hold the copy: the hold starts at checkout
      - "Add to bag" (card, PDP, player) adds and shows the toast "Added to bag." + View bag (decision 0050); then the button reads "In bag" (secondary + tick)
        and opens the bag (decision 0058); taking a copy out happens only on /bag/; the header Bag shows the count in brackets on every page
      - /bag/ (pages/bag.js) shows the lines of the bag, the subtotal of the available ones, or the empty state;
        with shipping set up: "Ship to" country (remembered), shipping estimate and total (decision 0057);
        Remove takes a line out and shows a toast with Undo (packages/ui/toast.js, decision 0049). Checkout is not wired yet (create-checkout + Stripe, _context/backend.md)
   7. Live status (_context/backend.md -> Stato dal vivo)
      - the pages are static: each listing carries its status at build time (data-listing-status); with Supabase meta
        tags on the page, one read of listing_availability per page (and when the tab comes back) brings it up to date
      - reserved (someone is in Stripe Checkout, max 30 min, or held by hand): the Add buttons read "Reserved" (secondary
        + clock) and stay active: pressing one opens the "Reserved" dialog, which explains the hold and offers "Notify me"
        (email, migration 0016). The bag line shows the notice "Reserved".
        Sold after the build: the bag line shows "Just sold"; the Add buttons are not designed for it yet (design/open.md)

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
      product: btn.getAttribute('data-product-name') || '',
      image: btn.getAttribute('data-product-image') || '',
      href: btn.getAttribute('data-product-href') || '',
      listing: btn.getAttribute('data-listing-id') || ''
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
      setText('.zz-player__number', String(index + 1));   // the sample's place in the queue (decision 0056)
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
      var add = q('.site-player__add');
      if (add) { add.disabled = !cur.listing; syncAddButton(add, cur.listing); }
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

  /* -- PLP filters (pages/plp.js, Figma page `filters`) --------------------
     OR inside a block, AND between blocks. Counts = records you would see by ticking that option, given the other
     blocks; an option at 0 is hidden unless ticked. State lives in the URL (?genre=Roots&format=7"), so a
     filtered list can be shared and Back restores it. Active filter row (0041, in place of the breadcrumbs) = the filter
     reached from a link: artist / label (no checkbox) or the genre / tag a card's tag linked to, one removable chip.
     Links from before decision 0048 (?subgenre=Roots) are rewritten to ?genre= in place.
     The column's checkboxes are the applied state. On mobile (Figma `filters layer`, 2026-11-10) the layer has its
     own checkboxes: a draft, copied from the column when the layer opens and back to it on Apply; closing discards
     it. Levels: main (applied recap + one row per facet) and facet (the options of one facet). */
  function initFilters() {
    var root = document.querySelector('[data-plp-filters]');
    if (!root) return;
    var items = Array.prototype.slice.call(document.querySelectorAll('.plp-item'));
    var list = items.length ? items[0].parentNode : null;
    var boxes = Array.prototype.slice.call(root.querySelectorAll('input[type="checkbox"]'));
    var keys = []; boxes.forEach(function (b) { if (keys.indexOf(b.name) === -1) keys.push(b.name); });
    // hidden facets (label): no checkbox; the value comes from the URL and shows as a removable chip
    var hidden = []; try { hidden = JSON.parse(root.getAttribute('data-hidden-facets') || '[]'); } catch (e) { hidden = []; }
    hidden.forEach(function (f) { if (keys.indexOf(f.key) === -1) keys.push(f.key); });
    var values = items.map(function (el) {
      var v = {}; keys.forEach(function (k) { try { v[k] = JSON.parse(el.getAttribute('data-' + k) || '[]'); } catch (e) { v[k] = []; } });
      return v;
    });
    var params = new URLSearchParams(location.search);
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

    function selectionOf(checkboxes, hiddenState) {
      var s = {}; keys.forEach(function (k) { s[k] = []; });
      checkboxes.forEach(function (b) { if (b.checked) s[b.name].push(b.value); });
      hidden.forEach(function (f) { s[f.key] = hiddenState[f.key].slice(); });
      return s;
    }
    function selected() { return selectionOf(boxes, hiddenSel); }
    function matches(v, s, skip) {
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
        var count = b.closest('.zz-filter').querySelector('.zz-filter__count');
        if (count) count.textContent = n;
        b.closest('.zz-filter').hidden = n === 0 && !b.checked;
      });
      // a block shows only when something in the current view can be picked (Gio, 2026-11-10)
      Array.prototype.forEach.call(scope.querySelectorAll('.zz-filter-block'), function (block) {
        block.setAttribute('data-empty', block.querySelector('.zz-filter:not([hidden])') ? 'false' : 'true');
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
    // the row's chips: the hidden-facet chips, else the linked genre / tag while still ticked
    function rowChipsOf(s) {
      var out = chipsOf(s);
      if (linked && s[linked.key] && s[linked.key].indexOf(linked.value) !== -1) {
        var b = boxes.filter(function (x) { return x.name === linked.key && x.value === linked.value; })[0];
        out.push({ key: linked.key, value: linked.value, box: b,
          text: (LINK_LABEL[linked.key] || linked.key) + ': ' + ((b && b.getAttribute('data-facet-label')) || linked.value) });
      }
      return out;
    }
    function makeChip(template, text, onRemove) {
      var chip = template.content.firstElementChild.cloneNode(true);
      chip.querySelector('.zz-entity-chip__label').textContent = text;
      var btn = chip.querySelector('.zz-entity-chip__remove');
      btn.setAttribute('aria-label', 'Remove filter ' + text);
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
        }));
      });
      return frag;
    }
    function applySort() {
      if (!list) return;
      var sorted = items.slice().sort(function (a, b) {
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
      var s = selected(), shown = 0;
      items.forEach(function (el, i) { var ok = matches(values[i], s); el.hidden = !ok; if (ok) shown++; });
      refreshOptions(boxes, s, root);
      var empty = document.querySelector('[data-plp-empty]'); if (empty) empty.hidden = shown > 0;
      var status = root.querySelector('[data-plp-status]');
      if (status && announce) status.textContent = shown + (shown === 1 ? ' record' : ' records');
      // mobile trigger: "Filter" + the number of applied filters as suffix (Figma `PLP header`, 0029)
      if (trigger) setSuffix(trigger, appliedCount(s) ? '(' + appliedCount(s) + ')' : null);
      // URL
      var q = new URLSearchParams();
      keys.forEach(function (k) { s[k].forEach(function (x) { q.append(k, x); }); });
      if (sort !== 'newest') q.set('sort', sort);
      var qs = q.toString();
      history.replaceState(history.state, '', location.pathname + (qs ? '?' + qs : '') + location.hash);
      // active filter row (0041): the link filter's chip; hidden when there is none
      var row = document.querySelector('[data-plp-active]');
      var holder = row && row.querySelector('.zz-active-filter__row');
      if (holder && chipTemplate) {
        holder.textContent = '';
        var chips = rowChipsOf(s);
        chips.forEach(function (c) { holder.appendChild(activeChips(c)); });
        row.hidden = !chips.length;
      }
    }
    // Button suffix (packages/ui Button `suffix`): created or removed in place
    function setSuffix(button, text) {
      var label = button.querySelector('.zz-button__label');
      var el = label && label.querySelector('.zz-button__suffix');
      if (text === null) { if (el) el.remove(); return; }
      if (!el && label) { el = document.createElement('span'); el.className = 'zz-button__suffix'; label.appendChild(el); }
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
      sel.addEventListener('change', function (e) { e.stopPropagation(); sort = sel.value; syncSort(); applySort(); apply(false); });
    });
    if (layer && trigger && layer.showModal) {
      var draftBoxes = Array.prototype.slice.call(layer.querySelectorAll('input[type="checkbox"]'));
      var draftHidden = {};
      var rows = Array.prototype.slice.call(layer.querySelectorAll('[data-facet]'));
      var blocks = Array.prototype.slice.call(layer.querySelectorAll('[data-facet-block]'));
      var panel = layer.querySelector('.zz-filters-layer');
      var title = layer.querySelector('[data-layer-title]');
      var back = layer.querySelector('[data-layer-back]');
      var appliedBox = layer.querySelector('[data-layer-applied]');
      var chipsBox = layer.querySelector('[data-layer-chips]');
      var applyBtn = layer.querySelector('[data-layer-apply]');
      var layerChip = layer.querySelector('template[data-layer-chip]');
      var currentFacet = null;
      var draft = function () { return selectionOf(draftBoxes, draftHidden); };
      var labelOf = function (b) { return b.getAttribute('data-facet-label') || b.value; };

      var renderDraft = function () {
        var s = draft();
        refreshOptions(draftBoxes, s, layer);
        // facet rows: value = ticked options; a facet with nothing to pick in this view is hidden (as the column)
        rows.forEach(function (row) {
          var key = row.getAttribute('data-facet');
          var picked = draftBoxes.filter(function (b) { return b.name === key && b.checked; }).map(labelOf);
          var value = row.querySelector('.zz-filter-facet__value');
          if (picked.length) {
            if (!value) { value = document.createElement('span'); value.className = 'zz-filter-facet__value body-small'; row.insertBefore(value, row.querySelector('.zz-filter-facet__chevron')); }
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
        var next = chipsBox.querySelector('.zz-entity-chip__remove') || rows.filter(function (r) { return !r.hidden; })[0] || applyBtn;
        if (next) next.focus();
      };
      var showLevel = function (key) {
        currentFacet = key;
        panel.setAttribute('data-level', key ? 'facet' : 'main');
        var row = key && rows.filter(function (r) { return r.getAttribute('data-facet') === key; })[0];
        title.textContent = key ? row.getAttribute('data-facet-label') : 'Filter';   // Gio 2026-11-10: "Filter", as the trigger
        back.hidden = !key;
        layer.querySelector('[data-layer-facets]').hidden = !!key;
        blocks.forEach(function (bl) { bl.hidden = bl.getAttribute('data-facet-block') !== key; });
        renderDraft();
        layer.querySelector('.zz-filters-layer__body').scrollTop = 0;
      };
      var open = function () {
        draftBoxes.forEach(function (d) {
          d.checked = boxes.some(function (b) { return b.name === d.name && b.value === d.value && b.checked; });
        });
        hidden.forEach(function (f) { draftHidden[f.key] = hiddenSel[f.key].slice(); });
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
        renderDraft();
      });
      applyBtn.addEventListener('click', function () {
        boxes.forEach(function (b) {
          b.checked = draftBoxes.some(function (d) { return d.name === b.name && d.value === b.value && d.checked; });
        });
        hidden.forEach(function (f) { hiddenSel[f.key] = draftHidden[f.key].slice(); });
        apply(true);
        close();
        window.scrollTo(0, 0);
      });
    }

    root.addEventListener('change', function () { apply(true); });
    applySort();
    apply(false);
  }

  /* ---------------------------------------------------------------- 6. bag */

  var BAG_KEY = 'zanza-bag';
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
  // same rule as formatPrice in pages/shell.js: whole euros without decimals (12, 12.50) + the euro sign
  function formatPrice(cents) { return (cents % 100 === 0 ? cents / 100 : (cents / 100).toFixed(2)) + '\u20ac'; }

  // a polite live region, once per document (outside .zz-page, so the soft navigation keeps it)
  var bagStatus = null;
  function announce(text) {
    if (!bagStatus) {
      bagStatus = document.createElement('p');
      bagStatus.className = 'zz-visually-hidden';
      bagStatus.setAttribute('role', 'status');
      document.body.appendChild(bagStatus);
    }
    bagStatus.textContent = '';
    window.setTimeout(function () { bagStatus.textContent = text; }, 50);
  }

  function addToBag(id) {
    if (!id) return;
    var ids = readBag();
    if (ids.indexOf(id) === -1) { ids.push(id); writeBag(ids); }
    // a toast too (Gio, decision 0050), even if the button and the header count already change: View bag = the header
    // Bag link (soft navigation keeps the player), so the toast closes after 6 s like a text-only one
    if (window.ZanzaToast) {
      window.ZanzaToast.show({ message: 'Added to bag.', actionLabel: 'View bag', actionElsewhere: true, onAction: function () {
        var link = document.querySelector('a[data-bag-count]');
        if (link) link.click();
      } });
    } else announce('Added to bag. ' + ids.length + (ids.length === 1 ? ' record' : ' records') + ' in the bag.');
  }
  function removeFromBag(id) {
    writeBag(readBag().filter(function (x) { return x !== id; }));
  }

  // the header Bag button: "(n)" in its suffix, on every page
  function renderBagCount(n) {
    Array.prototype.forEach.call(document.querySelectorAll('[data-bag-count] .zz-button__suffix'), function (el) {
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
    var count = 0, cents = 0;
    known.forEach(function (id) {
      var li = lines[id];
      li.hidden = false;
      list.appendChild(li);   // in the order they were added
      if (li.getAttribute('data-available') === 'true') { count++; cents += parseInt(li.getAttribute('data-price'), 10) || 0; }
    });
    var empty = known.length === 0;
    list.hidden = empty;
    root.querySelector('[data-bag-summary]').hidden = empty;
    root.querySelector('[data-bag-empty]').hidden = !empty;
    root.querySelector('[data-bag-subtotal-label]').textContent = 'Subtotal (' + count + (count === 1 ? ' record)' : ' records)');
    root.querySelector('[data-bag-subtotal]').textContent = formatPrice(cents);
    var served = renderShipping(root, known.filter(function (id) { return lines[id].getAttribute('data-available') === 'true'; })
      .map(function (id) { return lines[id]; }), cents);
    var checkout = root.querySelector('[data-bag-checkout]');
    if (checkout) checkout.disabled = count === 0 || !served;
    return known;
  }

  // shipping estimate (decision 0057, Figma `bag summary` destination=served | not served): the page carries the
  // config (admin page Shipping), packages/shipping/shipping.js does the maths, the country is remembered.
  // Returns false when the bag cannot go to checkout for this country (not served, too heavy). No config on the
  // page = shipping not set up: "Calculated at checkout", as before.
  var SHIP_KEY = 'zanza-ship-to';
  function readShipTo() { try { return window.localStorage.getItem(SHIP_KEY); } catch (e) { return null; } }
  function renderShipping(root, availableLines, subtotal) {
    var select = root.querySelector('[data-bag-ship-to]');
    var configEl = root.querySelector('[data-shipping-config]');
    if (!select || !configEl || !window.ZanzaShipping) return true;
    var config;
    try { config = JSON.parse(configEl.textContent); } catch (e) { return true; }
    var stored = readShipTo();
    if (stored && select.value !== stored && select.querySelector('option[value="' + stored + '"]')) select.value = stored;
    var country = select.value, name = select.options[select.selectedIndex] ? select.options[select.selectedIndex].text : country;
    var items = availableLines.map(function (li) {
      return { format: li.getAttribute('data-format'), weight_g: parseInt(li.getAttribute('data-weight'), 10) || null };
    });
    var est = window.ZanzaShipping.estimate(config, items, country);
    var shipping = root.querySelector('[data-bag-shipping]'), total = root.querySelector('[data-bag-total]');
    var note = root.querySelector('[data-bag-note]');
    var totalRow = total && total.closest('.zz-bag-summary__row');
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
      ? 'Shipping is an estimate for your country. You enter the address and pay on Stripe. Your records are held for 30 minutes once you start checkout.'
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

  function renderBag() {
    var ids = readBag();
    applyStatus();
    var known = renderBagPage(ids);
    if (known.length !== ids.length) {
      try { window.localStorage.setItem(BAG_KEY, JSON.stringify(known)); } catch (e) { /* ignore */ }
      ids = known;
    }
    renderBagCount(ids.length);
    syncAddButtons(ids);
  }

  function initBag() { renderBag(); }

  // a copy already in the bag: its Add buttons become "In bag" (Gio 2026-11-12, decision 0058, replaces "Remove" of
  // 0054). Same Button: hierarchy secondary (the PDP CTA drops from primary), leading icon = tick (Figma `leading icon`
  // on, icon-tick-large-thin), label "In bag", accessible name "In bag, view bag". Pressing it opens the bag: taking a
  // copy out happens only in the bag. Never disabled: struck through means unavailable (sold). The defaults are kept
  // in data-*-default so they come back when the copy leaves the bag.
  // Reserved (decision 0059): a copy held by a checkout (or by hand) reads "Reserved", hierarchy secondary,
  // leading icon = clock (icon-clock-counter-clockwise), accessible name "Reserved, find out more" (the dialog says which hold). It wins
  // over "In bag". Never disabled (struck through = sold, decision 0058): pressing it explains the hold in a toast.
  function syncAddButton(btn, id, ids) {
    var label = btn.querySelector('.zz-button__label');
    var text = label && label.firstChild;
    if (!text || text.nodeType !== 3) return;
    if (!btn.hasAttribute('data-label-default')) btn.setAttribute('data-label-default', text.nodeValue);
    if (!btn.hasAttribute('data-hierarchy-default')) btn.setAttribute('data-hierarchy-default', btn.getAttribute('data-hierarchy') || 'primary');
    var reserved = !!id && statusFor(id) === 'reserved';
    var inBag = !reserved && !!id && (ids || readBag()).indexOf(id) !== -1;
    text.nodeValue = reserved ? 'Reserved' : inBag ? 'In bag' : btn.getAttribute('data-label-default');
    btn.setAttribute('data-hierarchy', reserved || inBag ? 'secondary' : btn.getAttribute('data-hierarchy-default'));
    btn.setAttribute('data-in-bag', inBag ? 'true' : 'false');
    btn.setAttribute('data-reserved', reserved ? 'true' : 'false');
    if (reserved) btn.setAttribute('aria-label', 'Reserved, find out more');
    else if (inBag) btn.setAttribute('aria-label', 'In bag, view bag');
    else btn.removeAttribute('aria-label');
    setLeadingIcon(btn, label, reserved ? 'zz-icon-clock' : inBag ? 'zz-icon-tick' : null);
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
    Array.prototype.forEach.call(document.querySelectorAll('[data-listing-id] .zz-product-card__add'), function (b) {
      syncAddButton(b, b.closest('[data-listing-id]').getAttribute('data-listing-id'), ids);
    });
    Array.prototype.forEach.call(document.querySelectorAll('[data-add-to-bag]'), function (b) {
      syncAddButton(b, b.getAttribute('data-add-to-bag'), ids);
    });
    var add = player && player.querySelector('.site-player__add');
    var cur = typeof current === 'function' ? current() : null;
    if (add && cur) syncAddButton(add, cur.listing, ids);
  }
  // the Add buttons: Add to bag, or open the bag when the copy is already in it (decision 0058). The header Bag link
  // does the opening, so the soft navigation keeps the player; no toast (decision 0050)
  function addOrOpen(id) {
    if (!id) return;
    if (statusFor(id) === 'reserved') { openNotify(id); return; }
    if (readBag().indexOf(id) === -1) { addToBag(id); return; }
    var link = document.querySelector('a[data-bag-count]');
    if (link) link.click();
  }
  // take a copy out of the bag with a toast + Undo (decision 0049); Undo puts it back where it was
  function removeWithUndo(id, returnFocus, onUndo) {
    var at = readBag().indexOf(id);
    removeFromBag(id);
    if (!window.ZanzaToast) { announce('Removed from bag.'); return; }
    window.ZanzaToast.show({ message: 'Removed from bag.', actionLabel: 'Undo', returnFocus: returnFocus, onAction: function () {
      var ids = readBag();
      if (ids.indexOf(id) === -1) { ids.splice(at < 0 ? ids.length : Math.min(at, ids.length), 0, id); writeBag(ids); }
      window.ZanzaToast.show({ message: 'Undone.' });
      if (onUndo) onUndo();
      else if (returnFocus && document.contains(returnFocus)) returnFocus.focus();
    } });
  }

  /* ---------------------------------------------------------------- 7. live status */

  var seeded = {};      // listing id -> status written in this page at build time
  var live = {};        // listing id -> status read from Supabase (fresher: wins over the page)
  var holdKind = {};    // listing id -> 'checkout' | 'manual' (reserved copies only)
  var lastLiveRead = 0;
  var LIVE_MIN_GAP = 30000;   // ms between two reads (page load, soft navigation, tab back in view)
  function statusFor(id) { return live[id] || seeded[id] || 'available'; }
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
  // one (Gio holds it for someone, no end). Without the column (before 0016) a hold reads as a checkout.
  var RESERVED_TEXT = {
    checkout: 'Someone is checking out this record. If they don\u2019t buy it, it\u2019s back within 30 minutes.',
    manual: 'This record is on hold for someone. If it falls through, it\u2019s back in the shop.'
  };
  function reservedText(id) { return RESERVED_TEXT[holdKind[id] === 'manual' ? 'manual' : 'checkout']; }
  var notifyFor = null, notifyReturn = null, notifyBusy = false;
  function supabaseConfig() {
    var base = document.querySelector('meta[name="zz-supabase-url"]');
    var key = document.querySelector('meta[name="zz-supabase-key"]');
    return base && key ? { url: base.content, key: key.content } : null;
  }
  function notifyParts() {
    var d = document.querySelector('[data-notify-dialog]');
    if (!d) return null;
    var input = d.querySelector('[data-notify-email]');
    var field = input && input.closest('.zz-input');
    return { dialog: d, input: input, field: field, support: field && field.querySelector('[id$="-support"]'),
      confirm: d.querySelector('.zz-dialog__actions .zz-button:not([data-dialog-cancel])') };
  }
  var NOTIFY_SUPPORT = 'One email, only for this record. Then we delete your address.';
  function setNotifyError(p, text) {
    if (p.field) { if (text) p.field.setAttribute('data-invalid', 'true'); else p.field.removeAttribute('data-invalid'); }
    if (text) p.input.setAttribute('aria-invalid', 'true'); else p.input.removeAttribute('aria-invalid');
    if (p.support) p.support.textContent = text || NOTIFY_SUPPORT;
  }
  function openNotify(id) {
    var p = notifyParts();
    if (!p || !p.dialog.showModal || !supabaseConfig()) {
      if (window.ZanzaToast) window.ZanzaToast.show({ message: reservedText(id) }); else announce(reservedText(id));
      return;
    }
    notifyFor = id;
    var body = p.dialog.querySelector('.zz-dialog__body');
    if (body) body.textContent = reservedText(id) + ' Leave your email and we\u2019ll tell you.';
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
      if (window.ZanzaToast) window.ZanzaToast.show({ message: msg }); else announce(msg);
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
    else if (e.target.closest('.zz-dialog__actions .zz-button')) sendNotify();
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && e.target && e.target.hasAttribute && e.target.hasAttribute('data-notify-email')) { e.preventDefault(); sendNotify(); }
  });
  // Esc: the native dialog closes itself; keep our state in step
  document.addEventListener('cancel', function (e) {
    if (e.target && e.target.hasAttribute && e.target.hasAttribute('data-notify-dialog')) { e.preventDefault(); closeNotify(); }
  }, true);
  // a bag line follows the live status: available (price) or unavailable (notice, no price), as pages/bag.js renders it
  var NOTICE = { sold: 'Just sold', traded: 'Just sold', reserved: 'Reserved' };
  function syncBagLine(li) {
    var id = li.getAttribute('data-bag-line');
    var status = statusFor(id);
    var available = status === 'available';
    li.setAttribute('data-listing-status', status);
    li.setAttribute('data-available', available ? 'true' : 'false');
    var item = li.querySelector('.zz-bag-item');
    if (!item) return;
    item.setAttribute('data-status', available ? 'available' : 'unavailable');
    var info = item.querySelector('.zz-bag-item__info');
    var notice = item.querySelector('.zz-bag-item__notice');
    if (available && notice) notice.parentNode.removeChild(notice);
    if (!available && info) {
      if (!notice) { notice = document.createElement('p'); notice.className = 'zz-bag-item__notice label-small'; info.insertBefore(notice, info.firstChild); }
      notice.textContent = NOTICE[status] || 'Not available';
    }
    var purchase = item.querySelector('.zz-bag-item__purchase');
    var price = item.querySelector('.zz-bag-item__price');
    if (!available && price) price.parentNode.removeChild(price);
    if (available && !price && purchase) {
      price = document.createElement('p');
      price.className = 'zz-bag-item__price body-large body-medium--mobile';   // = BagItem responsive (CARD_TYPE.head)
      price.textContent = formatPrice(parseInt(li.getAttribute('data-price'), 10) || 0);
      purchase.insertBefore(price, purchase.firstChild);
    }
  }
  function applyStatus() {
    Array.prototype.forEach.call(document.querySelectorAll('[data-bag-line]'), syncBagLine);
    Array.prototype.forEach.call(document.querySelectorAll('[data-reserved-note]'), function (p) {
      var id = p.getAttribute('data-reserved-note');
      p.hidden = statusFor(id) !== 'reserved';
      if (!p.hidden) p.textContent = reservedText(id);
    });
    Array.prototype.forEach.call(document.querySelectorAll('[data-listing-status]'), function (el) {
      var id = listingIdOf(el);
      if (id && !el.hasAttribute('data-bag-line')) el.setAttribute('data-listing-status', statusFor(id));
    });
  }
  function readLive(force) {
    var base = document.querySelector('meta[name="zz-supabase-url"]');
    var key = document.querySelector('meta[name="zz-supabase-key"]');
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
    var card = t.closest('.zz-product-card__add');
    if (card) { var holder = card.closest('[data-listing-id]'); if (holder) addOrOpen(holder.getAttribute('data-listing-id')); return; }
    var cta = t.closest('[data-add-to-bag]');
    if (cta) { addOrOpen(cta.getAttribute('data-add-to-bag')); return; }
    var padd = t.closest('.site-player__add');
    if (padd) { var cur = typeof current === 'function' ? current() : null; if (cur) addOrOpen(cur.listing); return; }
    var remove = t.closest('.zz-bag-item__remove');
    if (remove) {
      var li = remove.closest('[data-bag-line]');
      if (!li) return;
      // focus goes to the next line's Remove, else the previous one's, else the page title (nothing left)
      var lines = Array.prototype.filter.call(document.querySelectorAll('[data-bag-line]'), function (x) { return !x.hidden; });
      var i = lines.indexOf(li);
      var next = lines[i + 1] || lines[i - 1];
      var id = li.getAttribute('data-bag-line');
      var focusEl = next ? next.querySelector('.zz-bag-item__remove') : document.querySelector('[data-bag-page] h1');
      removeWithUndo(id, focusEl, function () {
        var back = document.querySelector('[data-bag-line="' + id + '"] .zz-bag-item__remove');
        if (back) back.focus();
      });
      if (focusEl) { if (!next) focusEl.setAttribute('tabindex', '-1'); focusEl.focus(); }
    }
  });
  // another tab changed the bag
  window.addEventListener('storage', function (e) { if (e.key === BAG_KEY) renderBag(); });

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
      initGallery();
      initFilters();
      initStatus();
      initBag();
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
  initGallery();
  initFilters();
  initStatus();
  initBag();
})();
