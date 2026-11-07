/* apps/storefront/pages/pdp.js — Product detail page (Figma: PDP - desktop / PDP - mobile).
   A pure function: product data in, React tree out. When the commerce backend arrives,
   only the data source changes (JSON file → API), not this page. */
'use strict';
const React = require('react');
const Z = require('../../../packages/ui/components.js');
const h = React.createElement;

const SECTION_LABEL = { sale: 'For sale', trade: 'For trade' };

// ── data → text (mapping confirmed 2026-11-07) ──
const formatPrice = (p) => `${p.amount % 100 === 0 ? p.amount / 100 : (p.amount / 100).toFixed(2)}€`;
const productName = (r) => `${r.artist} - ${r.title}`;
const releaseInfo = (r) => [r.label, r.format, r.country ? `(${r.country})` : null].filter(Boolean).join(' ');
const grading = (c) => `Grading: ${c.condition_media}`;

function breadcrumbItems(product, url) {
  const { listing, release } = product;
  return [
    { label: SECTION_LABEL[listing.section], href: url(`/${listing.section}/`) },
    { label: release.style[0] || release.genre[0], href: null },
    { label: release.format, href: null }
  ];
}

function Pdp({ product, site, url }) {
  const { listing, release, copy, samples } = product;
  return h('div', { className: 'zz-page' },
    h(Z.Header, {
      className: 'site-header',   // sticky on scroll up: base.css + scripts/site.js
      logo: h('img', { src: url('/assets/logo.png'), alt: '', width: 64, height: 64 }),
      storeName: site.storeName,
      homeHref: url('/'),
      tabs: h(Z.Tabs, { as: 'nav', value: listing.section, 'aria-label': 'Section' },
        h(Z.Tab, { value: 'sale', href: url('/sale/') }, 'For sale'),
        h(Z.Tab, { value: 'trade', href: url('/trade/') }, 'For trade')),
      actions: h(React.Fragment, null,
        h(Z.Button, { hierarchy: 'secondary', className: 'zz-header__account' }, 'Account'),
        h(Z.Button, { hierarchy: 'secondary' }, 'Bag'))
    }),
    h(Z.Breadcrumbs, { items: breadcrumbItems(product, url) }),

    // Figma: `pdp content` — 12-col grid (desktop) / 4-col (mobile), gap gutter-small, padding-y small
    h('main', { className: 'pdp-content' },
      // Figma: `product image` ×2 / `mobile gallery` — images: cover + first copy photo
      h(Z.Gallery, {
        className: 'pdp-content__gallery',
        images: [release.cover, copy.photos[0]].filter(Boolean).map((src, i) => ({ src: url(src), alt: i === 0 ? productName(release) : '' }))
      }),
      h(Z.ProductInfo, {
        className: 'pdp-content__info',
        title: productName(release),
        price: listing.section === 'sale' ? formatPrice(listing.price) : null,
        releaseInfo: releaseInfo(release),
        tags: release.style.length ? h(Z.TagGroup, null, release.style.map((s) => h(Z.Tag, { key: s, size: 'large' }, s))) : null,
        description: copy.notes,
        grading: grading(copy),
        samples: samples.length ? samples.map((s) => h(Z.PlayerButton, { key: s.track_position }, s.title)) : null
      }),
      h('div', { className: 'pdp-content__actions' },
        h(Z.Button, { hierarchy: 'primary', size: 'large', className: 'pdp-content__cta' }, 'Add to bag'))
    )
  );
}

module.exports = { Pdp, title: (p) => productName(p.release) };
