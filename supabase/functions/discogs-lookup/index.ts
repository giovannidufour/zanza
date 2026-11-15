// supabase/functions/discogs-lookup — reads one Discogs release for the admin's "Fetch Discogs" button,
// and searches Discogs releases for the admin's Memo list (decision 0087): POST { query } → { results }.
// Admin only: the caller's Supabase session must belong to a row of public.admins.
// Why server side: Discogs wants an identifying User-Agent, rate-limits per caller, and the token
// (needed later for search) must never reach the browser (backend.md → Creare un listing).
// Nothing is cached here: Discogs ToU forbid keeping their data more than 6 h; the admin imports it
// once into our own tables when the listing is saved (product-brief.md → Discogs).
// Secrets (Supabase → Edge Functions → Secrets), optional: DISCOGS_TOKEN (personal access token;
// without it Discogs allows 25 requests a minute, plenty for one operator).
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const ALLOWED_ORIGINS = (Deno.env.get("ADMIN_ORIGINS") ?? "https://store-admin-3k1.pages.dev").split(",").map((s) => s.trim());
const USER_AGENT = "StoreAdmin/1.0 +https://store-admin-3k1.pages.dev";

function cors(origin: string | null) {
  const allow = origin && (ALLOWED_ORIGINS.includes(origin) || /^http:\/\/localhost(:\d+)?$/.test(origin)) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}
const json = (body: unknown, status: number, headers: Record<string, string>) =>
  new Response(JSON.stringify(body), { status, headers: { ...headers, "Content-Type": "application/json" } });

// Discogs disambiguates homonyms with " (2)"; "anv" is the name as printed on this release
type DiscogsArtist = { id?: number; name: string; anv?: string; join?: string };
const clean = (s: string) => s.replace(/\s+\(\d+\)$/, "").trim();
// printed = as on the record (anv), official = the Discogs artist name
function artistName(list: DiscogsArtist[] | undefined, printed: boolean): string {
  if (!list || !list.length) return "";
  return list.map((a, i) => clean((printed && a.anv) || a.name) + (i < list.length - 1 ? (a.join && a.join !== "," ? ` ${a.join} ` : ", ") : ""))
    .join("").replace(/\s+/g, " ").trim();
}
// one line: the official name and the credit as text, the Discogs id when it has a single artist, and each artist
// on its own (the admin makes one chip per artist, decision 0020)
function credit(list: DiscogsArtist[] | undefined) {
  return {
    artist: artistName(list, false),
    artistCredit: artistName(list, true),
    artistDiscogsId: list && list.length === 1 && list[0].id ? list[0].id : null,
    artists: (list ?? []).map((a) => ({ name: clean(a.name), credit: clean(a.anv || a.name), discogsId: a.id ?? null })),
  };
}

// one search result as { id, title: "Artist – Title", meta: "label · catno · year · country · format", thumb, uri }
const cleanAll = (s: string) => String(s ?? "").replace(/\s+\(\d+\)(?=$|\s*[-–,])/g, "").trim();
const metaOf = (parts: unknown[]) => parts.map((p) => String(p ?? "").trim()).filter((p) => p && p !== "0" && p.toLowerCase() !== "none").join(" · ");
// deno-lint-ignore no-explicit-any
function fromSearch(r: any) {
  const formats = [...new Set<string>((r.format ?? []).filter((f: string) => f && !/^vinyl$/i.test(f)))].slice(0, 2).join(", ");
  return {
    id: r.id,
    title: cleanAll(r.title).replace(/\s+-\s+/, " – "),
    meta: metaOf([(r.label ?? [])[0], r.catno, r.year, r.country, formats]),
    thumb: r.thumb || "",
    uri: `https://www.discogs.com/release/${r.id}`,
  };
}

