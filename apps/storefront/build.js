/* apps/storefront/build.js — static build.
   products (Supabase, or content/products/*.json: see data/products.js) → dist/products/<slug>/index.html,
   dist/index.html (home), dist/sale/index.html (PLP), dist/search/index.html (search results), dist/bag/index.html (bag), dist/checkout/thanks/index.html (after Stripe Checkout), dist/account/{,order/,details/}index.html (customer account), dist/<legal page>/index.html (content/legal/*.md) (+ css, fonts, assets). `--source=json` forces the local JSON.
   Upload the whole `dist/` folder to the web root. Run: npm run build
   Cloudflare Pages: `npm run build:pages` (= --target=pages --source=supabase: root basePath, never the local JSON). */
'use strict';
const fs = require('fs');
const path = require('path');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '../..');
const UI = path.join(ROOT, 'packages/ui');
const APP = __dirname;
// `--target=pages` (Cloudflare Pages) overrides site.json with site.json → targets.pages (e.g. basePath '' = web root)
const targetArg = (process.argv.find(a => a.startsWith('--target=')) || '').split('=')[1];
const siteFile = JSON.parse(fs.readFileSync(path.join(APP, 'site.json'), 'utf8'));
if (targetArg && !(siteFile.targets || {})[targetArg]) throw new Error(`site.json has no targets.${targetArg}`);
const site = Object.assign({}, siteFile, targetArg ? siteFile.targets[targetArg] : {});
// dist/<outputDir>/ is the folder to upload; basePath is where it will live on the domain ('' = web root)
const BASE = (site.basePath || '').replace(/\/$/, '');
const DIST = path.join(APP, 'dist', site.outputDir || '');
const url = (p) => (/^https?:\/\//.test(p) ? p : BASE + p);   // absolute URLs pass through
// cache-busting: a short content hash on every stylesheet link, so a redeploy never serves a stale CSS
const hashOf = (buf) => crypto.createHash('sha1').update(buf).digest('hex').slice(0, 8);
// custom media (`@media (--mobile)`) are expanded from tokens.json → breakpoint: one value, one place
const { expandMedia } = require(path.join(UI, 'media.js'));
// dist CSS ships without comments: lighter, and pure ASCII (the host's FTP rejected components.css with 451,
// likely because of the non-ASCII box-drawing characters in its comments). Sources keep their comments.
const stripComments = (css) => css.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\n\s*\n+/g, '\n').trim() + '\n';
const readCss = (f) => stripComments(expandMedia(fs.readFileSync(f, 'utf8')));
const css = {
  fonts: readCss(path.join(APP, 'fonts.css')),
  tokens: readCss(path.join(UI, 'tokens.css')),
  components: readCss(path.join(UI, 'components.css')),
  base: readCss(path.join(APP, 'base.css')),
  pdp: readCss(path.join(APP, 'pdp.css')),
  plp: readCss(path.join(APP, 'plp.css')),
  bag: readCss(path.join(APP, 'bag.css')),
  trade: readCss(path.join(APP, 'trade.css')),
  legal: readCss(path.join(APP, 'legal.css')),
  home: readCss(path.join(APP, 'home.css')),
  account: readCss(path.join(APP, 'account.css'))
};
const cssHref = (name) => url(`/css/${name}.css?v=${hashOf(css[name])}`);
const siteJs = fs.readFileSync(path.join(APP, 'scripts/site.js'));
const siteJsHref = url(`/js/site.js?v=${hashOf(siteJs)}`);
// customer account (decision 0101): sign-in and orders, on every page (the menu shows the signed-in email)
const accountJs = fs.readFileSync(path.join(APP, 'scripts/account.js'));
const accountJsHref = url(`/js/account.js?v=${hashOf(accountJs)}`);
// toast behaviour (decision 0049): the same file as the admin, straight from packages/ui
const toastJs = fs.readFileSync(path.join(UI, 'toast.js'));
const toastJsHref = url(`/js/toast.js?v=${hashOf(toastJs)}`);
// shipping estimate (decision 0057): the same file as the admin and create-checkout, straight from packages/shipping
const shippingJs = fs.readFileSync(path.join(ROOT, 'packages/shipping/shipping.js'));
const shippingJsHref = url(`/js/shipping.js?v=${hashOf(shippingJs)}`);
// newsletter signup + confirm page (decision 0103): the same file as the coming-soon page
const newsletterJs = fs.readFileSync(path.join(APP, 'scripts/newsletter.js'));
const newsletterJsHref = url(`/js/newsletter.js?v=${hashOf(newsletterJs)}`);
const { Pdp, title } = require('./pages/pdp.js');
const Plp = require('./pages/plp.js');
const Bag = require('./pages/bag.js');
const Checkout = require('./pages/checkout.js');
const Trade = require('./pages/trade.js');
const Legal = require('./pages/legal.js');
const ContactPage = require('./pages/contact.js');
const Newsletter = require('./pages/newsletter.js');
const Home = require('./pages/home.js');
const Account = require('./pages/account.js');
const Z = require(path.join(UI, 'components.js'));

