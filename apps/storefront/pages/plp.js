/* apps/storefront/pages/plp.js — Product listing page of a section (Figma: PLP - desktop).
   A pure function: products in, React tree out. Filters (Figma: page `filters`, 2026-11-10) are built from the
   products of the page; scripts/site.js applies them in the browser (OR inside a block, AND between blocks,
   counts, URL, active filter row). Mobile (Figma 2026-11-10): the column is hidden; `PLP header` ("Filter (n)" + sort)
   opens `filters layer`, a full-screen native dialog with nested levels whose ticks are a draft until Apply. */
'use strict';
const React = require('react');
const Z = require('../../../packages/ui/components.js');
const h = React.createElement;
const { SECTION_LABEL, SiteHeader, ProductCardFor, SearchForm, labelRef, artistRefs } = require('./shell.js');

const FORMAT_ORDER = ['7"', '10"', '12"', 'LP', 'Tape'];
const decadeOf = (year) => (year ? `${Math.floor(year / 10) * 10}s` : null);

// facet → values of one product. Genre = Discogs styles (release.genres, 0048); Tags = the shop's own tags
// (release.tags, migration 0011). `key` is the URL parameter. The macro genre (release.macro_genre) is not shown.
const FACETS = [
  { key: 'genre', label: 'Genre', values: (p) => p.release.genres || [], order: 'count' },
  { key: 'format', label: 'Format', values: (p) => (p.release.format ? [p.release.format] : []), order: 'format' },
  { key: 'decade', label: 'Decade', values: (p) => [decadeOf(p.release.year)].filter(Boolean), order: 'name' },
  { key: 'tag', label: 'Tags', values: (p) => p.release.tags || [], order: 'count' }
];
// filters with no list in the column (Gio 2026-11-10: not all labels always visible). Reached by a link
// (?label=…); while active it shows as a removable chip in the active filter row (one at a time: a new link replaces it).
// Values are entity slugs (label / artist), so a misspelt credit still matches; `refs` give the names.
const HIDDEN_FACETS = [
  { key: 'artist', label: 'Artist', refs: (p) => artistRefs(p.release) },
  { key: 'label', label: 'Label', refs: (p) => [labelRef(p.release)].filter(Boolean) }
].map((f) => Object.assign(f, { values: (p) => f.refs(p).map((r) => r.slug) }));
// slug → name of each hidden facet on the page (chip text)
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

