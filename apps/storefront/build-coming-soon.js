/* apps/storefront/build-coming-soon.js — the temporary page of rythem-works.com while the shop is on staging
   (Figma page `Coming soon`, component `coming soon`; decision 0096). Output: apps/storefront/dist-coming-soon/ =
   index.html (store name, title, text, newsletter signup), /privacy/ (a short privacy text, linked from the newsletter note), css, fonts,
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
const Newsletter = require('./pages/newsletter.js');
const newsletterJs = fs.readFileSync(path.join(APP, 'scripts/newsletter.js'));

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

// Figma `coming soon` → bottom: copyright only. Gio 2026-11-15: no Contact / Privacy / Terms links until launch; Privacy
// stays reachable from the newsletter note, the only place the page collects data (GDPR art. 13)
const bottom = h('footer', { className: 'coming-soon__bottom body-small' },
  h('p', { className: 'coming-soon__copyright' }, `© ${new Date().getFullYear()} ${site.storeName}`));

function page({ title, body, description }) {
  const links = Object.keys(css).map((n) => `<link rel="stylesheet" href="/css/${n}.css?v=${hashOf(css[n])}">`).join('\n');
  return `<!doctype html>
<html lang="${site.lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escape(title)}</title>
<!-- live favicon (decision 0127): this page only runs on rythem-works.com -->
<link rel="icon" href="/assets/favicon-live.svg" type="image/svg+xml">
<link rel="icon" href="/assets/favicon-live-32.png" type="image/png" sizes="32x32">
<link rel="apple-touch-icon" href="/assets/apple-touch-icon-live.png">
${description ? `<meta name="description" content="${escape(description)}">\n` : ''}<meta name="robots" content="noindex">
${links}
<script src="/js/newsletter.js?v=${hashOf(newsletterJs)}" defer></script>
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
write('js/newsletter.js', newsletterJs);   // signup in place + the confirm page (decision 0103)
for (const f of fs.readdirSync(path.join(APP, 'public'))) {
  if (/\.(woff2|png|svg|txt)$/.test(f)) write('assets/' + f, fs.readFileSync(path.join(APP, 'public', f)));
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
    nl.action ? h(Z.FooterNewsletter, { action: nl.action, endpoint: nl.endpoint || undefined, id: 'coming-soon-newsletter',
      note: [`New records in your inbox. You confirm ${nl.endpoint && nl.autoConfirm !== false ? 'with one click in an email' : 'by email'} and can leave anytime. `, h('a', { key: 'p', href: '/privacy/' }, 'Privacy')] }) : null),
  bottom);
write('index.html', page({ title: site.storeName, description: cs.text, body: renderToStaticMarkup(home) }));

// the link in the newsletter confirmation email lands here (decision 0103): the page's own layout, title + divider + states
{
  const confirm = h('div', { className: 'zz-page coming-soon' },
    header,
    h('main', { className: 'coming-soon__intro' },
      h('h1', { className: 'coming-soon__title body-large', 'data-newsletter-title': '' }, Newsletter.title),
      h(Z.Divider),
      h(Newsletter.ConfirmStates, { site, signup: h('a', { key: 's', href: '/' }, 'Sign up again') })),
    bottom);
  write('newsletter/confirm/index.html', page({ title: `${Newsletter.title} · ${site.storeName}`, body: renderToStaticMarkup(confirm) }));
}

// Privacy: a short text for this page only (content/legal/privacy-coming-soon.md, Gio 2026-11-15: no personal data on
// it), with the coming-soon header and bottom row. The shop keeps its full privacy.md
{
  const { title, body, missing } = Legal.legalPage('privacy-coming-soon', { site, url, shipping: null, countries: [], header });
  const withBottom = h('div', { className: 'zz-page coming-soon' }, ...React.Children.toArray(body.props.children), bottom);
  write('privacy/index.html', page({ title: `${title} · ${site.storeName}`, body: renderToStaticMarkup(withBottom) }));
  if (missing.length) console.log(`    to fill: ${missing.join(' · ')}`);
}
console.log('done: dist-coming-soon/');
