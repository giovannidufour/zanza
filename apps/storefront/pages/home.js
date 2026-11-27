/* apps/storefront/pages/home.js — the home page "/" (Figma page `Home`, Home v2, decision 0120; replaces 0085).
   A pure function: products in, React tree out. Sale only for now (Gio 2026-11-18: trade and personal info left out).
   - intro: the welcome line (admin → Content → Home) + "Subscribe to newsletter" → the newsletter box below
   - collections (decision 0174): the cards of admin → Collections set to "Show on the home", in Gio's order, full
     width under the intro; none → no row
   - side (desktop, 3 of 12 columns): the genres one per line + All (→ /sale/)
   - main (9 columns): shelf "This week (n)" = sale records published in the last 7 days (max 6), the newsletter box,
     shelf "Recent" = the next 12 newest sale records (decision 0167). No This week (nothing new) → only Recent.
   - under the last shelf: "View all for sale", full width → /sale/ (decision 0167)
   - each shelf head: Play all, the view toggle (grid | list, desktop only; decision 0126), See all
   - mobile: one column; genres in rows, no view toggle, one full-width tile per row with its photos in a swipe gallery.
   Each shelf renders both views: tiles (grid) and the PDP product cards (list); home.css shows the one in
   .home-content[data-view], scripts/site.js flips it and remembers the choice. "Play all" queues only visible samples. */
'use strict';
const React = require('react');
const Z = require('../../../packages/ui/components.js');
const h = React.createElement;
const { SiteHeader, ProductCardFor, plpHref, textOf, imageOf, IMAGE_SIZES, productNameLinked, releaseInfoLinked,
  productHref, productName, formatPrice, sampleAttrs, isOffers, priceText } = require('./shell.js');

const SHELF_COUNT = 6;    // This week, Figma: 2 rows of 3 tiles on desktop
const RECENT_COUNT = 12;  // Recent, Figma `home shelf` more records: 4 rows of 3 (decision 0167)
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

// the genres of the available sale listings, A–Z, each linking to the sale PLP filtered by it
function genresOf(products, url) {
  const names = new Set();
  products.forEach((p) => (p.release.genres || []).forEach((g) => names.add(g)));
  return [...names].sort((a, b) => a.localeCompare(b)).map((g) => ({ label: g, href: plpHref(url, 'genre', g) }));
}

// a record as a ProductTile: every photo (cover first), samples as in the card, Add to bag (site.js syncs it: In bag,
// (Reserved) Notify me, Sold out)
function TileFor({ product, url }) {
  const { listing, release, copy, samples } = product;
  const href = productHref(product, url);
  const photos = [release.cover].concat(copy.photos || []).filter(Boolean);
  return h(Z.ProductTile, {
    'data-listing-id': listing.id,
    'data-listing-status': listing.status,
    'data-listing-section': listing.section,
    href,
    images: photos.map((src, i) => imageOf(product, src, url, { sizes: IMAGE_SIZES.tile, alt: i === 0 ? productName(release) : '' })),
    title: productNameLinked(product, url, href),
    releaseInfo: releaseInfoLinked(release, url),
    'data-price-mode': isOffers(listing) ? 'offers' : undefined,
    price: priceText(listing),
    samples: samples.length ? samples.map((s, i) => h(Z.PlayerButton, Object.assign({
      key: s.track_position,
      'aria-label': `${productName(release)}, sample ${i + 1}: ${s.title}`
    }, sampleAttrs(product, s, url)), String(i + 1))) : null,
    counter: false,   // Gio 2026-11-18 (0121): the next photo peeks in, no "1/3" needed
    // best offer (decision 0158): a link to the offer page instead of Add to bag; reserved, a button like any copy's that
    // site.js makes "(Reserved) Notify me" (0189)
    action: isOffers(listing)
      ? (listing.status === 'available'
        ? h(Z.Button, { hierarchy: 'secondary', href: url(`/products/${listing.slug}/offer/`) }, 'Make an offer')
        : h(Z.Button, { hierarchy: 'secondary', 'data-add-to-bag': listing.id, 'data-listing-status': listing.status,
            'data-offer-href': url(`/products/${listing.slug}/offer/`), disabled: listing.status === 'sold' }, listing.status === 'sold' ? 'Sold out' : 'Make an offer'))
      : h(Z.Button, { hierarchy: 'secondary', 'data-add-to-bag': listing.id, 'data-listing-status': listing.status }, 'Add to bag')
  });
}

