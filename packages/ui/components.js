/* @ds-bundle: {"format":4,"namespace":"Zanza","components":[{"name":"Button"},{"name":"Tabs"},{"name":"Header"},{"name":"Breadcrumbs"},{"name":"Tag"},{"name":"PlayerButton"},{"name":"IconButton"},{"name":"Player"},{"name":"ProductInfo"},{"name":"ProductCard"},{"name":"RelatedProducts"},{"name":"Gallery"},{"name":"Input"},{"name":"DropZone"},{"name":"FileList"},{"name":"FileItem"}]} */
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
    var isLink = !!props.href;   // href → a link styled as a button (navigation, e.g. Player "View")
    var attrs = Object.assign(isLink ? {} : { type: props.type || 'button', disabled: disabled }, {
      className: cx('zz-button', props.className),
      'data-hierarchy': hierarchy,
      'data-size': size
    }, omit(props, ['hierarchy', 'size', 'disabled', 'leadingIcon', 'trailingIcon', 'children', 'state', 'className', 'type']));
    if (props.state && props.state !== 'default') attrs['data-state'] = props.state;
    // icon-only (no children): Figma hides the label container; aria-label is required by the consumer
    var hasLabel = props.children !== undefined && props.children !== null && props.children !== false;
    var typeClass = (size === 'small' || size === 'extra-small') ? 'label-extra-small' : 'label-medium';   // Figma text style per size
    return h(isLink ? 'a' : 'button', attrs,
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
  function PlayIcon() {   // Figma: icon/icon-play-ultra
    return h('svg', { viewBox: '0 0 24 24', fill: 'none' }, h('path', { d: 'M24 12L0 23.999V0.000976562L24 12Z', fill: 'currentColor' }));
  }
  function PauseIcon() {  // Figma: icon/pause-ultra
    return h('svg', { viewBox: '0 0 24 24', fill: 'none' }, h('path', { d: 'M9 24H8V0H9V24ZM16 24H15V0H16V24Z', fill: 'currentColor' }));
  }
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
  function PreviousIcon() {   // Figma: icon/play-previous-ultra
    return h('svg', { viewBox: '0 0 24 24', fill: 'none' }, h('path', { d: 'M1 11.5L24 0V24L1 12.5V24H0V0H1V11.5ZM2.23633 12L23 22.3818V1.61816L2.23633 12Z', fill: 'currentColor' }));
  }
  function NextIcon() {       // Figma: icon/play-next-ultra
    return h('svg', { viewBox: '0 0 24 24', fill: 'none' }, h('path', { d: 'M24 24H23V12.5L0 24V0.000976562L23 11.5V0H24V24ZM1 22.3818L21.7637 12L1 1.61816V22.3818Z', fill: 'currentColor' }));
  }
  function CloseIcon() {      // Figma: icon/icon-x-ultra
    return h('svg', { viewBox: '0 0 24 24', fill: 'none' }, h('path', { d: 'M11.7483 11.2881L23.0129 0.0233791L23.72 0.730486L12.4554 11.9952L23.7249 23.2647L23.0178 23.9718L11.7483 12.7023L0.725267 23.7253L0.0181598 23.0182L11.0412 11.9952L0.0229935 0.977006L0.7301 0.2699L11.7483 11.2881Z', fill: 'currentColor' }));
  }
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
    }, omit(props, ['device', 'image', 'trackPosition', 'sampleTitle', 'productName', 'index', 'total', 'playing', 'src',
                    'actions', 'onPrevious', 'onNext', 'onTogglePlay', 'onClose', 'audioRef', 'className', 'aria-label'])),
      // Figma: `now playing` — image 48 + title row (track position · sample title / product name)
      h('div', { className: 'zz-player__now' },
        h('div', { className: 'zz-player__image' }, img.src ? h('img', { src: img.src, alt: img.alt || '', width: 48, height: 48 }) : null),
        h('p', { className: 'zz-player__title body-medium', 'aria-live': 'polite' },
          h('span', { className: 'zz-player__track' }, props.trackPosition),
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
        onClick: props.onAdd,
        'aria-describedby': titleId
      }, d === 'mobile' ? (props.addLabelShort || 'Add') : (props.addLabel || 'Add to bag'));
    }
    return h('article', Object.assign({
      className: cx('zz-product-card', props.className),
      'data-device': device,
      'aria-labelledby': titleId
    }, omit(props, ['device', 'image', 'href', 'title', 'releaseInfo', 'price', 'description', 'grading', 'tags', 'samples',
                    'onAdd', 'addLabel', 'addLabelShort', 'headingLevel', 'className', 'children'])),
      // href: the cover becomes the link to the product page (no visual change; the link style is not designed yet)
      h(props.href ? 'a' : 'div', props.href ? { className: 'zz-product-card__image', href: props.href, 'aria-labelledby': titleId } : { className: 'zz-product-card__image' },
        img && img.src ? h('img', { src: img.src, alt: img.alt || '', loading: 'lazy' }) : null),
      h('div', { className: 'zz-product-card__info' },
        h('div', { className: 'zz-product-card__title-block' },
          h('h' + (props.headingLevel || 2), { id: titleId, className: cx('zz-product-card__name', t.head) }, props.title),
          props.releaseInfo ? h('p', { className: cx('zz-product-card__release', t.head) }, props.releaseInfo) : null),
        tags.length ? h(TagGroup, { className: 'zz-product-card__tags' },
          tags.map(function (tag, i) { return h(Tag, { key: i, size: t.tag, _typeClass: t.tagType }, tag); })) : null,
        props.samples ? h('div', { className: 'zz-product-card__samples' }, props.samples) : null),
      h('div', { className: 'zz-product-card__purchase' },
        device === 'responsive' ? [addButton('desktop'), addButton('mobile')] : addButton(device),
        props.price != null ? h('p', { className: cx('zz-product-card__price', t.head) }, props.price) : null),
      (props.description || props.grading)
        ? h('div', { className: 'zz-product-card__description' },
            props.description ? h('p', { className: t.meta }, props.description) : null,
            props.grading ? h('p', { className: t.meta }, props.grading) : null)
        : null);
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
    }, omit(props, ['title', 'headingLevel', 'className', 'children'])),
      h('h' + (props.headingLevel || 2), { id: titleId, className: 'zz-related-products__title body-medium' }, props.title),
      h('div', { className: 'zz-related-products__list' }, props.children));
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

  /* ══ Admin forms ═══════════════════════════════════════════════════════
     Used by the admin (Figma page BACKEND → Create). Render inside data-theme="backend" (Figma mode `backend`). */

  function SearchIcon() {        // Figma: icon/icon-magnifying-glass
    return h('svg', { viewBox: '0 0 24 24', fill: 'none' }, h('path', { d: 'M11.3613 1.68359C16.3162 1.68363 20.3336 5.70051 20.334 10.6553C20.334 13.1749 19.2928 15.4502 17.6201 17.0801L22.4941 21.7676C22.6929 21.9589 22.6988 22.2756 22.5078 22.4746C22.3164 22.6734 21.9997 22.6796 21.8008 22.4883L16.8633 17.7393C15.3435 18.9214 13.4357 19.6279 11.3613 19.6279C6.40638 19.6278 2.38965 15.6103 2.38965 10.6553C2.39002 5.7006 6.40661 1.68377 11.3613 1.68359ZM11.3613 2.68359C6.95889 2.68377 3.39002 6.25288 3.38965 10.6553C3.38965 15.058 6.95866 18.6278 11.3613 18.6279C15.7641 18.6279 19.334 15.0581 19.334 10.6553C19.3336 6.2528 15.7639 2.68363 11.3613 2.68359Z', fill: 'currentColor' }));
  }
  function ChevronDownIcon() {   // Figma: icon/icon-chevron-down-small-thin
    return h('svg', { viewBox: '0 0 24 24', fill: 'none' }, h('path', { d: 'M17.6465 9.14652C17.8417 8.95126 18.1583 8.95126 18.3535 9.14652C18.5487 9.34179 18.5488 9.6583 18.3535 9.85355L12.3535 15.8536C12.1583 16.0488 11.8417 16.0488 11.6465 15.8536L5.64648 9.85355C5.45122 9.65829 5.45122 9.34178 5.64648 9.14652C5.84175 8.95126 6.15825 8.95126 6.35352 9.14652L12 14.793L17.6465 9.14652Z', fill: 'currentColor' }));
  }
  function DragHandleIcon() {    // Figma: icon/hamburger-menu-ultra at 24 (the `drag handle` instance)
    return h('svg', { viewBox: '0 0 24 24', fill: 'none' }, h('path', { d: 'M24 16H0V15H24V16ZM24 12H0V11H24V12ZM24 8H0V7H24V8Z', fill: 'currentColor' }));
  }

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
    var leading = props.leadingIcon !== undefined ? props.leadingIcon : (variant === 'search' ? h(SearchIcon) : null);
    var trailing = props.trailingIcon !== undefined ? props.trailingIcon : (variant === 'select' ? h(ChevronDownIcon) : null);
    var own = ['variant', 'size', 'label', 'optional', 'optionalLabel', 'supportText', 'error', 'prefix', 'suffix',
               'leadingIcon', 'trailingIcon', 'className', 'style', 'id', 'children', 'placeholder', 'readOnly'];
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
        leading ? h('span', { className: 'zz-input__icon', 'aria-hidden': 'true' }, leading) : null,
        props.prefix ? h('span', { className: 'zz-input__affix body-medium', 'aria-hidden': 'true' }, props.prefix) : null,
        control,
        props.suffix ? h('span', { className: 'zz-input__affix body-medium', 'aria-hidden': 'true' }, props.suffix) : null,
        trailing ? h('span', { className: 'zz-input__icon zz-input__icon--trailing', 'aria-hidden': 'true' }, trailing) : null),
      support ? h('p', { id: supportId, className: 'zz-input__support body-small' }, support) : null);
  }

  /* ── DropZone ───────────────────────────────────────────────────────────
     Figma: the page-local frame below each upload list on BACKEND → Create ("Frame 4"); no Figma component yet.
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
     Figma: the page-local `uploaded list` frames on BACKEND → Create (images, the sample of a line, samples overview);
     no Figma component yet. A row: [drag handle] · [thumbnail 40 | play] position name (featured) · [remove ×].
     Gaps: list 8, row 16, content 8 (Figma). Reorder: drag a row (pointer): the other rows shift live to the order it would have on drop; or ↑ ↓ on the handle
     (keyboard), announced in a polite live region. FileList numbers the rows ("01", "02"…) in the shown order,
     so positions follow the preview while dragging. */
  var FileListContext = React.createContext(null);

  var blankImage = null;   // a transparent 1×1 image, to replace the browser drag image
  function blankDragImage() {
    if (!blankImage) { blankImage = new Image(1, 1); blankImage.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'; }
    return blankImage;
  }

  function FileList(props) {
    var listRef = React.useRef(null);
    var tops = React.useRef({});          // layout top of each row by key, for the keyboard-move slide (FLIP)
    var focusKey = React.useRef(null);    // keyboard move: the row whose handle keeps the focus
    var dropped = React.useRef(false);    // drop: the preview becomes the order, without sliding again
    // drag = { from, to, rows: [{ top, height }], gap, grab }: while dragging, the DOM keeps the old order and the
    // rows are translated to where they would be after the drop (the others shift live); committed on drop,
    // reverted on dragend elsewhere. Moving DOM nodes during a native drag would cancel the drop in Chromium.
    var dragState = React.useState(null), drag = dragState[0], setDrag = dragState[1];
    var dragRef = React.useRef(null);
    var liveState = React.useState(''), live = liveState[0], setLive = liveState[1];
    var items = React.Children.toArray(props.children);
    var move = props.onMove;
    React.useEffect(function () { if (move) blankDragImage(); }, [!!move]);   // loaded before the first drag

    function update(next) { dragRef.current = next; setDrag(next); }
    function itemName(i) { var c = items[i]; return (c && c.props && c.props.name) || ('item ' + (i + 1)); }
    function commit(from, to, viaKeyboard) {
      if (from === to) return;
      if (viaKeyboard) focusKey.current = items[from].key; else dropped.current = true;
      setLive(itemName(from) + ', position ' + (to + 1) + ' of ' + items.length);
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
        var handle = list.querySelector('[data-key="' + focusKey.current + '"] .zz-file-item__handle');
        focusKey.current = null;
        if (handle && document.activeElement !== handle) handle.focus();
      }
    });

    function onDragStart(i, e) {
      // selecting text in a field of the row (e.g. a sample title) must not drag the row
      if (e.target.closest && e.target.closest('input, textarea, select')) { e.preventDefault(); return; }
      e.dataTransfer.effectAllowed = 'move';
      try { e.dataTransfer.setData('text/plain', itemName(i)); } catch (err) { /* Firefox starts a drag only with data */ }
      var list = listRef.current, lis = list.children;
      var rows = Array.prototype.map.call(lis, function (li) { return { top: li.offsetTop, height: li.offsetHeight }; });
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

    return h(React.Fragment, null,
      h('ol', Object.assign({ ref: listRef, className: cx('zz-file-list', props.className), 'data-dragging': drag ? 'true' : undefined,
        onDragOver: move ? function (e) {
          var d = dragRef.current; if (!d) return;
          e.preventDefault();
          var to = slotAt(e.clientY);
          if (to !== d.to || !d.over) update(Object.assign({}, d, { to: to, over: true }));
        } : undefined,
        // left the list (or Escape, which fires a dragleave): on dragend the old order comes back
        onDragLeave: move ? function (e) {
          var d = dragRef.current; if (!d) return;
          var b = listRef.current.getBoundingClientRect();
          if (e.clientX <= b.left || e.clientX >= b.right || e.clientY <= b.top || e.clientY >= b.bottom) update(Object.assign({}, d, { over: false }));
        } : undefined,
        onDrop: move ? function (e) {
          var d = dragRef.current; if (!d) return;
          e.preventDefault(); update(null); commit(d.from, d.to);
        } : undefined
      }, omit(props, ['onMove', 'children', 'className'])),
        items.map(function (child, i) {
          var s = slot(i);
          return h('li', {
            key: child.key || i,
            'data-key': child.key || i,
            'data-dragged': drag && drag.from === i ? 'true' : undefined,
            className: 'zz-file-list__item',
            style: s.dy && !(drag && drag.from === i) ? { transform: 'translateY(' + s.dy + 'px)' } : undefined,   // the dragged row follows the pointer (set in onDragStart)
            draggable: move ? true : undefined,
            onDragStart: move ? function (e) { onDragStart(i, e); } : undefined,
            // Chromium fires no drop when the pointer is over the drag source, and the dragged row is translated under it:
            // so dragend commits the preview while the pointer is still on the list, and reverts it otherwise
            onDragEnd: move ? function () { var d = dragRef.current; if (!d) return; update(null); if (d.over) commit(d.from, d.to); } : undefined
          }, h(FileListContext.Provider, { value: { index: s.pos, count: items.length, move: move && function (from, to) { commit(from, to, true); } } }, child));
        })),
      move ? h('span', { className: 'zz-file-list__status', role: 'status', 'aria-live': 'polite' }, live) : null);
  }

  function FileItem(props) {
    var ctx = React.useContext(FileListContext) || { index: 0, count: 1 };
    var position = props.position !== undefined ? props.position : String(ctx.index + 1).padStart(2, '0');
    var name = props.name;
    function onHandleKey(e) {
      if (!ctx.move) return;
      if (e.key === 'ArrowUp' && ctx.index > 0) { e.preventDefault(); ctx.move(ctx.index, ctx.index - 1); }
      if (e.key === 'ArrowDown' && ctx.index < ctx.count - 1) { e.preventDefault(); ctx.move(ctx.index, ctx.index + 1); }
    }
    var playable = !!props.onTogglePlay;
    var hasBody = !!props.children;
    var remove = props.onRemove ? h(IconButton, { className: 'zz-file-item__remove', icon: h(CloseIcon), 'aria-label': props.removeLabel || ('Remove ' + name), onClick: props.onRemove }) : null;
    return h('div', Object.assign({
      className: cx('zz-file-item', props.className),
      'data-media': props.image ? 'image' : (playable ? 'audio' : undefined),
      'data-body': hasBody ? 'true' : undefined
    }, omit(props, ['name', 'position', 'image', 'featured', 'featuredLabel', 'playing', 'onTogglePlay', 'onRemove', 'removeLabel', 'reorderLabel', 'className', 'children'])),
      ctx.move ? h('button', {
        type: 'button', className: 'zz-file-item__handle',
        'aria-label': props.reorderLabel || ('Move ' + name + ', position ' + (ctx.index + 1) + ' of ' + ctx.count + ' (arrow up / down)'),
        onKeyDown: onHandleKey
      }, h('span', { className: 'zz-file-item__handle-icon', 'aria-hidden': 'true' }, h(DragHandleIcon))) : null,
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

  /* ── Checkbox ───────────────────────────────────────────────────────────
     Figma: page `controls` → `checkbox` (state default | active). A native checkbox (0018): the input is visually
     hidden and drives the drawn box (icon/icon-square ↔ icon/icon-square-tick); the label is clickable.
     state=active = checked. Focus: browser ring on the box (no focus token yet, design/open.md). */
  function SquareIcon() {        // Figma: icon/icon-square
    return h('svg', { viewBox: '0 0 24 24', fill: 'none' }, h('path', { d: 'M19.5 3.25C20.1904 3.25 20.75 3.80964 20.75 4.5V19.5C20.75 20.1904 20.1904 20.75 19.5 20.75H4.5C3.80964 20.75 3.25 20.1904 3.25 19.5V4.5C3.25 3.80964 3.80964 3.25 4.5 3.25H19.5ZM4.5 4.25C4.36193 4.25 4.25 4.36193 4.25 4.5V19.5C4.25 19.6381 4.36193 19.75 4.5 19.75H19.5C19.6381 19.75 19.75 19.6381 19.75 19.5V4.5C19.75 4.36193 19.6381 4.25 19.5 4.25H4.5Z', fill: 'currentColor' }));
  }
  function SquareTickIcon() {    // Figma: icon/icon-square-tick
    return h('svg', { viewBox: '0 0 24 24', fill: 'none' }, h('path', { d: 'M19.5 3.25C20.1904 3.25 20.75 3.80964 20.75 4.5V19.5C20.75 20.1904 20.1904 20.75 19.5 20.75H4.5C3.80964 20.75 3.25 20.1904 3.25 19.5V4.5C3.25 3.80964 3.80964 3.25 4.5 3.25H19.5ZM4.5 4.25C4.36193 4.25 4.25 4.36193 4.25 4.5V19.5C4.25 19.6381 4.36193 19.75 4.5 19.75H19.5C19.6381 19.75 19.75 19.6381 19.75 19.5V4.5C19.75 4.36193 19.6381 4.25 19.5 4.25H4.5ZM15.3965 9.39648C15.5917 9.20122 15.9083 9.20122 16.1035 9.39648C16.2988 9.59175 16.2988 9.90825 16.1035 10.1035L10.8535 15.3535C10.6583 15.5488 10.3417 15.5488 10.1465 15.3535L7.89648 13.1035C7.70122 12.9083 7.70122 12.5917 7.89648 12.3965C8.09175 12.2012 8.40825 12.2012 8.60352 12.3965L10.5 14.293L15.3965 9.39648Z', fill: 'currentColor' }));
  }
  function SquareMinusIcon() {   // Figma: icon/icon-square-minus (2026-11-10, checkbox state=indeterminate)
    return h('svg', { viewBox: '0 0 24 24', fill: 'none' }, h('path', { d: 'M19.5 3.25C20.1904 3.25 20.75 3.80964 20.75 4.5V19.5C20.75 20.1904 20.1904 20.75 19.5 20.75H4.5C3.80964 20.75 3.25 20.1904 3.25 19.5V4.5C3.25 3.80964 3.80964 3.25 4.5 3.25H19.5ZM4.5 4.25C4.36193 4.25 4.25 4.36193 4.25 4.5V19.5C4.25 19.6381 4.36193 19.75 4.5 19.75H19.5C19.6381 19.75 19.75 19.6381 19.75 19.5V4.5C19.75 4.36193 19.6381 4.25 19.5 4.25H4.5ZM16 12.5H8V11.5H16V12.5Z', fill: 'currentColor' }));
  }
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
      'onConfirm', 'cancelLabel', 'confirmLabel', 'busy'])),
      h('div', { className: 'zz-dialog__content' },
        h('h2', { id: titleId, className: 'zz-dialog__title label-large' }, props.title),
        h('div', { id: bodyId, className: 'zz-dialog__body body-medium' }, props.children)),
      h('div', { className: 'zz-dialog__actions' },
        h(Button, { hierarchy: 'secondary', type: 'button', 'data-dialog-cancel': '', onClick: props.onCancel }, props.cancelLabel || 'Cancel'),
        h(Button, { hierarchy: 'primary', type: 'button', onClick: props.busy ? undefined : props.onConfirm, 'aria-busy': props.busy ? 'true' : undefined },
          props.confirmLabel)));
  }

  /* ── EntityField + EntityChip ──────────────────────────────────────────
     Figma (Gio approved 2026-11-10, decision 0020): the `input` with `chips` on (field padding 6), `entity chip`
     (page tags; state default | hover | focus) and `entity option` (page input › building blocks; kind entity | alias |
     create × state default | active). Examples: BACKEND → Create, "Entity field (chips) · examples" (2106:676).
     A field whose value is a list of entities (artists, labels, tags): each chosen entity is a chip, text that is not
     a chip is not a value. Suggestions in a menu below the field (WAI-ARIA combobox + listbox, keyboard: arrows,
     Enter, Escape, Backspace on the empty field removes the last chip). `multiple={false}`: one chip, and the text
     box is hidden while it is there (remove the chip to change it). */
  function XThinIcon() {      // Figma: icon/icon-x-thin
    return h('svg', { viewBox: '0 0 24 24', fill: 'none' }, h('path', { d: 'M5.07538 5.07538C5.27064 4.88014 5.58723 4.88012 5.78248 5.07538L12.5 11.7929L19.2175 5.07538C19.4128 4.88012 19.7294 4.88012 19.9246 5.07538C20.1199 5.27064 20.1199 5.58723 19.9246 5.78249L13.2071 12.5L19.9246 19.2175C20.1199 19.4128 20.1199 19.7294 19.9246 19.9246C19.7294 20.1199 19.4128 20.1199 19.2175 19.9246L12.5 13.2071L5.78248 19.9246C5.58723 20.1199 5.27064 20.1199 5.07538 19.9246C4.88012 19.7294 4.88012 19.4128 5.07538 19.2175L11.7929 12.5L5.07538 5.78249C4.88012 5.58722 4.88012 5.27064 5.07538 5.07538Z', fill: 'currentColor' }));
  }
  function PlusSmallThinIcon() {      // Figma: icon/icon-plus-small-thin
    return h('svg', { viewBox: '0 0 24 24', fill: 'none' }, h('path', { d: 'M12 6.5C12.2761 6.5 12.5 6.72386 12.5 7V11.5H17C17.2761 11.5 17.5 11.7239 17.5 12C17.5 12.2761 17.2761 12.5 17 12.5H12.5V17C12.5 17.2761 12.2761 17.5 12 17.5C11.7239 17.5 11.5 17.2761 11.5 17V12.5H7C6.72386 12.5 6.5 12.2761 6.5 12C6.5 11.7239 6.72386 11.5 7 11.5H11.5V7C11.5 6.72386 11.7239 6.5 12 6.5Z', fill: 'currentColor' }));
  }
  function EntityChip(props) {
    var label = props.label !== undefined ? props.label : props.children;
    return h('span', Object.assign({ className: cx('zz-entity-chip', props.className), 'data-state': props.state },
      omit(props, ['label', 'children', 'className', 'onRemove', 'removeLabel', 'state'])),
      h('span', { className: 'zz-entity-chip__label body-small' }, label),
      h('button', { type: 'button', className: 'zz-entity-chip__remove', 'aria-label': props.removeLabel || ('Remove ' + label),
        onClick: props.onRemove, tabIndex: props.onRemove ? undefined : -1 }, h(XThinIcon)));
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

  return { Button: Button, Tabs: Tabs, Tab: Tab, Header: Header, Breadcrumbs: Breadcrumbs, Tag: Tag, TagGroup: TagGroup,
           PlayerButton: PlayerButton, IconButton: IconButton, Player: Player, ProductInfo: ProductInfo, ProductCard: ProductCard, RelatedProducts: RelatedProducts, Gallery: Gallery, HamburgerIcon: HamburgerIcon, PlayIcon: PlayIcon, PauseIcon: PauseIcon, PreviousIcon: PreviousIcon, NextIcon: NextIcon, CloseIcon: CloseIcon,
           Input: Input, DropZone: DropZone, FileList: FileList, FileItem: FileItem, SearchIcon: SearchIcon, ChevronDownIcon: ChevronDownIcon, DragHandleIcon: DragHandleIcon,
           Checkbox: Checkbox, SquareIcon: SquareIcon, SquareTickIcon: SquareTickIcon, SquareMinusIcon: SquareMinusIcon, Dialog: Dialog,
           EntityField: EntityField, EntityChip: EntityChip, XThinIcon: XThinIcon, PlusSmallThinIcon: PlusSmallThinIcon };
});
