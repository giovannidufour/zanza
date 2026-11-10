// supabase/functions/discogs-lookup — reads one Discogs release for the admin's "Fetch Discogs" button.
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
type DiscogsArtist = { name: string; anv?: string; join?: string };
const clean = (s: string) => s.replace(/\s+\(\d+\)$/, "").trim();
function artistName(list: DiscogsArtist[] | undefined): string {
  if (!list || !list.length) return "";
  return list.map((a, i) => clean(a.anv || a.name) + (i < list.length - 1 ? (a.join && a.join !== "," ? ` ${a.join} ` : ", ") : ""))
    .join("").replace(/\s+/g, " ").trim();
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

  let body: { releaseId?: number };
  try { body = await req.json(); } catch { return json({ error: "Send JSON: { releaseId }." }, 400, headers); }
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

  const releaseArtist = artistName(d.artists);
  const tracks = (d.tracklist ?? [])
    .filter((t: { type_?: string }) => (t.type_ ?? "track") === "track")
    .map((t: { position?: string; title?: string; artists?: DiscogsArtist[] }) => ({
      position: t.position ?? "",
      artist: artistName(t.artists) || releaseArtist,
      title: (t.title ?? "").trim(),
    }));
  const label = (d.labels ?? [])[0] ?? {};
  const format = (d.formats ?? [])[0] ?? {};

  return json({
    releaseId: d.id,
    masterId: d.master_id ?? null,
    uri: d.uri ?? null,
    artist: releaseArtist,
    title: d.title ?? "",
    label: label.name ? clean(label.name) : "",
    catNo: label.catno && label.catno !== "none" ? label.catno : "",
    year: d.year || null,
    country: d.country ?? "",
    format: { name: format.name ?? "", descriptions: format.descriptions ?? [] },
    genres: d.genres ?? [],
    styles: d.styles ?? [],
    tracks,
  }, 200, headers);
});
