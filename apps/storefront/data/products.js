/* apps/storefront/data/products.js — where the build gets its products from.
   Returns products in the storefront contract ({ listing, release, copy, samples }, see content/products/*.json),
   in listing order. Two sources:
   - Supabase (default when apps/storefront/.supabase.env exists): public REST API, publishable key, drafts and archived copies excluded by RLS
   - local JSON (content/products/*.json): fallback, or forced with `--source=json`
   Media columns in the DB hold storage keys; mediaUrl() turns them into URLs with site.json → mediaBaseUrl.
   Absolute URLs (imported test content) and root-relative paths ('/assets/…') pass through. */
'use strict';
const fs = require('fs');
const path = require('path');

const APP = path.resolve(__dirname, '..');
const ENV_FILE = path.join(APP, '.supabase.env');   // git-ignored: SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY

function readEnv() {
  const env = Object.assign({}, process.env);
  if (fs.existsSync(ENV_FILE)) {
    for (const line of fs.readFileSync(ENV_FILE, 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/);
      if (m && !env[m[1]]) env[m[1]] = m[2];
    }
  }
  return env;
}

function mediaUrlFor(site) {
  const base = (site.mediaBaseUrl || '').replace(/\/$/, '');
  return (key) => {
    if (!key) return null;
    if (/^https?:\/\//.test(key) || key.startsWith('/')) return key;
    if (!base) throw new Error(`media key "${key}" needs site.json → mediaBaseUrl`);
    return `${base}/${key}`;
  };
}

// local JSON: listing order = listing id order (as before the database)
function fromJson() {
  const dir = path.join(APP, 'content/products');
  return fs.readdirSync(dir).filter((f) => f.endsWith('.json'))
    .map((f) => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')))
    .sort((a, b) => a.listing.id.localeCompare(b.listing.id));
}

// displayed name (Figma "Create listing"): custom title if set; otherwise "Artist - Title 1 / Title 2",
// or "Artist 1 - Title 1 / Artist 2 - Title 2" when a later line has its own artist (empty artist = same as line 1)
function nameOf(lines, customTitle) {
  if (customTitle) return customTitle;
  const own = lines.slice(1).some((l) => l.artist && l.artist !== lines[0].artist);
  if (!own) return `${lines[0].artist} - ${lines.map((l) => l.title).join(' / ')}`;
  return lines.map((l) => `${l.artist || lines[0].artist} - ${l.title}`).join(' / ');
}

// a checkout hold that has expired counts as available (same rule as public.effective_status, migration 0004)
function effectiveStatus(row) {
  return row.status === 'reserved' && row.reserved_until && new Date(row.reserved_until) <= new Date() ? 'available' : row.status;
}

// one DB row (listing + embedded release, its lines and samples) → the storefront contract.
// Featured image = first photo: it is the release `cover`, the rest are the copy photos
// (a single photo is both, as in the JSON test content).
function toProduct(row, mediaUrl) {
  const r = row.release;
  const lines = (r.lines || []).slice().sort((a, b) => a.position - b.position);
  const photos = row.photo_keys.map(mediaUrl);
  return {
    listing: {
      id: row.id,
      slug: row.slug,
      section: row.section,
      status: effectiveStatus(row),
      price: row.price_cents == null ? null : { amount: row.price_cents, currency: row.currency },
      sku: row.sku,
      weight_g: row.weight_g || null,   // shipping: own weight; null = the format's (decision 0057)
      custom_title: row.custom_title
    },
    release: {
      discogs_release_id: r.discogs_release_id,
      discogs_master_id: r.discogs_master_id,
      name: nameOf(lines, row.custom_title),
      artist: lines[0].artist,
      title: lines.map((l) => l.title).join(' / '),
      // artists: the entities behind the printed credit (migration 0006), so a filter by artist also finds the
      // records where the credit is spelled differently (an alias)
      lines: lines.map((l) => ({
        side: String.fromCharCode(64 + l.position), artist: l.artist, title: l.title,
        artists: (l.line_artists || []).slice().sort((a, b) => a.position - b.position)
          .filter((a) => a.artist).map((a) => ({ slug: a.artist.slug, name: a.artist.name, join: a.join_text }))
      })),
      label: r.label,
      label_ref: r.label_entity ? { slug: r.label_entity.slug, name: r.label_entity.name } : null,   // the label entity
      pre_release: !!r.pre_release,
      cat_no: r.cat_no,
      year: r.year,
      year_precision: r.year_precision || 'year',   // 'decade' = year is the first year of a decade, "1990s" (0082)
      country: r.country,
      format: r.format,
      macro_genre: r.macro_genre,   // Discogs genre (Reggae), not shown as a filter (0048)
      genres: r.genres,             // genres (Discogs styles), in order
      tags: (r.tag_rows || []).slice().sort((a, b) => a.position - b.position).map((t) => t.tag.name),   // the shop's own tags
      tracklist: r.tracklist,
      cover: photos[0] || null
    },
    copy: {
      condition_media: row.condition_media,
      condition_media_b: row.condition_media_b,   // side B, null = not graded (migration 0013)
      sleeve_type: row.sleeve_type,
      condition_sleeve: row.condition_sleeve,
      condition_notes: row.condition_notes,
      notes: row.notes,
      photos: photos.length > 1 ? photos.slice(1) : photos
    },
    samples: (r.samples || []).slice().sort((a, b) => a.sort - b.sort).map((s) => ({
      track_position: s.track_position,
      // the admin form does not ask a title per sample: a sample on a line plays that line's track
      title: s.title || ((lines.find((l) => l.id === s.line_id) || {}).title) || null,
      audio_url: mediaUrl(s.audio_key),
      duration: s.duration_s,
      source: s.source
    }))
  };
}

// listing order: newest published first; imported test content keeps its old order (legacy id)
function byListingOrder(a, b) {
  return String(b.published_at || '').localeCompare(String(a.published_at || '')) ||
    String((a.import_source || {}).legacy_id || '').localeCompare(String((b.import_source || {}).legacy_id || '')) ||
    a.slug.localeCompare(b.slug);
}

async function fromSupabase(env, site, fetchImpl = fetch) {
  const select = '*,release:releases(*,label_entity:labels(slug,name),' +
    'lines:release_lines(*,line_artists:release_line_artists(position,join_text,artist:artists(slug,name))),' +
    'samples(*),tag_rows:release_tags(position,tag:tags(name)))';
  const res = await fetchImpl(`${env.SUPABASE_URL.replace(/\/$/, '')}/rest/v1/listings?select=${encodeURIComponent(select)}`, {
    headers: { apikey: env.SUPABASE_PUBLISHABLE_KEY, Accept: 'application/json' }
  });
  if (!res.ok) throw new Error(`Supabase: ${res.status} ${await res.text()}`);
  const rows = await res.json();
  const mediaUrl = mediaUrlFor(site);
  return rows.sort(byListingOrder).map((row) => toProduct(row, mediaUrl));
}

// shop-wide switches (migration 0023, decision 0102; migration 0025, decision 0106): shop_settings in the database is
// the single source of truth. tradeEnabled = false → the build leaves out every trade page, link, record and mention
// (trade_enabled is the effective value: off too while identity is off). identityEnabled = false → the Store profile and
// no trace of Gio. Local JSON: both on, unless `--trade=off` / `--identity=off`. A database without the table or the
// column yet (migration not applied) = on, as before. select=* so a missing column is not an error.
async function settingsFromSupabase(env, fetchImpl = fetch) {
  const res = await fetchImpl(`${env.SUPABASE_URL.replace(/\/$/, '')}/rest/v1/shop_settings?select=*`, {
    headers: { apikey: env.SUPABASE_PUBLISHABLE_KEY, Accept: 'application/json' }
  });
  if (res.status === 404) return { tradeEnabled: true, identityEnabled: true };   // PGRST205: no shop_settings table yet
  if (!res.ok) throw new Error(`Supabase shop_settings: ${res.status} ${await res.text()}`);
  const row = (await res.json())[0];
  return { tradeEnabled: !row || row.trade_enabled !== false, identityEnabled: !row || row.identity_enabled !== false };
}

// the texts Gio saved in the admin (page Content, migration 0025, decision 0106): [{ key, value, updated_at }].
// No table yet = none: the shop uses the texts in the repo (packages/content/content.js defaults).
async function textsFromSupabase(env, fetchImpl = fetch) {
  const res = await fetchImpl(`${env.SUPABASE_URL.replace(/\/$/, '')}/rest/v1/site_texts?select=key,value,updated_at`, {
    headers: { apikey: env.SUPABASE_PUBLISHABLE_KEY, Accept: 'application/json' }
  });
  if (res.status === 404) return [];
  if (!res.ok) throw new Error(`Supabase site_texts: ${res.status} ${await res.text()}`);
  return res.json();
}

async function loadSettings({ source, trade, identity } = {}) {
  const env = readEnv();
  const fromDb = source === 'supabase' ? await settingsFromSupabase(env) : { tradeEnabled: true, identityEnabled: true };
  if (identity === 'off') fromDb.identityEnabled = false;
  if (identity === 'on') fromDb.identityEnabled = true;
  if (trade === 'off') fromDb.tradeEnabled = false;
  if (trade === 'on') fromDb.tradeEnabled = true;
  if (!fromDb.identityEnabled) fromDb.tradeEnabled = false;   // trade relies on who Gio is (decision 0106)
  return fromDb;
}

async function loadTexts({ source } = {}) {
  return source === 'supabase' ? textsFromSupabase(readEnv()) : [];
}

async function loadProducts(site, { source } = {}) {
  const env = readEnv();
  const useDb = source !== 'json' && env.SUPABASE_URL && env.SUPABASE_PUBLISHABLE_KEY;
  if (source === 'supabase' && !useDb) throw new Error(`--source=supabase needs ${path.relative(process.cwd(), ENV_FILE)}`);
  const products = useDb ? await fromSupabase(env, site) : fromJson();
  return { products, source: useDb ? 'supabase' : 'json' };
}

module.exports = { loadProducts, loadSettings, loadTexts, settingsFromSupabase, textsFromSupabase, readEnv, effectiveStatus, toProduct, nameOf, byListingOrder, mediaUrlFor, fromSupabase };
