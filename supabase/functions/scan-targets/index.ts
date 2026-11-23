// supabase/functions/scan-targets — what the macOS Scanner needs to name its scans (decision 0138).
// Read only: it never writes to the database or to storage (Gio 2026-11-22: no automatic upload for now).
//   POST { query }        → { drafts: [{ id, sku, title, cat_no, photo_key, created_at }] }
//                            drafts only, newest first, max 500 (the Scanner's drafts column lists them all, 0141); query matches SKU, artist, title, custom title or
//                            catalogue number (all words, any order); empty query = all drafts (max 500).
//   POST { id, roles? }   → { draft: { id, sku, title, cat_no }, positions_read, images: [{ role, label, name }],
//                              clips: [{ role, label, name, artist, title }], tags: { album, label, cat_no, year, genres } }
//                            names for image roles 1…roles (default 3, max 12): 1 Label A, 2 Label B, 3+ Other photo.
//                            clips = one row per line with a clip role (a1, b1… or a / b), as the admin's File names;
//                            with tags = what the Scanner's Samples tab writes in the ID3 tags (decision 0141).
// The names come from packages/file-names (./file-names.js is a COPY, `npm run sync:functions`), the same code as
// the admin's File names (0136): the Scanner never builds a name itself. Label B needs the Discogs positions of the
// release (which line is side B); they are read here, once per call, like the admin does; if Discogs fails the rule
// falls back to line order (positions_read = false), exactly as the admin.
// Admin only: the caller's Supabase session (email OTP, same as the admin) must belong to a row of public.admins.
// Deploy with "Verify JWT" ON. Secrets: DISCOGS_TOKEN (optional, same as discogs-lookup).
import { createClient } from "npm:@supabase/supabase-js@2.45.4";
import "./file-names.js";

// deno-lint-ignore no-explicit-any
const FileNames = (globalThis as any).ZanzaFileNames;
const USER_AGENT = "rythem-works-admin/1.0 +https://rythem-works.com";
const headers = {
  "Access-Control-Allow-Origin": "*",   // a native app sends no Origin; the session token is what protects it
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...headers, "Content-Type": "application/json" } });

type Line = { position: number; artist: string | null; title: string | null };
type Release = {
  cat_no: string | null; discogs_release_id: number | null; label: string | null; year: number | null;
  year_precision: string | null; genres: string[] | null; lines: Line[] | null;
};
type Row = {
  id: string; sku: number | null; custom_title: string | null; photo_keys: string[] | null; created_at: string;
  release: Release | null;
};

const linesOf = (r: Row) => (r.release?.lines ?? []).slice().sort((a, b) => a.position - b.position)
  .map((l) => ({ artist: l.artist ?? "", title: l.title ?? "" }));
// as the admin's list: "Artist - Title 1 / Title 2" (or the custom title)
function titleOf(r: Row) {
  if (r.custom_title?.trim()) return r.custom_title.trim();
  const ls = linesOf(r);
  const titles = ls.map((l) => l.title.trim()).filter(Boolean).join(" / ");
  return [ls[0]?.artist.trim(), titles].filter(Boolean).join(" - ");
}
const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const summary = (r: Row) => ({
  id: r.id, sku: r.sku, title: titleOf(r), cat_no: r.release?.cat_no ?? null,
  photo_key: r.photo_keys?.[0] ?? null, created_at: r.created_at,
});

async function discogsPositions(id: number): Promise<string[] | null> {
  const token = Deno.env.get("DISCOGS_TOKEN")?.trim();
  try {
    const res = await fetch(`https://api.discogs.com/releases/${id}`, {
      headers: { "User-Agent": USER_AGENT, "Accept": "application/vnd.discogs.v2.discogs+json", ...(token ? { Authorization: `Discogs token=${token}` } : {}) },
    });
    if (!res.ok) return null;
    const d = await res.json();
    // same filter as the admin (positionsOf): tracks with a title, in tracklist order
    return (d.tracklist ?? [])
      .filter((t: { type_?: string; title?: string }) => (t.type_ ?? "track") === "track" && (t.title ?? "").trim())
      .map((t: { position?: string }) => String(t.position ?? "").toUpperCase());
  } catch { return null; }
}

const SELECT = "id,sku,custom_title,photo_keys,created_at,release:releases(cat_no,discogs_release_id,label,year,year_precision,genres,lines:release_lines(position,artist,title))";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers });
  if (req.method !== "POST") return json({ error: "Use POST." }, 405);

  const auth = req.headers.get("Authorization") ?? "";
  const apikey = req.headers.get("apikey") ?? Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, apikey, { global: { headers: { Authorization: auth } } });
  const { data: isAdmin, error: adminError } = await supabase.rpc("is_admin");
  if (adminError || isAdmin !== true) return json({ error: "Not allowed." }, 403);

  let body: { query?: string; id?: string; roles?: number };
  try { body = await req.json(); } catch { return json({ error: "Send JSON: { query } or { id }." }, 400); }

  // one draft: the names for its image slots
  if (typeof body.id === "string" && body.id) {
    const { data, error } = await supabase.from("listings").select(SELECT).eq("id", body.id).eq("status", "draft").maybeSingle();
    if (error) return json({ error: error.message }, 500);
    if (!data) return json({ error: "No draft with this id (published, deleted or not a draft)." }, 404);
    const r = data as unknown as Row;
    if (!r.sku) return json({ error: "This draft has no SKU yet." }, 409);
    const lines = linesOf(r);
    const relId = r.release?.discogs_release_id;
    const positions = relId ? await discogsPositions(relId) : [];
    const roles = Math.min(Math.max(Math.trunc(Number(body.roles) || 3), 3), 12);
    const images = Array.from({ length: roles }, (_, i) => ({
      role: i + 1,
      label: i === 0 ? "Label A" : i === 1 ? "Label B" : "Other photo",
      name: FileNames.imageName(r.sku, lines, positions ?? [], i + 1),
    }));
    // clip rows: the same rows as the admin's File names (0136), with the line they belong to for the ID3 tags
    const rows = FileNames.fileNames(r.sku, lines, positions ?? []) as { key: string; role: string; name: string }[];
    const clips = rows.filter((x) => x.key.startsWith("line-")).map((x) => {
      const i = Number(x.key.slice(5));
      return { role: x.role.toLowerCase(), label: x.role, name: x.name,
        artist: lines[i]?.artist.trim() || lines[0]?.artist.trim() || "", title: lines[i]?.title.trim() ?? "" };
    });
    const rel = r.release;
    const tags = {
      album: titleOf(r), label: rel?.label ?? null, cat_no: rel?.cat_no ?? null,
      year: rel?.year && rel?.year_precision !== "decade" ? rel.year : null, genres: rel?.genres ?? [],
    };
    return json({ draft: summary(r), positions_read: positions !== null, images, clips, tags });
  }

  // search over the drafts (a few hundred at most: filtered here, no full-text index needed)
  const words = fold(String(body.query ?? "")).split(/\s+/).filter(Boolean).slice(0, 8);
  const { data, error } = await supabase.from("listings").select(SELECT).eq("status", "draft")
    .order("created_at", { ascending: false }).limit(1000);
  if (error) return json({ error: error.message }, 500);
  const rows = (data ?? []) as unknown as Row[];
  const hits = rows.filter((r) => {
    if (!words.length) return true;
    const hay = fold([r.sku, r.custom_title, r.release?.cat_no, ...linesOf(r).flatMap((l) => [l.artist, l.title])]
      .filter(Boolean).join(" "));
    return words.every((w) => hay.includes(w));
  });
  return json({ drafts: hits.slice(0, 500).map(summary) });
});
