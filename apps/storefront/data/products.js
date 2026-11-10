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
      custom_title: row.custom_title
    },
    release: {
      discogs_release_id: r.discogs_release_id,
      discogs_master_id: r.discogs_master_id,
      name: nameOf(lines, row.custom_title),
      artist: lines[0].artist,
      title: lines.map((l) => l.title).join(' / '),
      lines: lines.map((l) => ({ side: String.fromCharCode(64 + l.position), artist: l.artist, title: l.title })),
      label: r.label,
      pre_release: !!r.pre_release,
      cat_no: r.cat_no,
      year: r.year,
      country: r.country,
      format: r.format,
      genre: r.genre,
      style: r.style,      // subgenres (Discogs styles), in order
      tags: (r.tag_rows || []).slice().sort((a, b) => a.position - b.position).map((t) => t.tag.name),   // the shop's own tags
      tracklist: r.tracklist,
      cover: photos[0] || null
    },
    copy: {
      condition_media: row.condition_media,
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
  const select = '*,release:releases(*,lines:release_lines(*),samples(*),tag_rows:release_tags(position,tag:tags(name)))';
  const res = await fetchImpl(`${env.SUPABASE_URL.replace(/\/$/, '')}/rest/v1/listings?select=${encodeURIComponent(select)}`, {
    headers: { apikey: env.SUPABASE_PUBLISHABLE_KEY, Accept: 'application/json' }
  });
  if (!res.ok) throw new Error(`Supabase: ${res.status} ${await res.text()}`);
  const rows = await res.json();
  const mediaUrl = mediaUrlFor(site);
  return rows.sort(byListingOrder).map((row) => toProduct(row, mediaUrl));
}

async function loadProducts(site, { source } = {}) {
  const env = readEnv();
  const useDb = source !== 'json' && env.SUPABASE_URL && env.SUPABASE_PUBLISHABLE_KEY;
  if (source === 'supabase' && !useDb) throw new Error(`--source=supabase needs ${path.relative(process.cwd(), ENV_FILE)}`);
  const products = useDb ? await fromSupabase(env, site) : fromJson();
  return { products, source: useDb ? 'supabase' : 'json' };
}

module.exports = { loadProducts, effectiveStatus, toProduct, nameOf, byListingOrder, mediaUrlFor, fromSupabase };
