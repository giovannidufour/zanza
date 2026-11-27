/* apps/storefront/pages/shell.js — what every page shares: the site header and the data → text mapping.
   Pure functions, no state. */
'use strict';
const React = require('react');
const Z = require('../../../packages/ui/components.js');
const Content = require('../../../packages/content/content.js');
const Images = require('../../../packages/images/images.js');
const { queries } = require('../../../packages/ui/media.js');
const h = React.createElement;

// catalog = every record, sale and trade mixed (/catalog/, reached only from the home's "See all", decision 0085)
// bargain = the Bargain crate, /bargain-crate/ (decision 0201): the sale records flagged in the admin
const SECTION_LABEL = { sale: 'For sale', trade: 'For trade', bargain: 'Bargain crate', catalog: 'Catalog' };

// ── photo sizes (decision 0108) ──
// How wide each spot draws a photo, for <img sizes>: measured on the page grids (card = 2 of 12 columns, 96 px on
// mobile; PDP gallery = 4 of 12 columns, full width on mobile). Fixed-size spots (bag 96, player 48) need none here.
const IMAGE_SIZES = {
  card: `${queries.mobile} 96px, 16vw`,
  gallery: `${queries.mobile} 100vw, 33vw`,
  tile: `${queries.mobile} 100vw, 25vw`   // home ProductTile: 3 per row in the 9-column main, full width on mobile
};
// a photo of `product` as a component image: + srcset when its smaller copies exist (data/products.js → markSized)
function imageOf(product, src, url, { sizes, alt = '' } = {}) {
  if (!src) return null;
  const sized = (product.sized || []).includes(src);
  return { src: url(src), alt, srcSet: sized ? Images.srcSet(url(src)) : undefined, sizes: sized ? sizes : undefined };
}
// one file for a small fixed spot (player 48, offer 80): the smallest copy at least px × 2 wide (sharp on 2× screens)
function smallImageUrl(product, src, px, url) {
  if (!src) return undefined;
  return url((product.sized || []).includes(src) ? Images.smallest(src, px * 2) : src);
}

