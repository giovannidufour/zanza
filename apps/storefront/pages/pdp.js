/* apps/storefront/pages/pdp.js — Product detail page (Figma: PDP - desktop / PDP - mobile).
   A pure function: product data in, React tree out. When the commerce backend arrives,
   only the data source changes (JSON file → API), not this page. */
'use strict';
const React = require('react');
const Z = require('../../../packages/ui/components.js');
const h = React.createElement;

const { SECTION_LABEL, formatPrice, productName, releaseInfo, grading, SiteHeader, sampleAttrs, ProductCardFor } = require('./shell.js');

function breadcrumbItems(product, url) {
  const { listing, release } = product;
  return [
    { label: SECTION_LABEL[listing.section], href: url(`/${listing.section}/`) },
    { label: release.style[0] || release.genre[0], href: null },
    { label: release.format, href: null }
  ];
}

function Pdp({ product, related = [], site, url }) {
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
        // label = the track title when there is one; without it the button is icon-only and keeps an accessible name
        samples: samples.length ? samples.map((s, i) => h(Z.PlayerButton, Object.assign({
          key: s.track_position,
          'aria-label': s.title ? undefined : `${productName(release)}, sample ${i + 1}`
        }, sampleAttrs(product, s, url)), s.title || null)) : null
      }),
      h('div', { className: 'pdp-content__actions' },
        h(Z.Button, { hierarchy: 'primary', size: 'large', className: 'pdp-content__cta' }, 'Add to bag')),
      // Figma: `you may also like` — desktop row 2, cols 5–12; mobile below the content. Cards are h3 under its h2.
      related.length ? h(Z.RelatedProducts, { className: 'pdp-content__related', title: 'More for sale:' },
        related.map((p) => h(ProductCardFor, { key: p.listing.slug, product: p, url, headingLevel: 3 }))) : null
    )
  );
}

module.exports = { Pdp, title: (p) => productName(p.release) };
