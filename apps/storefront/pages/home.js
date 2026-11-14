/* apps/storefront/pages/home.js — the home page "/" (Figma page `Home`, decision 0085).
   A pure function: products in, React tree out. Desktop mirrors the PLP: a 3-column side (where the filters are:
   Genres, About) and a 9-column main (Just in, For trade). Mobile: one column, main first.
   Just in = the newest sale listings (products come in listing order: newest published first), available or reserved.
   "Play all" queues their samples in the site player (scripts/site.js, data-play-all). */
'use strict';
const React = require('react');
const Z = require('../../../packages/ui/components.js');
const h = React.createElement;
const { SiteHeader, ProductCardFor, plpHref } = require('./shell.js');

const JUST_IN_COUNT = 8;
const TRADE_COUNT = 4;

// the genres of the available sale listings, A–Z, each linking to the sale PLP filtered by it
function genresOf(products, url) {
  const names = new Set();
  products.forEach((p) => (p.release.genres || []).forEach((g) => names.add(g)));
  return [...names].sort((a, b) => a.localeCompare(b)).map((g) => ({ label: g, href: plpHref(url, 'genre', g) }));
}

function Home({ products, site, url }) {
  const sale = products.filter((p) => p.listing.section === 'sale');
  const justIn = sale.filter((p) => ['available', 'reserved'].includes(p.listing.status)).slice(0, JUST_IN_COUNT);
  const trade = products.filter((p) => p.listing.section === 'trade' && p.listing.status === 'available').slice(0, TRADE_COUNT);
  const genres = genresOf(sale.filter((p) => p.listing.status === 'available'), url);
  const hasSamples = justIn.some((p) => (p.samples || []).some((s) => s.audio_url));
  const owner = site.owner || {};
  const discogs = owner.discogs || {};
  const btn = (label, props) => h(Z.Button, Object.assign({ hierarchy: 'secondary' }, props), label);
  const list = (items) => h('div', { className: 'home-list' }, items.map((product) =>
    h(ProductCardFor, { key: product.listing.slug, product, url, headingLevel: 3 })));

  return h('div', { className: 'zz-page' },
    h(SiteHeader, { site, url, current: 'home' }),
    h('div', { className: 'home-content' },
      h('main', { className: 'home-main' },
        h('h1', { className: 'zz-visually-hidden' }, site.storeName),
        h('section', { className: 'home-section', 'aria-labelledby': 'home-just-in', 'data-play-scope': '' },
          h(Z.SectionHead, { title: 'Just in', titleId: 'home-just-in', divider: false, actions: h(React.Fragment, null,
            hasSamples ? btn('Play all', { type: 'button', 'data-play-all': '' }) : null,
            btn('See all', { href: url('/sale/') })) }),
          justIn.length ? list(justIn) : h('p', { className: 'body-medium home-empty' }, 'No records right now.')),
        trade.length ? h('section', { className: 'home-section', 'aria-labelledby': 'home-trade' },
          h(Z.SectionHead, { title: 'For trade', titleId: 'home-trade', actions: btn('See all', { href: url('/trade/') }) }),
          h(Z.TradeIntro, { href: url('/how-trading-works/') }, 'Not for sale. Make me an offer.'),
          list(trade)) : null),
      h('aside', { className: 'home-side', 'aria-label': 'More' },
        genres.length ? h(Z.GenreLinks, { id: 'home-genres', genres, className: 'home-side__genres' }) : null,
        h(Z.HomeAbout, { id: 'home-about', href: url('/about/'),
          discogs: discogs.username ? { handle: discogs.username, stats: discogs.stats, href: discogs.href } : undefined },
          owner.bio))));
}

module.exports = { Home, title: 'Reggae and dancehall records', JUST_IN_COUNT, TRADE_COUNT };