// ── data → text (mapping confirmed 2026-11-07) ──
const formatPrice = (p) => `${p.amount % 100 === 0 ? p.amount / 100 : (p.amount / 100).toFixed(2)}€`;
// best offer (migration 0034, decision 0158): a sale copy with no price, buyers make an offer on /products/<slug>/offer/
const isOffers = (listing) => listing.section === 'sale' && listing.price_mode === 'offers';
// decision 0207: a sale copy at a fixed price with no price yet (side A "Unset" in the admin): no price, no Add to bag
const isUnpriced = (listing) => listing.section === 'sale' && !isOffers(listing) && !listing.price;
// the price slot of a card, tile, PDP: the price or "Trade only"; best offer has none (the "Make an offer" CTA says it, Gio 2026-11-23),
// except for the buyer of an accepted offer: an empty hidden slot that scripts/site.js fills with "Your offer · 25€" (decision
// 0191; base.css hides the slot while it is empty)
const priceText = (listing) => listing.section !== 'sale' ? 'Trade only'
  : isOffers(listing) ? React.createElement('span', { 'data-offer-price': listing.id, hidden: true })
  : isUnpriced(listing) ? null : formatPrice(listing.price);
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
// a custom title with the release's artists as links (decision 0111): each artist entity is found by its name, and
// a line's printed credit by its text (the credit of a single artist; a shared credit cut at its join texts as in
// creditNodes). Whole words, case-insensitive, longest first, each artist once; the rest stays text (`plain`).
function customTitleNodes(title, release, url, plain) {
  const found = [];
  const add = (text, ref) => { const t = String(text || '').trim(); if (t && ref) found.push({ text: t, ref }); };
  linesOf(release).forEach((l) => {
    const artists = lineArtists(l);
    artists.forEach((a) => add(a.name, a));
    if (artists.length === 1) add(l.artist, artists[0]);
    else if (artists.length > 1 && l.artist) {
      let rest = l.artist;
      artists.forEach((a, i) => {
        const join = (a.join || '').trim();
        const at = i < artists.length - 1 && join ? rest.toLowerCase().indexOf(' ' + join.toLowerCase() + ' ') : -1;
        if (i === artists.length - 1) add(rest, a);
        else if (at > 0) { add(rest.slice(0, at), a); rest = rest.slice(at + join.length + 2); }
      });
    }
  });
  found.sort((a, b) => b.text.length - a.text.length);
  const lower = title.toLowerCase();
  const isWord = (c) => !!c && /[\p{L}\p{N}]/u.test(c);
  const taken = [];   // [start, end, ref]
  const linked = new Set();
  found.forEach(({ text, ref }) => {
    if (linked.has(ref.slug)) return;
    const t = text.toLowerCase();
    for (let at = lower.indexOf(t); at >= 0; at = lower.indexOf(t, at + 1)) {
      const end = at + t.length;
      if (isWord(title[at - 1]) || isWord(title[end])) continue;
      if (taken.some(([s, e]) => at < e && end > s)) continue;
      taken.push([at, end, ref]); linked.add(ref.slug); break;
    }
  });
  return rangeNodes(title, taken, url, plain);
}
// a custom title with its links as character ranges [[start, end, ref]] (found above, or set by hand: 0147)
function rangeNodes(title, taken, url, plain) {
  if (!taken.length) return plain(title, 'p');
  taken.sort((a, b) => a[0] - b[0]);
  // the separators around an artist (" - ", " / ", " & ") stay text, as in the release name
  const text = (seg, k) => {
    const m = /^([\s\-–—\/&,.:]*)([\s\S]*?)([\s\-–—\/&,.:]*)$/.exec(seg);
    return [m[1], m[2] ? plain(m[2], k) : '', m[3]].filter((x) => x !== '');
  };
  const out = [];
  let pos = 0;
  taken.forEach(([s, e, ref], i) => {
    if (s > pos) out.push(...text(title.slice(pos, s), `p${i}`));
    out.push(entityLink(url, 'artist', ref, title.slice(s, e), `a${i}`));
    pos = e;
  });
  if (pos < title.length) out.push(...text(title.slice(pos), 'p-last'));
  return out;
}
// the product name with the artists as links (in a custom title too, decision 0111).
// pdpHref (cards only, decision 0040): the record title part links to the product page. It is out of the tab order:
// the card's cover link (named by the whole title) is the keyboard / screen reader way in.
function productNameLinked(product, url, pdpHref) {
  const { listing, release } = product;
  const toPdp = (text, k) => pdpHref ? h('a', { key: k, className: 'site-inline-link', href: pdpHref, tabIndex: -1 }, text) : text;
  // links set in the admin (0147): exactly those ranges; a title saved before 0147 derives them (0111)
  if (listing.custom_title && Array.isArray(listing.custom_title_links)) {
    const title = productName(release);
    return rangeNodes(title, listing.custom_title_links.filter((l) => l.ref && l.end <= title.length).map((l) => [l.start, l.end, l.ref]), url, toPdp);
  }
  if (listing.custom_title) return customTitleNodes(productName(release), release, url, toPdp);
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
// no side A grading = "Unset" in the admin (decision 0207): no grading line (null)
const grading = (c) => !c.condition_media ? null : `Record: ${[c.condition_media, c.condition_media_b].filter(Boolean).join(' / ')}`;
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
  // Unset (0207): the comment is about the grading, so it waits for it unless the cover line carries it
  if (!record) return { grading: null, cover, conditions: cover ? note : null };
  if (!cover) return { grading: `${record} ${note}`, cover: null, conditions: null };
  // stacked: its own line, so it keeps the 4px gap of the other lines (Figma `conditions`, decision 0042)
  return { grading: record, cover, conditions: note };
}
const productHref = (product, url) => url(`/products/${product.listing.slug}/`);
// the trade switch (admin → Settings, migration 0023, decision 0102), set by build.js from the database. Off = no
// trade link, tab, menu item or mention on any page. Undefined (a page rendered outside build.js) = on, as before.
const tradeOn = (site) => !site || site.tradeEnabled !== false;
// Who I am (admin → Settings, decision 0106): off = the Store profile, no name, no personal profiles, no trade
const identityOn = (site) => !site || site.identityEnabled !== false;
// Check your wantlist (admin → Settings, migration 0033, decision 0152): set by build.js; off or undefined = no link
const wantlistOn = (site) => !!site && site.wantlistEnabled === true;
// a text Gio edits in the admin (page Content, decision 0106): site.texts (build.js) or, without it, today's text;
// {{#trade}}…{{/trade}} already applied
const DEFAULT_TEXTS = Content.defaults({});
function textOf(site, key, field) {
  const saved = ((site && site.texts) || {})[key];
  const v = saved && saved[field] !== undefined ? saved[field] : (DEFAULT_TEXTS[key] || {})[field];
  return typeof v === 'string' ? Content.applyFlags(v, { trade: tradeOn(site), wantlist: wantlistOn(site) }) : v;
}
// a textarea's paragraphs (an empty line = a new paragraph) as <p>s
const Paragraphs = ({ text, className = 'body-medium' }) => h(React.Fragment, null,
  Content.paragraphs(text).map((p, i) => h('p', { key: i, className }, p)));

