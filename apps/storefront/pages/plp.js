/* apps/storefront/pages/plp.js — Product listing page of a section (Figma: PLP - desktop).
   A pure function: products in, React tree out. Filters (Figma: page `filters`, 2026-11-10) are built from the
   products of the page; scripts/site.js applies them in the browser (OR inside a block, AND between blocks,
   counts, URL, breadcrumbs). Mobile (Figma 2026-11-10): the column is hidden; `PLP header` ("Filter (n)" + sort)
   opens `filters layer`, a full-screen native dialog with nested levels whose ticks are a draft until Apply. */
'use strict';
const React = require('react');
const Z = require('../../../packages/ui/components.js');
const h = React.createElement;
const { SECTION_LABEL, SiteHeader, ProductCardFor, labelRef, artistRefs } = require('./shell.js');

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
// Values are entity slugs (label / artist), so a misspelt credit still matches; `refs` give the names.
const HIDDEN_FACETS = [
  { key: 'artist', label: 'Artist', refs: (p) => artistRefs(p.release) },
  { key: 'label', label: 'Label', refs: (p) => [labelRef(p.release)].filter(Boolean) }
].map((f) => Object.assign(f, { values: (p) => f.refs(p).map((r) => r.slug) }));
// slug → name of each hidden facet on the page (chip and breadcrumb text)
function hiddenFacetsOf(products) {
  return HIDDEN_FACETS.map((f) => {
    const names = {};
    for (const p of products) for (const r of f.refs(p)) if (!names[r.slug]) names[r.slug] = r.name;
    return { key: f.key, label: f.label, names };
  });
}

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

function PlpFilters({ facets, hidden, sorts }) {
  // Figma: `filters` > sort (Gio 2026-11-10: button hug, prefix "Sort:") + `filter block` per facet > `filter` (content=label, count)
  return h('aside', { className: 'plp-filters', 'aria-label': 'Filters', 'data-plp-filters': '',
    'data-hidden-facets': JSON.stringify(hidden) },
    h(Z.Filters, null,
      h(Z.SelectButton, { prefix: 'Sort:', className: 'plp-filters__sort', 'aria-label': 'Sort', 'data-plp-sort': '', defaultValue: 'newest', options: sorts }),
      // active hidden filters (label) on top of the column (Gio 2026-11-10): one EntityChip each, built by site.js
      h('div', { className: 'plp-active', hidden: true, 'data-plp-active': '' }),
      h('template', { 'data-plp-chip': '' }, h(Z.EntityChip, { label: '' })),
      facets.map((f) => h(Z.FilterBlock, { key: f.key, label: f.label },
        f.options.map((o) => h(Z.Filter, {
          key: o.value, name: f.key, value: o.value, label: optionLabel(f.key, o.value), count: o.count,
          'data-facet-label': optionLabel(f.key, o.value)
        }))))),
    // announces the result of a change ("12 records"); the empty state is not designed (design/open.md)
    h('p', { className: 'zz-visually-hidden', role: 'status', 'aria-live': 'polite', 'data-plp-status': '' }));
}

// Mobile filters (Figma `filters layer`, 2026-11-10): the same facets as the column, in a full-screen native dialog.
// Its checkboxes are a draft: site.js copies the column's state in when it opens and back on Apply.
function PlpLayer({ facets }) {
  return h('dialog', { className: 'plp-layer', 'aria-label': 'Filter', 'data-plp-layer': '' },
    h(Z.FiltersLayer, { level: 'main', title: 'Filter', applied: null, appliedLabel: 'Applied', applyCount: null },
      // level=main: one row per facet (value = its ticked options, written by site.js)
      h('div', { className: 'plp-layer__facets', 'data-layer-facets': '' },
        facets.map((f) => h(Z.FilterFacet, { key: f.key, label: f.label, 'data-facet': f.key, 'data-facet-label': f.label }))),
      // level=facet: the options of one facet; the bar title names it, so the legend is for screen readers only
      facets.map((f) => h(Z.FilterBlock, { key: f.key, label: f.label, hideLabel: true, hidden: true, 'data-facet-block': f.key },
        f.options.map((o) => h(Z.Filter, {
          key: o.value, name: f.key, value: o.value, label: optionLabel(f.key, o.value), count: o.count,
          'data-facet-label': optionLabel(f.key, o.value)
        }))))),
    h('template', { 'data-layer-chip': '' }, h(Z.EntityChip, { label: '', size: 'large' })));
}

// sort (Figma `PLP header` → sort, `filters` → sort; native selects). Newest = the listing order of the page (newest
// published first). Option names are Claude's (Gio: list to decide, design/open.md); short so "Sort: …" reads well.
const SORTS = [
  { value: 'newest', label: 'Newest' },
  { value: 'price-asc', label: 'Lowest price', section: 'sale' },
  { value: 'price-desc', label: 'Highest price', section: 'sale' }
];

const sortsFor = (section) => SORTS.filter((o) => !o.section || o.section === section);

// allProducts: every product with a page (also sold / reserved / trade), so a chip reached from any PDP shows the name
function Plp({ section, products, allProducts = products, site, url }) {
  const facets = facetsOf(products);
  return h('div', { className: 'zz-page' },
    h(SiteHeader, { site, url, section }),
    // Figma: "For sale / Dancehall / 7”" = the section + the applied filters (site.js rewrites it on change)
    h(Z.Breadcrumbs, { items: [{ label: SECTION_LABEL[section], href: null }], 'data-plp-breadcrumbs': '', 'data-section-label': SECTION_LABEL[section] }),
    // Figma `PLP header` (device=mobile, Gio 2026-11-10): mobile only (plp.css). "Filter" + applied count (site.js)
    h(Z.PlpHeader, { className: 'plp-header',
      filters: facets.length ? h(Z.Button, { hierarchy: 'secondary', size: 'small', 'aria-haspopup': 'dialog', 'data-plp-open': '' }, 'Filter') : h('span'),
      sort: h(Z.SelectButton, { 'aria-label': 'Sort', 'data-plp-sort': '', defaultValue: 'newest',
        options: sortsFor(section) }) }),

    // Figma: `pdp content` (sic) — 12-col grid, gap gutter-small, padding-y small; filters cols 1–3, list cols 4–12
    h('div', { className: 'plp-content' },
      facets.length ? h(PlpFilters, { facets, hidden: hiddenFacetsOf(allProducts), sorts: sortsFor(section) }) : null,
      h('main', { className: 'plp-list' },
        h('h1', { className: 'plp-list__title' }, SECTION_LABEL[section]),
        // no device: responsive card (desktop variant on PLP - desktop, mobile variant on PLP - mobile)
        products.map((product, i) => h('div', Object.assign({ key: product.listing.slug, className: 'plp-item',
          'data-order': i, 'data-price': product.listing.price ? product.listing.price.amount : undefined },
          ...FACETS.concat(HIDDEN_FACETS).map((f) => ({ [`data-${f.key}`]: JSON.stringify([...new Set(f.values(product))]) }))),
          h(ProductCardFor, { product, url }))),
        h('p', { className: 'plp-list__empty body-medium', hidden: true, 'data-plp-empty': '' }, 'No records match these filters.')),
      facets.length ? h(PlpLayer, { facets }) : null)
  );
}

module.exports = { Plp, title: (section) => SECTION_LABEL[section], facetsOf };
