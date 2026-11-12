/* apps/storefront/pages/shell.js — what every page shares: the site header and the data → text mapping.
   Pure functions, no state. */
'use strict';
const React = require('react');
const Z = require('../../../packages/ui/components.js');
const h = React.createElement;

const SECTION_LABEL = { sale: 'For sale', trade: 'For trade' };

// ── data → text (mapping confirmed 2026-11-07) ──
const formatPrice = (p) => `${p.amount % 100 === 0 ? p.amount / 100 : (p.amount / 100).toFixed(2)}€`;
// `name` comes from the database (custom title or the release lines, see data/products.js); JSON test content has none
const productName = (r) => r.name || `${r.artist} - ${r.title}`;
// a pre-release ("blank") of the label: "Pre" right after the label name (Gio, 2026-11-10)
const releaseInfo = (r) => [r.label, r.label && r.pre_release ? 'Pre' : null, r.format, r.country ? `(${r.country})` : null].filter(Boolean).join(' ');
// the sale PLP filtered by one value (`key` = a PLP filter key, pages/plp.js)
const plpHref = (url, key, value) => `${url('/sale/')}?${key}=${encodeURIComponent(value)}`;
// ── label and artists as links to the sale PLP filtered by the entity (Gio 2026-11-10) ──
// The filter value is the entity slug, not the printed credit: a record credited "Kesta Rec." still belongs to
// the label Kesta (aliases, migration 0006). JSON test content has no entities: the slug comes from the text.
const slugText = (s) => String(s || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
const labelRef = (r) => r.label_ref || (r.label ? { slug: slugText(r.label), name: r.label } : null);
const linesOf = (r) => (r.lines && r.lines.length ? r.lines : [{ artist: r.artist, title: r.title }]);
const lineArtists = (l) => (l.artists && l.artists.length ? l.artists
  : (l.artist ? [{ slug: slugText(l.artist), name: l.artist }] : []));
// every artist entity of the release, once (the PLP `artist` filter values)
function artistRefs(r) {
  const seen = new Map();
  linesOf(r).forEach((l) => lineArtists(l).forEach((a) => { if (!seen.has(a.slug)) seen.set(a.slug, a); }));
  return [...seen.values()];
}
const entityLink = (url, key, ref, text, k) => h('a', { key: k, className: 'site-inline-link', href: plpHref(url, key, ref.slug) }, text);
// the printed credit of a line ("Little Meeky & Kesta") with each artist as a link: the credit is cut at the
// join texts of its artists, in order. If it does not cut cleanly, the whole credit links to the first artist.
function creditNodes(text, artists, url, k) {
  if (!text || !artists.length) return text || '';
  if (artists.length === 1) return [entityLink(url, 'artist', artists[0], text, k)];
  const out = [];
  let rest = text;
  for (let i = 0; i < artists.length - 1; i++) {
    const join = (artists[i].join || '').trim();
    const at = join ? rest.toLowerCase().indexOf(' ' + join.toLowerCase() + ' ') : -1;
    if (at <= 0) return [entityLink(url, 'artist', artists[0], text, k)];
    out.push(entityLink(url, 'artist', artists[i], rest.slice(0, at), `${k}-${i}`), ` ${rest.substr(at + 1, join.length)} `);
    rest = rest.slice(at + join.length + 2);
  }
  out.push(entityLink(url, 'artist', artists[artists.length - 1], rest, `${k}-last`));
  return out;
}
// the product name with the artists as links; a custom title stays plain text (no credits to link).
// pdpHref (cards only, decision 0040): the record title part links to the product page. It is out of the tab order:
// the card's cover link (named by the whole title) is the keyboard / screen reader way in.
function productNameLinked(product, url, pdpHref) {
  const { listing, release } = product;
  const toPdp = (text, k) => pdpHref ? h('a', { key: k, className: 'site-inline-link', href: pdpHref, tabIndex: -1 }, text) : text;
  if (listing.custom_title) return toPdp(productName(release), 'p');
  const lines = linesOf(release);
  const first = lines[0];
  const credit = (l, i) => creditNodes(l.artist || first.artist, l.artist ? lineArtists(l) : lineArtists(first), url, `a${i}`);
  const own = lines.slice(1).some((l) => l.artist && l.artist !== first.artist);
  if (!own) return [].concat(credit(first, 0), ' - ', toPdp(lines.map((l) => l.title).join(' / '), 'p'));
  return lines.flatMap((l, i) => [].concat(i ? [' / '] : [], credit(l, i), ' - ', toPdp(l.title, `p${i}`)));
}
// releaseInfo with the label as a link (the printed label, filtered by its entity)
const releaseInfoLinked = (r, url) => {
  const ref = labelRef(r);
  if (!ref) return releaseInfo(r);
  const rest = releaseInfo(Object.assign({}, r, { label: null }));
  return [entityLink(url, 'label', ref, r.label, 'label'), (r.pre_release ? ' Pre' : '') + (rest ? ' ' + rest : '')];
};
// the record graded per side: "Record: VG+ / VG", only side A when side B is not graded (Gio, 2026-11-10)
const grading = (c) => `Record: ${[c.condition_media, c.condition_media_b].filter(Boolean).join(' / ')}`;
// the cover/sleeve grade on its own line, only when there is one (Gio, 2026-11-10)
const coverGrading = (c) => (c.condition_sleeve && c.sleeve_type !== 'none' ? `Cover: ${c.condition_sleeve}` : null);
// the conditions comment, value only (Gio 2026-11-10): right after the record grade; when the cover is graded,
// on its own line under "Cover:". Returns the { grading, cover, conditions } props of ProductCard / ProductInfo.
function gradingProps(c) {
  const text = (c.condition_notes || '').trim();
  const note = text ? `(${text})` : '';   // always in brackets (Gio 2026-11-10)
  const record = grading(c);
  const cover = coverGrading(c);
  if (!note) return { grading: record, cover, conditions: null };
  if (!cover) return { grading: `${record} ${note}`, cover: null, conditions: null };
  // stacked: its own line, so it keeps the 4px gap of the other lines (Figma `conditions`, decision 0042)
  return { grading: record, cover, conditions: note };
}
const productHref = (product, url) => url(`/products/${product.listing.slug}/`);

// Figma: `header` (device=desktop | mobile), the same on every page.
// `section` = the active tab (none on /bag/). `current = 'bag'` → the Bag button is the current page (state active,
// decision 0045). The Bag count is the button's suffix in brackets (Gio 2026-11-10): "(0)" in the static HTML,
// scripts/site.js writes the real count from the bag in the browser ([data-bag-count]).
// Mobile: the hamburger opens SiteMenu (scripts/site.js); it is rendered next to the header, inside .zz-page.
function SiteHeader({ site, url, section, current }) {
  return h(React.Fragment, null,
    h(Z.Header, {
      className: 'site-header',   // sticky on scroll up: base.css + scripts/site.js
      logo: h('img', { src: url('/assets/logo.png'), alt: '', width: 64, height: 64 }),
      storeName: site.storeName,
      homeHref: url('/'),
      menuProps: { 'aria-haspopup': 'dialog', 'aria-controls': 'site-menu', 'aria-expanded': 'false', 'data-menu-open': '' },
      // Figma `header` boolean `search` (2026-11-12): the field on desktop, the magnifier on mobile → /search/
      search: h(SearchForm, { url, id: 'site-search-header' }),
      searchHref: url('/search/'),
      tabs: h(Z.Tabs, { as: 'nav', value: section, 'aria-label': 'Section' },
        h(Z.Tab, { value: 'sale', href: url('/sale/') }, 'For sale'),
        h(Z.Tab, { value: 'trade', href: url('/trade/') }, 'For trade')),
      actions: h(React.Fragment, null,
        h(Z.Button, { hierarchy: 'secondary', className: 'zz-header__account' }, 'Account'),
        h(Z.Button, { hierarchy: 'secondary', href: url('/bag/'), state: current === 'bag' ? 'active' : undefined,
          suffix: '(0)', 'data-bag-count': '' }, 'Bag'))
    }),
    h(SiteMenu, { url, current: current || section }));
}

// the search field (Figma `input` type=search): a GET form to /search/?q=…, so it works without JS; scripts/site.js
// sends it through the soft navigation (the player keeps playing) and fills the field with the current query.
// The visible text is the placeholder; the accessible name is "Search records" (WCAG: a label, not only a placeholder).
function SearchForm({ url, id, className }) {
  return h('form', { className: cx('site-search', className), role: 'search', 'aria-label': 'Search', action: url('/search/'),
    method: 'get', 'data-site-search': '' },
    h(Z.Input, { variant: 'search', id, name: 'q', placeholder: 'Search', 'aria-label': 'Search records',
      submitLabel: 'Search', clearLabel: 'Clear search',
      autoComplete: 'off', enterKeyHint: 'search', 'data-search-input': '' }));
}
const cx = (...c) => c.filter(Boolean).join(' ');

// Figma page `menu` (proposal 2026-11-12): the mobile menu, a full-screen native modal dialog (focus trapped, Esc
// closes, the page behind is inert). Account is the entry point to /account/ on mobile; the Bag stays in the header.
// The Account detail is "Sign in to see your orders" until accounts exist (then: the signed-in email).
function SiteMenu({ url, current }) {
  const item = (key, label, href, detail) => h(Z.MenuItem, { key, label, href: url(href), detail, current: key === current });
  const legal = [['Impressum', '/impressum/'], ['Privacy', '/privacy/'], ['Terms', '/terms/'], ['Withdrawal', '/withdrawal/']]
    .map(([text, href]) => h('a', { key: href, href: url(href) }, text));
  return h('dialog', { id: 'site-menu', className: 'site-menu', 'aria-label': 'Menu', tabIndex: -1, 'data-site-menu': '' },
    h(Z.MenuLayer, { title: 'Menu', closeLabel: 'Close menu', legal },
      h(Z.MenuGroup, null, item('sale', 'For sale', '/sale/'), item('trade', 'For trade', '/trade/')),
      h(Z.MenuGroup, null, item('account', 'Account', '/account/', 'Sign in to see your orders')),
      h(Z.MenuGroup, null, item('grading', 'Grading', '/grading/'), item('shipping', 'Shipping', '/shipping/'),
        item('contact', 'Contact', '/contact/'))));
}

// the data the site player (scripts/site.js) reads from a PlayerButton: a product's samples are its queue
function sampleAttrs(product, s, url) {
  const { release } = product;
  return {
    disabled: !s.audio_url,
    'data-sample-src': s.audio_url ? url(s.audio_url) : undefined,
    'data-sample-title': s.title,
    'data-product-name': productName(release),
    'data-product-image': release.cover ? url(release.cover) : undefined,
    'data-product-href': productHref(product, url),
    'data-listing-id': product.listing.id   // the player's "Add to bag" adds the playing product
  };
}

// A product as a ProductCard (PLP list, PDP "More for sale"). No device: responsive card.
// one tag group: genres first, then the shop's own tags (decisions 0031, 0048)
function tagsOf(release) {
  return [...new Set([...(release.genres || []), ...(release.tags || [])])];
}
// the same tags as links to the sale PLP filtered by them (Gio 2026-11-10): genre → ?genre=, own tag → ?tag=
// (the PLP filter keys, pages/plp.js FACETS). A name that is both stays a genre, as in tagsOf.
function tagLinksOf(release, url) {
  const seen = new Set();
  const out = [];
  [['genre', release.genres || []], ['tag', release.tags || []]].forEach(([key, names]) => names.forEach((name) => {
    if (seen.has(name)) return;
    seen.add(name);
    out.push({ label: name, href: plpHref(url, key, name) });
  }));
  return out;
}
// Figma labels the card samples 1, 2…; the accessible name keeps the product and the sample title.
function ProductCardFor({ product, url, headingLevel }) {
  const { listing, release, copy, samples } = product;
  return h(Z.ProductCard, {
    'data-listing-id': listing.id,   // its Add button puts this copy in the bag (scripts/site.js)
    'data-listing-status': listing.status,   // status at build time; site.js updates it live (Reserved)
    href: productHref(product, url),
    image: release.cover ? { src: url(release.cover), alt: '' } : null,
    title: productNameLinked(product, url, productHref(product, url)),
    headingLevel,
    releaseInfo: releaseInfoLinked(release, url),
    price: listing.section === 'sale' ? formatPrice(listing.price) : null,
    tags: tagLinksOf(release, url),
    description: copy.notes,
    ...gradingProps(copy),
    samples: samples.length ? samples.map((s, i) => h(Z.PlayerButton, Object.assign({
      key: s.track_position,
      'aria-label': `${productName(release)}, sample ${i + 1}: ${s.title}`
    }, sampleAttrs(product, s, url)), String(i + 1))) : null
  });
}

module.exports = { SearchForm, SECTION_LABEL, labelRef, artistRefs, productNameLinked, tagsOf, tagLinksOf, plpHref, formatPrice, productName, releaseInfo, releaseInfoLinked, grading, coverGrading, gradingProps, productHref, SiteHeader, sampleAttrs, ProductCardFor };
