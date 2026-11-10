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
// the product name with the artists as links; a custom title stays plain text (no credits to link)
function productNameLinked(product, url) {
  const { listing, release } = product;
  if (listing.custom_title) return productName(release);
  const lines = linesOf(release);
  const first = lines[0];
  const credit = (l, i) => creditNodes(l.artist || first.artist, l.artist ? lineArtists(l) : lineArtists(first), url, `a${i}`);
  const own = lines.slice(1).some((l) => l.artist && l.artist !== first.artist);
  if (!own) return [].concat(credit(first, 0), ' - ' + lines.map((l) => l.title).join(' / '));
  return lines.flatMap((l, i) => [].concat(i ? [' / '] : [], credit(l, i), ' - ' + l.title));
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
// on its own line under "Cover:". Returns the { grading, cover } props of ProductCard / ProductInfo.
function gradingProps(c) {
  const note = (c.condition_notes || '').trim();
  const record = grading(c);
  const cover = coverGrading(c);
  if (!note) return { grading: record, cover };
  if (!cover) return { grading: `${record} ${note}`, cover: null };
  return { grading: record, cover: [cover, h('br', { key: 'br' }), note] };
}
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
// one tag group: subgenres first, then the shop's own tags (decision 0031)
function tagsOf(release) {
  return [...new Set([...(release.style || []), ...(release.tags || [])])];
}
// the same tags as links to the sale PLP filtered by them (Gio 2026-11-10): subgenre → ?subgenre=, own tag → ?tag=
// (the PLP filter keys, pages/plp.js FACETS). A name that is both stays a subgenre, as in tagsOf.
function tagLinksOf(release, url) {
  const seen = new Set();
  const out = [];
  [['subgenre', release.style || []], ['tag', release.tags || []]].forEach(([key, names]) => names.forEach((name) => {
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
    href: productHref(product, url),
    image: release.cover ? { src: url(release.cover), alt: '' } : null,
    title: productNameLinked(product, url),
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

module.exports = { SECTION_LABEL, labelRef, artistRefs, productNameLinked, tagsOf, tagLinksOf, plpHref, formatPrice, productName, releaseInfo, releaseInfoLinked, grading, coverGrading, gradingProps, productHref, SiteHeader, sampleAttrs, ProductCardFor };
