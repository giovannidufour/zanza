/* apps/storefront/pages/plp.js — Product listing page of a section (Figma: PLP - desktop).
   A pure function: products in, React tree out. Filters (Figma: page `filters`, 2026-11-10) are built from the
   products of the page; scripts/site.js applies them in the browser (OR inside a block, AND between blocks,
   counts, URL, breadcrumbs). Hidden on mobile (Figma PLP - mobile has none; mobile filters not designed). */
'use strict';
const React = require('react');
const Z = require('../../../packages/ui/components.js');
const h = React.createElement;
const { SECTION_LABEL, SiteHeader, ProductCardFor } = require('./shell.js');

const FORMAT_ORDER = ['7"', '10"', '12"', 'LP', 'Tape'];
const decadeOf = (year) => (year ? `${Math.floor(year / 10) * 10}s` : null);

// facet → values of one product. Subgenre = Discogs styles (release.style); Tags = the shop's own tags
// (release.tags, migration 0011). `key` is the URL parameter.
const FACETS = [
  { key: 'subgenre', label: 'Subgenre', values: (p) => p.release.style || [], order: 'count' },
  { key: 'format', label: 'Format', values: (p) => (p.release.format ? [p.release.format] : []), order: 'format' },
  { key: 'decade', label: 'Decade', values: (p) => [decadeOf(p.release.year)].filter(Boolean), order: 'name' },
  { key: 'tag', label: 'Tags', values: (p) => p.release.tags || [], order: 'count' }
];
// filters with no list in the column (Gio 2026-11-10: not all labels always visible). Reached by a link
// (?label=…); while active they show as a removable chip above the list.
const HIDDEN_FACETS = [
  { key: 'label', label: 'Label', values: (p) => (p.release.label ? [p.release.label] : []) }
];

// the options of each facet with their counts on the whole page; a facet with no options is not rendered
function facetsOf(products) {
  return FACETS.map((f) => {
    const counts = new Map();
    for (const p of products) for (const v of new Set(f.values(p))) counts.set(v, (counts.get(v) || 0) + 1);
    const options = [...counts.entries()].map(([value, count]) => ({ value, count }));
    const rank = (v) => { const i = FORMAT_ORDER.indexOf(v); return i === -1 ? FORMAT_ORDER.length : i; };
    options.sort((a, b) => f.order === 'count' ? b.count - a.count || a.value.localeCompare(b.value)
      : f.order === 'format' ? rank(a.value) - rank(b.value) || a.value.localeCompare(b.value)
      : a.value.localeCompare(b.value));
    return Object.assign({}, f, { options });
  }).filter((f) => f.options.length);
}

// shown: 7”, as in Figma (curly double prime); the value stays as stored
const optionLabel = (key, v) => (key === 'format' ? v.replace(/"$/, '”') : v);

function PlpFilters({ facets }) {
  // Figma: `filters` > `filter block` per facet > `filter` (content=label, count)
  return h('aside', { className: 'plp-filters', 'aria-label': 'Filters', 'data-plp-filters': '',
    'data-hidden-facets': JSON.stringify(HIDDEN_FACETS.map((f) => ({ key: f.key, label: f.label }))) },
    h(Z.Filters, null,
      facets.map((f) => h(Z.FilterBlock, { key: f.key, label: f.label },
        f.options.map((o) => h(Z.Filter, {
          key: o.value, name: f.key, value: o.value, label: optionLabel(f.key, o.value), count: o.count,
          'data-facet-label': optionLabel(f.key, o.value)
        }))))),
    // announces the result of a change ("12 records"); the empty state is not designed (design/open.md)
    h('p', { className: 'zz-visually-hidden', role: 'status', 'aria-live': 'polite', 'data-plp-status': '' }));
}

function Plp({ section, products, site, url }) {
  const facets = facetsOf(products);
  return h('div', { className: 'zz-page' },
    h(SiteHeader, { site, url, section }),
    // Figma: "For sale / Dancehall / 7”" = the section + the applied filters (site.js rewrites it on change)
    h(Z.Breadcrumbs, { items: [{ label: SECTION_LABEL[section], href: null }], 'data-plp-breadcrumbs': '', 'data-section-label': SECTION_LABEL[section] }),

    // Figma: `pdp content` (sic) — 12-col grid, gap gutter-small, padding-y small; filters cols 1–3, list cols 4–12
    h('div', { className: 'plp-content' },
      facets.length ? h(PlpFilters, { facets }) : null,
      h('main', { className: 'plp-list' },
        h('h1', { className: 'plp-list__title' }, SECTION_LABEL[section]),
        // active hidden filters (label): one EntityChip each, built by site.js from the template
        h('div', { className: 'plp-active', hidden: true, 'data-plp-active': '' }),
        h('template', { 'data-plp-chip': '' }, h(Z.EntityChip, { label: '' })),
        // no device: responsive card (desktop variant on PLP - desktop, mobile variant on PLP - mobile)
        products.map((product) => h('div', Object.assign({ key: product.listing.slug, className: 'plp-item' },
          ...FACETS.concat(HIDDEN_FACETS).map((f) => ({ [`data-${f.key}`]: JSON.stringify([...new Set(f.values(product))]) }))),
          h(ProductCardFor, { product, url }))),
        h('p', { className: 'plp-list__empty body-medium', hidden: true, 'data-plp-empty': '' }, 'No records match these filters.')))
  );
}

module.exports = { Plp, title: (section) => SECTION_LABEL[section], facetsOf };