// the site player: one per page, outside .zz-page, so the soft navigation in site.js keeps it (and the audio) alive.
// Empty and closed at load; site.js fills it when a sample is played.
const playerHtml = renderToStaticMarkup(React.createElement(Z.Player, {
  className: 'site-player',
  sampleTitle: '',
  productName: '',
  actions: React.createElement(React.Fragment, null,
    React.createElement(Z.Button, { hierarchy: 'secondary', size: 'small', className: 'site-player__add' }, 'Add to bag'),
    React.createElement(Z.Button, { hierarchy: 'secondary', size: 'small', className: 'site-player__view', href: url('/') }, 'View'))
}));

// the toast region (decision 0049): one per page, outside .zz-page like the player, so a toast survives soft navigation
const toastRegionHtml = renderToStaticMarkup(React.createElement(Z.ToastRegion, { className: 'site-toasts' }));

// "Notify me" on a reserved copy (proposal, design/open.md; migration 0016): one dialog per page, outside .zz-page like
// the toasts; scripts/site.js opens it from any Reserved button with that copy's id and sends the email to Supabase
const notifyDialogHtml = renderToStaticMarkup(React.createElement(Z.Dialog, {
  open: false, className: 'site-notify', 'data-notify-dialog': '', title: 'Reserved', confirmLabel: 'Notify me',
  onConfirm: () => {}, onCancel: () => {},
  field: React.createElement(Z.Input, { label: 'Email', type: 'email', name: 'email', autoComplete: 'email', required: true,
    placeholder: 'name@example.com', supportText: 'One email, only for this record. Then we delete your address.', 'data-notify-email': '' })
}, 'Someone is checking out this record. If they don\u2019t buy it, it\u2019s back within 30 minutes. Leave your email and we\u2019ll tell you.'));

// the tick of "In bag" (decision 0058): scripts/site.js clones it into the Button's leading icon slot
const tickTemplate = `<template id="zz-icon-tick">${renderToStaticMarkup(React.createElement('span', { className: 'zz-button__icon', 'aria-hidden': 'true' }, React.createElement(Z.TickLargeThinIcon)))}</template>`;
// the envelope of "(Reserved) Notify me" (copy held by a checkout, decision 0065): trailing slot, cloned by scripts/site.js
const envelopeTemplate = `<template id="zz-icon-envelope">${renderToStaticMarkup(React.createElement('span', { className: 'zz-button__icon', 'aria-hidden': 'true' }, React.createElement(Z.EnvelopeIcon)))}</template>`;
// live status (_context/backend.md → Stato dal vivo): with Supabase as the source, the page carries the project URL and
// the publishable key (public by design, read-only through RLS) so scripts/site.js can read listing_availability
let liveMeta = '';


