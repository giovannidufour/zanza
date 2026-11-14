/* apps/storefront/pages/home.js — the home page "/" (Figma page `Home`, decision 0085).
   A pure function: products in, React tree out. Desktop mirrors the PLP: a 3-column side (where the filters are:
   Genres, About) and a 9-column main (Just in). Mobile: one column, Genres, Just in, About.
   Just in = the newest listings, sale and trade mixed (Gio 2026-11-15; products come in listing order: newest
   published first): sale available or reserved, trade available. Trade cards keep their own button ("Make an offer").
   "Play all" queues their samples in the site player (scripts/site.js, data-play-all). */
'use strict';
const React = require('react');
const Z = require('../../../packages/ui/components.js');
const h = React.createElement;
const { SiteHeader, ProductCardFor, plpHref } = require('./shell.js');

const JUST_IN_COUNT = 8;

// the genres of the available sale listings, A–Z, each linking to the sale PLP filtered by it
function genresOf(products, url) {
  const names = new Set();
  products.forEach((p) => (p.release.genres || []).forEach((g) => names.add(g)));
  return [...names].sort((a, b) => a.localeCompare(b)).map((g) => ({ label: g, href: plpHref(url, 'genre', g) }));
}

function Home({ products, site, url }) {
  const sale = products.filter((p) => p.listing.section === 'sale');
  const justIn = products.filter((p) => (p.listing.section === 'sale' && ['available', 'reserved'].includes(p.listing.status)) ||
    (p.listing.section === 'trade' && p.listing.status === 'available')).slice(0, JUST_IN_COUNT);
  const genres = genresOf(sale.filter((p) => p.listing.status === 'available'), url);
  const hasSamples = justIn.some((p) => (p.samples || []).some((s) => s.audio_url));
  const owner = site.owner || {};
  const discogs = owner.discogs || {};
  const btn = (label, props) => h(Z.Button, Object.assign({ hierarchy: 'secondary' }, props), label);
  const list = (items) => h('div', { className: 'home-list' }, items.map((product) =>
    h(ProductCardFor, { key: product.listing.slug, product, url, headingLevel: 3 })));

  // one grid: Genres, Just in, About in this order (mobile = one column in DOM order: Genres on top, Gio 2026-11-15);
  // desktop places Genres and About in the side column and Just in across both rows of the main column
  return h('div', { className: 'zz-page' },
    h(SiteHeader, { site, url, current: 'home' }),
    h('main', { className: 'home-content' },
      h('h1', { className: 'zz-visually-hidden' }, site.storeName),
      genres.length ? h(Z.GenreLinks, { id: 'home-genres', genres, divider: false, className: 'home-genres' }) : null,
      h('section', { className: 'home-section home-just-in', 'aria-labelledby': 'home-just-in', 'data-play-scope': '' },
        // no "See all": the list mixes sale and trade, the full lists are the header tabs (Gio 2026-11-15)
        h(Z.SectionHead, { title: 'Just in', titleId: 'home-just-in',
          actions: hasSamples ? btn('Play all', { type: 'button', 'data-play-all': '' }) : null }),
        justIn.length ? list(justIn) : h('p', { className: 'body-medium home-empty' }, 'No records right now.')),
      h(Z.HomeAbout, { id: 'home-about', href: url('/about/'), className: 'home-about',
        discogs: discogs.username ? { handle: discogs.username, stats: discogs.stats, href: discogs.href } : undefined },
        owner.bio)));
}

module.exports = { Home, title: 'Reggae and dancehall records', JUST_IN_COUNT };