Deno.serve(async (req) => {
  const headers = cors(req.headers.get("Origin"));
  if (req.method === "OPTIONS") return new Response("ok", { headers });
  if (req.method !== "POST") return json({ error: "Use POST." }, 405, headers);

  const auth = req.headers.get("Authorization") ?? "";
  const apikey = req.headers.get("apikey") ?? Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, apikey, { global: { headers: { Authorization: auth } } });
  const { data: isAdmin, error: adminError } = await supabase.rpc("is_admin");
  if (adminError || isAdmin !== true) return json({ error: "Not allowed." }, 403, headers);

  let body: { releaseId?: number; query?: string };
  try { body = await req.json(); } catch { return json({ error: "Send JSON: { releaseId } or { query }." }, 400, headers); }

  // text search (Memo, 0087): same result shape as discogs-search (the shop's offer form), up to 8 releases.
  // Discogs search needs the token; nothing is stored here.
  if (typeof body.query === "string") {
    const q = body.query.trim().slice(0, 100);
    if (q.length < 3) return json({ results: [] }, 200, headers);
    const token = Deno.env.get("DISCOGS_TOKEN")?.trim();
    if (!token) return json({ error: "Discogs search needs the DISCOGS_TOKEN secret." }, 500, headers);
    const s = new URLSearchParams({ q, type: "release", per_page: "8", page: "1" });
    const r = await fetch(`https://api.discogs.com/database/search?${s}`, {
      headers: { "User-Agent": USER_AGENT, "Accept": "application/vnd.discogs.v2.discogs+json", Authorization: `Discogs token=${token}` },
    });
    if (r.status === 429) return json({ error: "Discogs is busy (too many requests): try again in a minute." }, 429, headers);
    if (!r.ok) return json({ error: `Discogs answered ${r.status}.` }, 502, headers);
    const data = await r.json();
    return json({ results: (data.results ?? []).slice(0, 8).map(fromSearch) }, 200, headers);
  }

  const id = Number(body.releaseId);
  if (!Number.isInteger(id) || id <= 0) return json({ error: "releaseId must be a Discogs release number." }, 400, headers);

  const token = Deno.env.get("DISCOGS_TOKEN")?.trim();
  const res = await fetch(`https://api.discogs.com/releases/${id}`, {
    headers: { "User-Agent": USER_AGENT, "Accept": "application/vnd.discogs.v2.discogs+json", ...(token ? { Authorization: `Discogs token=${token}` } : {}) },
  });
  if (res.status === 404) return json({ error: `Discogs has no release ${id}. Paste a release link (…/release/…), not a master.` }, 404, headers);
  if (res.status === 429) return json({ error: "Discogs is busy (too many requests): try again in a minute." }, 429, headers);
  if (!res.ok) return json({ error: `Discogs answered ${res.status}.` }, 502, headers);
  // deno-lint-ignore no-explicit-any
  const d: any = await res.json();

  const releaseCredit = credit(d.artists);
  const tracks = (d.tracklist ?? [])
    .filter((t: { type_?: string }) => (t.type_ ?? "track") === "track")
    .map((t: { position?: string; title?: string; artists?: DiscogsArtist[] }) => ({
      position: t.position ?? "",
      ...(t.artists && t.artists.length ? credit(t.artists) : releaseCredit),
      title: (t.title ?? "").trim(),
    }));
  const label = (d.labels ?? [])[0] ?? {};
  const format = (d.formats ?? [])[0] ?? {};

  return json({
    releaseId: d.id,
    masterId: d.master_id ?? null,
    uri: d.uri ?? null,
    ...releaseCredit,
    title: d.title ?? "",
    label: label.name ? clean(label.name) : "",
    labelDiscogsId: label.id ?? null,
    catNo: label.catno && label.catno !== "none" ? label.catno : "",
    year: d.year || null,
    country: d.country ?? "",
    format: { name: format.name ?? "", descriptions: format.descriptions ?? [] },
    genres: d.genres ?? [],
    styles: d.styles ?? [],
    tracks,
  }, 200, headers);
});