// the site footer (decision 0076): the same on every shop page, the last child of .zz-page (after <main>), so the soft
// navigation in site.js swaps it with the page. Rendered once here instead of in every page module.
// Rendered on first use, once the settings are loaded (the footer follows the trade switch).
let footerCache;
const footerHtml = () => footerCache || (footerCache = renderToStaticMarkup(React.createElement(require('./pages/shell.js').SiteFooter, { site, url })));
const withFooter = (body) => (body.startsWith('<div class="zz-page"') && body.endsWith('</div>') ? body.slice(0, -6) + footerHtml() + '</div>' : body);
// the staging edit bar goes first inside .zz-page (above the header, scrolls away with the page)
const withEditBar = (body, bar) => (bar && body.startsWith('<div class="zz-page"') ? body.replace(/^<div class="zz-page"[^>]*>/, m => m + bar) : body);

// Staging only (decision 0106): a strip of ✎ links at the top of the page, to the admin editors of the texts on this
// page, opened in a new tab. site.json → targets.pages → editLinks = the admin URL; shown only while the shop is noindex (staging), so
// it disappears at launch even if editLinks stays set. Inside .zz-page, so the soft navigation swaps it with the page.
const pencil = () => React.createElement('svg', { viewBox: '0 0 16 16', fill: 'none', stroke: 'currentColor', strokeWidth: 1, 'aria-hidden': true },
  React.createElement('path', { vectorEffect: 'non-scaling-stroke', d: 'M10.5 2.5l3 3L5 14H2v-3zM9 4l3 3' }));
function editBar(keys) {
  if (!site.editLinks || !site.noindex || !keys || !keys.length) return '';
  const items = keys.map(k => Content.blockOf(k)).filter(Boolean).map(b => renderToStaticMarkup(React.createElement(Z.Button, {
    hierarchy: 'secondary', size: 'small', href: `${site.editLinks}#content/${b.key}`, target: '_blank', rel: 'noopener',
    leadingIcon: pencil(),
    'aria-label': `Edit ${b.title} in the admin (new tab)`
  }, b.title)));
  return items.length ? `<nav class="staging-edit" aria-label="Edit this page's texts (staging only)">${items.join('')}</nav>` : '';
}
// the blocks a page shows (packages/content/content.js → BLOCKS)
const aboutKey = () => (site.identityEnabled ? 'profile' : 'store_profile');

// Favicon = the logo illustration (Gio 2026-11-15, decision 0097): files in public/, served from /assets/
const faviconLinks = [
  `<link rel="icon" href="${url('/assets/favicon.svg')}" type="image/svg+xml">`,
  `<link rel="icon" href="${url('/assets/favicon-32.png')}" type="image/png" sizes="32x32">`,
  `<link rel="apple-touch-icon" href="${url('/assets/apple-touch-icon.png')}">`
].join('\n');

function page({ title: t, body, edit }) {
  return `<!doctype html>
<html lang="${site.lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escape(t)} · ${escape(site.storeName)}</title>
${faviconLinks}
<link rel="stylesheet" href="${cssHref('fonts')}">
<link rel="stylesheet" href="${cssHref('tokens')}">
<link rel="stylesheet" href="${cssHref('components')}">
<link rel="stylesheet" href="${cssHref('base')}">
<link rel="stylesheet" href="${cssHref('pdp')}">
<link rel="stylesheet" href="${cssHref('plp')}">
<link rel="stylesheet" href="${cssHref('bag')}">
<link rel="stylesheet" href="${cssHref('trade')}">
<link rel="stylesheet" href="${cssHref('legal')}">
<link rel="stylesheet" href="${cssHref('home')}">
<link rel="stylesheet" href="${cssHref('account')}">
<script src="${toastJsHref}" defer></script>
<script src="${shippingJsHref}" defer></script>
<script src="${accountJsHref}" defer></script>
<script src="${siteJsHref}" defer></script>
<script src="${newsletterJsHref}" defer></script>
${liveMeta}</head>
<body>
${withEditBar(withFooter(body), editBar(edit))}
${playerHtml}
${toastRegionHtml}
${notifyDialogHtml}
${tickTemplate}
${envelopeTemplate}
</body>
</html>
`;
}
function escape(s) { return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
function write(rel, content) {
  const f = path.join(DIST, rel);
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, content);
  console.log('  ' + rel);
}

