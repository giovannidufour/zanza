/* apps/storefront/build.js — static build.
   products (Supabase, or content/products/*.json: see data/products.js) → dist/products/<slug>/index.html,
   dist/sale/index.html (PLP), dist/bag/index.html (bag) (+ css, assets). `--source=json` forces the local JSON.
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
  tokens: readCss(path.join(UI, 'tokens.css')),
  components: readCss(path.join(UI, 'components.css')),
  base: readCss(path.join(APP, 'base.css')),
  pdp: readCss(path.join(APP, 'pdp.css')),
  plp: readCss(path.join(APP, 'plp.css')),
  bag: readCss(path.join(APP, 'bag.css'))
};
const cssHref = (name) => url(`/css/${name}.css?v=${hashOf(css[name])}`);
const siteJs = fs.readFileSync(path.join(APP, 'scripts/site.js'));
const siteJsHref = url(`/js/site.js?v=${hashOf(siteJs)}`);
// toast behaviour (decision 0049): the same file as the admin, straight from packages/ui
const toastJs = fs.readFileSync(path.join(UI, 'toast.js'));
const toastJsHref = url(`/js/toast.js?v=${hashOf(toastJs)}`);
// shipping estimate (decision 0057): the same file as the admin and create-checkout, straight from packages/shipping
const shippingJs = fs.readFileSync(path.join(ROOT, 'packages/shipping/shipping.js'));
const shippingJsHref = url(`/js/shipping.js?v=${hashOf(shippingJs)}`);
const { Pdp, title } = require('./pages/pdp.js');
const Plp = require('./pages/plp.js');
const Bag = require('./pages/bag.js');
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
// the clock of "Reserved" (copy held by a checkout, design/open.md): same slot, cloned by scripts/site.js
const clockTemplate = `<template id="zz-icon-clock">${renderToStaticMarkup(React.createElement('span', { className: 'zz-button__icon', 'aria-hidden': 'true' }, React.createElement(Z.ClockCounterClockwiseIcon)))}</template>`;
// live status (_context/backend.md → Stato dal vivo): with Supabase as the source, the page carries the project URL and
// the publishable key (public by design, read-only through RLS) so scripts/site.js can read listing_availability
let liveMeta = '';


function page({ title: t, body }) {
  return `<!doctype html>
<html lang="${site.lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escape(t)} · ${escape(site.storeName)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500&display=swap" rel="stylesheet">
<link rel="stylesheet" href="${cssHref('tokens')}">
<link rel="stylesheet" href="${cssHref('components')}">
<link rel="stylesheet" href="${cssHref('base')}">
<link rel="stylesheet" href="${cssHref('pdp')}">
<link rel="stylesheet" href="${cssHref('plp')}">
<link rel="stylesheet" href="${cssHref('bag')}">
<script src="${toastJsHref}" defer></script>
<script src="${shippingJsHref}" defer></script>
<script src="${siteJsHref}" defer></script>
${liveMeta}</head>
<body>
${body}
${playerHtml}
${toastRegionHtml}
${notifyDialogHtml}
${tickTemplate}
${clockTemplate}
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
const { loadProducts, readEnv } = require('./data/products.js');
const shippingData = require('./data/shipping.js');
const sourceArg = (process.argv.find(a => a.startsWith('--source=')) || '').split('=')[1];

async function main() {
const { products, source } = await loadProducts(site, { source: sourceArg });
console.log(`products: ${products.length} from ${source}`);
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
write('css/tokens.css', css.tokens);
write('css/components.css', css.components);
write('css/base.css', css.base);
write('css/pdp.css', css.pdp);
write('css/plp.css', css.plp);
write('css/bag.css', css.bag);
write('js/site.js', siteJs);
write('js/toast.js', toastJs);
write('js/shipping.js', shippingJs);
for (const f of fs.readdirSync(path.join(APP, 'public'))) write('assets/' + f, fs.readFileSync(path.join(APP, 'public', f)));

const order = new Map(products.map((p, i) => [p, i]));
// "More for sale" (PDP): up to 3 other available products of the same section, most shared genres first, then
// listing order. Placeholder logic until the backend provides recommendations.
const RELATED_COUNT = 3;
function relatedTo(product) {
  const genres = new Set(product.release.genres || []);
  return products
    .filter(p => p !== product && p.listing.section === product.listing.section && p.listing.status === 'available')
    .map(p => ({ p, score: (p.release.genres || []).filter(g => genres.has(g)).length }))
    .sort((a, b) => b.score - a.score || order.get(a.p) - order.get(b.p))
    .slice(0, RELATED_COUNT).map(x => x.p);
}
for (const product of products) {
  const body = renderToStaticMarkup(React.createElement(Pdp, { product, related: relatedTo(product), site, url }));
  write(`products/${product.listing.slug}/index.html`, page({ title: title(product), body }));
}

// PLP: the listing of the "For sale" section (Figma: PLP - desktop); "For trade" has no products yet.
// A reserved copy stays in the list with its "Reserved" button: it is paused, not gone (Gio 2026-11-12)
const forSale = products.filter(p => p.listing.section === 'sale' && (p.listing.status === 'available' || p.listing.status === 'reserved'));
write('sale/index.html', page({ title: Plp.title('sale'), body: renderToStaticMarkup(React.createElement(Plp.Plp, { section: 'sale', products: forSale, allProducts: products, site, url })) }));

// Bag (decision 0044): one hidden line per listing of the sale section, whatever its status (a copy sold after it was
// added still shows, as unavailable); scripts/site.js shows the visitor's own lines from localStorage
const bagProducts = products.filter(p => p.listing.section === 'sale');
write('bag/index.html', page({ title: Bag.title, body: renderToStaticMarkup(React.createElement(Bag.Bag, { products: bagProducts, site, url, shipping, countries: shippingData.countries() })) }));

// root: redirect to the PLP while there is no home page
write('index.html', `<!doctype html><meta charset="utf-8"><meta http-equiv="refresh" content="0; url=${url('/sale/')}"><title>${escape(site.storeName)}</title>`);
console.log(`done: ${products.length} product page(s), 1 listing (${forSale.length} for sale)`);
}
main().catch((err) => { console.error(err.message || err); process.exit(1); });
