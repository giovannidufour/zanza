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
// releaseInfo with the label as a link to the sale PLP filtered by it (Gio 2026-11-10; ?label= is a filter with no list)
const releaseInfoLinked = (r, url) => {
  if (!r.label) return releaseInfo(r);
  const rest = releaseInfo(Object.assign({}, r, { label: null }));
  return [h('a', { key: 'label', className: 'site-inline-link', href: plpHref(url, 'label', r.label) }, r.label),
    (r.pre_release ? ' Pre' : '') + (rest ? ' ' + rest : '')];
};
// the record graded per side: "Record: VG+ / VG", only side A when side B is not graded (Gio, 2026-11-10)
const grading = (c) => `Record: ${[c.condition_media, c.condition_media_b].filter(Boolean).join(' / ')}`;
// the cover/sleeve grade on its own line, only when there is one (Gio, 2026-11-10)
const coverGrading = (c) => (c.condition_sleeve && c.sleeve_type !== 'none' ? `Cover: ${c.condition_sleeve}` : null);
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
    title: productName(release),
    headingLevel,
    releaseInfo: releaseInfoLinked(release, url),
    price: listing.section === 'sale' ? formatPrice(listing.price) : null,
    tags: tagLinksOf(release, url),
    description: copy.notes,
    grading: grading(copy),
    cover: coverGrading(copy),
    samples: samples.length ? samples.map((s, i) => h(Z.PlayerButton, Object.assign({
      key: s.track_position,
      'aria-label': `${productName(release)}, sample ${i + 1}: ${s.title}`
    }, sampleAttrs(product, s, url)), String(i + 1))) : null
  });
}

module.exports = { SECTION_LABEL, tagsOf, tagLinksOf, plpHref, formatPrice, productName, releaseInfo, releaseInfoLinked, grading, coverGrading, productHref, SiteHeader, sampleAttrs, ProductCardFor };
