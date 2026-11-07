/* apps/storefront/build.js — static build.
   content/products/*.json → dist/products/<slug>/index.html (+ css, assets).
   Upload the whole `dist/` folder to the web root. Run: npm run build */
'use strict';
const fs = require('fs');
const path = require('path');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '../..');
const UI = path.join(ROOT, 'packages/ui');
const APP = __dirname;
const site = JSON.parse(fs.readFileSync(path.join(APP, 'site.json'), 'utf8'));
// dist/<outputDir>/ is the folder to upload; basePath is where it will live on the domain ('' = web root)
const BASE = (site.basePath || '').replace(/\/$/, '');
const DIST = path.join(APP, 'dist', site.outputDir || '');
const url = (p) => (/^https?:\/\//.test(p) ? p : BASE + p);   // absolute URLs pass through
// cache-busting: a short content hash on every stylesheet link, so a redeploy never serves a stale CSS
const hashOf = (buf) => crypto.createHash('sha1').update(buf).digest('hex').slice(0, 8);
// custom media (`@media (--mobile)`) are expanded from tokens.json → breakpoint: one value, one place
const { expandMedia } = require(path.join(UI, 'media.js'));
const readCss = (f) => expandMedia(fs.readFileSync(f, 'utf8'));
const css = {
  tokens: readCss(path.join(UI, 'tokens.css')),
  components: readCss(path.join(UI, 'components.css')),
  base: readCss(path.join(APP, 'base.css')),
  pdp: readCss(path.join(APP, 'pdp.css'))
};
const cssHref = (name) => url(`/css/${name}.css?v=${hashOf(css[name])}`);
const siteJs = fs.readFileSync(path.join(APP, 'scripts/site.js'));
const siteJsHref = url(`/js/site.js?v=${hashOf(siteJs)}`);
const { Pdp, title } = require('./pages/pdp.js');

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
<script src="${siteJsHref}" defer></script>
</head>
<body>
${body}
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

fs.rmSync(path.join(APP, 'dist'), { recursive: true, force: true });
console.log(`dist/${site.outputDir || ''}  (basePath: '${BASE || '/'}')`);

// static assets
write('css/tokens.css', css.tokens);
write('css/components.css', css.components);
write('css/base.css', css.base);
write('css/pdp.css', css.pdp);
write('js/site.js', siteJs);
for (const f of fs.readdirSync(path.join(APP, 'public'))) write('assets/' + f, fs.readFileSync(path.join(APP, 'public', f)));

// products
const dir = path.join(APP, 'content/products');
const products = fs.readdirSync(dir).filter(f => f.endsWith('.json')).map(f => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')));
for (const product of products) {
  const body = renderToStaticMarkup(React.createElement(Pdp, { product, site, url }));
  write(`products/${product.listing.slug}/index.html`, page({ title: title(product), body }));
}

// root: redirect to the first product while there is no home page
if (products[0]) {
  write('index.html', `<!doctype html><meta charset="utf-8"><meta http-equiv="refresh" content="0; url=${url(`/products/${products[0].listing.slug}/`)}"><title>${escape(site.storeName)}</title>`);
}
console.log(`done: ${products.length} product page(s)`);
