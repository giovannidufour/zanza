/* apps/admin/build.js — builds the admin (a static single-page app) into apps/admin/dist/.
   Deployed to Cloudflare Pages (project store-admin) by GitHub Actions on every push to main (.github/workflows/deploy-admin.yml); `npm run deploy:admin` still works by hand.
   Same components and tokens as the shop (packages/ui); the admin renders in the Figma mode `backend` (decision 0017). */
'use strict';
const fs = require('fs');
const path = require('path');

const APP = __dirname;
const ROOT = path.resolve(APP, '../..');
const UI = path.join(ROOT, 'packages/ui');
const OUT = path.join(APP, 'dist');
const { expandMedia, queries } = require(path.join(UI, 'media.js'));

function readEnv(file) {
  const env = {};
  if (fs.existsSync(file)) for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/);
    if (m) env[m[1]] = m[2];
  }
  return Object.assign(env, process.env);
}
const env = readEnv(path.join(ROOT, 'apps/storefront/.supabase.env'));
if (!env.SUPABASE_URL || !env.SUPABASE_PUBLISHABLE_KEY) {
  console.error('admin build: SUPABASE_URL / SUPABASE_PUBLISHABLE_KEY missing (apps/storefront/.supabase.env)');
  process.exit(1);
}
const cfg = JSON.parse(fs.readFileSync(path.join(APP, 'admin.json'), 'utf8'));
const config = {
  supabaseUrl: env.SUPABASE_URL,
  supabaseKey: env.SUPABASE_PUBLISHABLE_KEY,
  mediaBaseUrl: cfg.mediaBaseUrl || '',
  storefrontUrl: cfg.storefrontUrl || '',
  media: queries   // tokens.json → breakpoint, for the JS that renders differently on mobile (decision 0089)
};

// tokens.css is generated: make sure it is fresh
require('child_process').execFileSync(process.execPath, [path.join(UI, 'build-tokens.js')], { stdio: 'ignore' });

function contentDefaults() {
  const Content = require(path.join(ROOT, 'packages/content/content.js'));
  const site = JSON.parse(fs.readFileSync(path.join(ROOT, 'apps/storefront/site.json'), 'utf8'));
  const legal = {};
  for (const b of Content.BLOCKS) if (b.page) legal[b.page] = fs.readFileSync(path.join(ROOT, 'apps/storefront/content/legal', `${b.page}.md`), 'utf8');
  return `\nwindow.ZanzaContent.DEFAULTS = ${JSON.stringify(Content.defaults({ owner: site.owner, legal }))};\n` +
    `window.ZanzaContent.PAGE_TITLES = ${JSON.stringify(Content.pageTitles(legal))};\n`;
}
const hash = (s) => require('crypto').createHash('md5').update(s).digest('hex').slice(0, 8);
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
const files = {
  'tokens.css': fs.readFileSync(path.join(UI, 'tokens.css'), 'utf8'),
  'components.css': expandMedia(fs.readFileSync(path.join(UI, 'components.css'), 'utf8')),
  'admin.css': expandMedia(fs.readFileSync(path.join(APP, 'admin.css'), 'utf8')),
  'components.js': fs.readFileSync(path.join(UI, 'components.js'), 'utf8'),
  'toast.js': fs.readFileSync(path.join(UI, 'toast.js'), 'utf8'),
  'shipping.js': fs.readFileSync(path.join(ROOT, 'packages/shipping/shipping.js'), 'utf8'),   // decision 0057
  'images.js': fs.readFileSync(path.join(ROOT, 'packages/images/images.js'), 'utf8'),   // decision 0108
  'listing-draft.js': fs.readFileSync(path.join(ROOT, 'packages/listing-draft/listing-draft.js'), 'utf8'),   // decision 0145
  'collections.js': fs.readFileSync(path.join(ROOT, 'packages/collections/collections.js'), 'utf8'),   // decision 0174
  // the texts of page Content (decision 0106): the blocks + today's texts as defaults (site.json → owner, legal Markdown)
  'content.js': fs.readFileSync(path.join(ROOT, 'packages/content/content.js'), 'utf8') + contentDefaults(),
  'config.js': `window.ADMIN_CONFIG = ${JSON.stringify(config, null, 2)};\n`,
  'admin.js': fs.readFileSync(path.join(APP, 'admin.js'), 'utf8')
};
for (const [name, body] of Object.entries(files)) fs.writeFileSync(path.join(OUT, name), body);
// Favicon = the shop's logo illustration in negative, black ground (decisions 0097, 0127): single source in apps/storefront/public/
for (const f of ['favicon-admin.svg', 'favicon-admin-32.png', 'apple-touch-icon-admin.png']) fs.copyFileSync(path.join(ROOT, 'apps/storefront/public', f), path.join(OUT, f));
const v = (n) => `${n}?v=${hash(files[n])}`;
const html = fs.readFileSync(path.join(APP, 'index.html'), 'utf8')
  .replace(/\{\{(\w[\w.-]*)\}\}/g, (m, n) => (n === 'title' ? cfg.title : files[n] !== undefined ? v(n) : m));
fs.writeFileSync(path.join(OUT, 'index.html'), html);
// assets are versioned (?v=hash): Cloudflare Pages' default revalidation is enough, no _headers file
console.log(`admin: dist/ written (${Object.keys(files).length + 1} files)`);