// products, in listing order
const { loadProducts, loadSettings, loadTexts, readEnv } = require('./data/products.js');
const shippingData = require('./data/shipping.js');
const sourceArg = (process.argv.find(a => a.startsWith('--source=')) || '').split('=')[1];
const tradeArg = (process.argv.find(a => a.startsWith('--trade=')) || '').split('=')[1];   // on | off: try the shop either way
const identityArg = (process.argv.find(a => a.startsWith('--identity=')) || '').split('=')[1];   // on | off: the same for Who I am
const Content = require('../../packages/content/content.js');

async function main() {
const loaded = await loadProducts(site, { source: sourceArg });
const source = loaded.source;
// the trade switch (admin → Settings, migration 0023, decision 0102): off = no trade anywhere. The pages read
// site.tradeEnabled; the trade copies leave the build here (Supabase already hides them while trade is off: RLS)
// Who I am (migration 0025, decision 0106): off = the Store profile and no trace of Gio; trade is off with it
const settings = await loadSettings({ source, trade: tradeArg, identity: identityArg });
site.tradeEnabled = settings.tradeEnabled;
site.identityEnabled = settings.identityEnabled;
// the texts Gio edits in the admin (page Content, decision 0106): saved rows over today's texts (the defaults: site.json →
// owner, content/legal/*.md, packages/content). The pages read site.texts; `owner` keeps its old shape (Profile, or
// while Who I am is off only the Store profile's about + links: no name, no profiles).
const legalMd = Object.fromEntries(Legal.PAGES.map((p) => [p, fs.readFileSync(path.join(APP, 'content/legal', `${p}.md`), 'utf8')]));
const resolved = Content.resolve(Content.defaults({ owner: siteFile.owner, legal: legalMd }), await loadTexts({ source }));
site.texts = resolved.texts;
site.pageTitles = Content.pageTitles(legalMd);
const store = site.texts.store_profile;
site.owner = site.identityEnabled ? Content.ownerFromProfile(site.texts.profile) : { bio: store.about, links: store.links || [] };
if (resolved.updated['page.privacy']) site.legal = Object.assign({}, site.legal, { updated: String(resolved.updated['page.privacy']).slice(0, 10) });
console.log(`texts: ${Object.keys(resolved.updated).length} saved in the admin · who I am ${site.identityEnabled ? 'on' : 'off'}`);
const products = site.tradeEnabled ? loaded.products : loaded.products.filter(p => p.listing.section !== 'trade');
console.log(`products: ${products.length} from ${source} · trade ${site.tradeEnabled ? 'on' : 'off'}`);
if (source === 'supabase') {
  const env = readEnv();
  liveMeta = `<meta name="zz-supabase-url" content="${escape(env.SUPABASE_URL.replace(/\/$/, ''))}">\n<meta name="zz-supabase-key" content="${escape(env.SUPABASE_PUBLISHABLE_KEY)}">\n`;
}
// shipping config from the same source as the products (null = not set up: the bag says "Calculated at checkout")
const shipping = source === 'supabase' ? await shippingData.fromSupabase(readEnv()) : shippingData.fromJson();
console.log(`shipping: ${shipping && (shipping.rates || []).length ? shipping.rates.length + ' rate(s)' : 'not set up'}`);

// only now that the data is here: a failed fetch must not leave an empty dist/
fs.rmSync(path.join(APP, 'dist'), { recursive: true, force: true });
console.log(`dist/${site.outputDir || ''}  (basePath: '${BASE || '/'}')`);

// static assets
write('css/fonts.css', css.fonts);
write('css/tokens.css', css.tokens);
write('css/components.css', css.components);
write('css/base.css', css.base);
write('css/pdp.css', css.pdp);
write('css/plp.css', css.plp);
write('css/bag.css', css.bag);
write('css/trade.css', css.trade);
write('css/legal.css', css.legal);
write('css/home.css', css.home);
write('css/account.css', css.account);
write('js/site.js', siteJs);
write('js/account.js', accountJs);
write('js/toast.js', toastJs);
write('js/shipping.js', shippingJs);
write('js/newsletter.js', newsletterJs);
for (const f of fs.readdirSync(path.join(APP, 'public'))) write('assets/' + f, fs.readFileSync(path.join(APP, 'public', f)));

const order = new Map(products.map((p, i) => [p, i]));
// "More for sale" (PDP, decision 0119): always RELATED_COUNT records when the catalogue has them. First the available
// records of the same section, then the available ones of the other section (none while trade is off), then the
// unavailable ones (sold / reserved, shown with their state); inside each group most shared genres first, then
// listing order. Placeholder logic until the backend provides recommendations.
const RELATED_COUNT = 12;
function relatedTo(product) {
  const genres = new Set(product.release.genres || []);
  const rank = (p) => (p.listing.status === 'available' ? 0 : 2) + (p.listing.section === product.listing.section ? 0 : 1);
  return products
    .filter(p => p !== product)   // trade copies are already out of `products` while trade is off
    .map(p => ({ p, rank: rank(p), score: (p.release.genres || []).filter(g => genres.has(g)).length }))
    .sort((a, b) => a.rank - b.rank || b.score - a.score || order.get(a.p) - order.get(b.p))
    .slice(0, RELATED_COUNT).map(x => x.p);
}
for (const product of products) {
  const body = renderToStaticMarkup(React.createElement(Pdp, { product, related: relatedTo(product), site, url }));
  write(`products/${product.listing.slug}/index.html`, page({ title: title(product), body, edit: product.listing.section === 'trade' ? ['short.trade', aboutKey()] : null }));
}

// PLP: the listing of the "For sale" section (Figma: PLP - desktop); "For trade" has no products yet.
// A reserved copy stays in the list with its "Reserved" button: it is paused, not gone (Gio 2026-11-12)
// Sold copies stay too, behind the "Show sold out" filter, ticked by default (Gio 2026-11-12, Figma page `Search`)
const forSale = products.filter(p => p.listing.section === 'sale' && ['available', 'reserved', 'sold'].includes(p.listing.status));
write('sale/index.html', page({ title: Plp.title('sale'), body: renderToStaticMarkup(React.createElement(Plp.Plp, { section: 'sale', products: forSale, allProducts: products, site, url })) }));

// For trade (Figma page `Trade`, decision 0068): the trade PLP, one offer page per trade listing, How trading works, About.
// Traded copies stay on the list like sold ones (behind "Show sold out").
const forTrade = products.filter(p => p.listing.section === 'trade' && ['available', 'reserved', 'traded'].includes(p.listing.status));
if (site.tradeEnabled) write('trade/index.html', page({ title: Plp.title('trade'), body: renderToStaticMarkup(React.createElement(Plp.Plp, { section: 'trade', products: forTrade, allProducts: products, site, url })) }));
// Catalog (decision 0085, Gio 2026-11-15): every record of both sections mixed, newest first, with the PLP filters.
// Linked only from the home's "See all" under Just in (no tab, no menu item).
const catalog = products.filter(p => forSale.includes(p) || forTrade.includes(p));
write('catalog/index.html', page({ title: Plp.title('catalog'), body: renderToStaticMarkup(React.createElement(Plp.Plp, { section: 'catalog', products: catalog, allProducts: products, site, url })) }));
for (const product of forTrade.filter(p => p.listing.status === 'available')) {
  write(`products/${product.listing.slug}/offer/index.html`, page({ title: `Make an offer · ${title(product)}`, body: renderToStaticMarkup(React.createElement(Trade.Offer, { product, site, url })), edit: ['short.trade', aboutKey()] }));
}
// trade off: no /trade/, no offer pages (forTrade is empty), no How trading works. A Pages deploy replaces the whole
// site, so the pages of the previous build are gone too.
if (site.tradeEnabled) write('how-trading-works/index.html', page({ title: 'How trading works', body: renderToStaticMarkup(React.createElement(Trade.HowTrading, { site, url })), edit: ['page.how_trading'] }));
write('about/index.html', page({ title: 'About', body: renderToStaticMarkup(React.createElement(Trade.About, { site, url })), edit: [aboutKey()] }));

// Search results (Figma page `Search`, 2026-11-12): /search/?q=… is a PLP of the same copies, matched in the browser
// (scripts/site.js) against each card's data-search text. Static and client-side: fine at hundreds of copies
// (_context/stack.md: a search service only past ~2k).
write('search/index.html', page({ title: 'Search', body: renderToStaticMarkup(React.createElement(Plp.Plp, { section: 'sale', products: forSale, allProducts: products, site, url, search: true })) }));

// Bag (decision 0044): one hidden line per listing of the sale section, whatever its status (a copy sold after it was
// added still shows, as unavailable); scripts/site.js shows the visitor's own lines from localStorage
const bagProducts = products.filter(p => p.listing.section === 'sale');
write('bag/index.html', page({ title: Bag.title, body: renderToStaticMarkup(React.createElement(Bag.Bag, { products: bagProducts, site, url, shipping, countries: shippingData.countries(shipping) })) }));
// after a paid Stripe Checkout (migration 0021, Figma page `Checkout`): site.js takes the paid records out of the bag
write('checkout/thanks/index.html', page({ title: Checkout.title, body: renderToStaticMarkup(React.createElement(Checkout.Thanks, { site, url })), edit: ['short.order'] }));

// Customer account (decision 0101, Figma page `Account`): sign in with an email code, then the orders bought with that
// email (scripts/account.js reads them from Supabase). Static shells: nothing personal is in the HTML.
write('account/index.html', page({ title: Account.TITLE.orders, body: renderToStaticMarkup(React.createElement(Account.Account, { site, url, view: 'orders' })) }));
write('account/order/index.html', page({ title: Account.TITLE.order, body: renderToStaticMarkup(React.createElement(Account.Account, { site, url, view: 'order' })) }));
write('account/details/index.html', page({ title: Account.TITLE.details, body: renderToStaticMarkup(React.createElement(Account.Account, { site, url, view: 'details' })) }));

// Legal pages (decision 0079, Figma page `Legal`): content/legal/<page>.md → /<page>/. What Gio still has to fill
// (site.json → legal, [[TO FILL]] in the text) is listed here, so a build never hides a placeholder.
for (const p of Legal.PAGES) {
  const md = Content.markdownFromSections(site.pageTitles[p], site.texts[`page.${p}`].sections);
  const { title: t, body, missing } = Legal.legalPage(p, { site, url, shipping, countries: shippingData.countries(shipping), md });
  write(`${p}/index.html`, page({ title: t, body: renderToStaticMarkup(body), edit: [`page.${p}`] }));
  if (missing.length) console.log(`    to fill: ${missing.join(' · ')}`);
}
// Contact (decision 0093): email + form, in place of an Impressum (Gio sells privately)
write('contact/index.html', page({ title: 'Contact', body: renderToStaticMarkup(React.createElement(ContactPage.Contact, { site, url })), edit: ['short.contact'] }));
// the link in the newsletter confirmation email lands here (decision 0103)
write('newsletter/confirm/index.html', page({ title: Newsletter.title, body: renderToStaticMarkup(React.createElement(Newsletter.ShopConfirm, { site, url })) }));

// Home (Figma page `Home`, decision 0085): Just in, Genres, About
write('index.html', page({ title: Home.title, body: renderToStaticMarkup(React.createElement(Home.Home, { products, site, url })), edit: [aboutKey()] }));
// Cloudflare Pages response headers (target pages only). Until launch the shop lives on staging.rythem-works.com
// (behind Cloudflare Access) and store-front-6fx.pages.dev: neither may be indexed (site.json → noindex).
if (targetArg === 'pages' && site.noindex) write('_headers', '/*\n  X-Robots-Tag: noindex\n');
console.log(`done: ${products.length} product page(s), ${forSale.length} for sale` + (site.tradeEnabled ? `, ${forTrade.length} for trade` : ', trade off'));
}
main().catch((err) => { console.error(err.message || err); process.exit(1); });