function Shelf({ id, title, meta, items, url, divider, viewAll }) {
  const hasSamples = items.some((p) => (p.samples || []).some((s) => s.audio_url));
  const btn = (label, props) => h(Z.Button, Object.assign({ hierarchy: 'secondary' }, props), label);
  return h('section', { className: 'home-shelf', 'aria-labelledby': id, 'data-play-scope': '' },
    h(Z.SectionHead, { title, titleId: id, meta, divider, actions: h(React.Fragment, null,
      hasSamples ? btn('Play all', { type: 'button', 'data-play-all': '' }) : null,
      // next to Play all (decision 0126): every shelf has one, all of them switch the whole page
      h('div', { className: 'home-view-toggle' },
        h(Z.ViewToggle, { view: 'grid', 'data-home-toggle': 'list', 'aria-controls': 'home-main' }),
        h(Z.ViewToggle, { view: 'list', 'data-home-toggle': 'grid', 'aria-controls': 'home-main' })),
      btn('See all', { href: url('/sale/') })) }),
    h('div', { className: 'home-shelf__grid', 'data-home-view': 'grid' },
      items.map((product) => h(TileFor, { key: product.listing.slug, product, url }))),
    h('div', { className: 'home-shelf__list', 'data-home-view': 'list' },
      items.map((product) => h(ProductCardFor, { key: product.listing.slug, product, url, headingLevel: 3 }))),
    // Figma `home shelf` → view all (decision 0167): the PDP's "View all for sale", full width under both views
    viewAll ? h('div', { className: 'home-shelf__action' },
      h(Z.Button, { hierarchy: 'secondary', size: 'large', href: url('/sale/') }, 'View all for sale')) : null);
}

function Home({ products, site, url, collections = [], now = Date.now() }) {
  // the Bargain crate stays off the home (decision 0201): the curated part stays clean
  const sale = products.filter((p) => p.listing.section === 'sale' && !p.listing.bargain);
  // the shelves are about what is new (decision 0129): newest published first, not Gio's order of the shop lists
  const newest = (x, y) => String(y.listing.published_at || '').localeCompare(String(x.listing.published_at || ''));
  const onSale = sale.filter((p) => ['available', 'reserved'].includes(p.listing.status)).sort(newest);
  const fresh = onSale.filter((p) => p.listing.published_at && now - Date.parse(p.listing.published_at) < WEEK_MS);
  const thisWeek = fresh.slice(0, SHELF_COUNT);
  const recent = onSale.filter((p) => !thisWeek.includes(p)).slice(0, RECENT_COUNT);
  const genres = genresOf(sale.filter((p) => p.listing.status === 'available'), url);
  const nl = site.newsletter || {};
  const intro = textOf(site, 'short.home', 'intro');

  const newsletter = nl.action ? h(Z.HomeNewsletter, { id: 'newsletter', className: 'home-newsletter' },
    h(Z.FooterNewsletter, { id: 'home-newsletter', action: nl.action, endpoint: nl.endpoint || undefined, label: 'Email', hideLabel: true,
      note: ['Get them in your inbox as they’re listed. ', h('a', { key: 'p', href: url('/privacy/') }, 'Privacy')] })) : null;

  return h('div', { className: 'hm-page' },
    h(SiteHeader, { site, url, current: 'home' }),
    h('main', { className: 'home-content', 'data-view': 'grid' },
      h('h1', { className: 'hm-visually-hidden' }, site.storeName),
      h('div', { className: 'home-intro' },
        h(Z.HomeIntro, null, intro, nl.action ? h(React.Fragment, null, ' ', h('a', { href: '#newsletter' }, 'Subscribe to newsletter')) : null)),
      collections.length ? h(Z.HomeCollections, { className: 'home-collections', collections }) : null,
      h('div', { className: 'home-side' },
        genres.length ? h(Z.GenreLinks, { genres, allHref: url('/sale/'), className: 'home-genres' }) : null),
      h('div', { className: 'home-main', id: 'home-main' },
        thisWeek.length ? h(Shelf, { id: 'home-this-week', title: 'This week', meta: `(${fresh.length})`, items: thisWeek, url, viewAll: !recent.length }) : null,
        thisWeek.length ? newsletter : null,
        recent.length ? h(Shelf, { id: 'home-recent', title: 'Recent', items: recent, url, viewAll: true }) : null,
        thisWeek.length ? null : newsletter,
        !thisWeek.length && !recent.length ? h('p', { className: 'body-medium home-empty' }, 'No records right now.') : null)));
}

module.exports = { Home, title: 'Reggae and dancehall records', SHELF_COUNT, RECENT_COUNT };
