/* apps/storefront/pages/pdp.js — Product detail page (Figma: PDP - desktop / PDP - mobile).
   A pure function: product data in, React tree out. When the commerce backend arrives,
   only the data source changes (JSON file → API), not this page. */
'use strict';
const React = require('react');
const Z = require('../../../packages/ui/components.js');
const h = React.createElement;

const { SECTION_LABEL, formatPrice, productName, releaseInfo, grading, SiteHeader, sampleAttrs } = require('./shell.js');

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
    h(SiteHeader, { site, url, section: listing.section }),
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
        // each PlayerButton carries what the site player needs (scripts/site.js): the product's samples are its queue
        samples: samples.length ? samples.map((s) => h(Z.PlayerButton, Object.assign({ key: s.track_position }, sampleAttrs(product, s, url)), s.title)) : null
      }),
      h('div', { className: 'pdp-content__actions' },
        h(Z.Button, { hierarchy: 'primary', size: 'large', className: 'pdp-content__cta' }, 'Add to bag'))
    )
  );
}

module.exports = { Pdp, title: (p) => productName(p.release) };
