/* @ds-bundle: {"format":4,"namespace":"Zanza","components":[{"name":"Button"},{"name":"Tabs"},{"name":"Header"},{"name":"Breadcrumbs"},{"name":"Tag"},{"name":"PlayerButton"},{"name":"ProductInfo"},{"name":"Gallery"}]} */
/* packages/ui/components.js — the ONE implementation of the Zanza components.
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

  /* ── Button ─────────────────────────────────────────────────────────────
     Figma: `button` (page buttons → section button). Variants hierarchy × size; states via pseudo-classes. */
  function Button(props) {
    var hierarchy = props.hierarchy || 'primary';
    var size = props.size || 'medium';
    var disabled = !!props.disabled || props.state === 'disabled';
    var attrs = Object.assign({
      type: props.type || 'button',
      className: cx('zz-button', props.className),
      'data-hierarchy': hierarchy,
      'data-size': size,
      disabled: disabled
    }, omit(props, ['hierarchy', 'size', 'disabled', 'leadingIcon', 'trailingIcon', 'children', 'state', 'className', 'type']));
    if (props.state && props.state !== 'default') attrs['data-state'] = props.state;
    // icon-only (no children): Figma hides the label container; aria-label is required by the consumer
    var hasLabel = props.children !== undefined && props.children !== null && props.children !== false;
    var typeClass = size === 'extra-small' ? 'label-extra-small' : 'label-medium';   // Figma text style per size
    return h('button', attrs,
      props.leadingIcon ? h('span', { className: 'zz-button__icon', 'aria-hidden': 'true' }, props.leadingIcon) : null,
      hasLabel ? h('span', { className: cx('zz-button__label', typeClass) }, props.children) : null,
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
    }, omit(props, ['value', 'children', 'leadingIcon', 'trailingIcon', 'state', 'className', 'onClick']));
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
      h('span', { className: 'zz-tab__label label-medium' }, props.children),
      props.trailingIcon ? h('span', { className: 'zz-tab__icon', 'aria-hidden': 'true' }, props.trailingIcon) : null);
  }

  /* ── Header ─────────────────────────────────────────────────────────────
     Figma: `header` (device=desktop | mobile). Composition: logo + store name, Tabs (desktop), actions, menu (mobile), 1px rule.
     `device` omitted → responsive: both the menu button and the tabs are rendered and CSS shows one of them (see components.css). */
  function HamburgerIcon() {
    // Figma: icon/hamburger-menu-ultra (20×20)
    return h('svg', { viewBox: '0 0 20 20', fill: 'none' },
      h('path', { d: 'M20 13.333H0V12.333H20V13.333ZM20 10H0V9H20V10ZM20 6.66699H0V5.66699H20V6.66699Z', fill: 'currentColor' }));
  }

  function Header(props) {
    var device = props.device || 'responsive';
    var showMenu = device !== 'desktop';
    var showTabs = device !== 'mobile' && !!props.tabs;
    var nameTag = props.homeHref ? 'a' : 'div';
    var nameAttrs = { className: 'zz-header__name label-medium' };
    if (props.homeHref) nameAttrs.href = props.homeHref;

    return h('header', Object.assign({
      className: cx('zz-header', props.className),
      'data-device': device
    }, omit(props, ['device', 'logo', 'storeName', 'homeHref', 'tabs', 'actions', 'onMenuClick', 'menuLabel', 'className', 'children'])),
      h('div', { className: 'zz-header__row' },
        h('div', { className: 'zz-header__leading' },
          showMenu ? h(Button, { className: 'zz-header__menu', hierarchy: 'secondary', leadingIcon: h(HamburgerIcon), 'aria-label': props.menuLabel || 'Menu', onClick: props.onMenuClick }) : null,
          props.logo ? h('div', { className: 'zz-header__logo' }, props.logo) : null,
          props.storeName ? h(nameTag, nameAttrs, props.storeName) : null),
        showTabs ? h('div', { className: 'zz-header__tabs' }, props.tabs) : null,
        props.actions ? h('div', { className: 'zz-header__trailing' }, props.actions) : null),
      h('div', { className: 'zz-header__rule', role: 'presentation' }));
  }

  /* ── Breadcrumbs ────────────────────────────────────────────────────────
     Figma: `breadcrumbs` (page breadcrumbs). body/medium items separated by "/", padding `small`, 1px rule below. */
  function Breadcrumbs(props) {
    var items = props.items || [];
    var nodes = [];
    items.forEach(function (it, i) {
      var last = i === items.length - 1;
      var label = typeof it === 'string' ? it : it.label;
      var href = typeof it === 'string' ? null : it.href;
      if (i > 0) nodes.push(h('li', { key: 'sep' + i, className: 'zz-breadcrumbs__sep', 'aria-hidden': 'true' }, '/'));
      nodes.push(h('li', { key: 'it' + i, className: 'zz-breadcrumbs__item' },
        href && !last
          ? h('a', { href: href }, label)
          : h('span', last ? { 'aria-current': 'page' } : null, label)));
    });
    return h('nav', Object.assign({
      className: cx('zz-breadcrumbs', props.className),
      'aria-label': props['aria-label'] || 'Breadcrumb'
    }, omit(props, ['items', 'className', 'aria-label'])),
      h('ol', { className: 'zz-breadcrumbs__list body-medium' }, nodes),
      h('div', { className: 'zz-breadcrumbs__rule', role: 'presentation' }));
  }

  /* ── Tag / TagGroup ─────────────────────────────────────────────────────
     Figma: `tag item` (size extra small | small | medium, bg surface/support-1, body text) and `tag group` (wrap, gap 4). */
  var TAG_TYPE = { 'extra-small': 'body-extra-small', small: 'body-extra-small', medium: 'body-small', large: 'body-medium' };   // Figma text style per size
  function Tag(props) {
    var size = props.size || 'small';
    return h('span', Object.assign({
      className: cx('zz-tag', props.className),
      'data-size': size
    }, omit(props, ['size', 'children', 'className'])),
      h('span', { className: cx('zz-tag__label', TAG_TYPE[size]) }, props.children));
  }

  function TagGroup(props) {
    return h('ul', Object.assign({
      className: cx('zz-tag-group', props.className)
    }, omit(props, ['children', 'className'])),
      React.Children.map(props.children, function (c, i) { return c ? h('li', { key: i, className: 'zz-tag-group__item' }, c) : null; }));
  }

  /* ── PlayerButton ───────────────────────────────────────────────────────
     Figma: `player button` (state default | playing). icon 24 + label body/medium, gap 0. */
  function PlayIcon() {   // Figma: icon/icon-play-ultra
    return h('svg', { viewBox: '0 0 24 24', fill: 'none' }, h('path', { d: 'M24 12L0 23.999V0.000976562L24 12Z', fill: 'currentColor' }));
  }
  function PauseIcon() {  // Figma: icon/pause-ultra
    return h('svg', { viewBox: '0 0 24 24', fill: 'none' }, h('path', { d: 'M9 24H8V0H9V24ZM16 24H15V0H16V24Z', fill: 'currentColor' }));
  }
  function PlayerButton(props) {
    var playing = !!props.playing;
    return h('button', Object.assign({
      type: 'button',
      className: cx('zz-player-button', props.className),
      'data-state': playing ? 'playing' : 'default',
      'aria-pressed': playing ? 'true' : 'false'
    }, omit(props, ['playing', 'children', 'className'])),
      h('span', { className: 'zz-player-button__icon', 'aria-hidden': 'true' }, playing ? h(PauseIcon) : h(PlayIcon)),
      h('span', { className: 'zz-player-button__label body-medium' }, props.children));
  }

  /* ── ProductInfo ────────────────────────────────────────────────────────
     Figma: `product info` (device=desktop | mobile). Inner grid 3 cols × 2 rows:
     row 1 = details (title row, release info, tags, description, grading), row 2 = samples
     (desktop: middle column; mobile: full width, horizontal). Breakpoint via CSS (`--mobile`, tokens.json).
     Type: name/price/release = body-extra-large (desktop) · body-large (mobile); responsive = both, the --mobile class wins below the breakpoint. */
  function ProductInfo(props) {
    var device = props.device || 'responsive';
    var headType = device === 'desktop' ? 'body-extra-large' : device === 'mobile' ? 'body-large' : 'body-extra-large body-large--mobile';
    return h('section', Object.assign({
      className: cx('zz-product-info', props.className),
      'data-device': device
    }, omit(props, ['device', 'title', 'price', 'releaseInfo', 'tags', 'description', 'grading', 'samples', 'className', 'children'])),
      h('div', { className: 'zz-product-info__details' },
        h('div', { className: 'zz-product-info__title-block' },
          h('div', { className: 'zz-product-info__title-row' },
            h('h1', { className: cx('zz-product-info__name', headType) }, props.title),
            props.price != null ? h('p', { className: cx('zz-product-info__price', headType) }, props.price) : null),
          props.releaseInfo ? h('p', { className: cx('zz-product-info__release', headType) }, props.releaseInfo) : null),
        props.tags ? h('div', { className: 'zz-product-info__tags' }, props.tags) : null,
        (props.description || props.grading)
          ? h('div', { className: 'zz-product-info__description-block' },
              props.description ? h('p', { className: 'zz-product-info__description body-medium' }, props.description) : null,
              props.grading ? h('p', { className: 'zz-product-info__grading body-medium' }, props.grading) : null)
          : null),
      props.samples ? h('div', { className: 'zz-product-info__samples' }, props.samples) : null);
  }

  /* ── Gallery ────────────────────────────────────────────────────────────
     Figma: PDP `product image` ×2 (desktop: big + half-width below; mobile: `mobile gallery`, horizontal swipe).
     The Figma gallery component is not designed yet: this mirrors the PDP placement. */
  function Gallery(props) {
    var images = props.images || [];
    var device = props.device || 'responsive';
    return h('div', Object.assign({
      className: cx('zz-gallery', props.className),
      'data-device': device,
      role: 'group',
      'aria-label': props['aria-label'] || 'Product images'
    }, omit(props, ['images', 'device', 'className', 'aria-label'])),
      images.map(function (img, i) {
        return h('div', { key: i, className: 'zz-gallery__item' },
          img && img.src ? h('img', { src: img.src, alt: img.alt || '', loading: i === 0 ? 'eager' : 'lazy' }) : null);
      }));
  }

  return { Button: Button, Tabs: Tabs, Tab: Tab, Header: Header, Breadcrumbs: Breadcrumbs, Tag: Tag, TagGroup: TagGroup,
           PlayerButton: PlayerButton, ProductInfo: ProductInfo, Gallery: Gallery, HamburgerIcon: HamburgerIcon, PlayIcon: PlayIcon, PauseIcon: PauseIcon };
});
