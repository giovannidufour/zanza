/* apps/storefront/build-coming-soon.js — the temporary page of rythem-works.com while the shop is on staging
   (Figma page `Coming soon`, component `coming soon`; decision 0096). Output: apps/storefront/dist-coming-soon/ =
   index.html (store name, title, text, newsletter signup), /privacy/ and /terms/ (the shop's legal texts), css, fonts,
   logo, and a _headers file with noindex. Published to the Cloudflare Pages project `coming-soon` by
   .github/workflows/deploy-coming-soon.yml. No products, no Supabase: it builds anywhere.
   Run: npm run build:coming-soon */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

const ROOT = path.resolve(__dirname, '../..');
const UI = path.join(ROOT, 'packages/ui');
const APP = __dirname;
const DIST = path.join(APP, 'dist-coming-soon');
const siteFile = JSON.parse(fs.readFileSync(path.join(APP, 'site.json'), 'utf8'));
const site = Object.assign({}, siteFile, siteFile.targets.pages);
const cs = siteFile.comingSoon || {};
const url = (p) => p;   // served from the web root
const h = React.createElement;
const Z = require(path.join(UI, 'components.js'));
const Legal = require('./pages/legal.js');

const { expandMedia } = require(path.join(UI, 'media.js'));
const stripComments = (css) => css.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\n\s*\n+/g, '\n').trim() + '\n';
const readCss = (f) => stripComments(expandMedia(fs.readFileSync(f, 'utf8')));
const hashOf = (buf) => crypto.createHash('sha1').update(buf).digest('hex').slice(0, 8);
const css = {
  fonts: readCss(path.join(APP, 'fonts.css')),
  tokens: readCss(path.join(UI, 'tokens.css')),
  components: readCss(path.join(UI, 'components.css')),
  base: readCss(path.join(APP, 'base.css')),
  legal: readCss(path.join(APP, 'legal.css')),
  'coming-soon': readCss(path.join(APP, 'coming-soon.css'))
};
const escape = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// Figma `coming soon` → store name (logo=true): the shop Header with only the store name, the logo inside it
// (data-logo="inside", decision 0094) and no rule under it (coming-soon.css)
const header = h(Z.Header, {
  className: 'coming-soon__header',
  device: 'desktop',   // no menu button: there is nothing to navigate to
  'data-logo': 'inside',
  logo: h('img', { src: '/assets/logo.png', alt: '', width: 64, height: 64 }),
  storeName: site.storeName,
  homeHref: '/'
});

// Figma `coming soon` → bottom: copyright, then Contact (mailto: the contact form lives on the shop), Privacy, Terms
const email = cs.email || '';
const bottom = h('footer', { className: 'coming-soon__bottom body-small' },
  h('p', { className: 'coming-soon__copyright' }, `© ${new Date().getFullYear()} ${site.storeName}`),
  h('div', { className: 'coming-soon__links', role: 'group', 'aria-label': 'Legal' },
    email ? h('a', { href: `mailto:${email}` }, 'Contact') : null,
    h('a', { href: '/privacy/' }, 'Privacy'),
    h('a', { href: '/terms/' }, 'Terms')));

function page({ title, body, description }) {
  const links = Object.keys(css).map((n) => `<link rel="stylesheet" href="/css/${n}.css?v=${hashOf(css[n])}">`).join('\n');
  return `<!doctype html>
<html lang="${site.lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escape(title)}</title>
${description ? `<meta name="description" content="${escape(description)}">\n` : ''}<meta name="robots" content="noindex">
${links}
</head>
<body>
${body}
</body>
</html>
`;
}
function write(rel, content) {
  const f = path.join(DIST, rel);
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, content);
  console.log('  ' + rel);
}

fs.rmSync(DIST, { recursive: true, force: true });
for (const [n, c] of Object.entries(css)) write(`css/${n}.css`, c);
for (const f of fs.readdirSync(path.join(APP, 'public'))) {
  if (/\.(woff2|png|txt)$/.test(f)) write('assets/' + f, fs.readFileSync(path.join(APP, 'public', f)));
}
// noindex until launch (Figma note on the `Coming soon` page)
write('_headers', '/*\n  X-Robots-Tag: noindex\n');

// Figma `coming soon`: store name, then intro (page title, divider, text, newsletter), then the bottom row
const nl = site.newsletter || {};
const home = h('div', { className: 'zz-page coming-soon' },
  header,
  h('main', { className: 'coming-soon__intro' },
    h('h1', { className: 'coming-soon__title body-large' }, cs.title || 'Opening soon'),
    h(Z.Divider),
    h('p', { className: 'coming-soon__text body-medium' }, cs.text || ''),
    nl.action ? h(Z.FooterNewsletter, { action: nl.action, id: 'coming-soon-newsletter',
      note: ['New records in your inbox. You confirm by email and can leave anytime. ', h('a', { key: 'p', href: '/privacy/' }, 'Privacy')] }) : null),
  bottom);
write('index.html', page({ title: site.storeName, description: cs.text, body: renderToStaticMarkup(home) }));

// Privacy and Terms: the shop's texts (content/legal), with the coming-soon header and bottom row
for (const p of ['privacy', 'terms']) {
  const { title, body, missing } = Legal.legalPage(p, { site, url, shipping: null, countries: [], header });
  const withBottom = h('div', { className: 'zz-page coming-soon' }, ...React.Children.toArray(body.props.children), bottom);
  write(`${p}/index.html`, page({ title: `${title} · ${site.storeName}`, body: renderToStaticMarkup(withBottom) }));
  if (missing.length) console.log(`    to fill: ${missing.join(' · ')}`);
}
console.log('done: dist-coming-soon/');