// Search (Figma page `Search`, 2026-11-12): what a query is matched against, normalised the same way as the query in
// scripts/site.js (searchWords): no accents, lower case, punctuation = space. Artist (entities too: an alias credit
// still finds the artist), title and track titles, label, catalogue number, genres, the shop's tags, and the producers
// from the Discogs credits with every spelling of their name (decision 0148; not shown on the page, only searched).
// Which credit roles are searchable: SEARCH_ROLES (Gio 2026-11-23: producers only; all roles are stored).
const searchWords = (s) => String(s || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  .replace(/[^a-z0-9]+/g, ' ').trim();
const SEARCH_ROLES = /produc/i;   // Producer, Co-producer, Executive Producer, "Producer [Dub]"
function searchTextOf(p) {
  const r = p.release;
  const credits = (r.credits || []).filter((c) => SEARCH_ROLES.test(c.role))
    .flatMap((c) => [c.credit, c.artist.name, ...(c.artist.aliases || [])]);
  const tracks = (r.tracklist || []).map((t) => (typeof t === 'string' ? t : (t && t.title) || ''));
  const lines = (r.lines || []).flatMap((l) => [l.artist, l.title]);
  const parts = [r.name, r.artist, r.title, ...lines, ...artistRefs(r).map((a) => a.name), r.label,
    (labelRef(r) || {}).name, r.cat_no, ...(r.genres || []), ...(r.tags || []), ...tracks, ...credits];
  return [...new Set(parts.map(searchWords).filter(Boolean))].join(' ');
}
// sold copies stay on the list (Gio 2026-11-12) behind "Show sold out", ticked by default
const SOLD_STATUSES = ['sold', 'traded'];
const isSold = (p) => SOLD_STATUSES.indexOf(p.listing.status) !== -1;
// Figma `filters` / `filters layer` (main level): the first row, a `filter` (content=label, state=active, no count).
// Not a facet: unticked = sold copies hidden (?sold=hide); it never counts as an applied filter (scripts/site.js).
// Hidden while the page has no sold copy (Gio 2026-11-23, decision 0161; Figma boolean `show sold out`): a build-time
// check, the shop rebuilds when a listing's sale state changes, so the tick comes back with the first sold record.
const ShowSold = () => h(Z.Filter, { name: 'sold', value: 'show', label: 'Show sold out', defaultChecked: true, 'data-show-sold': '' });

function PlpFilters({ facets, hidden, sorts, showSold }) {
  // Figma: `filters` > sort (Gio 2026-11-10: button hug, prefix "Sort:") + `filter block` per facet > `filter` (content=label, count)
  return h('aside', { className: 'plp-filters', 'aria-label': 'Filters', 'data-plp-filters': '',
    'data-hidden-facets': JSON.stringify(hidden) },
    h(Z.Filters, null,
      h(Z.SelectButton, { prefix: 'Sort:', className: 'plp-filters__sort', 'aria-label': 'Sort', 'data-plp-sort': '', defaultValue: 'newest', options: sorts }),
      showSold ? h(ShowSold) : null,
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
function PlpLayer({ facets, showSold }) {
  return h('dialog', { className: 'plp-layer', 'aria-label': 'Filter', tabIndex: -1, 'data-plp-layer': '' },
    h(Z.FiltersLayer, { level: 'main', title: 'Filter', applied: null, appliedLabel: 'Applied', applyCount: null },
      // level=main: one row per facet (value = its ticked options, written by site.js)
      showSold ? h('div', { className: 'plp-layer__sold', 'data-layer-sold': '' }, h(ShowSold)) : null,
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

// allProducts: every product with a page (also sold / reserved / trade), so a chip reached from any PDP shows the name.
// search (Figma page `Search`, 2026-11-12): the results page /search/?q=… — the same page with no section tab, the
// heading `search heading` ("N results for “q”", written by site.js), on mobile the `search field` under the header,
// and `search message` as the empty state (no results: hint + "Browse all records"; no query: the hint only).
// wantlist (Figma page `Wantlist`, decision 0152): /wantlist/ — first the connect view (the four steps that say what
// happens to the wantlist + "Connect Discogs"), then, once Discogs said yes, the same results page as Search: heading
// "N records from your wantlist" + "Disconnect Discogs", two groups (your pressing / other pressings). scripts/site.js
// (initWantlist) runs the check and marks each card's .plp-item with data-want="exact|other".
const WANTLIST_STEPS = [
  ['Connect Discogs', 'You\u2019re sent to Discogs and say yes. I can only read, and only during this visit.'],
  ['Your browser compares', 'Your browser gets your wantlist from Discogs and compares it with the shop, on your device. Your wantlist is never sent to me.'],
  ['Nothing is kept', 'No account, no cookies, nothing saved. Close the tab and it\u2019s gone. You can also remove access on Discogs anytime.'],
  ['You see the matches', 'The records here that are on your wantlist: exact matches first, then other pressings of the same record.']
];
function WantlistTop({ site }) {
  return h('div', { className: 'wantlist-top', 'data-wantlist': '', 'data-endpoint': site.wantlist.endpoint },
    h('div', { className: 'wantlist-connect trade-content', 'data-wantlist-connect': '' },
      h('h1', { className: 'trade-content__title body-large' }, 'Check your wantlist'),
      h('div', { className: 'trade-col trade-col--steps' }, h(Z.Divider),
        h('ol', { className: 'trade-steps' }, WANTLIST_STEPS.map(([title, text], i) => h(Z.Step, { key: i, number: i + 1, title }, text)))),
      h('div', { className: 'trade-col trade-col--3' }, h(Z.Divider),
        h(Z.Button, { hierarchy: 'secondary', type: 'button', 'data-wantlist-start': '' }, 'Connect Discogs'),
        // not in Figma (design/open.md): Discogs refused or could not be reached
        h('p', { className: 'body-medium', role: 'alert', hidden: true, 'data-wantlist-error': '' }))),
    h('div', { className: 'wantlist-heading', hidden: true, 'data-wantlist-heading': '' },
      h('h1', { className: 'search-heading body-large', 'aria-live': 'polite', 'data-wantlist-title': '' }, 'Checking your wantlist\u2026'),
      h(Z.Button, { hierarchy: 'secondary', type: 'button', className: 'wantlist-heading__disconnect', 'data-wantlist-disconnect': '' }, 'Disconnect Discogs')));
}
// group heading = Figma `section head` (divider on top + title body/medium, as "More for sale" on the PDP; Gio 2026-11-23)
const groupHeading = (group, title) => h(Z.SectionHead, { className: 'wantlist-group', title, hidden: true, 'data-wantlist-group': group });

// every PLP (Gio 2026-11-24, decision 0174): the records for sale first, the sold ones at the end, each group in the
// listing order. Reserved copies are paused, not gone: they stay with the ones for sale. Stable, so the order inside
// each group is the one given.
const soldLast = (list) => list.filter((p) => !isSold(p)).concat(list.filter(isSold));

// collection (decisions 0174, 0178; Figma PLP - desktop / collection): /collections/<slug>/, the records that match its
// rules. The collection shows as a removable chip in the active filter row (→ /sale/); with no record, the zero-results
// message (Gio: the card stays on the home).
function Plp({ section, products, allProducts = products, site, url, search = false, wantlist = false, collection = null }) {
  const facets = facetsOf(products);
  const showSold = products.some(isSold);
  const hint = 'Search by artist, title, label or catalogue number.';
  return h('div', { className: 'zz-page', 'data-search-page': search ? '' : undefined, 'data-wantlist-page': wantlist ? '' : undefined },
    h(SiteHeader, { site, url, section: search || wantlist ? undefined : section, current: wantlist ? 'wantlist' : undefined }),
    wantlist ? h(WantlistTop, { site }) : null,
    search ? h('div', { className: 'search-top' },
      h(SearchForm, { url, id: 'site-search-page', className: 'search-field' }),
      h('h1', { className: 'search-heading body-large', 'data-search-title': '' }, 'Search'),
      h('div', { className: 'search-message', 'data-search-hint': '' }, h('p', { className: 'body-medium' }, hint))) : null,
    // a collection is an active filter (Gio 2026-11-24, decision 0178): its name as a chip in the row below, the
    // heading only for screen readers. Removing the chip = every record for sale (/sale/, site.js keeps the query).
    collection ? h('h1', { className: 'zz-visually-hidden' }, `${collection.name} (${products.length})`) : null,
    // Figma `active filter` (0041): in place of the breadcrumbs, the filter reached from a link (artist, label, genre,
    // tag) as a removable EntityChip, medium on desktop, large on mobile (plp.css shows one). Hidden until site.js fills it.
    h(Z.ActiveFilter, { hidden: !collection, 'data-plp-active': '' },
      collection ? [['medium', 'plp-chip--desktop'], ['large', 'plp-chip--mobile']].map(([size, cls]) =>
        h(Z.EntityChip, { key: size, label: collection.name, size: size === 'large' ? 'large' : undefined,
          className: `plp-chip ${cls}`, 'data-plp-fixed': '', removeHref: url('/sale/'),
          removeLabel: `Remove collection ${collection.name}, show all records` })) : null),
    h('template', { 'data-plp-chip': '' },
      h(Z.EntityChip, { label: '', className: 'plp-chip plp-chip--desktop' }),
      h(Z.EntityChip, { label: '', size: 'large', className: 'plp-chip plp-chip--mobile' })),
    // Figma `PLP header` (device=mobile, Gio 2026-11-10): mobile only (plp.css). "Filter" + applied count (site.js)
    h(Z.PlpHeader, { className: 'plp-header',
      filters: facets.length ? h(Z.Button, { hierarchy: 'secondary', size: 'small', 'aria-haspopup': 'dialog', 'data-plp-open': '' }, 'Filter') : h('span'),
      sort: h(Z.SelectButton, { 'aria-label': 'Sort', 'data-plp-sort': '', defaultValue: 'newest',
        options: sortsFor(section) }) }),

    // Figma: `pdp content` (sic) — 12-col grid, gap gutter-small, padding-y small; filters cols 1–3, list cols 4–12
    h('div', { className: 'plp-content', 'data-search-results': search ? '' : undefined },
      facets.length ? h(PlpFilters, { facets, hidden: hiddenFacetsOf(allProducts), sorts: sortsFor(section), showSold }) : null,
      h('main', { className: 'plp-list' },
        search || wantlist || collection ? null : h('h1', { className: 'plp-list__title' }, SECTION_LABEL[section]),
        wantlist ? groupHeading('exact', 'Exact matches') : null,
        wantlist ? groupHeading('other', 'Other pressings') : null,
        // no device: responsive card (desktop variant on PLP - desktop, mobile variant on PLP - mobile)
        products.map((product, i) => h('div', Object.assign({ key: product.listing.slug, className: 'plp-item',
          'data-order': i, 'data-sold': isSold(product) ? '' : undefined, 'data-price': product.listing.price ? product.listing.price.amount : undefined,
          'data-search': search ? searchTextOf(product) : undefined,
          // Discogs ids, matched against the visitor's wantlist in their browser (decision 0152)
          'data-release': wantlist && product.release.discogs_release_id ? product.release.discogs_release_id : undefined,
          'data-master': wantlist && product.release.discogs_master_id ? product.release.discogs_master_id : undefined },
          ...FACETS.concat(HIDDEN_FACETS).map((f) => ({ [`data-${f.key}`]: JSON.stringify([...new Set(f.values(product))]) }))),
          h(ProductCardFor, { product, url }))),
        wantlist
          ? h('div', { className: 'search-message plp-list__empty', hidden: true, 'data-plp-empty': '' },
            h('p', { className: 'body-medium', 'data-wantlist-empty': '' }, 'None of the records on your wantlist are here right now.'),
            h(Z.Button, { hierarchy: 'secondary', href: url('/sale/') }, 'Browse all records'))
        : search
          ? h('div', { className: 'search-message plp-list__empty', hidden: true, 'data-plp-empty': '' },
            h('p', { className: 'body-medium' }, 'Check the spelling, or try an artist, a label or a catalogue number.'),
            h(Z.Button, { hierarchy: 'secondary', href: url('/sale/') }, 'Browse all records'))
          : products.length
            ? h('p', { className: 'plp-list__empty body-medium', hidden: true, 'data-plp-empty': '' }, 'No records match these filters.')
            // a section with no copies yet (For trade at launch): said plainly, not designed (design/open.md)
            : collection
              ? h('div', { className: 'search-message plp-list__empty' },
                h('p', { className: 'body-medium' }, 'Nothing in this collection right now. Come back soon.'),
                h(Z.Button, { hierarchy: 'secondary', href: url('/sale/') }, 'Browse all records'))
            : h('p', { className: 'plp-list__empty body-medium' }, section === 'trade' ? 'Nothing up for trade right now. Come back soon.' : 'No records right now.')),
      facets.length ? h(PlpLayer, { facets, showSold }) : null)
  );
}

module.exports = { Plp, title: (section) => SECTION_LABEL[section], facetsOf, searchTextOf, searchWords, isSold, soldLast };