// Figma: `header` (device=desktop | mobile), the same on every page.
// `section` = the active tab (none on /bag/). `current = 'home'` → the store name is lit (decision 0085). `current = 'bag'` → the Bag button is the current page (state active,
// decision 0045). The Bag count is the button's suffix in brackets (Gio 2026-11-10): "(0)" in the static HTML,
// scripts/site.js writes the real count from the bag in the browser ([data-bag-count]).
// Mobile: the hamburger opens SiteMenu (scripts/site.js); it is rendered next to the header, inside .hm-page.
function SiteHeader({ site, url, section, current }) {
  return h(React.Fragment, null,
    h(Z.Header, {
      className: 'site-header',   // sticky on scroll up: base.css + scripts/site.js
      logo: h(Z.Logo),   // Figma `logo`, the HIGHMUZIK wordmark (decision 0183)
      storeName: site.storeName,
      homeHref: url('/'),
      homeCurrent: current === 'home',   // Figma `store name` state=active on the home page (decision 0085)
      menuProps: { 'aria-haspopup': 'dialog', 'aria-controls': 'site-menu', 'aria-expanded': 'false', 'data-menu-open': '' },
      // Figma `header` boolean `search` (2026-11-12): the field on desktop; on mobile it lives in the menu (Gio 2026-11-12)
      search: h(SearchForm, { url, id: 'site-search-header' }),
      // trade off (admin → Settings, decision 0102): only "For sale", still the desktop way to /sale/
      tabs: h(Z.Tabs, { as: 'nav', value: section, 'aria-label': 'Section' },
        h(Z.Tab, { value: 'sale', href: url('/sale/') }, 'For sale'),
        tradeOn(site) ? h(Z.Tab, { value: 'trade', href: url('/trade/') }, 'For trade') : null,
        // Bargain crate (Gio 2026-11-27, decision 0201): a third tab for now, Gio will move it later
        h(Z.Tab, { value: 'bargain', href: url('/bargain-crate/') }, 'Bargain crate')),
      actions: h(React.Fragment, null,
        // Account (decision 0101): the customer's orders; state active on /account/ pages, as Bag on /bag/ (0045)
        h(Z.Button, { hierarchy: 'secondary', className: 'hm-header__account', href: url('/account/'),
          state: current === 'account' ? 'active' : undefined }, 'Account'),
        h(Z.Button, { hierarchy: 'secondary', href: url('/bag/'), state: current === 'bag' ? 'active' : undefined,
          suffix: '(0)', 'data-bag-count': '' }, 'Bag'))
    }),
    h(SiteMenu, { site, url, current: current || section }));
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

// Figma page `menu` (proposal 2026-11-12, search field on top since 2026-11-12): the mobile menu, a full-screen native modal dialog (focus trapped, Esc
// closes, the page behind is inert). Account is the entry point to /account/ on mobile; the Bag stays in the header.
// The Account detail is "Sign in to see your orders" until accounts exist (then: the signed-in email).
function SiteMenu({ site, url, current }) {
  const trade = tradeOn(site);
  const item = (key, label, href, detail) => h(Z.MenuItem, { key, label, href: url(href), detail, current: key === current });
  const legal = LEGAL_LINKS
    .map(([text, href]) => h('a', { key: href, href: url(href) }, text));
  return h('dialog', { id: 'site-menu', className: 'site-menu', 'aria-label': 'Menu', tabIndex: -1, 'data-site-menu': '' },
    h(Z.MenuLayer, { title: 'Menu', closeLabel: 'Close menu', legal },
      // Figma `menu layer`: the search field on top of the body (Gio 2026-11-12: mobile search in the menu, not the header)
      h(SearchForm, { url, id: 'site-search-menu', className: 'site-menu__search' }),
      h(Z.MenuGroup, null, item('sale', 'For sale', '/sale/'), trade ? item('trade', 'For trade', '/trade/') : null,
        item('bargain', 'Bargain crate', '/bargain-crate/'),
        wantlistOn(site) ? item('wantlist', 'Check your wantlist', '/wantlist/') : null),
      // the detail becomes the signed-in email (scripts/account.js, [data-account-email]); decision 0101
      h(Z.MenuGroup, null, item('account', 'Account', '/account/', h('span', { 'data-account-email': '' }, 'Sign in to see your orders'))),
      h(Z.MenuGroup, null, item('about', 'About', '/about/'), trade ? item('how-trading-works', 'How trading works', '/how-trading-works/') : null,
        item('grading', 'Grading', '/grading/'), item('shipping', 'Shipping', '/shipping/'), item('contact', 'Contact', '/contact/'))));
}

// Figma page `footer` (decision 0076): the same on every shop page, after <main>. Links = the mobile menu's
// (SiteMenu), so both lead to the same places; social = Gio's Instagram and Discogs (site.json → owner, his personal
// identity). The newsletter slot shows only when site.json → newsletter.action is set (Buttondown subscribe URL):
// it stays off until the Privacy page names Buttondown (German law, design/open.md). newsletter.endpoint = our own
// double opt-in (decision 0103, scripts/newsletter.js); Buttondown's form stays as the fallback without JS.
const LEGAL_LINKS = [['Privacy', '/privacy/'], ['Terms', '/terms/']];   // private seller (decision 0093): no Impressum, no Withdrawal; contact = /contact/;
function SiteFooter({ site, url, newsletter = true }) {
  const owner = site.owner || {};
  const nl = site.newsletter || {};
  const link = (label, href) => ({ label, href: url(href) });
  // Who I am off (decision 0106): the Store profile's own links instead of Gio's Instagram and Discogs
  const social = identityOn(site)
    ? [owner.instagram && owner.instagram.href && { label: 'Instagram', href: owner.instagram.href },
      owner.discogs && owner.discogs.href && { label: 'Discogs', href: owner.discogs.href }].filter(Boolean)
    : (owner.links || []).map((l) => ({ label: l.label, href: l.href }));
  return h(Z.Footer, {
    className: 'site-footer',
    newsletter: newsletter && nl.action ? h(Z.FooterNewsletter, { action: nl.action, endpoint: nl.endpoint || undefined,
      note: [`New records in your inbox. You confirm ${nl.endpoint && nl.autoConfirm !== false ? 'with one click in an email' : 'by email'} and can leave anytime. `, h('a', { key: 'p', href: url('/privacy/') }, 'Privacy')] }) : null,
    legal: LEGAL_LINKS.map(([text, href]) => h('a', { key: href, href: url(href) }, text)),
    copyright: `\u00a9 ${new Date().getFullYear()} ${site.storeName}`
  },
  h(Z.FooterLinks, { label: 'Shop', links: [link('For sale', '/sale/'), tradeOn(site) && link('For trade', '/trade/'), link('Bargain crate', '/bargain-crate/'),
    wantlistOn(site) && link('Check your wantlist', '/wantlist/')].filter(Boolean) }),
  h(Z.FooterLinks, { label: 'Info', links: [link('About', '/about/'), tradeOn(site) && link('How trading works', '/how-trading-works/'),
    link('Grading', '/grading/'), link('Shipping', '/shipping/'), link('Contact', '/contact/')].filter(Boolean) }),
  social.length ? h(Z.FooterLinks, { label: 'Follow', links: social }) : null);
}

// the data the site player (scripts/site.js) reads from a PlayerButton: a product's samples are its queue
function sampleAttrs(product, s, url) {
  const { release } = product;
  return {
    disabled: !s.audio_url,
    'data-sample-src': s.audio_url ? url(s.audio_url) : undefined,
    'data-sample-title': s.title,
    'data-product-name': productName(release),
    'data-product-image': smallImageUrl(product, release.cover, 48, url),   // the player's 48 px cover
    'data-product-href': productHref(product, url),
    'data-listing-id': product.listing.id,   // the player's "Add to bag" adds the playing product
    'data-listing-section': product.listing.section,   // trade listings: no Add to bag in the player
    'data-price-mode': isOffers(product.listing) ? 'offers' : isUnpriced(product.listing) ? 'none' : undefined,   // best offer (0158) or no price yet (0207): no Add to bag either
    'data-listing-status': product.listing.status   // sold / traded: the player's button reads "Sold out", disabled
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
const TRADE_CARD_LABEL = { available: 'Make an offer', reserved: 'Reserved', traded: 'Traded', sold: 'Sold out' };
// Figma labels the card samples 1, 2…; the accessible name keeps the product and the sample title.
function ProductCardFor({ product, url, headingLevel }) {
  const { listing, release, copy, samples } = product;
  return h(Z.ProductCard, {
    'data-listing-id': listing.id,   // its Add button puts this copy in the bag (scripts/site.js)
    'data-listing-status': listing.status,   // status at build time; site.js updates it live (Reserved)
    'data-listing-section': listing.section,
    href: productHref(product, url),
    image: imageOf(product, release.cover, url, { sizes: IMAGE_SIZES.card }),
    title: productNameLinked(product, url, productHref(product, url)),
    headingLevel,
    releaseInfo: releaseInfoLinked(release, url),
    'data-price-mode': isOffers(listing) ? 'offers' : undefined,   // best offer: site.js leaves its button alone (0158)
    price: priceText(listing),
    button: !isUnpriced(listing),   // no price yet (0207): no add button
    // trade (Figma page Trade) and best offer (Figma page Offers, 0158): the card button is a link to the offer page,
    // not a bag button (only while available: a reserved, sold or traded copy shows its state, and site.js ignores its button)
    // A reserved best-offer copy (decision 0189) has a button like any copy: site.js makes it "(Reserved) Notify me"
    // (data-offer-href: where it leads once the copy is open to offers again)
    'data-offer-href': isOffers(listing) ? url(`/products/${listing.slug}/offer/`) : undefined,
    addHref: (listing.section === 'trade' || isOffers(listing)) && listing.status === 'available' ? url(`/products/${listing.slug}/offer/`) : undefined,
    addLabel: listing.section === 'trade' ? TRADE_CARD_LABEL[listing.status] || TRADE_CARD_LABEL.available
      : isOffers(listing) ? (listing.status === 'sold' ? 'Sold out' : 'Make an offer') : undefined,
    addLabelShort: listing.section === 'trade' ? (listing.status === 'available' ? 'Offer' : TRADE_CARD_LABEL[listing.status])
      : isOffers(listing) ? (listing.status === 'sold' ? 'Sold out' : 'Offer') : undefined,
    tags: tagLinksOf(release, url),
    description: copy.notes,
    ...gradingProps(copy),
    samples: samples.length ? samples.map((s, i) => h(Z.PlayerButton, Object.assign({
      key: s.track_position,
      'aria-label': `${productName(release)}, sample ${i + 1}: ${s.title}`
    }, sampleAttrs(product, s, url)), String(i + 1))) : null
  });
}

module.exports = { isOffers, isUnpriced, priceText, IMAGE_SIZES, imageOf, smallImageUrl, tradeOn, identityOn, wantlistOn, textOf, Paragraphs, SearchForm, SECTION_LABEL, labelRef, artistRefs, productNameLinked, tagsOf, tagLinksOf, plpHref, formatPrice, productName, releaseInfo, releaseInfoLinked, grading, coverGrading, gradingProps, productHref, SiteHeader, SiteFooter, sampleAttrs, ProductCardFor };
