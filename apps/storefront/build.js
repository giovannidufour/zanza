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
<script src="${siteJsHref}" defer></script>
</head>
<body>
${body}
${playerHtml}
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
const { loadProducts } = require('./data/products.js');
const sourceArg = (process.argv.find(a => a.startsWith('--source=')) || '').split('=')[1];

async function main() {
const { products, source } = await loadProducts(site, { source: sourceArg });
console.log(`products: ${products.length} from ${source}`);

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
for (const f of fs.readdirSync(path.join(APP, 'public'))) write('assets/' + f, fs.readFileSync(path.join(APP, 'public', f)));

const order = new Map(products.map((p, i) => [p, i]));
// "More for sale" (PDP): up to 3 other available products of the same section, most shared styles first, then
// listing order. Placeholder logic until the backend provides recommendations.
const RELATED_COUNT = 3;
function relatedTo(product) {
  const styles = new Set(product.release.style);
  return products
    .filter(p => p !== product && p.listing.section === product.listing.section && p.listing.status === 'available')
    .map(p => ({ p, score: p.release.style.filter(s => styles.has(s)).length }))
    .sort((a, b) => b.score - a.score || order.get(a.p) - order.get(b.p))
    .slice(0, RELATED_COUNT).map(x => x.p);
}
for (const product of products) {
  const body = renderToStaticMarkup(React.createElement(Pdp, { product, related: relatedTo(product), site, url }));
  write(`products/${product.listing.slug}/index.html`, page({ title: title(product), body }));
}

// PLP: the listing of the "For sale" section (Figma: PLP - desktop); "For trade" has no products yet
const forSale = products.filter(p => p.listing.section === 'sale' && p.listing.status === 'available');
write('sale/index.html', page({ title: Plp.title('sale'), body: renderToStaticMarkup(React.createElement(Plp.Plp, { section: 'sale', products: forSale, allProducts: products, site, url })) }));

// Bag (decision 0044): one hidden line per listing of the sale section, whatever its status (a copy sold after it was
// added still shows, as unavailable); scripts/site.js shows the visitor's own lines from localStorage
const bagProducts = products.filter(p => p.listing.section === 'sale');
write('bag/index.html', page({ title: Bag.title, body: renderToStaticMarkup(React.createElement(Bag.Bag, { products: bagProducts, site, url })) }));

// root: redirect to the PLP while there is no home page
write('index.html', `<!doctype html><meta charset="utf-8"><meta http-equiv="refresh" content="0; url=${url('/sale/')}"><title>${escape(site.storeName)}</title>`);
console.log(`done: ${products.length} product page(s), 1 listing (${forSale.length} for sale)`);
}
main().catch((err) => { console.error(err.message || err); process.exit(1); });
