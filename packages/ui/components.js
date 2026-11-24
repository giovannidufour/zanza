/* @ds-bundle: {"format":4,"namespace":"Zanza","components":[{"name":"Button"},{"name":"Tabs"},{"name":"Header"},{"name":"Breadcrumbs"},{"name":"Tag"},{"name":"PlayerButton"},{"name":"IconButton"},{"name":"Player"},{"name":"ProductInfo"},{"name":"ProductCard"},{"name":"BagItem"},{"name":"OrderItem"},{"name":"OrderRow"},{"name":"BagSummary"},{"name":"RelatedProducts"},{"name":"ProductReturnCard"},{"name":"Gallery"},{"name":"Input"},{"name":"DropZone"},{"name":"FileList"},{"name":"FileItem"},{"name":"Alert"},{"name":"Divider"},{"name":"ActionPanel"},{"name":"ListingLine"},{"name":"Checkbox"},{"name":"Dialog"},{"name":"EntityField"},{"name":"Radio"},{"name":"Filter"},{"name":"FiltersLayer"},{"name":"PlpHeader"},{"name":"MenuItem"},{"name":"MenuGroup"},{"name":"MenuLayer"},{"name":"Footer"},{"name":"FooterLinks"},{"name":"FooterNewsletter"},{"name":"TradeNote"},{"name":"DiscogsCard"},{"name":"Step"},{"name":"ReleaseOption"},{"name":"ReleaseList"},{"name":"ChosenRelease"},{"name":"DiscogsLink"},{"name":"FormSectionHead"},{"name":"Marker"},{"name":"PriceFields"},{"name":"ListingStatus"},{"name":"SectionHead"},{"name":"GenreLinks"},{"name":"HomeIntro"},{"name":"HomeNewsletter"},{"name":"ProductTile"},{"name":"GalleryCounter"},{"name":"ViewToggle"},{"name":"NewsletterDialog"}]} */
/* packages/ui/components.js — the ONE implementation of the rythem-works components.
   Plain React.createElement (no JSX, no build step). Works as a CommonJS module (Node / SSR)
   and as a classic script (window.Zanza) for the design-system artifact.
   Every visual value is a token from tokens.css or a dimension that is hardcoded in Figma. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('react'));
  else root.Zanza = factory(root.React);
})(typeof self !== 'undefined' ? self : this, function (React) {
  'use strict';
  var h = React.createElement;

  function omit(props, keys) {
    var rest = {};
    for (var k in props) if (keys.indexOf(k) === -1) rest[k] = props[k];
    return rest;
  }
  function cx() {
    return Array.prototype.filter.call(arguments, Boolean).join(' ');
  }

  /* Icons (Figma page `icons`): drawn with 1px strokes, as in Figma, and `vector-effect: non-scaling-stroke`, so a
     line stays 1px at any icon size (Gio 2026-11-12). Inside-aligned strokes = a 2px stroke clipped to the shape.
     Solid shapes (play triangle, radio dot) are fills. Markup is static and trusted (generated from Figma). */
  function strokeIcon(w, hh, markup) {
    return h('svg', { viewBox: '0 0 ' + w + ' ' + hh, fill: 'none', dangerouslySetInnerHTML: { __html: markup } });
  }

  /* ── Icons ──────────────────────────────────────────────────────────────
     One entry per Figma component on page `icons`, keyed by its name without `icon/` (decision 0080).
     Drawn as Figma draws them (decision 0066): 1px non-scaling strokes, inside strokes = 2px clipped.
     To update an icon after it changes in Figma, replace its entry here; every component follows. */
  var ICONS = {
    'icon-bars-three': [24, 24, '<path d="M0 8H24" stroke="currentColor" stroke-width="1" vector-effect="non-scaling-stroke"/><path d="M0 12H24" stroke="currentColor" stroke-width="1" vector-effect="non-scaling-stroke"/><path d="M0 16H24" stroke="currentColor" stroke-width="1" vector-effect="non-scaling-stroke"/>'],
    'icon-chevron-down-large-thin': [24, 24, '<path transform="matrix(0 -1 1 0 2 17.5)" d="M 10 0 L 0 10 L 10 20" stroke="currentColor" stroke-width="1" vector-effect="non-scaling-stroke" stroke-linecap="round" stroke-linejoin="round"/>'],
    'icon-chevron-down-small-thin': [24, 24, '<path transform="matrix(0 -1 1 0 6 15.5)" d="M 6 0 L 0 6 L 6 12" stroke="currentColor" stroke-width="1" vector-effect="non-scaling-stroke" stroke-linecap="round" stroke-linejoin="round"/>'],
    'icon-chevron-up-small-thin': [24, 24, '<path d="M 6 15 L 12 9 L 18 15" stroke="currentColor" stroke-width="1" vector-effect="non-scaling-stroke" stroke-linecap="round" stroke-linejoin="round"/>'],
    'icon-chevron-left-small-thin': [24, 24, '<path transform="translate(9 6)" d="M 6 0 L 0 6 L 6 12" stroke="currentColor" stroke-width="1" vector-effect="non-scaling-stroke" stroke-linecap="round" stroke-linejoin="round"/>'],
    'icon-chevron-right-small-thin': [24, 24, '<path transform="translate(9 6)" d="M 0 0 L 6 6 L 0 12" stroke="currentColor" stroke-width="1" vector-effect="non-scaling-stroke" stroke-linecap="round" stroke-linejoin="round"/>'],
    'icon-clock-counter-clockwise': [24, 24, '<path transform="translate(11.889 6.875)" d="M 0 0 L 0 5.121 L 5.121 5.121" stroke="currentColor" stroke-width="1" vector-effect="non-scaling-stroke" stroke-linecap="round"/><path transform="translate(3.555 16.326)" d="M 0.622 4.948 L 0 0 L 4.858 1.354" stroke="currentColor" stroke-width="1" vector-effect="non-scaling-stroke" stroke-linecap="round"/><path transform="translate(2.5 2.612)" d="M 1.056 13.714 C 2.113 15.752 3.881 17.331 6.024 18.154 C 8.167 18.976 10.537 18.985 12.687 18.179 C 14.836 17.372 16.615 15.806 17.688 13.777 C 18.761 11.747 19.053 9.395 18.509 7.164 C 17.966 4.934 16.623 2.98 14.737 1.673 C 12.85 0.365 10.55 -0.207 8.27 0.067 C 5.991 0.34 3.891 1.439 2.367 3.156 C 0.843 4.873 0.001 7.089 0 9.384" stroke="currentColor" stroke-width="1" vector-effect="non-scaling-stroke" stroke-linecap="round"/>'],
    'icon-envelope': [24, 24, '<path transform="translate(1 0.875)" d="M 22 0 L 11 13 L 0 0" stroke="currentColor" stroke-width="1" vector-effect="non-scaling-stroke"/><defs><clipPath id="zz-icon-envelope-clip"><path transform="translate(0 0)" d="M0 0H24V24H0Z"/></clipPath></defs><path transform="translate(0 0)" d="M0 0H24V24H0Z" clip-path="url(#zz-icon-envelope-clip)" stroke="currentColor" stroke-width="2" vector-effect="non-scaling-stroke"/>'],
    'icon-magnifying-glass': [24, 24, '<path transform="translate(17.256 17.25)" d="M 6 6 L 0 0" stroke="currentColor" stroke-width="1" vector-effect="non-scaling-stroke" stroke-linecap="square" stroke-linejoin="round"/><defs><clipPath id="zz-icon-search-clip"><path d="M0 10A10 10 0 1 0 20 10A10 10 0 1 0 0 10Z"/></clipPath></defs><path d="M0 10A10 10 0 1 0 20 10A10 10 0 1 0 0 10Z" clip-path="url(#zz-icon-search-clip)" stroke="currentColor" stroke-width="2" vector-effect="non-scaling-stroke"/>'],
    'icon-pause': [24, 24, '<path d="M8.5 0V24" stroke="currentColor" stroke-width="1" vector-effect="non-scaling-stroke"/><path d="M15.5 0V24" stroke="currentColor" stroke-width="1" vector-effect="non-scaling-stroke"/>'],
    'icon-play': [24, 24, '<path d="M 0 24 L 24 12 L 0 0 Z" fill="currentColor"/>'],
    'icon-plus-small-thin': [24, 24, '<path d="M12 7V17" stroke="currentColor" stroke-width="1" vector-effect="non-scaling-stroke" stroke-linecap="round" stroke-linejoin="round"/><path d="M17 12H7" stroke="currentColor" stroke-width="1" vector-effect="non-scaling-stroke" stroke-linecap="round" stroke-linejoin="round"/>'],
    'icon-radio-dot': [18, 18, '<defs><clipPath id="zz-icon-radio-dot-clip"><path transform="translate(0 0)" d="M0 9A9 9 0 1 0 18 9A9 9 0 1 0 0 9Z"/></clipPath></defs><path transform="translate(0 0)" d="M0 9A9 9 0 1 0 18 9A9 9 0 1 0 0 9Z" clip-path="url(#zz-icon-radio-dot-clip)" stroke="currentColor" stroke-width="2" vector-effect="non-scaling-stroke"/><path d="M3 9A6 6 0 1 0 15 9A6 6 0 1 0 3 9Z" fill="currentColor"/>'],
    'icon-radio-empty': [18, 18, '<defs><clipPath id="zz-icon-radio-empty-clip"><path transform="translate(0 0)" d="M0 9A9 9 0 1 0 18 9A9 9 0 1 0 0 9Z"/></clipPath></defs><path transform="translate(0 0)" d="M0 9A9 9 0 1 0 18 9A9 9 0 1 0 0 9Z" clip-path="url(#zz-icon-radio-empty-clip)" stroke="currentColor" stroke-width="2" vector-effect="non-scaling-stroke"/>'],
    'icon-skip-back': [24, 24, '<defs><clipPath id="zz-icon-prev-clip"><path transform="translate(0 0)" d="M 24 24 L 0 12 L 24 0 Z"/></clipPath></defs><path transform="translate(0 0)" d="M 24 24 L 0 12 L 24 0 Z" clip-path="url(#zz-icon-prev-clip)" stroke="currentColor" stroke-width="2" vector-effect="non-scaling-stroke"/><path d="M0.5 0V24" stroke="currentColor" stroke-width="1" vector-effect="non-scaling-stroke"/>'],
    'icon-skip-forward': [24, 24, '<defs><clipPath id="zz-icon-next-clip"><path transform="translate(0 0)" d="M 0 24 L 24 12 L 0 0 Z"/></clipPath></defs><path transform="translate(0 0)" d="M 0 24 L 24 12 L 0 0 Z" clip-path="url(#zz-icon-next-clip)" stroke="currentColor" stroke-width="2" vector-effect="non-scaling-stroke"/><path d="M23.5 0V24" stroke="currentColor" stroke-width="1" vector-effect="non-scaling-stroke"/>'],
    'icon-square': [24, 24, '<defs><clipPath id="zz-icon-square-clip"><path d="M0 0H24V24H0Z"/></clipPath></defs><path d="M0 0H24V24H0Z" clip-path="url(#zz-icon-square-clip)" stroke="currentColor" stroke-width="2" vector-effect="non-scaling-stroke"/>'],
    'icon-square-minus': [24, 24, '<defs><clipPath id="zz-icon-square-minus-clip"><path d="M0 0H24V24H0Z"/></clipPath></defs><path d="M0 0H24V24H0Z" clip-path="url(#zz-icon-square-minus-clip)" stroke="currentColor" stroke-width="2" vector-effect="non-scaling-stroke"/><path d="M5 12H19" stroke="currentColor" stroke-width="1" vector-effect="non-scaling-stroke"/>'],
    'icon-square-tick': [24, 24, '<defs><clipPath id="zz-icon-square-tick-clip"><path d="M0 0H24V24H0Z"/></clipPath></defs><path d="M0 0H24V24H0Z" clip-path="url(#zz-icon-square-tick-clip)" stroke="currentColor" stroke-width="2" vector-effect="non-scaling-stroke"/><path transform="translate(4 4)" d="M 0 9.032 L 4.889 14 L 16 0" stroke="currentColor" stroke-width="1" vector-effect="non-scaling-stroke"/>'],
    'icon-tick-large-thin': [24, 24, '<path transform="translate(3 5)" d="M 0 8.667 L 4.5 13 L 18 0" stroke="currentColor" stroke-width="1" vector-effect="non-scaling-stroke" stroke-linecap="round"/>'],
    'icon-x': [24, 24, '<path transform="matrix(0.707 0.707 -0.707 0.707 0.023 0.977)" d="M0 0L32.52 0" stroke="currentColor" stroke-width="1" vector-effect="non-scaling-stroke"/><path transform="matrix(-0.707 0.707 -0.707 -0.707 23.014 0.023)" d="M0 0L32.52 0" stroke="currentColor" stroke-width="1" vector-effect="non-scaling-stroke"/>'],
    'icon-x-thin': [24, 24, '<path transform="matrix(0.707 -0.707 0.707 0.707 5.429 5.429)" d="M 0 0 L 0 20" stroke="currentColor" stroke-width="1" vector-effect="non-scaling-stroke" stroke-linecap="round" stroke-linejoin="round"/><path transform="matrix(0.707 -0.707 0.707 0.707 5.429 19.571)" d="M 20 0 L 0 0" stroke="currentColor" stroke-width="1" vector-effect="non-scaling-stroke" stroke-linecap="round" stroke-linejoin="round"/>']
  };
  function icon(name) {
    var d = ICONS[name];
    return strokeIcon(d[0], d[1], d[2]);
  }

  /* ── Button ─────────────────────────────────────────────────────────────
     Figma: `button` (page buttons → section button). Variants hierarchy × size; states via pseudo-classes. */
  function Button(props) {
    var hierarchy = props.hierarchy || 'primary';
    var size = props.size || 'medium';
    var disabled = !!props.disabled || props.state === 'disabled';
    var isLink = !!props.href;   // href → a link styled as a button (navigation, e.g. Player "View")
    var attrs = Object.assign(isLink ? {} : { type: props.type || 'button', disabled: disabled }, {
      className: cx('zz-button', props.className),
      'data-hierarchy': hierarchy,
      'data-size': size
    }, omit(props, ['hierarchy', 'size', 'disabled', 'leadingIcon', 'trailingIcon', 'children', 'state', 'className', 'type', 'suffix', 'prefix']));
    if (props.state && props.state !== 'default') attrs['data-state'] = props.state;
    // state="active" (Figma _button-states state=active, 2026-11-10): the button stands for the page you are on
    // (header Bag on /bag/). A real state, not doc-only: it stays a focusable link with aria-current="page", never
    // `disabled`, so keyboard and screen readers still reach it and hear "current page" (decision 0045).
    if (props.state === 'active') attrs['aria-current'] = props['aria-current'] || 'page';   // in-page anchors pass "true"
    // icon-only (no children): Figma hides the label container; aria-label is required by the consumer
    var hasLabel = props.children !== undefined && props.children !== null && props.children !== false;
    var typeClass = (size === 'small' || size === 'extra-small') ? 'label-extra-small' : 'label-medium';   // Figma text style per size
    return h(isLink ? 'a' : 'button', attrs,
      props.leadingIcon ? h('span', { className: 'zz-button__icon', 'aria-hidden': 'true' }, props.leadingIcon) : null,
      // Figma `suffix` (label container gap 4, same text style): a count next to the label (0029)
      // Figma `prefix` (label container, gap 4, same text style): a word before the label, e.g. "(Reserved)" (0065)
      hasLabel ? h('span', { className: cx('zz-button__label', typeClass) },
        props.prefix !== undefined && props.prefix !== null && props.prefix !== false
          ? h('span', { className: 'zz-button__prefix' }, props.prefix) : null,
        props.children,
        props.suffix !== undefined && props.suffix !== null && props.suffix !== false
          ? h('span', { className: 'zz-button__suffix' }, props.suffix) : null) : null,
      props.trailingIcon ? h('span', { className: 'zz-button__icon', 'aria-hidden': 'true' }, props.trailingIcon) : null);
  }

  /* ── Tabs / Tab ─────────────────────────────────────────────────────────
     Figma: `tab group` (slot of `tab`) and `tab` (states default/hover/pressed/active).
     Selection lives in Tabs (controlled). WAI-ARIA tabs pattern. */
  var TabsContext = React.createContext(null);

  function Tabs(props) {
    var listRef = React.useRef(null);
    function onKeyDown(e) {
      if (['ArrowRight', 'ArrowLeft', 'Home', 'End'].indexOf(e.key) === -1) return;
      var tabs = Array.prototype.slice.call(listRef.current.querySelectorAll('[role="tab"]'));
      var i = tabs.indexOf(document.activeElement);
      if (i === -1) return;
      e.preventDefault();
      var n = e.key === 'ArrowRight' ? (i + 1) % tabs.length
            : e.key === 'ArrowLeft' ? (i - 1 + tabs.length) % tabs.length
            : e.key === 'Home' ? 0 : tabs.length - 1;
      tabs[n].focus();
      var v = tabs[n].getAttribute('data-value');
      if (props.onValueChange && v !== null) props.onValueChange(v);
    }
    return h(TabsContext.Provider, { value: { value: props.value, onValueChange: props.onValueChange } },
      h(props.as || 'div', Object.assign({
        ref: listRef,
        role: props.as ? undefined : 'tablist',   // as="nav" → section navigation, no tablist semantics
        className: cx('zz-tabs', props.className),
        onKeyDown: props.as ? undefined : onKeyDown
      }, omit(props, ['value', 'onValueChange', 'children', 'className', 'as'])), props.children));
  }

  function Tab(props) {
    var ctx = React.useContext(TabsContext) || {};
    var selected = ctx.value !== undefined && ctx.value === props.value;
    // href → the tab is site navigation (a link, aria-current), not an in-page tab (role=tab, aria-selected)
    var tag = props.href ? 'a' : 'button';
    var attrs = Object.assign({
      className: cx('zz-tab', props.className),
      'data-value': props.value,
      onClick: function (e) {
        if (ctx.onValueChange) ctx.onValueChange(props.value);
        if (props.onClick) props.onClick(e);
      }
    }, omit(props, ['value', 'children', 'leadingIcon', 'trailingIcon', 'suffix', 'state', 'size', 'className', 'onClick']));
    // Figma `_tab-sizes` size=extra small (account nav, 2026-11-12): padding 4, gap 2, label/extra small (decision 0101)
    var xs = props.size === 'extra-small';
    if (xs) attrs['data-size'] = 'extra-small';
    if (tag === 'a') {
      if (selected) attrs['aria-current'] = 'page';
      attrs['data-selected'] = selected ? 'true' : 'false';
    } else {
      attrs.type = 'button';
      attrs.role = 'tab';
      attrs['aria-selected'] = selected ? 'true' : 'false';
      attrs.tabIndex = selected ? 0 : -1;
    }
    if (props.state && props.state !== 'default') attrs['data-state'] = props.state;
    return h(tag, attrs,
      props.leadingIcon ? h('span', { className: 'zz-tab__icon', 'aria-hidden': 'true' }, props.leadingIcon) : null,
      // Figma `_tab-sizes` label container: label + `suffix` (e.g. a count, "Artists 64"), gap 4, same text style
      h('span', { className: cx('zz-tab__label', xs ? 'label-extra-small' : 'label-medium') }, h('span', null, props.children),
        props.suffix !== undefined && props.suffix !== null && props.suffix !== false ? h('span', { className: 'zz-tab__suffix' }, props.suffix) : null),
      props.trailingIcon ? h('span', { className: 'zz-tab__icon', 'aria-hidden': 'true' }, props.trailingIcon) : null);
  }

  /* ── Header ─────────────────────────────────────────────────────────────
     Figma: `header` (device=desktop | mobile). Composition: logo + store name, Tabs (desktop), actions, menu (mobile), 1px rule.
     `device` omitted → responsive: both the menu button and the tabs are rendered and CSS shows one of them (see components.css). */
  function HamburgerIcon() { return icon('icon-bars-three'); }

  function Header(props) {
    var device = props.device || 'responsive';
    var showMenu = device !== 'desktop';
    var showTabs = device !== 'mobile' && !!props.tabs;
    var hasSearch = !!(props.search || props.searchHref);
    var nameTag = props.homeHref ? 'a' : 'div';
    var nameAttrs = { className: 'zz-header__name label-medium' };
    if (props.homeHref) nameAttrs.href = props.homeHref;
    // Figma `store name` state=active (2026-11-14): on the home page the store name is lit like the tab of the current section
    if (props.homeCurrent) { nameAttrs['data-state'] = 'active'; if (props.homeHref) nameAttrs['aria-current'] = 'page'; }

    return h('header', Object.assign({
      className: cx('zz-header', props.className),
      'data-device': device
    }, omit(props, ['device', 'logo', 'storeName', 'homeHref', 'homeCurrent', 'tabs', 'actions', 'search', 'searchHref', 'searchLabel', 'onMenuClick', 'menuLabel', 'menuProps', 'className', 'children'])),
      h('div', { className: 'zz-header__row' },
        h('div', { className: 'zz-header__leading' },
          showMenu ? h(Button, Object.assign({ className: 'zz-header__menu', hierarchy: 'secondary', leadingIcon: h(HamburgerIcon), 'aria-label': props.menuLabel || 'Menu', onClick: props.onMenuClick }, props.menuProps)) : null,
          props.logo ? h('div', { className: 'zz-header__logo' }, props.logo) : null,
          // Figma `store name` logo=true (2026-11-15, decision 0094): when the header has no room for the big logo
          // (data-logo="hidden"), the same logo shows 36px inside the store name; CSS switches between the two.
          props.storeName ? h(nameTag, nameAttrs,
            props.logo ? h('span', { className: 'zz-header__name-logo', 'aria-hidden': 'true' }, props.logo) : null,
            props.storeName) : null),
        showTabs ? h('div', { className: 'zz-header__tabs' }, props.tabs) : null,
        (props.actions || hasSearch) ? h('div', { className: 'zz-header__trailing' },
          // Figma boolean `search` (2026-11-12): desktop = the search field (input type=search, 280 wide) before the
          // actions; mobile = a secondary icon Button (magnifier, like the hamburger) that leads to the search page
          hasSearch && device !== 'mobile' && props.search ? h('div', { className: 'zz-header__search' }, props.search) : null,
          hasSearch && device !== 'desktop' && props.searchHref ? h(Button, { className: 'zz-header__search-link', hierarchy: 'secondary',
            href: props.searchHref, leadingIcon: h(SearchIcon), 'aria-label': props.searchLabel || 'Search' }) : null,
          props.actions) : null),
      h('div', { className: 'zz-header__rule', role: 'presentation' }));
  }

  /* ── Breadcrumbs ────────────────────────────────────────────────────────
     Figma: `breadcrumbs` (one component that fills its parent; the identical device variants went in 0122). `trail` = body/medium items separated by "/", padding `small`, one line
     (scrolls sideways when too long), 1px rule below. PDP only: the PLP shows ActiveFilter instead (0041).
     Items with `href` are links (the last one too: the PDP trail is section / genre, both links, 0122); a last item
     without `href` is the current page (aria-current). The "/" sits inside the item, hidden from AT, so the list
     holds only the path. */
  function Breadcrumbs(props) {
    var items = (props.items || []).filter(function (it) { return typeof it === 'string' ? it : it && it.label; });
    var nodes = items.map(function (it, i) {
      var last = i === items.length - 1;
      var label = typeof it === 'string' ? it : it.label;
      var href = typeof it === 'string' ? null : it.href;
      return h('li', { key: i, className: 'zz-breadcrumbs__item' },
        i > 0 ? h('span', { className: 'zz-breadcrumbs__sep', 'aria-hidden': 'true' }, '/') : null,
        href
          ? h('a', { href: href }, label)
          : h('span', last ? { 'aria-current': 'page' } : null, label));
    });
    return h('nav', Object.assign({
      className: cx('zz-breadcrumbs', props.className),
      'aria-label': props['aria-label'] || 'Breadcrumb'
    }, omit(props, ['items', 'className', 'aria-label'])),
      h('ol', { className: 'zz-breadcrumbs__list body-medium' }, nodes),
      h('div', { className: 'zz-breadcrumbs__rule', role: 'presentation' }));
  }

  /* ── ActiveFilter ───────────────────────────────────────────────────────
     Figma: page `active filter` → `active filter` (device=desktop|mobile, 2026-11-10, decision 0041). The PLP's row in
     place of the breadcrumbs: the filter reached from a link (artist, label, genre, tag) as one removable EntityChip
     (medium on desktop, large on mobile: the consumer picks the size), padding `small`, 1px rule below — the
     breadcrumbs' frame. A labelled group, not a nav: it is not a path. Render nothing (or hide it) when no filter is active. */
  function ActiveFilter(props) {
    return h('div', Object.assign({
      className: cx('zz-active-filter', props.className),
      role: 'group',
      'aria-label': props['aria-label'] || 'Active filter'
    }, omit(props, ['className', 'aria-label', 'children'])),
      h('div', { className: 'zz-active-filter__row' }, props.children),
      h('div', { className: 'zz-active-filter__rule', role: 'presentation' }));
  }

  /* ── Tag / TagGroup ─────────────────────────────────────────────────────
     Figma: `tag item` (size extra small | small | medium, bg surface/support-1, body text) and `tag group` (wrap, gap 4). */
  var TAG_TYPE = { 'extra-small': 'body-extra-small', small: 'body-extra-small', medium: 'body-small', large: 'body-medium' };   // Figma text style per size
  function Tag(props) {
    var size = props.size || 'small';
    // href: the tag is a link (shop: the PLP filtered by it). Interaction states not designed yet (Gio 2026-11-10: ignore for now).
    return h(props.href ? 'a' : 'span', Object.assign({
      className: cx('zz-tag', props.className),
      'data-size': size
    }, omit(props, ['size', 'children', 'className', '_typeClass'])),
      h('span', { className: cx('zz-tag__label', props._typeClass || TAG_TYPE[size]) }, props.children));
  }

  function TagGroup(props) {
    return h('ul', Object.assign({
      className: cx('zz-tag-group', props.className)
    }, omit(props, ['children', 'className'])),
      React.Children.map(props.children, function (c, i) { return c ? h('li', { key: i, className: 'zz-tag-group__item' }, c) : null; }));
  }

  /* ── PlayerButton ───────────────────────────────────────────────────────
     Figma: `player button` (state default | playing). icon 24 + label body/medium, gap 0. */
  function PlayIcon() { return icon('icon-play'); }
  function PauseIcon() { return icon('icon-pause'); }
  /* Figma: `_player button-icon` (building block, state default | playing): the 24px play/pause icon.
     Internal, like the `_` component in Figma: PlayerButton exposes its state as the nested `playing` prop. */
  function PlayerButtonIcon(props) {
    return h('span', { className: 'zz-player-button__icon', 'aria-hidden': 'true' },
      h(PlayPauseIcons));
  }
  /* Both icons are always in the markup; CSS shows one from the nearest [data-playing] ancestor.
     So a static page (no React at runtime) can switch play ↔ pause by flipping one attribute. */
  function PlayPauseIcons() {
    return h(React.Fragment, null,
      h('span', { className: 'zz-icon-play' }, h(PlayIcon)),
      h('span', { className: 'zz-icon-pause' }, h(PauseIcon)));
  }
  /* Figma: `player button` (state default | hover | pressed | disabled) + nested exposed `_player button-icon`.
     Interaction states come from :hover / :active / :disabled; `state` pins one for documentation only. */
  function PlayerButton(props) {
    var playing = !!props.playing;
    var disabled = !!props.disabled || props.state === 'disabled';
    var attrs = Object.assign({
      type: 'button',
      className: cx('zz-player-button', props.className),
      'data-playing': playing ? 'true' : 'false',
      'aria-pressed': playing ? 'true' : 'false',
      disabled: disabled
    }, omit(props, ['playing', 'disabled', 'state', 'children', 'className']));
    if (props.state && props.state !== 'default') attrs['data-state'] = props.state;
    return h('button', attrs,
      h(PlayerButtonIcon, { playing: playing }),
      h('span', { className: 'zz-player-button__label body-medium' }, props.children));
  }

  /* ── IconButton ─────────────────────────────────────────────────────────
     Figma: `icon button` (state default | hover | pressed | disabled), 24 × 24, icon fills the box.
     Same colour logic as PlayerButton: action/floating/foreground/* on the icon, background/* on the box.
     Icon-only: an accessible name (aria-label) is required. Interaction states come from
     :hover / :active / :disabled; `state` pins one for documentation only. */
  function IconButton(props) {
    var disabled = !!props.disabled || props.state === 'disabled';
    var attrs = Object.assign({
      type: 'button',
      className: cx('zz-icon-button', props.className),
      disabled: disabled
    }, omit(props, ['icon', 'disabled', 'state', 'children', 'className']));
    if (props.state && props.state !== 'default') attrs['data-state'] = props.state;
    return h('button', attrs,
      h('span', { className: 'zz-icon-button__icon', 'aria-hidden': 'true' }, props.icon || h(PlayIcon)));
  }

  /* ── Player ─────────────────────────────────────────────────────────────
     Figma: `player` (device mobile | desktop) + building block `_player controls` (state default | playing).
     The sample player docked at the bottom of the site. Presentational: it renders the current sample and the
     native audio element; the site owns playback, the queue, docking and the slide in/out (apps/storefront).
     Desktop row: actions · now playing (fill) · _player controls · native player (326) · close.
     Mobile column: now playing + close / actions · _player controls / native player. */
  function PreviousIcon() { return icon('icon-skip-back'); }
  function NextIcon() { return icon('icon-skip-forward'); }
  function CloseIcon() { return icon('icon-x'); }
  /* Figma: `_player controls` (state default | playing): position "n of total" + previous · play/pause · next.
     Internal (0008): Player exposes its state as `playing`. Previous/next are disabled at the ends of the queue. */
  function PlayerControls(props) {
    var index = props.index || 1, total = props.total || 1;
    return h('div', { className: 'zz-player__controls' },
      h('span', { className: 'zz-player__position body-medium', 'aria-hidden': 'true' }, index + ' of ' + total),
      h('div', { className: 'zz-player__transport' },
        h(IconButton, { className: 'zz-player__previous', icon: h(PreviousIcon), 'aria-label': 'Previous sample', disabled: index <= 1, onClick: props.onPrevious }),
        h(IconButton, { className: 'zz-player__toggle', icon: h(PlayPauseIcons), 'aria-label': props.playing ? 'Pause' : 'Play', onClick: props.onTogglePlay }),
        h(IconButton, { className: 'zz-player__next', icon: h(NextIcon), 'aria-label': 'Next sample', disabled: index >= total, onClick: props.onNext })));
  }
  function Player(props) {
    var device = props.device || 'responsive';
    var img = props.image || {};
    return h('section', Object.assign({
      className: cx('zz-player', props.className),
      'data-device': device,
      'data-playing': props.playing ? 'true' : 'false',
      'aria-label': props['aria-label'] || 'Player'
    }, omit(props, ['device', 'image', 'sampleTitle', 'productName', 'index', 'total', 'playing', 'src',
                    'actions', 'onPrevious', 'onNext', 'onTogglePlay', 'onClose', 'audioRef', 'className', 'aria-label'])),
      // Figma: `now playing` — image 48 + title row (sample number · sample title / product name)
      h('div', { className: 'zz-player__now' },
        h('div', { className: 'zz-player__image' }, img.src ? h('img', { src: img.src, srcSet: img.srcSet, sizes: img.srcSet ? img.sizes || '48px' : undefined, alt: img.alt || '', width: 48, height: 48 }) : null),
        h('p', { className: 'zz-player__title body-medium', 'aria-live': 'polite' },
          // sample number = position of the sample in the queue, as on the sample buttons (decision 0056)
          h('span', { className: 'zz-player__number' }, props.index || 1),
          h('span', { className: 'zz-player__names' },
            h('span', { className: 'zz-player__sample' }, props.sampleTitle),
            h('span', { className: 'zz-player__product' }, props.productName)))),
      props.actions ? h('div', { className: 'zz-player__actions' }, props.actions) : null,
      h(PlayerControls, { index: props.index, total: props.total, playing: props.playing,
        onPrevious: props.onPrevious, onNext: props.onNext, onTogglePlay: props.onTogglePlay }),
      // Figma: `native player` slot — the browser's own audio controls (seek, time, volume)
      h('div', { className: 'zz-player__native' },
        h('audio', { className: 'zz-player__audio', controls: true, preload: 'none', src: props.src || undefined, ref: props.audioRef })),
      h(IconButton, { className: 'zz-player__close', icon: h(CloseIcon), 'aria-label': 'Close player', onClick: props.onClose }));
  }

  /* ── ProductInfo ────────────────────────────────────────────────────────
     Figma: `product info` (device=desktop | mobile). Inner grid 3 cols × 2 rows:
     row 1 = details (title row, release info, tags, description, grading, cover, conditions), row 2 = samples
     (desktop: middle column; mobile: full width, horizontal). Breakpoint via CSS (`--mobile`, tokens.json).
     Type: name/price/release = body-extra-large (desktop) · body-large (mobile); responsive = both, the --mobile class wins below the breakpoint. */
  function ProductInfo(props) {
    var device = props.device || 'responsive';
    var headType = device === 'desktop' ? 'body-extra-large' : device === 'mobile' ? 'body-large' : 'body-extra-large body-large--mobile';
    return h('section', Object.assign({
      className: cx('zz-product-info', props.className),
      'data-device': device
    }, omit(props, ['device', 'title', 'price', 'releaseInfo', 'tags', 'description', 'grading', 'cover', 'conditions', 'samples', 'headingLevel', 'className', 'children'])),
      h('div', { className: 'zz-product-info__details' },
        h('div', { className: 'zz-product-info__title-block' },
          h('div', { className: 'zz-product-info__title-row' },
            h('h' + (props.headingLevel || 1), { className: cx('zz-product-info__name', headType) }, props.title),
            props.price != null ? h('p', { className: cx('zz-product-info__price', headType) }, props.price) : null),
          props.releaseInfo ? h('p', { className: cx('zz-product-info__release', headType) }, props.releaseInfo) : null),
        props.tags ? h('div', { className: 'zz-product-info__tags' }, props.tags) : null,
        (props.description || props.grading || props.cover || props.conditions)
          ? h('div', { className: 'zz-product-info__description-block' },
              props.description ? h('p', { className: 'zz-product-info__description body-medium' }, props.description) : null,
              props.grading ? h('p', { className: 'zz-product-info__grading body-medium' }, props.grading) : null,
              props.cover ? h('p', { className: 'zz-product-info__cover body-medium' }, props.cover) : null,
              props.conditions ? h('p', { className: 'zz-product-info__conditions body-medium' }, props.conditions) : null)
          : null),
      props.samples ? h('div', { className: 'zz-product-info__samples' }, props.samples) : null);
  }

  /* ── ProductCard ────────────────────────────────────────────────────────
     Figma: `product card` (device=desktop | mobile), page PDP. One markup for both variants; CSS grid places the blocks:
       desktop: 9-col grid · image 2 cols · info 3 cols (title block, tags, samples; gap 16) ·
                purchase 4 cols (button fill medium "Add to bag", price, then description + grading below; gap 8)
       mobile:  12-col grid · image 4 cols · info (title block, description, tags, samples; gap 8) + purchase (button
                hug small "Add", price, right-aligned) share the other 8 cols.
     In Figma the description sits in different frames per variant (auto layout cannot move it); here it is one node.
     Responsive (no device): both buttons are rendered and CSS shows one per breakpoint (labels and sizes differ). */
  var CARD_TYPE = {
    desktop:    { head: 'body-large', meta: 'body-medium', tag: 'large' },
    mobile:     { head: 'body-medium', meta: 'body-small', tag: 'small' },
    responsive: { head: 'body-large body-medium--mobile', meta: 'body-medium body-small--mobile', tag: 'large', tagType: 'body-medium body-extra-small--mobile' }
  };
  var useId = React.useId || function () { return React.useRef('zz-' + Math.random().toString(36).slice(2, 8)).current; };
  function ProductCard(props) {
    var device = props.device || 'responsive';
    var t = CARD_TYPE[device];
    var titleId = useId();
    var img = props.image;
    var tags = props.tags || [];
    function addButton(d) {
      return h(Button, {
        key: d,
        hierarchy: 'secondary',
        size: d === 'mobile' ? 'small' : 'medium',
        className: 'zz-product-card__add',
        'data-device': d,
        href: props.addHref,   // trade listings: a link to the offer page ("Make an offer"), not a bag button
        onClick: props.onAdd,
        'aria-describedby': titleId
      }, d === 'mobile' ? (props.addLabelShort || 'Add') : (props.addLabel || 'Add to bag'));
    }
    return h('article', Object.assign({
      className: cx('zz-product-card', props.className),
      'data-device': device,
      'data-state': props.state && props.state !== 'default' ? props.state : undefined,   // doc-only pin (0009)
      'aria-labelledby': titleId
    }, omit(props, ['device', 'state', 'image', 'href', 'title', 'releaseInfo', 'price', 'description', 'grading', 'cover', 'conditions', 'tags', 'samples',
                    'onAdd', 'addHref', 'addLabel', 'addLabelShort', 'headingLevel', 'className', 'children'])),
      // href: the cover becomes the link to the product page (no visual change; the link style is not designed yet)
      h(props.href ? 'a' : 'div', props.href ? { className: 'zz-product-card__image', href: props.href, 'aria-labelledby': titleId } : { className: 'zz-product-card__image' },
        img && img.src ? h('img', { src: img.src, srcSet: img.srcSet, sizes: img.srcSet ? img.sizes : undefined, alt: img.alt || '', loading: 'lazy' }) : null),
      h('div', { className: 'zz-product-card__info' },
        h('div', { className: 'zz-product-card__title-block' },
          h('h' + (props.headingLevel || 2), { id: titleId, className: cx('zz-product-card__name', t.head) }, props.title),
          props.releaseInfo ? h('p', { className: cx('zz-product-card__release', t.head) }, props.releaseInfo) : null),
        tags.length ? h(TagGroup, { className: 'zz-product-card__tags' },
          tags.map(function (tag, i) {
            var o = typeof tag === 'string' ? { label: tag } : tag;
            return h(Tag, { key: i, size: t.tag, _typeClass: t.tagType, href: o.href }, o.label);
          })) : null,
        props.samples ? h('div', { className: 'zz-product-card__samples' }, props.samples) : null),
      h('div', { className: 'zz-product-card__purchase' },
        device === 'responsive' ? [addButton('desktop'), addButton('mobile')] : addButton(device),
        props.price != null ? h('p', { className: cx('zz-product-card__price', t.head) }, props.price) : null),
      (props.description || props.grading || props.cover || props.conditions)
        ? h('div', { className: 'zz-product-card__description' },
            props.description ? h('p', { className: t.meta }, props.description) : null,
            props.grading ? h('p', { className: t.meta }, props.grading) : null,
            props.cover ? h('p', { className: t.meta }, props.cover) : null,
            props.conditions ? h('p', { className: t.meta }, props.conditions) : null)
        : null);
  }

  /* ── BagItem ────────────────────────────────────────────────────────────
     Figma: page `Bag` → `bag item` (device=desktop | mobile × status=available | sold | reserved, text `notice`).
     One line of the bag = one copy (copies are unique: no quantity, Remove only). Row: cover 96 · info (title block,
     grade lines, samples; gap 8) · purchase (price, Remove secondary small; right-aligned, gap 8); gaps 16.
     sold: product name plain (decision 0078; was struck through), "SOLD OUT" in an inline Alert (alert box) beside the struck price, in the price style (decision 0064: struck =
     unavailable for good, as the disabled Button); no notice. reserved (held by someone else's checkout or by hand):
     the same line with "RESERVED" (Gio 2026-11-12, decision 0065). `notice` overrides the word. `unavailable` (before 0064) = reserved. Samples stay (Gio 2026-11-10). Desktop type = ProductCard desktop,
     mobile = ProductCard mobile. Decision 0044. */
  function BagItem(props) { return bagLine(props, true); }

  /* ── OrderItem ──────────────────────────────────────────────────────────
     Figma: page `Account` → `order item` (device=desktop | mobile; 2198:2462). One record of a past order (account › order
     detail): the BagItem anatomy without Remove (Figma description: "bag item without the remove action"); the price is
     what was paid. Always available-looking: an order line has no sold / reserved state. Decision 0101. */
  function OrderItem(props) {
    return bagLine(Object.assign({}, omit(props, ['status', 'notice', 'onRemove', 'removeLabel']), { status: 'available' }), false);
  }

  function bagLine(props, removable) {
    var device = props.device || 'responsive';
    var t = CARD_TYPE[device];
    var titleId = useId();
    var img = props.image;
    var status = props.status === 'sold' ? 'sold' : (props.status === 'reserved' || props.status === 'unavailable') ? 'reserved' : 'available';
    var unavailable = status !== 'available';
    return h('article', Object.assign({
      className: cx('zz-bag-item', props.className),
      'data-device': device,
      'data-status': status,
      'aria-labelledby': titleId
    }, omit(props, ['device', 'status', 'notice', 'image', 'href', 'title', 'releaseInfo', 'price', 'grading', 'cover', 'conditions',
                    'samples', 'onRemove', 'removeLabel', 'headingLevel', 'className', 'children'])),
      h(props.href ? 'a' : 'div', props.href ? { className: 'zz-bag-item__image', href: props.href, tabIndex: -1, 'aria-hidden': 'true' } : { className: 'zz-bag-item__image' },
        img && img.src ? h('img', { src: img.src, srcSet: img.srcSet, sizes: img.srcSet ? img.sizes || '96px' : undefined, alt: img.alt || '', loading: 'lazy' }) : null),
      h('div', { className: 'zz-bag-item__info' },
        h('div', { className: 'zz-bag-item__title-block' },
          h('h' + (props.headingLevel || 2), { id: titleId, className: cx('zz-bag-item__name', t.head) },
            props.href ? h('a', { className: 'zz-bag-item__link', href: props.href }, props.title) : props.title),
          props.releaseInfo ? h('p', { className: cx('zz-bag-item__release', t.head) }, props.releaseInfo) : null),
        (props.grading || props.cover || props.conditions)
          ? h('div', { className: 'zz-bag-item__description' },
              props.grading ? h('p', { className: t.meta }, props.grading) : null,
              props.cover ? h('p', { className: t.meta }, props.cover) : null,
              props.conditions ? h('p', { className: t.meta }, props.conditions) : null)
          : null,
        props.samples ? h('div', { className: 'zz-bag-item__samples' }, props.samples) : null),
      h('div', { className: 'zz-bag-item__purchase' },
        unavailable
          ? h('p', { className: cx('zz-bag-item__price', t.head) },
              h(Alert, { layout: 'inline', className: 'zz-bag-item__status' }, props.notice || (status === 'sold' ? 'SOLD OUT' : 'RESERVED')),
              h('span', { className: 'zz-visually-hidden' }, ', not in your order, '),
              props.price != null ? h('s', null, props.price) : null)
          : status === 'available' && props.price != null ? h('p', { className: cx('zz-bag-item__price', t.head) }, props.price) : null,
        removable ? h(Button, { hierarchy: 'secondary', size: 'small', className: 'zz-bag-item__remove', onClick: props.onRemove, 'aria-describedby': titleId },
          props.removeLabel || 'Remove') : null));
  }

  /* ── OrderRow ───────────────────────────────────────────────────────────
     Figma: page `Account` → `order row` (device=desktop | mobile; 2198:2509). One order in account › orders: the BagItem
     anatomy (cover 96 of the first record · info: heading = "Order <ref>" + date, details = "<n> records" + "Status: …" ·
     right column: total + View). The whole row is ONE link (Figma note: "View" is not a second tab stop): View is drawn
     as a secondary small Button but is a span inside the link, aria-hidden; the link's accessible name is `label`
     ("Order 1A2B3C4D, 9 Nov 2026, shipped, 39€"). Type classes as BagItem / ProductCard. Decision 0101. */
  function OrderRow(props) {
    var device = props.device || 'responsive';
    var t = CARD_TYPE[device];
    var img = props.image;
    return h('a', Object.assign({
      className: cx('zz-order-row', props.className),
      'data-device': device,
      href: props.href,
      'aria-label': props.label
    }, omit(props, ['device', 'image', 'href', 'label', 'title', 'date', 'count', 'status', 'total', 'viewLabel', 'className', 'children'])),
      h('span', { className: 'zz-bag-item__image zz-order-row__image' },
        img && img.src ? h('img', { src: img.src, srcSet: img.srcSet, sizes: img.srcSet ? img.sizes || '96px' : undefined, alt: '', loading: 'lazy' }) : null),
      h('span', { className: 'zz-bag-item__info' },
        h('span', { className: 'zz-bag-item__title-block' },
          h('span', { className: cx('zz-order-row__title', t.head) }, props.title),
          props.date ? h('span', { className: cx('zz-order-row__date', t.head) }, props.date) : null),
        h('span', { className: 'zz-bag-item__description' },
          props.count ? h('span', { className: cx('zz-order-row__count', t.meta) }, props.count) : null,
          props.status ? h('span', { className: cx('zz-order-row__status', t.meta) }, props.status) : null)),
      h('span', { className: 'zz-bag-item__purchase' },
        h('span', { className: cx('zz-order-row__total', t.head) }, props.total),
        h('span', { className: 'zz-button zz-order-row__view', 'data-hierarchy': 'secondary', 'data-size': 'small', 'aria-hidden': 'true' },
          h('span', { className: 'zz-button__label label-extra-small' }, props.viewLabel || 'View'))));
  }

  /* ── BagSummary ─────────────────────────────────────────────────────────
     Figma: page `Bag` → `bag summary` (2026-11-10; shipping estimate 2026-11-12, decision 0057). Column, gap 8: divider · `ship to` slot (a select) · subtotal row · shipping row ·
     total row (label left, value right, body/medium) · `sold out note` (an Alert, decision 0077, when the bag has sold lines:
     "1 record sold out, not included.", decision 0064) · `minimum note` (an Alert, decision 0077; Figma minimum=below: "Minimum
     order 20€. Add 8€ more to check out.", decision 0072; the consumer also disables Checkout and points its
     aria-describedby at the note) · Checkout (primary, large, fill) · note (body/small).
     Figma `destination=not served` = no total, shipping "Not available", Checkout disabled: the consumer passes that
     (total omitted, checkoutDisabled). Without `total` there is no total row (before shipping was set up). */
  function BagSummary(props) {
    var hasTotal = props.total !== undefined && props.total !== null;
    return h('section', Object.assign({
      className: cx('zz-bag-summary', props.className),
      'aria-label': props['aria-label'] || 'Summary'
    }, omit(props, ['subtotalLabel', 'subtotal', 'shippingLabel', 'shipping', 'totalLabel', 'total', 'shipTo', 'checkoutLabel', 'onCheckout', 'checkoutDisabled', 'checkoutProps', 'note', 'soldOutNote', 'soldOutNoteProps', 'minimumNote', 'minimumNoteProps', 'className', 'children', 'aria-label'])),
      h(Divider),
      props.shipTo ? h('div', { className: 'zz-bag-summary__ship-to' }, props.shipTo) : null,
      h('dl', { className: 'zz-bag-summary__rows' },
        h('div', { className: 'zz-bag-summary__row' },
          h('dt', { className: 'body-medium' }, props.subtotalLabel || 'Subtotal'),
          h('dd', { className: 'body-medium' }, props.subtotal)),
        h('div', { className: 'zz-bag-summary__row' },
          h('dt', { className: 'body-medium' }, props.shippingLabel || 'Shipping'),
          h('dd', { className: 'body-medium' }, props.shipping || 'Calculated at checkout')),
        hasTotal ? h('div', { className: 'zz-bag-summary__row' },
          h('dt', { className: 'body-medium' }, props.totalLabel || 'Total'),
          h('dd', { className: 'body-medium' }, props.total)) : null),
      props.soldOutNote || props.soldOutNoteProps
        ? h(Alert, Object.assign({}, props.soldOutNoteProps || {}, { className: 'zz-bag-summary__sold-out' }), props.soldOutNote)
        : null,
      props.minimumNote || props.minimumNoteProps
        ? h(Alert, Object.assign({}, props.minimumNoteProps || {}, { className: 'zz-bag-summary__minimum' }), props.minimumNote)
        : null,
      h(Button, Object.assign({ hierarchy: 'primary', size: 'large', className: 'zz-bag-summary__checkout', onClick: props.onCheckout, disabled: !!props.checkoutDisabled },
        props.checkoutProps || {}), props.checkoutLabel || 'Checkout'),
      props.note ? h('p', { className: 'zz-bag-summary__note body-small' }, props.note) : null);
  }

  /* ── RelatedProducts ────────────────────────────────────────────────────
     Figma: `you may also like` (device=desktop | mobile), page PDP. Top rule (border divider/strong), padding 8/0,
     title (body/medium) then the `products list` slot (gap 8). The Figma `device` variant only swaps the card variant
     inside the slot: the layout is identical, so there is no device prop here; pass ProductCards (responsive or with
     a device) as children. Titles of the cards should be one level below this heading (headingLevel + 1). */
  function RelatedProducts(props) {
    var titleId = useId();
    return h('section', Object.assign({
      className: cx('zz-related-products', props.className),
      'aria-labelledby': titleId
    }, omit(props, ['title', 'headingLevel', 'className', 'children', 'action'])),
      h('h' + (props.headingLevel || 2), { id: titleId, className: 'zz-related-products__title body-medium' }, props.title),
      h('div', { className: 'zz-related-products__list' }, props.children),
      // Figma `view all` (boolean, decision 0119): full-width action at the end, inside the container
      props.action ? h('div', { className: 'zz-related-products__action' }, props.action) : null);
  }

  /* ── ProductReturnCard ──────────────────────────────────────────────────
     Figma: `product return card` (state default | hover), page PDP. Desktop PDP: docked on the anchored gallery once
     "More for sale" covers the record; pressing it takes the page back to the record (behaviour: the page, decision
     0119). A <button>: cover 48 | name (body/small, max 2 lines) + price (body/small) | chevron up. Outlined box on
     surface/accent; hover adds surface/hover over it (stays opaque). The accessible name comes from aria-label. */
  function ProductReturnCard(props) {
    var image = props.image;
    return h('button', Object.assign({ type: 'button', className: cx('zz-return-card', props.className),
      'data-state': props.state && props.state !== 'default' ? props.state : undefined
    }, omit(props, ['image', 'name', 'price', 'className', 'state'])),
      h('span', { className: 'zz-return-card__cover' }, image && image.src ? h('img', { src: image.src, alt: image.alt || '' }) : null),
      h('span', { className: 'zz-return-card__text' },
        h('span', { className: 'zz-return-card__name body-small' }, props.name),
        props.price != null ? h('span', { className: 'zz-return-card__price body-small' }, props.price) : null),
      h('span', { className: 'zz-return-card__icon', 'aria-hidden': 'true' }, icon('icon-chevron-up-small-thin')));
  }

  /* ── Gallery ────────────────────────────────────────────────────────────
     Figma: PDP - desktop `gallery` (images stacked, gap 1, scrolls vertically) / PDP - mobile `mobile gallery`
     (horizontal swipe). Not a Figma component yet: this mirrors the PDP frames. Focusable (tabIndex 0): it is a
     scroll container, so keyboard users can scroll it. */
  function Gallery(props) {
    var images = props.images || [];
    var device = props.device || 'responsive';
    return h('div', Object.assign({
      className: cx('zz-gallery', props.className),
      'data-device': device,
      role: 'group',
      tabIndex: 0,
      'aria-label': props['aria-label'] || 'Product images'
    }, omit(props, ['images', 'device', 'className', 'aria-label'])),
      images.map(function (img, i) {
        return h('div', { key: i, className: 'zz-gallery__item' },
          img && img.src ? h('img', { src: img.src, srcSet: img.srcSet, sizes: img.srcSet ? img.sizes : undefined, alt: img.alt || '', loading: i === 0 ? 'eager' : 'lazy' }) : null);
      }));
  }

  /* ══ Admin forms ═══════════════════════════════════════════════════════
     Used by the admin (Figma page BACKEND → Create). Render inside data-theme="backend" (Figma mode `backend`). */

  function SearchIcon() { return icon('icon-magnifying-glass'); }
  function ChevronDownIcon() { return icon('icon-chevron-down-small-thin'); }
  function ChevronDownLargeIcon() { return icon('icon-chevron-down-large-thin'); }   // Sort select, shown at 14
  function DragHandleIcon() { return icon('icon-bars-three'); }   // at 24 (the `drag handle` instance)

  var idCounter = 0;
  function useStableId(given) {   // React 18 useId when available (SSR-safe), else a counter
    var auto = React.useId ? React.useId() : React.useState(function () { return 'zz-' + (++idCounter); })[0];
    return given || auto;
  }

  /* ── Input ──────────────────────────────────────────────────────────────
     Figma: `input` (type text field | search | select) over the building block `_input-master`
     (size medium | compact × state default | filled | error | locked), support text = `_input-master-support text`.
     `type` is renamed `variant` (it would clash with the native input type). States map to the platform:
     filled = has a value (:placeholder-shown), error = `error` (aria-invalid), locked = `readOnly`.
     Every prop not listed in InputProps goes to the native control (name, value, onChange, required…). */
  function Input(props) {
    var variant = props.variant || 'text-field';
    var size = props.size || 'medium';
    var id = useStableId(props.id);
    var supportId = id + '-support';
    var hasError = props.error !== undefined && props.error !== null && props.error !== false && props.error !== '';
    var support = hasError ? props.error : props.supportText;
    var locked = !!props.readOnly;
    // search (Figma `input` type=search, state default | filled, Gio 2026-11-12): the magnifier sits in the trailing slot;
    // with `submitLabel` it is the form's submit button. With `clearLabel` a × button sits in the leading slot, shown
    // only while the field has text (CSS :placeholder-shown, needs a placeholder); clearing is the consumer's job
    // (`onClear`; the storefront wires it in scripts/site.js).
    var isSearch = variant === 'search';
    var leading = props.leadingIcon !== undefined ? props.leadingIcon : null;
    var trailing = props.trailingIcon !== undefined ? props.trailingIcon : (variant === 'select' ? h(ChevronDownIcon) : isSearch ? h(SearchIcon) : null);
    var clearBtn = isSearch && props.clearLabel ? h('button', { type: 'button', className: 'zz-input__action zz-input__clear',
      'aria-label': props.clearLabel, onClick: props.onClear }, h(XThinIcon)) : null;
    var submitBtn = isSearch && props.submitLabel ? h('button', { type: 'submit', className: 'zz-input__action zz-input__submit',
      'aria-label': props.submitLabel }, trailing) : null;
    var own = ['variant', 'size', 'label', 'optional', 'optionalLabel', 'supportText', 'error', 'prefix', 'suffix',
               'leadingIcon', 'trailingIcon', 'className', 'style', 'id', 'children', 'placeholder', 'readOnly',
               'clearLabel', 'onClear', 'submitLabel'];
    var controlAttrs = Object.assign({
      id: id,
      className: 'zz-input__control body-medium',
      'aria-invalid': hasError ? 'true' : undefined,
      'aria-describedby': support ? supportId : undefined
    }, omit(props, own));
    var control;
    if (variant === 'select') {
      // locked select: a select has no readOnly, so it is disabled (value still visible)
      control = h('select', Object.assign(controlAttrs, { disabled: locked || props.disabled }),
        props.placeholder !== undefined ? h('option', { value: '' }, props.placeholder) : null,
        props.children);
    } else if (variant === 'text-area') {
      // Figma `input` type=text area → `_input-master` size=multiline (2026-11-12, proposal): field min 120, text top-aligned
      control = h('textarea', Object.assign({ rows: 4 }, controlAttrs, { placeholder: props.placeholder, readOnly: locked }));
    } else {
      control = h('input', Object.assign({ type: variant === 'search' ? 'search' : 'text' }, controlAttrs,
        { placeholder: props.placeholder, readOnly: locked }));
    }
    return h('div', {
      className: cx('zz-input', props.className),
      style: props.style,
      'data-variant': variant,
      'data-size': size,
      'data-invalid': hasError ? 'true' : undefined,
      'data-locked': locked ? 'true' : undefined
    },
      (props.label || props.optional) ? h('label', { className: 'zz-input__top', htmlFor: id },
        h('span', { className: 'zz-input__label body-small' }, props.label),
        props.optional ? ' ' : null,   // whitespace between the two names (not rendered in the flex row)
        props.optional ? h('span', { className: 'zz-input__optional body-small' }, props.optionalLabel || 'Optional') : null) : null,
      h('div', { className: 'zz-input__field' },
        clearBtn,
        leading ? h('span', { className: 'zz-input__icon', 'aria-hidden': 'true' }, leading) : null,
        props.prefix ? h('span', { className: 'zz-input__affix body-medium', 'aria-hidden': 'true' }, props.prefix) : null,
        control,
        props.suffix ? h('span', { className: 'zz-input__affix body-medium', 'aria-hidden': 'true' }, props.suffix) : null,
        submitBtn || (trailing ? h('span', { className: 'zz-input__icon zz-input__icon--trailing', 'aria-hidden': 'true' }, trailing) : null)),
      support ? h('p', { id: supportId, className: 'zz-input__support body-small' }, support) : null);
  }

  /* ── DropZone ───────────────────────────────────────────────────────────
     Figma: page `uploads` → `drop zone` (2026-11-10; was a page-local frame on BACKEND → Create).
     surface/subtle, 1px dashed [16,16] border-divider/strong, padding 24 0, a secondary Button centred.
     The button opens the file picker; files dropped on the zone arrive the same way (onFiles). */
  function DropZone(props) {
    var inputRef = React.useRef(null);
    function pick(list) {
      var files = Array.prototype.slice.call(list || []);
      if (files.length && props.onFiles) props.onFiles(files);
    }
    return h('div', Object.assign({
      className: cx('zz-drop-zone', props.className),
      onDragOver: function (e) { if (!props.disabled) e.preventDefault(); },
      onDrop: function (e) { e.preventDefault(); if (!props.disabled) pick(e.dataTransfer.files); }
    }, omit(props, ['label', 'accept', 'multiple', 'onFiles', 'disabled', 'className', 'name'])),
      h(Button, { hierarchy: 'secondary', size: 'medium', disabled: props.disabled, onClick: function () { inputRef.current && inputRef.current.click(); } }, props.label),
      h('input', { ref: inputRef, type: 'file', name: props.name, accept: props.accept, multiple: props.multiple, hidden: true, tabIndex: -1,
        onChange: function (e) { pick(e.target.files); e.target.value = ''; } }));
  }

  /* ── FileList / FileItem ────────────────────────────────────────────────
     Figma: page `uploads` → `file item` (2026-11-10): type audio | image, state default | dragging (the dragged row,
     surface/base), booleans handle (= FileList onMove), featured, title field (= children). A row: [drag handle] · [thumbnail 40 | play] position name (featured) · [remove ×].
     Gaps: list 8, row 16, content 8 (Figma). Reorder: drag a row (pointer): the other rows shift live to the order it would have on drop; or ↑ ↓ on the handle
     (keyboard), announced in a polite live region. FileList numbers the rows ("01", "02"…) in the shown order,
     so positions follow the preview while dragging. */
  var FileListContext = React.createContext(null);

  var blankImage = null;   // a transparent 1×1 image, to replace the browser drag image
  function blankDragImage() {
    if (!blankImage) { blankImage = new Image(1, 1); blankImage.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'; }
    return blankImage;
  }

  /* useDragOrder (decision 0129: the one drag & drop of the admin, extracted from FileList). A list whose rows the
     user reorders by dragging (pointer) or with ↑ ↓ on a handle (keyboard). While dragging, the DOM keeps the old
     order and the rows are translated to where they would be after the drop (the others shift live); committed on
     drop, reverted on dragend elsewhere. Moving DOM nodes during a native drag would cancel the drop in Chromium.
     opts: count, keyOf(i), nameOf(i), onMove(from, to) (null = fixed order), handleSelector (the handle that keeps the
     focus after a keyboard move). Returns { listRef, listProps, rowProps(i), slot(i), keyboardMove(from, to), drag, live }:
     the caller spreads listProps on the list element (<ol>, <ul>, <tbody>) and rowProps(i) on each row. */
  function useDragOrder(opts) {
    var listRef = React.useRef(null);
    var tops = React.useRef({});          // layout top of each row by key, for the keyboard-move slide (FLIP)
    var focusKey = React.useRef(null);    // keyboard move: the row whose handle keeps the focus
    var dropped = React.useRef(false);    // drop: the preview becomes the order, without sliding again
    // drag = { from, to, rows: [{ top, height }], gap, grab, over }
    var dragState = React.useState(null), drag = dragState[0], setDrag = dragState[1];
    var dragRef = React.useRef(null);
    var liveState = React.useState(''), live = liveState[0], setLive = liveState[1];
    var move = opts.onMove, count = opts.count;
    React.useEffect(function () { if (move) blankDragImage(); }, [!!move]);   // loaded before the first drag

    function update(next) { dragRef.current = next; setDrag(next); }
    function itemName(i) { return (opts.nameOf && opts.nameOf(i)) || ('item ' + (i + 1)); }
    function commit(from, to, viaKeyboard) {
      if (from === to) return;
      if (viaKeyboard) focusKey.current = opts.keyOf(from); else dropped.current = true;
      setLive(itemName(from) + ', position ' + (to + 1) + ' of ' + count);
      move(from, to);
    }
    // where row i shows (0-based) and how far it is translated, for the current preview
    function slot(i) {
      if (!drag || drag.from === drag.to) return { pos: i, dy: 0 };
      var f = drag.from, t = drag.to, r = drag.rows, step = r[f].height + drag.gap;
      if (i === f) return { pos: t, dy: t > f ? r[t].top + r[t].height - r[f].top - r[f].height : r[t].top - r[f].top };
      if (f < t && i > f && i <= t) return { pos: i - 1, dy: -step };
      if (t < f && i >= t && i < f) return { pos: i + 1, dy: step };
      return { pos: i, dy: 0 };
    }

    React.useLayoutEffect(function () {
      var list = listRef.current; if (!list) return;
      var animate = !dropped.current && !(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
      var settle = dropped.current; dropped.current = false;
      var next = {};
      Array.prototype.forEach.call(list.children, function (li) {
        var key = li.getAttribute('data-key');
        if (key === null) return;
        next[key] = li.offsetTop;
        var dy = tops.current[key] !== undefined ? tops.current[key] - li.offsetTop : 0;
        if (settle) {                       // the preview translate is gone and the row is in its new DOM place: no slide
          li.style.transition = 'none'; li.getBoundingClientRect(); li.style.transition = '';
        } else if (dy && animate) {         // keyboard move: slide from the old place
          li.style.transition = 'none'; li.style.transform = 'translateY(' + dy + 'px)';
          li.getBoundingClientRect();
          li.style.transition = ''; li.style.transform = '';
        }
      });
      tops.current = next;
      if (focusKey.current !== null) {
        var handle = list.querySelector('[data-key="' + focusKey.current + '"] ' + (opts.handleSelector || '.zz-drag-handle'));
        focusKey.current = null;
        if (handle && document.activeElement !== handle) handle.focus();
      }
    });

    function onDragStart(i, e) {
      // selecting text in a field of the row (e.g. a sample title) must not drag the row
      if (e.target.closest && e.target.closest('input, textarea, select')) { e.preventDefault(); return; }
      e.dataTransfer.effectAllowed = 'move';
      try { e.dataTransfer.setData('text/plain', itemName(i)); } catch (err) { /* Firefox starts a drag only with data */ }
      var list = listRef.current, lis = list.children, listTop = list.getBoundingClientRect().top;
      // measured from the list's own box, so it works for a <tbody> too (its rows' offsetParent is the table)
      var rows = Array.prototype.map.call(lis, function (li) { var b = li.getBoundingClientRect(); return { top: b.top - listTop, height: b.height }; });
      // no browser drag image (a static snapshot): the row itself follows the pointer, so its position number
      // follows the preview, and the list shows the empty slot where it will land
      if (blankDragImage().complete && e.dataTransfer.setDragImage) e.dataTransfer.setDragImage(blankDragImage(), 0, 0);
      var li = lis[i];
      update({ from: i, to: i, rows: rows, gap: parseFloat(getComputedStyle(list).rowGap) || 0,
        grab: e.clientY - li.getBoundingClientRect().top });
      function follow(ev) {             // document-wide, so the row keeps following outside the list
        var d = dragRef.current; if (!d || !ev.clientY) return;
        li.style.transform = 'translateY(' + (ev.clientY - list.getBoundingClientRect().top - d.grab - d.rows[d.from].top) + 'px)';
      }
      document.addEventListener('dragover', follow);
      li.addEventListener('dragend', function stop() {
        document.removeEventListener('dragover', follow); li.removeEventListener('dragend', stop);
        li.style.transform = '';         // back to its slot (or, after a drop, it already is in the new one)
      });
    }
    // the slot of the dragged row: how many other rows have their middle above its middle, measured on the list
    // without the dragged row (fixed geometry, so the rows don't flicker while they shift)
    function slotAt(clientY) {
      var d = dragRef.current, r = d.rows, step = r[d.from].height + d.gap;
      var mid = clientY - listRef.current.getBoundingClientRect().top - d.grab + r[d.from].height / 2, n = 0;
      r.forEach(function (row, k) {
        if (k === d.from) return;
        if (row.top - (k > d.from ? step : 0) + row.height / 2 < mid) n++;
      });
      return n;
    }

    var listProps = !move ? { ref: listRef } : {
      ref: listRef,
      'data-dragging': drag ? 'true' : undefined,
      onDragOver: function (e) {
        var d = dragRef.current; if (!d) return;
        e.preventDefault();
        var to = slotAt(e.clientY);
        if (to !== d.to || !d.over) update(Object.assign({}, d, { to: to, over: true }));
      },
      // left the list (or Escape, which fires a dragleave): on dragend the old order comes back
      onDragLeave: function (e) {
        var d = dragRef.current; if (!d) return;
        var b = listRef.current.getBoundingClientRect();
        if (e.clientX <= b.left || e.clientX >= b.right || e.clientY <= b.top || e.clientY >= b.bottom) update(Object.assign({}, d, { over: false }));
      },
      onDrop: function (e) {
        var d = dragRef.current; if (!d) return;
        e.preventDefault(); update(null); commit(d.from, d.to);
      }
    };
    function rowProps(i) {
      var s = slot(i), key = opts.keyOf(i);
      return {
        key: key,
        'data-key': key,
        'data-dragged': drag && drag.from === i ? 'true' : undefined,
        style: s.dy && !(drag && drag.from === i) ? { transform: 'translateY(' + s.dy + 'px)' } : undefined,   // the dragged row follows the pointer (set in onDragStart)
        draggable: move ? true : undefined,
        onDragStart: move ? function (e) { onDragStart(i, e); } : undefined,
        // Chromium fires no drop when the pointer is over the drag source, and the dragged row is translated under it:
        // so dragend commits the preview while the pointer is still on the list, and reverts it otherwise
        onDragEnd: move ? function () { var d = dragRef.current; if (!d) return; update(null); if (d.over) commit(d.from, d.to); } : undefined
      };
    }
    return { listRef: listRef, listProps: listProps, rowProps: rowProps, slot: slot, drag: drag, live: live,
      keyboardMove: move ? function (from, to) { commit(from, to, true); } : null };
  }

  /* DragHandle (Figma: `drag handle` = icon `bars-three` 24, in `file item`, `listing row`, `listings table row`;
     decision 0129): the chromeless 24 × 24 button that starts a keyboard move (↑ ↓) of its row. Pointer drags start
     on the whole row (useDragOrder). */
  function DragHandle(props) {
    function onKey(e) {
      if (e.key === 'ArrowUp' && props.index > 0) { e.preventDefault(); props.onMove(props.index, props.index - 1); }
      if (e.key === 'ArrowDown' && props.index < props.count - 1) { e.preventDefault(); props.onMove(props.index, props.index + 1); }
    }
    return h('button', Object.assign({ type: 'button' }, omit(props, ['index', 'count', 'onMove', 'name', 'className', 'label']), {
      className: cx('zz-drag-handle', props.className),
      'aria-label': props.label || ('Move ' + (props.name || 'item') + ', position ' + (props.index + 1) + ' of ' + props.count + ' (arrow up / down)'),
      onKeyDown: props.onMove ? onKey : undefined
    }), h('span', { className: 'zz-drag-handle__icon', 'aria-hidden': 'true' }, h(DragHandleIcon)));
  }

  function FileList(props) {
    var items = React.Children.toArray(props.children);
    var move = props.onMove;
    var d = useDragOrder({ count: items.length, onMove: move, handleSelector: '.zz-file-item__handle',
      keyOf: function (i) { return items[i].key || i; },
      nameOf: function (i) { var c = items[i]; return c && c.props && c.props.name; } });
    return h(React.Fragment, null,
      h('ol', Object.assign({ className: cx('zz-file-list', props.className) }, d.listProps, omit(props, ['onMove', 'children', 'className'])),
        items.map(function (child, i) {
          var s = d.slot(i);
          return h('li', Object.assign({ className: 'zz-file-list__item' }, d.rowProps(i)),
            h(FileListContext.Provider, { value: { index: s.pos, count: items.length, move: d.keyboardMove } }, child));
        })),
      move ? h('span', { className: 'zz-file-list__status', role: 'status', 'aria-live': 'polite' }, d.live) : null);
  }

  function FileItem(props) {
    var ctx = React.useContext(FileListContext) || { index: 0, count: 1 };
    var position = props.position !== undefined ? props.position : String(ctx.index + 1).padStart(2, '0');
    var name = props.name;
    var playable = !!props.onTogglePlay;
    var hasBody = !!props.children;
    var remove = props.onRemove ? h(IconButton, { className: 'zz-file-item__remove', icon: h(CloseIcon), 'aria-label': props.removeLabel || ('Remove ' + name), onClick: props.onRemove }) : null;
    return h('div', Object.assign({
      className: cx('zz-file-item', props.className),
      'data-media': props.image ? 'image' : (playable ? 'audio' : undefined),
      'data-body': hasBody ? 'true' : undefined
    }, omit(props, ['name', 'position', 'image', 'featured', 'featuredLabel', 'playing', 'onTogglePlay', 'onRemove', 'removeLabel', 'reorderLabel', 'className', 'children'])),
      ctx.move ? h(DragHandle, { className: 'zz-file-item__handle', index: ctx.index, count: ctx.count, onMove: ctx.move, name: name, label: props.reorderLabel }) : null,
      // with children (e.g. the sample title Input, Figma `sample row` 2095:20507): a full-width column,
      // `file row` (content + remove, gap 16) above the children (gap 16)
      h(hasBody ? 'div' : React.Fragment, hasBody ? { className: 'zz-file-item__body' } : null,
      h(hasBody ? 'div' : React.Fragment, hasBody ? { className: 'zz-file-item__row' } : null,
      h('div', { className: 'zz-file-item__content' },
        props.image ? h('span', { className: 'zz-file-item__thumb' }, props.image.src ? h('img', { src: props.image.src, alt: props.image.alt || '' }) : null) : null,
        playable ? h(IconButton, { 'data-playing': props.playing ? 'true' : 'false', 'aria-pressed': !!props.playing, 'aria-label': (props.playing ? 'Pause ' : 'Play ') + name,
          icon: h(PlayPauseIcons), onClick: props.onTogglePlay }) : null,
        h('span', { className: 'zz-file-item__position body-medium' }, position),
        h('span', { className: 'zz-file-item__name body-medium' }, name),
        props.featured ? h('span', { className: 'zz-file-item__featured body-medium' }, props.featuredLabel || '(featured)') : null),
      hasBody ? remove : null),
      props.children || null),
      hasBody ? null : remove);
  }

  /* ── Alert ──────────────────────────────────────────────────────────────
     Figma: page `Bag` → `alert` (2026-11-14, decision 0077): a message that blocks an action or changes what the user
     gets (records left out of the order), in an alert box (surface-alert). Padding 8
     (small), surface/alert, text body/small in text/strong-invert, fills its container. A <p>: the consumer adds the
     live region / id it needs (the bag's minimum note is aria-live polite and Checkout's aria-describedby). Figma
     `layout`: block (default, a <p>) | inline (a <span>, padding 2/4 as Tag extra-small, hugs: bag item SOLD OUT /
     RESERVED, decision 0078). Not a toast:
     it stays as long as the condition holds. */
  function Alert(props) {
    var inline = props.layout === 'inline';
    return h(inline ? 'span' : 'p', Object.assign({}, omit(props, ['className', 'children', 'layout']),
      { className: cx('zz-alert body-small', props.className), 'data-layout': inline ? 'inline' : 'block' }), props.children);
  }

  /* ── Divider ────────────────────────────────────────────────────────────
     Figma: page `divider` → `divider` (2026-11-10): 1px, border/divider/strong, fills its container. Between the sections
     of the admin form. A native <hr> (a thematic break for screen readers). */
  function Divider(props) {
    return h('hr', Object.assign({}, omit(props, ['className']), { className: cx('zz-divider', props.className) }));
  }


  /* ── Trade (Figma page `Trade`, proposal 2026-11-12) ─────────────────────
     TradeNote: `trade note` — title label/small, body body/medium, signature body/small text/moderate; gap 8 (small).
     DiscogsCard: `discogs card` — 1px border-divider/strong, padding 8 (small), gap 4: label body/small text/moderate,
       handle body/large, stats body/medium, link body/medium underlined (boolean `link`).
     Step: `step` (was `trade step`, decision 0152) — number label/large (24 wide) + title label/medium + body body/medium; gap 16 (medium-small), text gap 4. */
  function TradeNote(props) {
    return h('div', Object.assign({}, omit(props, ['title', 'signature', 'className', 'children', 'headingLevel']), { className: cx('zz-trade-note', props.className) }),
      h('h' + (props.headingLevel || 2), { className: 'zz-trade-note__title label-small' }, props.title || 'Why it’s not for sale'),
      h('div', { className: 'zz-trade-note__body body-medium' }, props.children),
      props.signature ? h('p', { className: 'zz-trade-note__signature body-small' }, props.signature) : null);
  }
  function DiscogsCard(props) {
    return h('div', Object.assign({}, omit(props, ['label', 'handle', 'stats', 'href', 'linkLabel', 'className']), { className: cx('zz-discogs-card', props.className) }),
      h('p', { className: 'zz-discogs-card__label body-small' }, props.label || 'On Discogs'),
      h('p', { className: 'zz-discogs-card__handle body-large' }, props.handle),
      props.stats ? h('p', { className: 'zz-discogs-card__stats body-medium' }, props.stats) : null,
      props.href ? h('a', { className: 'zz-discogs-card__link body-medium', href: props.href, target: '_blank', rel: 'noopener' },
        props.linkLabel || 'View profile', h('span', { 'aria-hidden': 'true' }, ' ↗'), h('span', { className: 'zz-visually-hidden' }, ' (opens in a new tab)')) : null);
  }
  /* ── Discogs release picker (Figma page `Trade`: `release option`, `release list`, `chosen release`, `which record`) ──
     The "Which record" field of the offer form. These render the markup; apps/storefront/scripts/site.js builds the same
     markup in the browser while the trader types (keep the two in step).
     ReleaseOption: thumb 40 + title body/medium + meta body/small text/moderate; padding/gap 8 (small);
       highlighted (active option) = surface/subtle.
     ReleaseList: 1px border-divider/strong on surface/base; options, or a message; "Data from Discogs" footer always.
     ChosenRelease: same row in a 1px border-divider/strong box, Discogs link under the text, Change at the end. */
  function ReleaseOption(props) {
    return h('li', Object.assign({ role: 'option', 'aria-selected': props.highlighted ? 'true' : 'false' },
      omit(props, ['title', 'meta', 'thumb', 'highlighted', 'className']),
      { className: cx('zz-release-option', props.className), 'data-highlighted': props.highlighted ? 'true' : undefined }),
      props.thumb ? h('img', { className: 'zz-release-option__thumb', src: props.thumb, alt: '', width: 40, height: 40, loading: 'lazy' })
        : h('span', { className: 'zz-release-option__thumb', 'aria-hidden': 'true' }),
      h('span', { className: 'zz-release-option__text' },
        h('span', { className: 'zz-release-option__title body-medium' }, props.title),
        props.meta ? h('span', { className: 'zz-release-option__meta body-small' }, props.meta) : null));
  }
  function ReleaseList(props) {
    return h('div', Object.assign({}, omit(props, ['listId', 'label', 'message', 'source', 'className', 'children']),
      { className: cx('zz-release-list', props.className) }),
      props.message ? h('p', { className: 'zz-release-list__message body-small' }, props.message)
        : h('ul', { className: 'zz-release-list__options', role: 'listbox', id: props.listId, 'aria-label': props.label }, props.children),
      h('p', { className: 'zz-release-list__source body-small' }, props.source || 'Data from Discogs'));
  }
  function ChosenRelease(props) {
    return h('div', Object.assign({}, omit(props, ['title', 'meta', 'thumb', 'href', 'linkLabel', 'changeLabel', 'onChange', 'className']),
      { className: cx('zz-chosen-release', props.className) }),
      props.thumb ? h('img', { className: 'zz-release-option__thumb', src: props.thumb, alt: '', width: 40, height: 40 })
        : h('span', { className: 'zz-release-option__thumb', 'aria-hidden': 'true' }),
      h('span', { className: 'zz-release-option__text' },
        h('span', { className: 'zz-release-option__title body-medium' }, props.title),
        props.meta ? h('span', { className: 'zz-release-option__meta body-small' }, props.meta) : null,
        props.href ? h('a', { className: 'zz-chosen-release__link body-small', href: props.href, target: '_blank', rel: 'noopener' },
          props.linkLabel || 'On Discogs', h('span', { 'aria-hidden': 'true' }, ' ↗'), h('span', { className: 'zz-visually-hidden' }, ' (opens in a new tab)')) : null),
      h('button', { type: 'button', className: 'zz-chosen-release__change body-small', onClick: props.onChange }, props.changeLabel || 'Change'));
  }
  /* ── Memo item (Figma BACKEND → Memo › `memo item`, decision 0087) ──
     One record on the admin Memo list. Text column: title body/medium text/strong, meta body/small text/moderate,
     note body/small, "On Discogs ↗" body/small underlined; actions = two secondary small Buttons (Create listing, Remove).
     Row: padding 16 top/bottom, gap 8, 1px border-divider/strong at the bottom. device=mobile stacks the actions under
     the text; desktop puts them on the right, centred (CSS @media, one markup). */
  function MemoItem(props) {
    var name = typeof props.title === 'string' ? props.title : 'record';
    return h('li', Object.assign({}, omit(props, ['title', 'meta', 'note', 'href', 'select', 'onCreateDraft', 'onCreate', 'onRemove', 'createDraftLabel', 'createDraftBusy', 'createLabel', 'removeLabel', 'className']),
      { className: cx('zz-memo-item', props.className) }),
      // Figma boolean `select` (decision 0140): the row's checkbox, first
      props.select ? h('div', { className: 'zz-memo-item__select' }, props.select) : null,
      h('div', { className: 'zz-memo-item__text' },
        h('p', { className: 'zz-memo-item__title body-medium' }, props.title),
        props.meta ? h('p', { className: 'zz-memo-item__meta body-small' }, props.meta) : null,
        props.note ? h('p', { className: 'zz-memo-item__note body-small' }, props.note) : null,
        props.href ? h('a', { className: 'zz-memo-item__link body-small', href: props.href, target: '_blank', rel: 'noopener' },
          'On Discogs', h('span', { 'aria-hidden': 'true' }, ' ↗'), h('span', { className: 'zz-visually-hidden' }, ' (opens in a new tab)')) : null),
      h('div', { className: 'zz-memo-item__actions' },
        // Figma boolean `create draft` (decision 0135): a draft in one tap, no form; busy = "Creating…", disabled
        props.onCreateDraft ? h(Button, { hierarchy: 'secondary', size: 'small', onClick: props.createDraftBusy ? undefined : props.onCreateDraft,
          'aria-busy': props.createDraftBusy || undefined, 'aria-disabled': props.createDraftBusy || undefined,
          'aria-label': (props.createDraftBusy ? 'Creating draft' : props.createDraftLabel || 'Create draft') + ': ' + name },
          props.createDraftBusy ? 'Creating…' : props.createDraftLabel || 'Create draft') : null,
        props.onCreate ? h(Button, { hierarchy: 'secondary', size: 'small', onClick: props.onCreate, 'aria-label': (props.createLabel || 'Create listing') + ': ' + name }, props.createLabel || 'Create listing') : null,
        props.onRemove ? h(Button, { hierarchy: 'secondary', size: 'small', onClick: props.onRemove, 'aria-label': (props.removeLabel || 'Remove') + ': ' + name }, props.removeLabel || 'Remove') : null));
  }
  /* BackLink (Figma `admin` → `back link`): a text link back to a list, above a detail/edit page title. An <a>,
     body/small text/moderate, "← " + label; hover underlines. Used by Edit listing (→ the matching Listings tab). */
  function BackLink(props) {
    return h('a', Object.assign({}, omit(props, ['href', 'label', 'className']),
      { className: cx('zz-back-link body-small', props.className), href: props.href }),
      '\u2190 ', props.label);
  }
  /* DiscogsLink (Figma BACKEND → Create › `discogs link`, decision 0150): the Discogs release a listing is matched to,
     opening in a new tab. Same grammar as the "On Discogs ↗" link of MemoItem / ChosenRelease: body/small, underlined,
     text colour inherited (text/strong). Screen readers also hear "(opens in a new tab)". */
  function DiscogsLink(props) {
    return h('a', Object.assign({}, omit(props, ['href', 'label', 'className']),
      { className: cx('zz-discogs-link body-small', props.className), href: props.href, target: '_blank', rel: 'noopener' }),
      props.label || 'On Discogs', h('span', { 'aria-hidden': 'true' }, ' \u2197'), h('span', { className: 'zz-visually-hidden' }, ' (opens in a new tab)'));
  }
  /* ── Bulk create (Figma BACKEND → Bulk, decision 0107) ──
     BulkRecord (`bulk record`, device mobile | desktop, state reading | matched | choose | not found | confirmed | skipped,
     boolean `warning`): one record found in the dropped files, MemoItem grammar. Text column: title body/medium
     text/strong, meta body/small text/moderate, files body/small, then (reading) a ProgressBar, the status line
     (support text, body/small text/strong) and the warning (support text, emphasis alert); actions = Review, Remove
     (secondary small). Row padding 16 / 0, gap 8, bottom border divider/strong; desktop: actions on the right, top.
     BulkHelp (`bulk naming help`): heading body/medium + lines body/small, example body/small text/moderate; gap 4. */
  function BulkRecord(props) {
    var name = typeof props.title === 'string' ? props.title : 'record';
    var reading = props.state === 'reading';
    var uploading = !reading && props.uploadProgress != null;
    return h('li', Object.assign({}, omit(props, ['title', 'meta', 'files', 'status', 'warning', 'progress', 'uploadProgress', 'state', 'onReview', 'onRemove', 'reviewLabel', 'removeLabel', 'className']),
      { className: cx('zz-bulk-record', props.className), 'data-state': props.state || undefined }),
      h('div', { className: 'zz-bulk-record__text' },
        h('p', { className: 'zz-bulk-record__title body-medium' }, props.title),
        props.meta ? h('p', { className: 'zz-bulk-record__meta body-small' }, props.meta) : null,
        props.files ? h('p', { className: 'zz-bulk-record__files body-small' }, props.files) : null,
        reading ? h(ProgressBar, { className: 'zz-bulk-record__progress', value: props.progress || 0, 'aria-label': 'Reading ' + name }) : null,
        // files still converting / uploading (decision 0108): the same bar, under the files line
        uploading ? h(ProgressBar, { className: 'zz-bulk-record__progress', value: props.uploadProgress, 'aria-label': 'Uploading the files of ' + name }) : null,
        props.status ? h('p', { className: 'zz-bulk-record__status body-small' }, props.status) : null,
        props.warning ? h('p', { className: 'zz-bulk-record__warning body-small' }, props.warning) : null),
      reading ? null : h('div', { className: 'zz-bulk-record__actions' },
        props.onReview ? h(Button, { hierarchy: 'secondary', size: 'small', onClick: props.onReview, 'aria-label': (props.reviewLabel || 'Review') + ': ' + name }, props.reviewLabel || 'Review') : null,
        props.onRemove ? h(Button, { hierarchy: 'secondary', size: 'small', onClick: props.onRemove, 'aria-label': (props.removeLabel || 'Remove') + ': ' + name }, props.removeLabel || 'Remove') : null));
  }
  function BulkHelp(props) {
    return h('div', Object.assign({}, omit(props, ['heading', 'lines', 'example', 'className']), { className: cx('zz-bulk-help', props.className) }),
      h('p', { className: 'zz-bulk-help__heading body-medium' }, props.heading),
      (props.lines || []).map(function (l, i) { return h('p', { key: i, className: 'zz-bulk-help__line body-small' }, l); }),
      props.example ? h('p', { className: 'zz-bulk-help__example body-small' }, props.example) : null);
  }
  /* ── Admin Content (Figma BACKEND → Content, decision 0106) ──
     ContentGroupHead (`content group head`): heading label/medium + help body/small text/moderate, gap 4.
     ContentRow (`content row`, device desktop | mobile, one responsive markup): an <li>, MemoItem grammar: text (title
     body/medium · where body/small text/moderate · edited body/small · condition body/small, booleans `has edited`,
     `has condition`) + Edit (Button secondary small, a link). Padding 16 / 0, gap 16, bottom border divider/strong;
     mobile: stacked, gap 8.
     ContentEditorHead (`content editor head`): back link (body/small, underlined) · title row (h1 label-extra-large,
     the admin page title, + actions: View on shop secondary, Save primary; the actions hide on mobile, where the page
     puts them in an ActionBar) · where (body/small text/moderate). Gap 8, title row gap 16.
     LinkRow (`link row`, layout inline | stacked): Label + Link (two Inputs) + Remove; inline = label 160, link fills.
     SectionRow (`section row`): heading Input + text Input (text area) + Remove, gap 8. Also the steps of How trading works. */
  function ContentGroupHead(props) {
    var Tag = 'h' + (props.headingLevel || 2);
    return h('div', Object.assign({}, omit(props, ['heading', 'help', 'headingLevel', 'className']), { className: cx('zz-content-group-head', props.className) }),
      h(Tag, { className: 'label-medium', id: props.headingId }, props.heading),
      props.help ? h('p', { className: 'zz-content-group-head__help body-small' }, props.help) : null);
  }
  function ContentRow(props) {
    var name = typeof props.title === 'string' ? props.title : 'text';
    return h('li', Object.assign({}, omit(props, ['title', 'where', 'edited', 'condition', 'href', 'editLabel', 'className']), { className: cx('zz-content-row', props.className) }),
      h('div', { className: 'zz-content-row__text' },
        h('p', { className: 'body-medium' }, props.title),
        props.where ? h('p', { className: 'zz-content-row__where body-small' }, props.where) : null,
        props.edited ? h('p', { className: 'body-small' }, props.edited) : null,
        props.condition ? h('p', { className: 'body-small' }, props.condition) : null),
      h(Button, { hierarchy: 'secondary', size: 'small', href: props.href, 'aria-label': (props.editLabel || 'Edit') + ': ' + name }, props.editLabel || 'Edit'));
  }
  function ContentEditorHead(props) {
    return h('div', Object.assign({}, omit(props, ['backHref', 'backLabel', 'title', 'where', 'actions', 'className']), { className: cx('zz-content-editor-head', props.className) }),
      h('a', { className: 'zz-content-editor-head__back body-small', href: props.backHref }, '\u2190 ', props.backLabel || 'Content'),
      h('div', { className: 'zz-content-editor-head__title-row' },
        h('h1', { className: 'label-extra-large' }, props.title),
        props.actions ? h('div', { className: 'zz-content-editor-head__actions' }, props.actions) : null),
      props.where ? h('p', { className: 'zz-content-editor-head__where body-small' }, props.where) : null);
  }
  function LinkRow(props) {
    return h('div', Object.assign({}, omit(props, ['label', 'link', 'onRemove', 'removeLabel', 'layout', 'className']),
      { className: cx('zz-link-row', props.className), 'data-layout': props.layout || 'inline' }),
      h('div', { className: 'zz-link-row__label' }, props.label),
      h('div', { className: 'zz-link-row__link' }, props.link),
      props.onRemove ? h(Button, { hierarchy: 'secondary', size: 'small', type: 'button', onClick: props.onRemove }, props.removeLabel || 'Remove') : null);
  }
  function SectionRow(props) {
    return h('div', Object.assign({}, omit(props, ['heading', 'text', 'onRemove', 'removeLabel', 'className']), { className: cx('zz-section-row', props.className) }),
      props.heading, props.text,
      props.onRemove ? h('div', null, h(Button, { hierarchy: 'secondary', size: 'small', type: 'button', onClick: props.onRemove }, props.removeLabel || 'Remove')) : null);
  }
  /* ── ProgressBar (Figma BACKEND → Memo → `progress bar`, decision 0091) ──
     Determinate bar: track surface/subtle, value action/primary/background/default, 4px high, square ends.
     value 0–100. role=progressbar + aria-valuenow; the visible status text stays next to it. */
  function ProgressBar(props) {
    var v = Math.max(0, Math.min(100, Math.round(Number(props.value) || 0)));
    return h('div', Object.assign({ role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-valuenow': v },
      omit(props, ['value', 'className']), { className: cx('zz-progress-bar', props.className) }),
      h('div', { className: 'zz-progress-bar__value', style: { width: v + '%' } }));
  }
  /* ── AdminBar (Figma page `admin` → `admin bar`, device=desktop | mobile, decision 0089) ──
     One responsive markup. desktop: section Buttons (secondary small, state=active = the section you are on, 0045)
     · the signed-in email (body/small text/moderate) + Sign out.
     mobile (--mobile): Menu Button (secondary, bars icon, like the shop header) · title (label/medium),
     padding page-margin/mobile, bottom border divider/strong; the sections and Sign out live in the page's menu dialog
     (MenuLayer), opened by onMenuClick. No Create here since decision 0125: Create listing and Bulk create are actions
     of the Listings page (ListingsHead). */
  function AdminBar(props) {
    var items = props.items || [];
    return h('header', Object.assign({}, omit(props, ['items', 'title', 'email', 'onSignOut', 'signOutLabel',
      'onMenuClick', 'menuLabel', 'menuProps', 'navLabel', 'className']), { className: cx('zz-admin-bar', props.className) }),
      h('div', { className: 'zz-admin-bar__desktop' },
        h('nav', { className: 'zz-admin-bar__nav', 'aria-label': props.navLabel || 'Admin' },
          items.map(function (it) {
            return h(Button, { key: it.href, hierarchy: 'secondary', size: 'small', href: it.href, state: it.current ? 'active' : undefined }, it.label);
          })),
        h('div', { className: 'zz-admin-bar__account' },
          props.email ? h('span', { className: 'zz-admin-bar__email body-small' }, props.email) : null,
          props.onSignOut ? h(Button, { hierarchy: 'secondary', size: 'small', onClick: props.onSignOut }, props.signOutLabel || 'Sign out') : null)),
      h('div', { className: 'zz-admin-bar__mobile' },
        h(Button, Object.assign({ className: 'zz-admin-bar__menu', hierarchy: 'secondary', leadingIcon: h(HamburgerIcon),
          'aria-label': props.menuLabel || 'Menu', onClick: props.onMenuClick }, props.menuProps)),
        h('p', { className: 'zz-admin-bar__title label-medium' }, props.title || 'Store admin')));
  }
  /* ── ListingsHead (Figma BACKEND → Listings → `listings head`, device=desktop | mobile, decision 0125) ──
     The Listings page title (h1 label-extra-large, the `admin page title`) + the ways to add records: Bulk create
     (secondary) and Create listing (primary), gap 16, links. Desktop: one row, actions on the right, centred.
     Mobile (--mobile): the actions go under the title, gap 16 (the uppercase labels do not fit beside it at 343). */
  function ListingsHead(props) {
    return h('div', Object.assign({}, omit(props, ['title', 'createHref', 'createLabel', 'bulkHref', 'bulkLabel', 'className']), { className: cx('zz-listings-head', props.className) }),
      h('h1', { className: 'zz-listings-head__title label-extra-large' }, props.title || 'Listings'),
      h('div', { className: 'zz-listings-head__actions' },
        props.bulkHref ? h(Button, { hierarchy: 'secondary', href: props.bulkHref }, props.bulkLabel || 'Bulk create') : null,
        props.createHref ? h(Button, { hierarchy: 'primary', href: props.createHref }, props.createLabel || 'Create listing') : null));
  }
  /* ── Stat (Figma BACKEND → Dashboard → `stat`, decision 0169) ──────────────
     One figure of the admin Dashboard: 1px divider on top, padding-top 12, gap 4; label (body/small, moderate),
     value (label/extra-large), optional note (body/small, moderate) and optional link (body/small, underlined).
     Figma booleans `note` / `link` = the props being set. */
  function Stat(props) {
    return h('div', Object.assign({}, omit(props, ['label', 'value', 'note', 'href', 'linkLabel', 'className']), { className: cx('zz-stat', props.className) }),
      h('p', { className: 'zz-stat__label body-small' }, props.label),
      h('p', { className: 'zz-stat__value label-extra-large' }, props.value),
      props.note ? h('p', { className: 'zz-stat__note body-small' }, props.note) : null,
      props.href ? h('a', { className: 'zz-stat__link body-small', href: props.href }, props.linkLabel || 'View') : null);
  }
  /* ── ListingsFilter (Figma BACKEND → Listings → `listings filter`, device=desktop | mobile, decision 0128) ──
     The status tabs of the Listings page (Live · Drafts · Sold · Archived, a <Tabs>) + the search field that filters
     the rows (an <Input variant="search">). Desktop: one row, tabs left, search 280 right, centred, gap 16.
     Mobile (--mobile): the tabs (they scroll sideways) then the search full width, gap 16. */
  function ListingsFilter(props) {
    return h('div', Object.assign({}, omit(props, ['tabs', 'search', 'className']), { className: cx('zz-listings-filter', props.className) }),
      h('div', { className: 'zz-listings-filter__tabs' }, props.tabs),
      props.search ? h('div', { className: 'zz-listings-filter__search' }, props.search) : null);
  }
  /* ── Thumbnail (Figma `product image` (page `media`) at 40 × 40, decision 0123) ──
     The record's photo in an admin list (ListingRow, the Listings table). Decorative: the row's title names the record,
     so alt is empty and the box is hidden from screen readers. No photo → the empty square (surface/media). */
  function Thumbnail(props) {
    return h('span', Object.assign({}, omit(props, ['src', 'srcSet', 'sizes', 'alt', 'className']), { className: cx('zz-thumbnail', props.className), 'aria-hidden': props.alt ? undefined : 'true' }),
      props.src ? h('img', { src: props.src, srcSet: props.srcSet, sizes: props.srcSet ? props.sizes || '40px' : undefined, alt: props.alt || '',
        width: 40, height: 40, loading: 'lazy', decoding: 'async' }) : null);
  }
  /* ── ListingRow (Figma page `admin` → `listing row`, decision 0089) ──
     One row of an admin list on mobile (Listings, Attributes), in place of the table row. Same grammar as MemoItem:
     select (a Checkbox, label hidden) · text (title link body/small underlined, meta body/small text/moderate, gap 4)
     · price (body/small, right). Padding 16 top/bottom, gap 16, bottom border divider/strong. */
  function ListingRow(props) {
    return h(props.as || 'li', Object.assign({}, omit(props, ['as', 'handle', 'select', 'image', 'title', 'href', 'meta', 'price', 'className']), { className: cx('zz-listing-row', props.className) }),
      props.handle || null,   // Figma boolean `handle` (decision 0129): a DragHandle, first
      props.select ? h('div', { className: 'zz-listing-row__select' }, props.select) : null,
      // Figma boolean `show thumbnail` (decision 0123): an `image` object, even without src (= the empty square)
      props.image ? h(Thumbnail, Object.assign({ className: 'zz-listing-row__thumb' }, props.image)) : null,
      h('div', { className: 'zz-listing-row__text' },
        h('a', { className: 'zz-listing-row__title body-small', href: props.href }, props.title),
        props.meta ? h('p', { className: 'zz-listing-row__meta body-small' }, props.meta) : null),
      props.price ? h('p', { className: 'zz-listing-row__price body-small' }, props.price) : null);
  }
  /* ── OfferRow (Figma BACKEND → Offers → `offer row`, device=desktop | mobile, state=new | decided; decision 0158) ──
     One offer in admin → Offers. record = a ListingRow (price = the offer) without its own padding and border ·
     buyer (body/small: who and where, the note, the date in text/moderate, gap 4) · new: `actions` (Accept / Decline
     Buttons, gap 8) · decided: `status` (body/small, 195 wide). Padding 16 top/bottom, gap 16, bottom border
     divider/strong. desktop: in a row, record 400; mobile: stacked. Booleans: `show note` (on). */
  function OfferRow(props) {
    var r = props.record || {};
    return h('li', Object.assign({}, omit(props, ['record', 'buyer', 'note', 'date', 'actions', 'status', 'className']), { className: cx('zz-offer-row', props.className) }),
      h(ListingRow, { as: 'div', className: 'zz-offer-row__record', image: r.image, title: r.title, href: r.href, meta: r.meta, price: r.price }),
      h('div', { className: 'zz-offer-row__buyer body-small' },
        h('p', null, props.buyer),
        props.note ? h('p', { className: 'zz-offer-row__note' }, props.note) : null,
        props.date ? h('p', { className: 'zz-offer-row__date' }, props.date) : null),
      props.actions ? h('div', { className: 'zz-offer-row__actions' }, props.actions)
        : props.status ? h('p', { className: 'zz-offer-row__status body-small' }, props.status) : null);
  }
  /* ── ActionBar (Figma page `admin` → `action bar`, decision 0089) ──
     The ActionPanel buttons of a form on mobile, in a bar that stays at the bottom of the viewport (position: sticky,
     so at the end of the page it sits in its place and covers nothing). Fill surface/base, top border divider/strong,
     padding medium-small, buttons side by side, gap 8. `children` = the Buttons (primary first); `status` = an optional
     line above them (the save result: it must be visible where the button was pressed). */
  function ActionBar(props) {
    return h('div', Object.assign({}, omit(props, ['className', 'children', 'status']), { className: cx('zz-action-bar', props.className) }),
      props.status ? h('div', { className: 'zz-action-bar__status' }, props.status) : null,
      h('div', { className: 'zz-action-bar__actions' }, props.children));
  }
  /* ── OrderBlock (Figma page `Orders` (BACKEND) → `order block`, decision 0100) ──
     One block of the admin order page: title (label/medium) · body (body/small, line breaks kept: an address, the
     totals) · an optional action (a Button, hug). Vertical, gap 8. Booleans: `action` (on). */
  function OrderBlock(props) {
    return h('section', Object.assign({}, omit(props, ['title', 'children', 'action', 'className']), { className: cx('zz-order-block', props.className) }),
      h('h2', { className: 'zz-order-block__title label-medium' }, props.title),
      h('p', { className: 'zz-order-block__body body-small' }, props.children),
      props.action ? h('div', { className: 'zz-order-block__action' }, props.action) : null);
  }
  function Step(props) {
    return h('li', Object.assign({}, omit(props, ['number', 'title', 'className', 'children']), { className: cx('zz-step', props.className) }),
      h('span', { className: 'zz-step__number label-large', 'aria-hidden': 'true' }, props.number),
      h('div', { className: 'zz-step__text' },
        h('h3', { className: 'zz-step__title label-medium' }, props.title),
        h('p', { className: 'zz-step__body body-medium' }, props.children)));
  }

  /* ── ActionPanel ────────────────────────────────────────────────────────
     Figma: page `listing form` → `action panel` (2026-11-10): surface/subtle, padding 16, a column of Buttons that fill
     it, gap 8 (Create: Publish now · Save draft · Preview). Children = the Buttons. */
  function ActionPanel(props) {
    return h('div', Object.assign({}, omit(props, ['className', 'children']), { className: cx('zz-action-panel', props.className) }), props.children);
  }

  /* ── ListingStatus ──────────────────────────────────────────────────────
     Figma: page `listing form` → `listing status` (2369:23575, decision 0118): the state of a listing at a glance, at the
     top of the Create/Edit side column (mobile: under the page title). Vertical, gap 4: status (label/large, text/strong)
     · details (body/small, text/moderate: when + SKU) · `unsaved` (an `alert`, block: alert colours, Gio 2026-11-18) · `shop update`
     (body/small, text/moderate). Booleans on in Figma; here a line shows when its prop is given. A live region: a screen
     reader hears the status change after a save. */
  function ListingStatus(props) {
    return h('div', Object.assign({ role: 'status' }, omit(props, ['status', 'details', 'unsaved', 'shopUpdate', 'className']), { className: cx('zz-listing-status', props.className) }),
      h('p', { className: 'zz-listing-status__status label-large' }, props.status),
      props.details ? h('p', { className: 'zz-listing-status__details body-small' }, props.details) : null,
      props.unsaved ? h(Alert, { className: 'zz-listing-status__unsaved' }, props.unsaved === true ? 'Unsaved changes' : props.unsaved) : null,
      props.shopUpdate ? h('p', { className: 'zz-listing-status__shop body-small' }, props.shopUpdate === true ? 'The shop updates in about 2 minutes.' : props.shopUpdate) : null);
  }

  /* ── ListingLine ────────────────────────────────────────────────────────
     Figma: page `listing form` → `listing line` (2026-11-10): one track line of a listing and its sample.
     `fields` = 8-column grid, gap 8 × 16. removable=false (line 1): artist 4 + title 4. removable=true (line 2+,
     here: onRemove given): artist 3 + title 4 + remove × in column 8. Row 2: "Different spelling" under the artist,
     "Artist name on label" (`artist on label`) under the title. Then the sample (gap 8): a FileList or a DropZone
     (decision 0022: one sample per line). The fields are slots: the page owns their state. */
  function ListingLine(props) {
    var removable = !!props.onRemove;
    function cell(name, node) { return node ? h('div', { className: 'zz-listing-line__' + name }, node) : null; }
    var hasMarker = props.marker !== undefined && props.marker !== null && props.marker !== false;
    return h('div', Object.assign({}, omit(props, ['artist', 'title', 'spelling', 'credit', 'onRemove', 'removeLabel', 'marker', 'className', 'children']), {
      className: cx('zz-listing-line', props.className), 'data-removable': removable ? 'true' : 'false'
    }),
      // Figma `listing line` boolean `number` (Gio 2026-11-17): a Marker with the line number before the fields, gap 0
      hasMarker ? h(Marker, null, props.marker) : null,
      h('div', { className: 'zz-listing-line__body' },
        h('div', { className: 'zz-listing-line__fields' },
          cell('artist', props.artist),
          cell('title', props.title),
          removable ? h('div', { className: 'zz-listing-line__remove' },
            h(IconButton, { icon: h(CloseIcon), 'aria-label': props.removeLabel || 'Remove line', onClick: props.onRemove })) : null,
          cell('spelling', props.spelling),
          cell('credit', props.credit)),
        props.children ? h('div', { className: 'zz-listing-line__sample' }, props.children) : null));
  }

  /* ── Marker (Figma page `listing form` → `marker`, Gio 2026-11-17) ──
     A circle that draws the eye to a block of the listing form: the line number in ListingLine, "€€" in PriceFields.
     48 × 48, border 1 border-divider/strong, body/extra-large text/strong, centred. Decorative (aria-hidden): the
     fields next to it carry their own labels. Sits 0 from the fields (wanted). */
  function Marker(props) {
    return h('span', Object.assign({ 'aria-hidden': 'true' }, omit(props, ['className', 'children']), { className: cx('zz-marker body-extra-large', props.className) }), props.children);
  }
  /* ── PriceFields (Figma page `Create` → `price fields`, device=desktop | mobile, Gio 2026-11-17) ──
     Marker ("€€") + Sale type + Price. desktop: an 8-column grid gap 16, each field 2 columns; mobile: stacked, gap 16.
     price=offers (decision 0158): a note (body-small, text/strong) instead of Price, 6 columns, centred on the select. */
  function PriceFields(props) {
    return h('div', Object.assign({}, omit(props, ['marker', 'saleType', 'price', 'note', 'className']), { className: cx('zz-price-fields', props.className) }),
      h(Marker, null, props.marker === undefined ? '€€' : props.marker),
      h('div', { className: 'zz-price-fields__row' },
        props.saleType ? h('div', { className: 'zz-price-fields__field' }, props.saleType) : null,
        props.note ? h('p', { className: 'zz-price-fields__note body-small' }, props.note)
          : props.price ? h('div', { className: 'zz-price-fields__field' }, props.price) : null));
  }

  /* ── Checkbox ───────────────────────────────────────────────────────────
     Figma: page `controls` → `checkbox` (state default | active). A native checkbox (0018): the input is visually
     hidden and drives the drawn box (icon/icon-square ↔ icon/icon-square-tick); the label is clickable.
     state=active = checked. Focus: browser ring on the box (no focus token yet, design/open.md). */
  function SquareIcon() { return icon('icon-square'); }
  function SquareTickIcon() { return icon('icon-square-tick'); }
  function SquareMinusIcon() { return icon('icon-square-minus'); }   // (2026-11-10, checkbox state=indeterminate)
  /* state=indeterminate (Figma 2026-11-10): `indeterminate` sets the native property (no HTML attribute exists), so
     screen readers announce "mixed". label=false (Figma boolean `label`): `hideLabel` keeps the label for assistive
     tech but hides it, e.g. "Select <record>" on a table row. */
  function Checkbox(props) {
    var ref = React.useRef(null);
    var checked = props.checked !== undefined ? !!props.checked : props.state === 'active';
    var indeterminate = props.indeterminate !== undefined ? !!props.indeterminate : props.state === 'indeterminate';
    React.useEffect(function () { if (ref.current) ref.current.indeterminate = indeterminate; }, [indeterminate]);
    var attrs = Object.assign({ type: 'checkbox', className: 'zz-checkbox__control', ref: ref },
      omit(props, ['label', 'state', 'className', 'style', 'children', 'indeterminate', 'hideLabel']));
    if (props.checked === undefined && props.state) { attrs.checked = checked; attrs.readOnly = true; }
    if (indeterminate) attrs['data-indeterminate'] = '';      // server render: the box shows the minus before hydration
    return h('label', { className: cx('zz-checkbox', props.hideLabel && 'zz-checkbox--hide-label', props.className), style: props.style },
      h('input', attrs),
      h('span', { className: 'zz-checkbox__box', 'aria-hidden': 'true' }, h(SquareIcon), h(SquareTickIcon), h(SquareMinusIcon)),
      h('span', { className: 'zz-checkbox__label body-medium' }, props.label || props.children));
  }

  /* ── Dialog ────────────────────────────────────────────────────────────
     Figma: page `dialog` → `dialog` (2026-11-10): surface/base (opaque white in every mode), 1px border-divider-strong,
     padding 16, gap 24; content = title (label/large, uppercase) + body (body/medium), gap 8; actions right-aligned,
     gap 8: secondary Cancel + primary confirm. Backdrop = surface/scrim.
     Native <dialog> opened with showModal(): focus is trapped, Esc cancels, focus returns to the opener on close.
     Admin: before every bulk action (decision 0025); initial focus on Cancel. */
  function Dialog(props) {
    var ref = React.useRef(null);
    var titleId = useId(), bodyId = useId();
    React.useEffect(function () {
      var d = ref.current; if (!d) return;
      if (props.open && !d.open) {
        if (d.showModal) d.showModal(); else d.setAttribute('open', '');
        var cancel = d.querySelector('[data-dialog-cancel]'); if (cancel) cancel.focus();
      } else if (!props.open && d.open) d.close();
    }, [props.open]);
    function onCancel(e) { e.preventDefault(); if (props.onCancel) props.onCancel(); }   // Esc
    return h('dialog', Object.assign({ ref: ref, className: cx('zz-dialog', props.className), 'aria-labelledby': titleId,
      'aria-describedby': bodyId, onCancel: onCancel }, omit(props, ['open', 'title', 'children', 'className', 'onCancel',
      'onConfirm', 'cancelLabel', 'confirmLabel', 'busy', 'choices', 'field'])),
      h('div', { className: 'zz-dialog__content' },
        h('h2', { id: titleId, className: 'zz-dialog__title label-large' }, props.title),
        h('div', { id: bodyId, className: 'zz-dialog__body body-medium' }, props.children),
        props.field ? h('div', { className: 'zz-dialog__field' }, props.field) : null,
        props.choices ? h('div', { className: 'zz-dialog__choices' }, props.choices) : null),
      h('div', { className: 'zz-dialog__actions' },
        h(Button, { hierarchy: 'secondary', type: 'button', 'data-dialog-cancel': '', onClick: props.onCancel }, props.cancelLabel || 'Cancel'),
        h(Button, { hierarchy: 'primary', type: 'button', onClick: props.busy ? undefined : props.onConfirm, 'aria-busy': props.busy ? 'true' : undefined },
          props.confirmLabel)));
  }

  /* ── NewsletterDialog ───────────────────────────────────────────────────
     Figma: page `dialog` → `newsletter dialog` (2026-11-18, decision 0121): the Dialog shell (surface/base, 1px
     divider/strong, padding 16, gap 24) with a head row (title label/large uppercase + `icon button` close, icon-x),
     a body line (body/medium) and the signup form (children: a FooterNewsletter with the label hidden). No Cancel /
     confirm: the form's Subscribe is the action, the close button (and Esc, and a click on the backdrop) closes it.
     Static: rendered closed; the page script opens it (showModal) from any link or button that points to the
     newsletter, and returns focus to it on close. */
  function NewsletterDialog(props) {
    var base = props.id || 'zz-newsletter-dialog';
    return h('dialog', Object.assign({}, omit(props, ['title', 'body', 'closeLabel', 'children', 'className']), {
      id: base, className: cx('zz-dialog zz-newsletter-dialog', props.className), 'aria-labelledby': base + '-title', 'aria-describedby': base + '-body' }),
      h('div', { className: 'zz-dialog__content' },
        h('div', { className: 'zz-newsletter-dialog__head' },
          h('h2', { id: base + '-title', className: 'zz-dialog__title label-large' }, props.title || 'Get new records first'),
          h(IconButton, { className: 'zz-newsletter-dialog__close', icon: h(CloseIcon), 'aria-label': props.closeLabel || 'Close', 'data-dialog-close': '' })),
        h('p', { id: base + '-body', className: 'zz-dialog__body body-medium' }, props.body || 'Get them in your inbox as they\u2019re listed.')),
      props.children);
  }

  /* ── Toast / ToastRegion ────────────────────────────────────────────────
     Figma: page `toast` → `toast` (2177:439; props message, action, dismiss). Decision 0049: a toast confirms a done
     action whose result left the view (Undo) or brings off-screen news; never an error. One look, no types.
     Toast is presentational. ToastRegion is the one place toasts appear: fixed at the bottom of the viewport, with a
     visually hidden live region (role=status) that exists at load and a <template> of the toast; the behaviour
     (show, replace, 6 s timeout with pause, Esc, focus return) is packages/ui/toast.js, the same file in the shop
     (no framework) and the admin. */
  function Toast(props) {
    var showAction = props.actionLabel !== undefined && props.actionLabel !== null && props.actionLabel !== false;
    var showDismiss = props.dismiss !== false;
    return h('div', Object.assign({ className: cx('zz-toast', props.className) },
      omit(props, ['message', 'actionLabel', 'onAction', 'dismiss', 'onDismiss', 'dismissLabel', 'className'])),
      h('p', { className: 'zz-toast__message body-medium', 'data-toast-message': '' }, props.message),
      showAction ? h(Button, { hierarchy: 'secondary', size: 'small', className: 'zz-toast__action', 'data-toast-action': '',
        onClick: props.onAction }, props.actionLabel) : null,
      showDismiss ? h(IconButton, { className: 'zz-toast__dismiss', 'data-toast-dismiss': '', icon: h(CloseIcon),
        'aria-label': props.dismissLabel || 'Dismiss', onClick: props.onDismiss }) : null);
  }
  function ToastRegion(props) {
    return h('section', Object.assign({ className: cx('zz-toast-region', props.className), 'aria-label': props['aria-label'] || 'Notifications',
      'data-toast-region': '' }, omit(props, ['className', 'aria-label'])),
      h('p', { className: 'zz-visually-hidden', role: 'status', 'aria-live': 'polite', 'aria-atomic': 'true', 'data-toast-announcer': '' }),
      h('div', { className: 'zz-toast-region__slot', 'data-toast-slot': '' }),
      h('template', { 'data-toast-template': '' }, h(Toast, { message: '', actionLabel: 'Undo' })));
  }

  /* ── Radio / RadioGroup ─────────────────────────────────────────────────
     Figma: page `controls` → `radio` (Gio, 2026-11-10; state default | active, boolean `label`). Same anatomy as the
     checkbox: a 24px control (icon/icon-radio-empty ↔ icon/icon-radio-dot, 18px, centred), gap 8, label body/medium
     text/strong. Native radio (0018): the input is visually hidden over the control; arrow keys move between the
     radios of a group (browser behaviour). RadioGroup = <fieldset> + <legend>, gap 8 (Figma: dialog `choices`). */
  function RadioEmptyIcon() { return icon('icon-radio-empty'); }   // (18)
  function RadioDotIcon() { return icon('icon-radio-dot'); }   // (18)
  var RadioGroupContext = React.createContext(null);
  function Radio(props) {
    var g = React.useContext(RadioGroupContext);
    var attrs = Object.assign({ type: 'radio', className: 'zz-radio__control' },
      omit(props, ['label', 'state', 'className', 'style', 'children', 'hideLabel']));
    if (g) {
      attrs.name = g.name;
      if (g.value !== undefined) attrs.checked = g.value === props.value;
      attrs.onChange = function (e) { if (g.onValueChange) g.onValueChange(props.value); if (props.onChange) props.onChange(e); };
    } else if (props.checked === undefined && props.state) { attrs.checked = props.state === 'active'; attrs.readOnly = true; }
    return h('label', { className: cx('zz-radio', props.hideLabel && 'zz-radio--hide-label', props.className), style: props.style },
      h('input', attrs),
      h('span', { className: 'zz-radio__box', 'aria-hidden': 'true' }, h(RadioEmptyIcon), h(RadioDotIcon)),
      h('span', { className: 'zz-radio__label body-medium' }, props.label || props.children));
  }
  function RadioGroup(props) {
    var autoName = useId();
    return h(RadioGroupContext.Provider, { value: { name: props.name || autoName, value: props.value, onValueChange: props.onValueChange } },
      h('fieldset', Object.assign({ className: cx('zz-radio-group', props.className) },
        omit(props, ['name', 'value', 'onValueChange', 'legend', 'hideLegend', 'children', 'className'])),
        props.legend ? h('legend', { className: cx('zz-radio-group__legend body-medium', props.hideLegend && 'zz-visually-hidden') }, props.legend) : null,
        props.children));
  }

  /* ── Filter / FilterBlock / Filters ────────────────────────────────────
     Figma: page `filters` (Gio's sketch, cleaned 2026-11-10). `filter`: content label | tag × state default | active,
     box 16 (icon/icon-square ↔ icon/icon-square-tick), gap 8, label body/small text/strong, `count` body/small
     text/moderate. `filter block`: heading label/extra small, gap 16, options gap 8. `filters`: blocks gap 24,
     padding 0 8. Shop PLP: all options content=label (Gio). A filter is a native checkbox (0018); a block is a
     <fieldset> with the heading as <legend>. Logic lives in the page: OR inside a block, AND between blocks. */
  function Filter(props) {
    var content = props.content || 'label';
    var attrs = Object.assign({ type: 'checkbox', className: 'zz-filter__control' },
      omit(props, ['label', 'count', 'content', 'state', 'className', 'style', 'children']));
    if (props.checked === undefined && props.state) { attrs.checked = props.state === 'active'; attrs.readOnly = true; }
    var label = props.label !== undefined ? props.label : props.children;
    var hasCount = props.count !== undefined && props.count !== null && props.count !== false;
    return h('label', { className: cx('zz-filter', props.className), 'data-content': content, style: props.style },
      h('input', attrs),
      h('span', { className: 'zz-filter__box', 'aria-hidden': 'true' }, h(SquareIcon), h(SquareTickIcon)),
      content === 'tag' ? h(Tag, { size: 'medium', className: 'zz-filter__tag' }, label) : h('span', { className: 'zz-filter__label body-small body-medium--mobile' }, label),
      hasCount ? h('span', { className: cx('zz-filter__count body-small', content === 'label' && 'body-medium--mobile') }, props.count) : null);
  }
  function FilterBlock(props) {
    return h('fieldset', Object.assign({ className: cx('zz-filter-block', props.className) },
      omit(props, ['label', 'hideLabel', 'children', 'className'])),
      h('legend', { className: cx('zz-filter-block__label label-extra-small', props.hideLabel && 'zz-visually-hidden') }, props.label),
      h('div', { className: 'zz-filter-block__options' }, props.children));
  }
  function Filters(props) {
    return h('div', Object.assign({ className: cx('zz-filters', props.className) }, omit(props, ['children', 'className'])), props.children);
  }

  /* ── FilterFacet / FiltersLayer / PlpHeader / SelectButton (mobile filters, Figma page `filters`, 2026-11-10) ──
     Gio: on mobile the filters open in a full-screen layer with nested levels (no accordion). `filters layer`
     (level main | facet): top bar (back on facet · title label/medium · close), body, actions sticky at the bottom
     (Reset secondary + Apply primary, large, the count as Apply's suffix, 0029). level=main: "Applied" recap
     (entity chips, large) + one `filter facet` per facet; level=facet: the options of one facet (`filter`).
     `PLP header` (device=mobile): "Filter" + the number of applied filters as suffix, and the sort, a native select
     drawn as a small secondary button with a trailing chevron (Gio: every select opens the native dropdown). */
  function ChevronRightIcon() { return icon('icon-chevron-right-small-thin'); }   // (= chevron-down turned)
  function ChevronLeftIcon() { return icon('icon-chevron-left-small-thin'); }
  function FilterFacet(props) {
    var hasValue = props.value !== undefined && props.value !== null && props.value !== false && props.value !== '';
    return h('button', Object.assign({ type: 'button', className: cx('zz-filter-facet', props.className) },
      omit(props, ['label', 'value', 'className', 'children'])),
      h('span', { className: 'zz-filter-facet__label label-medium' }, props.label),
      hasValue ? h('span', { className: 'zz-filter-facet__value body-small' }, props.value) : null,
      h('span', { className: 'zz-filter-facet__chevron', 'aria-hidden': 'true' }, h(ChevronRightIcon)));
  }
  function FiltersLayer(props) {
    var level = props.level || 'main';
    var titleId = useId();
    var hasApplied = props.applied !== undefined && props.applied !== null && props.applied !== false;
    return h('div', Object.assign({ className: cx('zz-filters-layer', props.className), 'data-level': level,
      role: props.role || 'group', 'aria-labelledby': titleId },
      omit(props, ['level', 'title', 'applied', 'appliedLabel', 'children', 'className', 'onBack', 'onClose', 'backLabel',
        'closeLabel', 'onApply', 'onReset', 'applyLabel', 'applyCount', 'resetLabel', 'role'])),
      h('div', { className: 'zz-filters-layer__bar' },
        h(IconButton, { className: 'zz-filters-layer__back', icon: h(ChevronLeftIcon), 'aria-label': props.backLabel || 'Back to filters',
          onClick: props.onBack, hidden: level !== 'facet', 'data-layer-back': '' }),
        h('h2', { id: titleId, className: 'zz-filters-layer__title label-medium', 'data-layer-title': '' }, props.title),
        h(IconButton, { className: 'zz-filters-layer__close', icon: h(CloseIcon), 'aria-label': props.closeLabel || 'Close filters',
          onClick: props.onClose, 'data-layer-close': '' })),
      h('div', { className: 'zz-filters-layer__body' },
        hasApplied || props.appliedLabel ? h('div', { className: 'zz-filters-layer__applied', hidden: level !== 'main' || !hasApplied, 'data-layer-applied': '' },
          h('p', { className: 'zz-filters-layer__applied-label label-extra-small' }, props.appliedLabel || 'Applied'),
          h('div', { className: 'zz-filters-layer__chips', 'data-layer-chips': '' }, props.applied)) : null,
        props.children),
      h('div', { className: 'zz-filters-layer__actions' },
        h(Button, { hierarchy: 'secondary', size: 'large', onClick: props.onReset, 'data-layer-reset': '' }, props.resetLabel || 'Reset'),
        h(Button, { hierarchy: 'primary', size: 'large', className: 'zz-filters-layer__apply', onClick: props.onApply,
          suffix: props.applyCount, 'data-layer-apply': '' }, props.applyLabel || 'Apply')));
  }
  function PlpHeader(props) {
    return h('div', Object.assign({ className: cx('zz-plp-header', props.className) }, omit(props, ['filters', 'sort', 'className'])),
      h('div', { className: 'zz-plp-header__controls' }, props.filters, props.sort),
      h('div', { className: 'zz-plp-header__rule', 'aria-hidden': 'true' }));
  }
  /* ── MenuItem / MenuGroup / MenuLayer (mobile menu, Figma page `menu`, proposal 2026-11-12) ──
     Opened by the header hamburger. `menu layer`: the frame of `filters layer` (bar: title label/medium + close;
     body scrolls on its own) without the actions. Body: padding small (top) / medium-small (bottom) × page-margin-mobile,
     groups 24 apart (Figma literal, no token). `menu item` (state default | current): a link row like `filter facet`
     without the chevron, padding medium-small × small, 1px border-divider-strong at the bottom; label label-medium
     (uppercase), detail body-small text-moderate; current = the page you are on (aria-current) on tab-background-active.
     Legal links: body-small, wrap, gap medium-small × small, padding-x small (Gio 2026-11-12: rows keep padding 8). */
  function MenuItem(props) {
    var current = !!props.current;
    var hasDetail = props.detail !== undefined && props.detail !== null && props.detail !== false && props.detail !== '';
    // no href → a <button> (an action in the menu, e.g. the admin's Sign out, decision 0089)
    return h(props.href ? 'a' : 'button', Object.assign(props.href ? {} : { type: 'button' }, { className: cx('zz-menu-item', props.className), 'data-state': current ? 'current' : 'default',
      'aria-current': current ? 'page' : undefined }, omit(props, ['label', 'detail', 'current', 'className', 'children'])),
      h('span', { className: 'zz-menu-item__label label-medium' }, props.label),
      hasDetail ? h('span', { className: 'zz-menu-item__detail body-small' }, props.detail) : null);
  }
  function MenuGroup(props) {
    return h('div', Object.assign({ className: cx('zz-menu-group', props.className) }, omit(props, ['children', 'className'])), props.children);
  }
  function MenuLayer(props) {
    var titleId = useId();
    return h('div', Object.assign({ className: cx('zz-menu-layer', props.className) },
      omit(props, ['title', 'legal', 'legalLabel', 'onClose', 'closeLabel', 'children', 'className'])),
      h('div', { className: 'zz-menu-layer__bar' },
        h('h2', { id: titleId, className: 'zz-menu-layer__title label-medium' }, props.title || 'Menu'),
        h(IconButton, { className: 'zz-menu-layer__close', icon: h(CloseIcon), 'aria-label': props.closeLabel || 'Close menu',
          onClick: props.onClose, 'data-menu-close': '' })),
      h('nav', { className: 'zz-menu-layer__body', 'aria-labelledby': titleId },
        props.children,
        props.legal ? h('div', { className: 'zz-menu-layer__legal body-small', role: 'group', 'aria-label': props.legalLabel || 'Legal' }, props.legal) : null));
  }

  /* ── Footer / FooterLinks / FooterNewsletter (Figma page `footer`: `footer` device=desktop | mobile,
     `footer link list` group=shop | info | social, `footer newsletter`, `footer legal`; decision 0077) ──
     One responsive markup: desktop = newsletter and the link columns side by side, mobile (--mobile) = stacked,
     links in two columns. The page gives the content: the DS has no site data. */
  function Footer(props) {
    return h('footer', Object.assign({ className: cx('zz-footer', props.className) },
      omit(props, ['newsletter', 'children', 'navLabel', 'legal', 'legalLabel', 'copyright', 'className'])),
      h('div', { className: 'zz-footer__main' },
        props.newsletter ? h('div', { className: 'zz-footer__newsletter' }, props.newsletter) : null,   // Figma boolean `newsletter`
        h('nav', { className: 'zz-footer__links', 'aria-label': props.navLabel || 'Footer' }, props.children)),
      h('div', { className: 'zz-footer__bottom body-small' },
        props.copyright ? h('p', { className: 'zz-footer__copyright' }, props.copyright) : null,   // Figma `copyright`
        props.legal ? h('div', { className: 'zz-footer__legal', role: 'group', 'aria-label': props.legalLabel || 'Legal' }, props.legal) : null));
  }
  // Figma `footer link list`: one column of links. `links` = [{ href, label }]. `label` names the list for screen readers
  // (aria-label: the columns have no titles in Figma). No useId: the storefront renders the footer as its own React
  // root, where generated ids would repeat the page's.
  function FooterLinks(props) {
    return h('div', Object.assign({ className: cx('zz-footer-links', props.className) }, omit(props, ['links', 'label', 'className'])),
      h('ul', { className: 'zz-footer-links__list body-small', role: 'list', 'aria-label': props.label },
        (props.links || []).map(function (l) {
          return h('li', { key: l.href + l.label }, h('a', { href: l.href, rel: l.rel, target: l.target }, l.label));
        })));
  }
  // Figma `footer newsletter`: a plain HTML form (works without JS) → the provider's subscribe endpoint (Buttondown,
  // double opt-in). Input text field (label) + secondary Button, then the note (`note`, links inside are underlined).
  // `endpoint` (decision 0103): the site's own signup function; the page script (apps/storefront/scripts/newsletter.js)
  // posts there and answers in place, in the status line, and falls back to `action` if the function can't be reached.
  // The hidden `website` field is a honeypot for bots.
  function FooterNewsletter(props) {
    var base = props.id || 'zz-footer-newsletter';   // fixed ids, not useId (see FooterLinks)
    var noteId = base + '-note';
    return h('form', Object.assign({ className: cx('zz-footer-newsletter', props.className), action: props.action, method: props.method || 'post',
      'data-newsletter-endpoint': props.endpoint || undefined },
      omit(props, ['action', 'method', 'endpoint', 'label', 'hideLabel', 'placeholder', 'submitLabel', 'note', 'name', 'className'])),
      h('div', { className: 'zz-footer-newsletter__row' },
        // hideLabel (Figma `input label` off, home newsletter): the label stays for assistive tech as aria-label
        h(Input, { id: base + '-email', className: 'zz-footer-newsletter__input', label: props.hideLabel ? undefined : props.label || 'Newsletter',
          'aria-label': props.hideLabel ? props.label || 'Email' : undefined, type: 'email', name: props.name || 'email',
          placeholder: props.placeholder || 'Your email', autoComplete: 'email', required: true, 'aria-describedby': props.note ? noteId : undefined }),
        h(Button, { hierarchy: 'secondary', type: 'submit' }, props.submitLabel || 'Subscribe')),
      props.endpoint ? h('div', { className: 'zz-visually-hidden', 'aria-hidden': 'true' },
        h('label', null, 'Website', h('input', { type: 'text', name: 'website', tabIndex: -1, autoComplete: 'off' }))) : null,
      // the answer after submit (filled by the page script): sent → replaces the row; error → under the row
      props.endpoint ? h('p', { className: 'zz-footer-newsletter__status body-small', role: 'status', tabIndex: -1, hidden: true, 'data-newsletter-status': '' }) : null,
      props.note ? h('p', { id: noteId, className: 'zz-footer-newsletter__note body-small' }, props.note) : null);
  }

  // a native <select> drawn as a Button (Figma: button + trailing icon chevron-down): the select is invisible over
  // the button, so the platform picker opens (Gio, 2026-11-10). The visible text is the selected option's label.
  function SelectButton(props) {
    var options = props.options || [];
    var value = props.value !== undefined ? props.value : props.defaultValue;
    var current = options.filter(function (o) { return o.value === value; })[0] || options[0] || { label: '' };
    var size = props.size || 'small';
    return h('span', { className: cx('zz-button zz-select-button', props.className), 'data-hierarchy': props.hierarchy || 'secondary', 'data-size': size, 'data-layout': props.layout || 'hug' },
      h('span', { className: cx('zz-button__label', (size === 'small' || size === 'extra-small') ? 'label-extra-small' : 'label-medium') },
        props.prefix ? h('span', { className: 'zz-button__prefix' }, props.prefix) : null,   // Figma `prefix` ("Sort:", desktop)
        h('span', { 'data-select-label': '' }, current.label)),
      h('span', { className: 'zz-button__icon', 'aria-hidden': 'true' }, h(ChevronDownLargeIcon)),
      h('select', Object.assign({ className: 'zz-select-button__control' },
        omit(props, ['options', 'className', 'hierarchy', 'size', 'layout', 'prefix'])),
        options.map(function (o) { return h('option', { key: o.value, value: o.value }, o.label); })));
  }

  /* ── EntityField + EntityChip ──────────────────────────────────────────
     Figma (Gio approved 2026-11-10, decision 0020): the `input` with `chips` on (field padding 6), `entity chip`
     (page tags; state default | hover | focus) and `entity option` (page input › building blocks; kind entity | alias |
     create × state default | active). Examples: BACKEND → Create, "Entity field (chips) · examples" (2106:676).
     A field whose value is a list of entities (artists, labels, tags): each chosen entity is a chip, text that is not
     a chip is not a value. Suggestions in a menu below the field (WAI-ARIA combobox + listbox, keyboard: arrows,
     Enter, Escape, Backspace on the empty field removes the last chip). `multiple={false}`: one chip, and the text
     box is hidden while it is there (remove the chip to change it). */
  function XThinIcon() { return icon('icon-x-thin'); }
  function TickLargeThinIcon() { return icon('icon-tick-large-thin'); }   // leading icon of "In bag" (decision 0058)
  function ClockCounterClockwiseIcon() { return icon('icon-clock-counter-clockwise'); }   // leading icon of "Reserved" (proposal, design/open.md)
  function EnvelopeIcon() { return icon('icon-envelope'); }   // trailing icon of "(Reserved) Notify me" (decision 0065)
  function PlusSmallThinIcon() { return icon('icon-plus-small-thin'); }
  function EntityChip(props) {
    var label = props.label !== undefined ? props.label : props.children;
    var size = props.size || 'medium';   // Figma `size` (2026-11-10): medium 24px | large 44px (mobile, body/medium, × 44 × 44)
    return h('span', Object.assign({ className: cx('zz-entity-chip', props.className), 'data-state': props.state, 'data-size': size },
      omit(props, ['label', 'children', 'className', 'onRemove', 'removeLabel', 'state', 'size'])),
      h('span', { className: cx('zz-entity-chip__label', size === 'large' ? 'body-medium' : 'body-small') }, label),
      h('button', { type: 'button', className: 'zz-entity-chip__remove', 'aria-label': props.removeLabel || ('Remove ' + label),
        onClick: props.onRemove, tabIndex: props.onRemove ? undefined : -1 }, h(CloseIcon)));
  }
  function entityMatches(options, text, taken, limit) {
    var t = String(text || '').trim().toLowerCase();
    if (!t) return [];
    var starts = [], contains = [];
    (options || []).forEach(function (e) {
      if (taken[e.id]) return;
      var n = e.name.toLowerCase();
      if (n.indexOf(t) === 0) starts.push({ entity: e, alias: null });
      else if (n.indexOf(t) > 0) contains.push({ entity: e, alias: null });
      else {
        var a = (e.aliases || []).filter(function (x) { return x.toLowerCase().indexOf(t) >= 0; })[0];
        if (a) (a.toLowerCase().indexOf(t) === 0 ? starts : contains).push({ entity: e, alias: a });
      }
    });
    return starts.concat(contains).slice(0, limit || 8);
  }
  function EntityField(props) {
    var id = useStableId(props.id);
    var listId = id + '-options', supportId = id + '-support';
    var value = props.value || [];
    var multiple = props.multiple !== false;
    var ts = React.useState(''), text = ts[0], setText = ts[1];
    var os = React.useState(false), open = os[0], setOpen = os[1];
    var as = React.useState(0), active = as[0], setActive = as[1];
    var inputRef = React.useRef(null);
    var taken = {};
    value.forEach(function (v) { if (v.id) taken[v.id] = true; });
    var matches = entityMatches(props.options, text, taken);
    var trimmed = text.trim();
    var exact = trimmed && (props.options || []).some(function (e) { return e.name.toLowerCase() === trimmed.toLowerCase(); }) ||
                value.some(function (v) { return v.name.toLowerCase() === trimmed.toLowerCase(); });
    var items = matches.map(function (m) { return { kind: m.alias ? 'alias' : 'entity', entity: m.entity, alias: m.alias }; });
    if (trimmed && !exact && props.allowCreate !== false) items.push({ kind: 'create', name: trimmed });
    var showMenu = open && items.length > 0;
    var cur = Math.min(active, items.length - 1);
    var hasError = props.error !== undefined && props.error !== null && props.error !== false && props.error !== '';
    var support = hasError ? props.error : props.supportText;
    var full = !multiple && value.length > 0;

    function choose(item) {
      if (!item) return;
      var chip = item.kind === 'create' ? { id: null, name: item.name } : { id: item.entity.id, name: item.entity.name };
      var next = multiple ? value.concat([chip]) : [chip];
      if (props.onChange) props.onChange(next, { added: chip, alias: item.alias || null });
      setText(''); setActive(0); setOpen(false);
    }
    function remove(i) {
      var next = value.filter(function (_, j) { return j !== i; });
      if (props.onChange) props.onChange(next, { removed: value[i] });
      setTimeout(function () { if (inputRef.current) inputRef.current.focus(); }, 0);
    }
    function onKeyDown(e) {
      if (e.key === 'ArrowDown') { e.preventDefault(); if (!open) setOpen(true); else setActive(items.length ? (cur + 1) % items.length : 0); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(items.length ? (cur - 1 + items.length) % items.length : 0); }
      else if (e.key === 'Enter') { if (showMenu) { e.preventDefault(); choose(items[cur]); } }
      else if (e.key === 'Escape') { if (open) { e.preventDefault(); setOpen(false); } }
      else if (e.key === 'Backspace' && !text && value.length) { e.preventDefault(); remove(value.length - 1); }
    }
    // leaving the field: an exact official name becomes its chip; anything else stays as (unsaved) text
    function onBlur() {
      setOpen(false);
      var m = trimmed && (props.options || []).filter(function (e) { return !taken[e.id] && e.name.toLowerCase() === trimmed.toLowerCase(); })[0];
      if (m) choose({ kind: 'entity', entity: m });
    }
    var optionId = function (i) { return id + '-option-' + i; };

    return h('div', {
      className: cx('zz-input zz-entity-field', props.className), style: props.style,
      'data-invalid': hasError ? 'true' : undefined
    },
      (props.label || props.optional) ? h('label', { className: 'zz-input__top', htmlFor: id },
        h('span', { className: 'zz-input__label body-small' }, props.label),
        props.optional ? ' ' : null,
        props.optional ? h('span', { className: 'zz-input__optional body-small' }, props.optionalLabel || 'Optional') : null) : null,
      h('div', { className: 'zz-input__field zz-entity-field__field', onMouseDown: function (e) {
          if (e.target === e.currentTarget && inputRef.current) { e.preventDefault(); inputRef.current.focus(); }
        } },
        value.length ? h('ul', { className: 'zz-entity-field__chips', 'aria-label': (props.label || '') + ': chosen' },
          value.map(function (v, i) {
            return h('li', { key: (v.id || 'new') + ':' + v.name }, h(EntityChip, { label: v.name, onRemove: function () { remove(i); } }));
          })) : null,
        full ? null : h('input', {
          ref: inputRef, id: id, type: 'text', className: 'zz-input__control zz-entity-field__control body-medium',
          role: 'combobox', 'aria-autocomplete': 'list', 'aria-expanded': showMenu ? 'true' : 'false', 'aria-controls': listId,
          'aria-activedescendant': showMenu ? optionId(cur) : undefined,
          'aria-invalid': hasError ? 'true' : undefined, 'aria-describedby': support ? supportId : undefined,
          autoComplete: 'off', placeholder: props.placeholder, value: text, disabled: props.disabled,
          onChange: function (e) { setText(e.target.value); setOpen(true); setActive(0); },
          onFocus: function () { if (text) setOpen(true); }, onBlur: onBlur, onKeyDown: onKeyDown
        }),
        h('ul', { id: listId, role: 'listbox', className: 'zz-entity-field__menu', hidden: !showMenu, 'aria-label': props.label },
          showMenu ? items.map(function (it, i) {
            return h('li', {
              key: it.kind + (it.entity ? it.entity.id + (it.alias || '') : it.name), id: optionId(i), role: 'option',
              className: 'zz-entity-option body-medium', 'data-kind': it.kind, 'aria-selected': i === cur ? 'true' : 'false',
              onMouseDown: function (e) { e.preventDefault(); }, onMouseEnter: function () { setActive(i); },
              onClick: function () { choose(it); }
            },
              it.kind === 'create' ? h('span', { className: 'zz-entity-option__icon', 'aria-hidden': 'true' }, h(PlusSmallThinIcon)) : null,
              h('span', { className: 'zz-entity-option__label' },
                it.kind === 'create' ? (props.createLabel || 'Create') + ' “' + it.name + '”' : it.kind === 'alias' ? it.alias : it.entity.name),
              it.kind === 'alias' ? h('span', { className: 'zz-entity-option__official body-small' }, '→ ' + it.entity.name) : null);
          }) : null)),
      support ? h('p', { id: supportId, className: 'zz-input__support body-small' }, support) : null);
  }

  /* ── LinkedInput (Figma BACKEND → Create → `custom title`, decision 0147) ────────────────────────────
     A text field whose characters can link to an entity (an artist): Custom title. The links are character ranges
     [{ start, end, artist: { id, name } }] drawn underlined over the text (a backdrop behind a transparent input, so the
     field stays a native input). Select characters, or click a name of the record (`names`) or a link: a small bar
     (`title link bar`) appears under the field with Link artist / Change link and Clear link / Remove link. The bar never
     takes the focus, so Delete and typing work as usual and hide it. Link artist or ⌘K / Ctrl+K opens the menu
     (`title link menu`): a search box + the record's artists (`suggested`) first, then the matches in `options`.
     Clear unlinks exactly the selected characters (a link can split). Typing moves the links with the text: inside a
     link stays in it, right before or after it does not. onChange(value, links) gets both. */
  function linksCut(links, s, e) {
    var out = [];
    links.forEach(function (l) {
      if (l.end <= s || l.start >= e) { out.push(l); return; }
      if (l.start < s) out.push({ start: l.start, end: s, artist: l.artist });
      if (l.end > e) out.push({ start: e, end: l.end, artist: l.artist });
    });
    return out;
  }
  function linksTidy(links) {   // sorted, no empty link, same artist touching = one link
    var out = [];
    links.filter(function (l) { return l.end > l.start; }).sort(function (a, b) { return a.start - b.start; }).forEach(function (l) {
      var p = out[out.length - 1];
      var same = p && (p.artist.id && l.artist.id ? p.artist.id === l.artist.id : p.artist.name === l.artist.name);
      if (same && p.end >= l.start) p.end = Math.max(p.end, l.end);
      else out.push({ start: l.start, end: l.end, artist: l.artist });
    });
    return out;
  }
  function linksShift(links, a, b) {   // the text changed from a to b: [pre, oldEnd) became [pre, newEnd)
    var pre = 0; while (pre < a.length && pre < b.length && a[pre] === b[pre]) pre++;
    var suf = 0; while (suf < a.length - pre && suf < b.length - pre && a[a.length - 1 - suf] === b[b.length - 1 - suf]) suf++;
    var oldEnd = a.length - suf, newEnd = b.length - suf, delta = b.length - a.length;
    function ms(x) { return x >= oldEnd ? x + delta : x <= pre ? x : newEnd; }
    function me(x) { return x <= pre ? x : x >= oldEnd ? x + delta : pre; }
    return linksTidy(links.map(function (l) { return { start: ms(l.start), end: me(l.end), artist: l.artist }; }));
  }
  function wordChar(c) { return !!c && /[\p{L}\p{N}]/u.test(c); }
  function findWhole(text, part, from) {
    var lower = text.toLowerCase(), t = String(part || '').toLowerCase();
    if (!t) return -1;
    for (var at = lower.indexOf(t, from || 0); at >= 0; at = lower.indexOf(t, at + 1)) {
      if (!wordChar(text[at - 1]) && !wordChar(text[at + t.length])) return at;
    }
    return -1;
  }
  function LinkMenu(props) {
    var qs = React.useState(''), q = qs[0], setQ = qs[1];
    var as = React.useState(0), active = as[0], setActive = as[1];
    var ref = React.useRef(null);
    React.useEffect(function () { if (ref.current) ref.current.focus(); }, []);
    var t = q.trim().toLowerCase();
    var sug = (props.suggested || []).filter(function (a) { return !t || a.name.toLowerCase().indexOf(t) >= 0; });
    var x = props.text.trim().toLowerCase();
    var guess = x && sug.filter(function (a) {
      var n = a.name.toLowerCase();
      return n.indexOf(x) >= 0 || n.split(' ').some(function (w) { return w.length > 2 && x.indexOf(w) >= 0; });
    })[0];
    if (guess) sug = [guess].concat(sug.filter(function (a) { return a !== guess; }));
    var taken = {}; sug.forEach(function (a) { if (a.id) taken[a.id] = true; });
    var list = sug.map(function (a) { return { entity: a, note: a === guess && !props.current ? 'Suggested' : 'On this record' }; })
      .concat(entityMatches(props.options, q, taken, 8).map(function (m) { return { entity: m.entity, note: m.alias ? m.alias : null }; }))
      .slice(0, 8);
    var cur = Math.min(active, Math.max(0, list.length - 1));
    function onKeyDown(e) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setActive(list.length ? (cur + 1) % list.length : 0); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(list.length ? (cur - 1 + list.length) % list.length : 0); }
      else if (e.key === 'Enter') { e.preventDefault(); if (list[cur]) props.onPick(list[cur].entity); }
      else if (e.key === 'Escape') { e.preventDefault(); props.onClose(); }
    }
    var listId = props.id + '-menu';
    return h('div', { className: 'zz-linked-input__menu', role: 'dialog', 'aria-label': props.label, style: { left: props.x + 'px' },
      onMouseDown: function (e) { e.stopPropagation(); } },
      h('input', { ref: ref, type: 'text', className: 'zz-linked-input__search body-medium', placeholder: props.placeholder,
        'aria-label': props.placeholder, role: 'combobox', 'aria-expanded': 'true', 'aria-controls': listId, autoComplete: 'off',
        'aria-activedescendant': list.length ? listId + '-' + cur : undefined,
        value: q, onChange: function (e) { setQ(e.target.value); setActive(0); }, onKeyDown: onKeyDown }),
      list.length ? h('ul', { id: listId, role: 'listbox', className: 'zz-linked-input__options', 'aria-label': props.label },
        list.map(function (it, i) {
          return h('li', { key: (it.entity.id || it.entity.name), id: listId + '-' + i, role: 'option',
            className: 'zz-entity-option body-medium', 'aria-selected': i === cur ? 'true' : 'false',
            'data-current': props.current && (props.current.id ? props.current.id === it.entity.id : props.current.name === it.entity.name) ? 'true' : undefined,
            onMouseDown: function (e) { e.preventDefault(); }, onMouseEnter: function () { setActive(i); },
            onClick: function () { props.onPick(it.entity); } },
            h('span', { className: 'zz-entity-option__label' }, it.entity.name),
            it.note ? h('span', { className: 'zz-entity-option__official body-small' }, it.note) : null);
        })) : null);
  }
  function LinkedInput(props) {
    var id = useStableId(props.id);
    var value = props.value || '', links = props.links || [];
    var wrap = React.useRef(null), ctl = React.useRef(null), dragging = React.useRef(false);
    var bs = React.useState({ left: 0, top: 0, width: 0, scroll: 0 }), box = bs[0], setBox = bs[1];
    var ms = React.useState(null), menu = ms[0], setMenu = ms[1];
    function measure() {
      var w = wrap.current; if (!w) return;
      var c = w.querySelector('.zz-input__control'); if (!c) return; ctl.current = c;
      var a = w.getBoundingClientRect(), b = c.getBoundingClientRect();
      var nb = { left: b.left - a.left, top: b.top - a.top, width: b.width, scroll: c.scrollLeft };
      setBox(function (o) { return o.left === nb.left && o.top === nb.top && o.width === nb.width && o.scroll === nb.scroll ? o : nb; });
    }
    React.useLayoutEffect(measure);
    React.useEffect(function () {
      function off() { setMenu(null); }
      function up() { if (!dragging.current) return; dragging.current = false; setTimeout(function () { sel.current(true); }, 0); }
      window.addEventListener('resize', measure); document.addEventListener('mousedown', off); document.addEventListener('mouseup', up);
      return function () { window.removeEventListener('resize', measure); document.removeEventListener('mousedown', off); document.removeEventListener('mouseup', up); };
    }, []);
    function xAt(i) {
      var bd = wrap.current.querySelector('.zz-linked-input__text'), w = document.createTreeWalker(bd, NodeFilter.SHOW_TEXT), n = 0, tn;
      while ((tn = w.nextNode())) {
        if (n + tn.length >= i) { var r = document.createRange(); r.setStart(tn, i - n); r.setEnd(tn, i - n); return r.getBoundingClientRect().left - wrap.current.getBoundingClientRect().left; }
        n += tn.length;
      }
      return box.left;
    }
    function open(s, e, whole) {
      setMenu({ open: false, start: s, end: e, text: value.slice(s, e), whole: whole || null,
        inside: links.filter(function (l) { return l.start < e && l.end > s; }),
        x: Math.max(0, Math.min(xAt(s), (wrap.current.clientWidth || 320) - 320)) });
    }
    function onSelect(fromMouse) {
      var c = ctl.current; if (!c || props.disabled || props.readOnly) return; measure();
      var s = c.selectionStart, e = c.selectionEnd;
      if (e > s) { open(s, e, null); return; }
      if (!fromMouse) { setMenu(null); return; }
      var at = links.filter(function (l) { return s >= l.start && s <= l.end; })[0];
      if (at) { open(at.start, at.end, at); return; }
      var known = null;
      (props.names || []).forEach(function (n) {
        for (var i = findWhole(value, n); i >= 0 && !known; i = findWhole(value, n, i + 1)) if (s >= i && s <= i + n.length) known = [i, i + n.length];
      });
      if (known) open(known[0], known[1], null); else setMenu(null);
    }
    var sel = React.useRef(onSelect); sel.current = onSelect;
    function emit(nextLinks) { if (props.onChange) props.onChange(value, nextLinks); }
    function pick(a) {
      emit(linksTidy(linksCut(links, menu.start, menu.end).concat([{ start: menu.start, end: menu.end, artist: { id: a.id || null, name: a.name } }])));
      var end = menu.end; setMenu(null);
      if (ctl.current) { ctl.current.focus(); ctl.current.setSelectionRange(end, end); }
    }
    function clear() { emit(linksTidy(linksCut(links, menu.start, menu.end))); setMenu(null); if (ctl.current) ctl.current.focus(); }
    var current = menu && menu.whole ? menu.whole.artist : null;
    var pieces = [], pos = 0;
    links.forEach(function (l, i) {
      if (l.start > pos) pieces.push(value.slice(pos, l.start));
      pieces.push(h('span', { key: i, className: 'zz-linked-input__link' }, value.slice(l.start, l.end)));
      pos = l.end;
    });
    if (pos < value.length) pieces.push(value.slice(pos));
    var inputProps = omit(props, ['links', 'options', 'suggested', 'names', 'onChange', 'className', 'style', 'linkLabel', 'menuPlaceholder']);
    return h('div', { ref: wrap, className: cx('zz-linked-input', props.className), style: props.style,
        onMouseDown: function (e) { e.stopPropagation(); if (ctl.current && e.target === ctl.current) dragging.current = true; },
        onKeyDown: function (e) {
          if (e.target !== ctl.current || ['Shift', 'Control', 'Meta', 'Alt'].indexOf(e.key) >= 0) return;
          if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); if (menu) setMenu(Object.assign({}, menu, { open: true })); return; }
          if (!e.shiftKey && e.key.indexOf('Arrow') !== 0) setMenu(null);
        },
        onKeyUp: function (e) { if (e.target === ctl.current && e.shiftKey && e.key !== 'Shift') onSelect(false); } },
      h(Input, Object.assign({}, inputProps, { id: id, value: value, onScroll: measure,
        onChange: function (e) { var v = e.target.value; setMenu(null); if (props.onChange) props.onChange(v, linksShift(links, value, v)); },
        onSelect: function () { if ('ontouchstart' in window) onSelect(true); } })),
      h('div', { className: 'zz-linked-input__backdrop', 'aria-hidden': 'true', style: { left: box.left + 'px', top: box.top + 'px', width: box.width + 'px' } },
        h('div', { className: 'zz-linked-input__text body-medium', style: { transform: 'translateX(' + (-box.scroll) + 'px)' } }, pieces)),
      menu && !menu.open ? h('div', { className: 'zz-linked-input__bar', role: 'toolbar', 'aria-label': props.linkLabel || 'Link artist', style: { left: menu.x + 'px' },
          onMouseDown: function (e) { e.preventDefault(); e.stopPropagation(); } },   // keeps the focus and the selection in the field
        h(Button, { hierarchy: 'secondary', size: 'extra-small', title: '⌘K', onClick: function () { setMenu(Object.assign({}, menu, { open: true })); } },
          current ? 'Change link' : (props.linkLabel || 'Link artist')),
        menu.inside.length ? h(Button, { hierarchy: 'secondary', size: 'extra-small', onClick: clear }, menu.whole ? 'Remove link' : 'Clear link') : null) : null,
      menu && menu.open ? h(LinkMenu, { key: menu.start + '-' + menu.end, id: id, label: props.linkLabel || 'Link artist', text: menu.text,
        placeholder: props.menuPlaceholder || 'Search artist', suggested: props.suggested, options: props.options, current: current, x: menu.x,
        onPick: pick, onClose: function () { setMenu(null); if (ctl.current) ctl.current.focus(); } }) : null);
  }
  LinkedInput.cut = linksCut; LinkedInput.tidy = linksTidy; LinkedInput.shift = linksShift; LinkedInput.find = findWhole;

  /* ── Create / Edit listing sections (Figma BACKEND → Create, Gio 2026-11-17) ──
     FormSectionHead (`form section head`): the heading of a form section, label/medium text/strong (like the old
       "Images" title).
     (A section nav, `form section nav`, was built in 0113 and removed in 0117.) */
  function FormSectionHead(props) {
    var Tag = 'h' + (props.headingLevel || 2);
    return h(Tag, Object.assign({}, omit(props, ['headingLevel', 'className', 'children']), { className: cx('zz-form-section-head label-medium', props.className) }), props.children);
  }

  /* ── Home (Figma page `Home`, Home v2 2026-11-18, decision 0120) ─────────
     SectionHead: `section head` — divider on top (boolean `divider`), then a row (gap small, top-aligned): title body/medium
       text/strong + `meta` (inline count "(12)", body/medium text/moderate, booleans `meta`), actions on the right
       (boolean `actions`: `play` "Play all", `see all`, secondary Buttons); gap small.
     GenreLinks: `genre links` (layout row | column): the genres as Tag size=large links + "All" (Button secondary
       extra-small, own line), gap small. No title (Gio 2026-11-18): a <nav> named "Genres". responsive = column on
       desktop, row on mobile.
     HomeIntro: `home intro` (device desktop | mobile): the welcome line, body/extra-large (desktop) · body/large (mobile).
     HomeNewsletter: `home newsletter` — 16 above and below, then a dashed box (the store name's dash, 1px divider/strong,
       8 on / 8 off), padding medium-small, gap small: SectionHead (no divider, no actions) + FooterNewsletter (label hidden).
     ProductTile: `product tile` (device desktop | mobile × state default | hover), page `product card`. A record in a home
       shelf: media, title block (name, release info, body/medium), price row (price + samples, space-between), Button
       fill. desktop: the cover 1:1. mobile: every photo in a horizontal swipe gallery + `gallery counter` "1/3" (8 from
       the bottom-left corner). responsive (default) = desktop above the breakpoint, mobile below (one markup).
     GalleryCounter: `gallery counter` — "1/3", tag anatomy (padding 4/8), body/extra-small text/strong on surface/accent.
     ViewToggle: `view toggle` (view grid | list): a secondary Button that switches a shelf between tiles and cards.
       view=grid reads "List view" (icon bars-three); view=list reads "Grid view" (icon TODO in Figma, open.md). */
  function SectionHead(props) {
    var HeadingTag = 'h' + (props.headingLevel || 2);
    var hasMeta = props.meta !== undefined && props.meta !== null && props.meta !== false;
    return h('div', Object.assign({}, omit(props, ['title', 'meta', 'headingLevel', 'divider', 'actions', 'titleId', 'className']), { className: cx('zz-section-head', props.className) }),
      props.divider === false ? null : h(Divider),
      h('div', { className: 'zz-section-head__row' },
        h(HeadingTag, { className: 'zz-section-head__title body-medium', id: props.titleId }, props.title,
          hasMeta ? h('span', { className: 'zz-section-head__meta' }, ' ', props.meta) : null),
        props.actions ? h('div', { className: 'zz-section-head__actions' }, props.actions) : null));
  }
  function GenreLinks(props) {
    var genres = props.genres || [];
    return h('nav', Object.assign({}, omit(props, ['genres', 'layout', 'allHref', 'allLabel', 'className', 'aria-label']),
      { className: cx('zz-genre-links', props.className), 'data-layout': props.layout || 'responsive', 'aria-label': props['aria-label'] || 'Genres' }),
      h('ul', { className: 'zz-genre-links__list' }, genres.map(function (g) {
        return h('li', { key: g.href }, h(Tag, { size: 'large', href: g.href }, g.label));
      })),
      props.allHref ? h(Button, { hierarchy: 'secondary', size: 'extra-small', href: props.allHref, className: 'zz-genre-links__all' }, props.allLabel || 'All') : null);
  }
  function HomeIntro(props) {
    var device = props.device || 'responsive';
    var type = device === 'desktop' ? 'body-extra-large' : device === 'mobile' ? 'body-large' : 'body-extra-large body-large--mobile';
    return h('p', Object.assign({}, omit(props, ['device', 'className', 'children']), { className: cx('zz-home-intro', type, props.className), 'data-device': device }), props.children);
  }
  function HomeNewsletter(props) {
    var titleId = (props.id || 'zz-home-newsletter') + '-title';
    return h('section', Object.assign({}, omit(props, ['title', 'headingLevel', 'device', 'children', 'className']),
      { className: cx('zz-home-newsletter', props.className), 'data-device': props.device || 'responsive', 'aria-labelledby': titleId }),
      h('div', { className: 'zz-home-newsletter__box' },
        h(SectionHead, { title: props.title || 'Get new records first', headingLevel: props.headingLevel, divider: false, titleId: titleId }),
        props.children));
  }
  function GalleryCounter(props) {
    return h('span', Object.assign({}, omit(props, ['className', 'children']), { className: cx('zz-gallery-counter body-extra-small', props.className) }), props.children);
  }
  function ProductTile(props) {
    var device = props.device || 'responsive';
    var titleId = useId();
    var images = (props.images || []).filter(function (img) { return img && img.src; });
    var many = images.length > 1 && device !== 'desktop';
    var media = h('div', { className: 'zz-product-tile__media' },
      h(props.href ? 'a' : 'div', Object.assign({ className: 'zz-product-tile__gallery' },
        props.href ? { href: props.href, 'aria-labelledby': titleId } : {},
        many ? { 'data-tile-gallery': '' } : {}),
        (images.length ? images : [null]).map(function (img, i) {
          if (device === 'desktop' && i > 0) return null;
          return h('span', { key: i, className: 'zz-product-tile__photo' },
            img ? h('img', { src: img.src, srcSet: img.srcSet, sizes: img.srcSet ? img.sizes : undefined, alt: i === 0 ? img.alt || '' : '', loading: 'lazy' }) : null);
        })),
      // Figma boolean `counter`: only with more than one photo; scripts update the first number while swiping
      many && props.counter !== false ? h(GalleryCounter, { className: 'zz-product-tile__counter', 'aria-hidden': 'true', 'data-tile-counter': '' }, '1/' + images.length) : null);
    return h('article', Object.assign({
      className: cx('zz-product-tile', props.className),
      'data-device': device,
      'data-state': props.state && props.state !== 'default' ? props.state : undefined,   // doc-only pin (0009)
      'aria-labelledby': titleId
    }, omit(props, ['device', 'state', 'images', 'href', 'title', 'releaseInfo', 'price', 'samples', 'action', 'counter', 'headingLevel', 'className', 'children'])),
      media,
      h('div', { className: 'zz-product-tile__title-block' },
        h('h' + (props.headingLevel || 3), { id: titleId, className: 'zz-product-tile__name body-medium' }, props.title),
        props.releaseInfo ? h('p', { className: 'zz-product-tile__release body-medium' }, props.releaseInfo) : null),
      (props.price != null || props.samples) ? h('div', { className: 'zz-product-tile__price-row' },
        props.price != null ? h('p', { className: 'zz-product-tile__price body-medium' }, props.price) : null,
        props.samples ? h('div', { className: 'zz-product-tile__samples' }, props.samples) : null) : null,
      props.action ? h('div', { className: 'zz-product-tile__action' }, props.action) : null);
  }
  function ViewToggle(props) {
    var view = props.view || 'grid';
    return h(Button, Object.assign({ hierarchy: 'secondary' }, omit(props, ['view', 'className']), {
      className: cx('zz-view-toggle', props.className),
      'data-view': view,
      leadingIcon: view === 'grid' ? icon('icon-bars-three') : undefined   // view=list: grid icon still a placeholder in Figma (open.md)
    }), view === 'grid' ? 'List view' : 'Grid view');
  }

  return { Button: Button, Tabs: Tabs, Tab: Tab, Header: Header, Breadcrumbs: Breadcrumbs, ActiveFilter: ActiveFilter, Tag: Tag, TagGroup: TagGroup,
           PlayerButton: PlayerButton, IconButton: IconButton, Player: Player, ProductInfo: ProductInfo, ProductCard: ProductCard, BagItem: BagItem, OrderItem: OrderItem, OrderRow: OrderRow, BagSummary: BagSummary, RelatedProducts: RelatedProducts, ProductReturnCard: ProductReturnCard, Gallery: Gallery, HamburgerIcon: HamburgerIcon, PlayIcon: PlayIcon, PauseIcon: PauseIcon, PreviousIcon: PreviousIcon, NextIcon: NextIcon, CloseIcon: CloseIcon,
           Input: Input, DropZone: DropZone, FileList: FileList, FileItem: FileItem, SearchIcon: SearchIcon, ChevronDownIcon: ChevronDownIcon, ChevronDownLargeIcon: ChevronDownLargeIcon, DragHandleIcon: DragHandleIcon,
           Checkbox: Checkbox, Alert: Alert, Divider: Divider, ActionPanel: ActionPanel, ListingStatus: ListingStatus, ListingLine: ListingLine, SquareIcon: SquareIcon, SquareTickIcon: SquareTickIcon, SquareMinusIcon: SquareMinusIcon, Dialog: Dialog, Toast: Toast, ToastRegion: ToastRegion,
           EntityField: EntityField, EntityChip: EntityChip, LinkedInput: LinkedInput, XThinIcon: XThinIcon, PlusSmallThinIcon: PlusSmallThinIcon, TickLargeThinIcon: TickLargeThinIcon, ClockCounterClockwiseIcon: ClockCounterClockwiseIcon, EnvelopeIcon: EnvelopeIcon,
           Radio: Radio, RadioGroup: RadioGroup, RadioEmptyIcon: RadioEmptyIcon, RadioDotIcon: RadioDotIcon,
           Filter: Filter, FilterBlock: FilterBlock, Filters: Filters,
           FilterFacet: FilterFacet, FiltersLayer: FiltersLayer, PlpHeader: PlpHeader, MenuItem: MenuItem, MenuGroup: MenuGroup, MenuLayer: MenuLayer, Footer: Footer, FooterLinks: FooterLinks, FooterNewsletter: FooterNewsletter, SelectButton: SelectButton, ChevronRightIcon: ChevronRightIcon, ChevronLeftIcon: ChevronLeftIcon,
           TradeNote: TradeNote, DiscogsCard: DiscogsCard, Step: Step,
           ReleaseOption: ReleaseOption, ReleaseList: ReleaseList, ChosenRelease: ChosenRelease, MemoItem: MemoItem, BackLink: BackLink, DiscogsLink: DiscogsLink, BulkRecord: BulkRecord, BulkHelp: BulkHelp, ContentGroupHead: ContentGroupHead, ContentRow: ContentRow, ContentEditorHead: ContentEditorHead, LinkRow: LinkRow, SectionRow: SectionRow, ProgressBar: ProgressBar, useDragOrder: useDragOrder, DragHandle: DragHandle, AdminBar: AdminBar, ListingsHead: ListingsHead, ListingsFilter: ListingsFilter, Stat: Stat, Thumbnail: Thumbnail, ListingRow: ListingRow, OfferRow: OfferRow, ActionBar: ActionBar, OrderBlock: OrderBlock, FormSectionHead: FormSectionHead, Marker: Marker, PriceFields: PriceFields,
           NewsletterDialog: NewsletterDialog, SectionHead: SectionHead, GenreLinks: GenreLinks, HomeIntro: HomeIntro, HomeNewsletter: HomeNewsletter, ProductTile: ProductTile, GalleryCounter: GalleryCounter, ViewToggle: ViewToggle };
});
