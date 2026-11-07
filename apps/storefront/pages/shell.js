/* apps/storefront/pages/shell.js — what every page shares: the site header and the data → text mapping.
   Pure functions, no state. */
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
const productHref = (product, url) => url(`/products/${product.listing.slug}/`);

// Figma: `header` (device=desktop | mobile), the same on every page
function SiteHeader({ site, url, section }) {
  return h(Z.Header, {
    className: 'site-header',   // sticky on scroll up: base.css + scripts/site.js
    logo: h('img', { src: url('/assets/logo.png'), alt: '', width: 64, height: 64 }),
    storeName: site.storeName,
    homeHref: url('/'),
    tabs: h(Z.Tabs, { as: 'nav', value: section, 'aria-label': 'Section' },
      h(Z.Tab, { value: 'sale', href: url('/sale/') }, 'For sale'),
      h(Z.Tab, { value: 'trade', href: url('/trade/') }, 'For trade')),
    actions: h(React.Fragment, null,
      h(Z.Button, { hierarchy: 'secondary', className: 'zz-header__account' }, 'Account'),
      h(Z.Button, { hierarchy: 'secondary' }, 'Bag'))
  });
}

// the data the site player (scripts/site.js) reads from a PlayerButton: a product's samples are its queue
function sampleAttrs(product, s, url) {
  const { release } = product;
  return {
    disabled: !s.audio_url,
    'data-sample-src': s.audio_url ? url(s.audio_url) : undefined,
    'data-sample-title': s.title,
    'data-sample-track': s.track_position,
    'data-product-name': productName(release),
    'data-product-image': release.cover ? url(release.cover) : undefined,
    'data-product-href': productHref(product, url)
  };
}

// A product as a ProductCard (PLP list, PDP "More for sale"). No device: responsive card.
// Figma labels the card samples 1, 2…; the accessible name keeps the product and the sample title.
function ProductCardFor({ product, url, headingLevel }) {
  const { listing, release, copy, samples } = product;
  return h(Z.ProductCard, {
    href: productHref(product, url),
    image: release.cover ? { src: url(release.cover), alt: '' } : null,
    title: productName(release),
    headingLevel,
    releaseInfo: releaseInfo(release),
    price: listing.section === 'sale' ? formatPrice(listing.price) : null,
    tags: release.style,
    description: copy.notes,
    grading: grading(copy),
    samples: samples.length ? samples.map((s, i) => h(Z.PlayerButton, Object.assign({
      key: s.track_position,
      'aria-label': `${productName(release)}, sample ${i + 1}: ${s.title}`
    }, sampleAttrs(product, s, url)), String(i + 1))) : null
  });
}

module.exports = { SECTION_LABEL, formatPrice, productName, releaseInfo, grading, productHref, SiteHeader, sampleAttrs, ProductCardFor };
