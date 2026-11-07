/* apps/storefront/pages/plp.js — Product listing page of a section (Figma: PLP - desktop).
   A pure function: products in, React tree out. Filters are HARDCODED placeholders copied from Figma
   (no state, no filtering) until the filters component is designed. Hidden on mobile (Figma PLP - mobile has none). */
'use strict';
const React = require('react');
const Z = require('../../../packages/ui/components.js');
const h = React.createElement;
const { SECTION_LABEL, formatPrice, productName, releaseInfo, grading, productHref, SiteHeader, sampleAttrs } = require('./shell.js');

// Figma: `filters` > `filter block` ×3 > `filter` (content=label) — hardcoded values from the Figma frame
const FILTERS = [
  { label: 'Genre', options: ['Dancehall', 'Roots', 'Steppers', 'Rocksteady'] },
  { label: 'Format', options: ['7”', '10”', '12”', 'LP', 'Tape'] },
  { label: 'Decade', options: ['1960s', '1970s', '1980s', '1990s', '2000s'] }
];
// Figma: icon/icon-square (24 grid, shown at 16)
const SquareIcon = () => h('svg', { viewBox: '0 0 24 24', width: 16, height: 16, 'aria-hidden': 'true', focusable: 'false' },
  h('path', { fill: 'currentColor', d: 'M19.5 3.25C20.1904 3.25 20.75 3.80964 20.75 4.5V19.5C20.75 20.1904 20.1904 20.75 19.5 20.75H4.5C3.80964 20.75 3.25 20.1904 3.25 19.5V4.5C3.25 3.80964 3.80964 3.25 4.5 3.25H19.5ZM4.5 4.25C4.36193 4.25 4.25 4.36193 4.25 4.5V19.5C4.25 19.6381 4.36193 19.75 4.5 19.75H19.5C19.6381 19.75 19.75 19.6381 19.75 19.5V4.5C19.75 4.36193 19.6381 4.25 19.5 4.25H4.5Z' }));

function Filters() {
  return h('aside', { className: 'plp-filters', 'aria-label': 'Filters' },
    FILTERS.map((block) => h('div', { key: block.label, className: 'plp-filters__block' },
      h('h2', { className: 'plp-filters__label label-extra-small' }, block.label),
      h('ul', { className: 'plp-filters__list' },
        block.options.map((o) => h('li', { key: o, className: 'plp-filters__item' },
          h('span', { className: 'plp-filters__icon' }, h(SquareIcon)),
          h('span', { className: 'body-small' }, o)))))));
}

function Plp({ section, products, site, url }) {
  return h('div', { className: 'zz-page' },
    h(SiteHeader, { site, url, section }),
    // Figma shows "For sale / Dancehall / 7”" (the applied filters); with hardcoded filters only the section is true
    h(Z.Breadcrumbs, { items: [{ label: SECTION_LABEL[section], href: null }] }),

    // Figma: `pdp content` (sic) — 12-col grid, gap gutter-small, padding-y small; filters cols 1–3, list cols 4–12
    h('div', { className: 'plp-content' },
      h(Filters),
      h('main', { className: 'plp-list' },
        h('h1', { className: 'plp-list__title' }, SECTION_LABEL[section]),
        products.map((product) => {
          const { listing, release, copy, samples } = product;
          return h(Z.ProductCard, {
            key: listing.slug,
            // no device: responsive card (desktop variant on PLP - desktop, mobile variant on PLP - mobile)
            href: productHref(product, url),
            image: release.cover ? { src: url(release.cover), alt: '' } : null,
            title: productName(release),
            releaseInfo: releaseInfo(release),
            price: section === 'sale' ? formatPrice(listing.price) : null,
            tags: release.style,
            description: copy.notes,
            grading: grading(copy),
            // Figma labels the card samples 1, 2…; the accessible name keeps the product and the sample title
            samples: samples.length ? samples.map((s, i) => h(Z.PlayerButton, Object.assign({
              key: s.track_position,
              'aria-label': `${productName(release)}, sample ${i + 1}: ${s.title}`
            }, sampleAttrs(product, s, url)), String(i + 1))) : null
          });
        })))
  );
}

module.exports = { Plp, title: (section) => SECTION_LABEL[section] };
