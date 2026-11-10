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
     blocks; an option at 0 is hidden unless ticked. State lives in the URL (?subgenre=Roots&format=7"), so a
     filtered list can be shared and Back restores it. Active filter row (0041, in place of the breadcrumbs) = the filter
     reached from a link: artist / label (no checkbox) or the subgenre / tag a card's tag linked to, one removable chip.
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
    boxes.forEach(function (b) { b.checked = params.getAll(b.name).indexOf(b.value) !== -1; });
    var hiddenSel = {}; hidden.forEach(function (f) { hiddenSel[f.key] = params.getAll(f.key); });
    // the link filter (0041): a page opened on exactly one subgenre / tag value (a card's tag link: a new click replaces
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
    var LINK_LABEL = { subgenre: 'Subgenre', tag: 'Tag' };
    // the row's chips: the hidden-facet chips, else the linked subgenre / tag while still ticked
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
        var first = layer.querySelector('[data-layer-close]'); if (first) first.focus();
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
          var firstBox = layer.querySelector('[data-facet-block]:not([hidden]) .zz-filter:not([hidden]) input');
          (firstBox || back).focus();
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
})();
