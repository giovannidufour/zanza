// supabase/functions/scanner-push — the macOS Scanner's "Push to admin" button (decision 0142).
// Attaches photos and clips the Scanner already uploaded to R2 (through sign-upload, like the admin) to ONE draft.
// It never uploads, converts or deletes files: keys stay in storage, as when the admin replaces a photo.
//   POST { id, check: true }
//        → { draft: { id, sku }, photos: [{ role, key }], clips: [{ line, key }] }   what the admin has now
//   POST { id, mode: "replace" | "fill", photos: [{ role, key }], clips: [{ line, key }] }
//        → { photos: n, clips: n, skipped: [{ kind, role|line }] }
//          photos: role 1 = Label A, 2 = Label B, 3… = other photos (decision 0136); photo_keys[role - 1] in the admin.
//          clips: line = 1-based line of the release (the scan-targets clip row); one sample per line, as the admin.
//          replace = the pushed roles/lines take the place of what the admin has there; roles and lines not pushed stay.
//          fill    = only roles/lines that are empty in the admin are set; nothing already there changes.
// Drafts only. Samples belong to the release (as in admin_save_listing): positions A, B… per line, sort = line order,
// additional samples (no line) stay after them untouched. A typed sample title in the admin is kept.
// Admin only: the caller's Supabase session (email OTP) must belong to public.admins. Deploy with "Verify JWT" ON.
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const headers = {
  "Access-Control-Allow-Origin": "*",   // a native app sends no Origin; the session token is what protects it
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...headers, "Content-Type": "application/json" } });

type Photo = { role: number; key: string };
type Clip = { line: number; key: string };
type Sample = { id: string; line_id: string | null; track_position: string; title: string | null; audio_key: string; sort: number };

const KEY = { photo: /^photos\/[0-9a-f-]{36}\.(webp|jpg|png)$/, sample: /^samples\/[0-9a-f-]{36}\.mp3$/ };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers });
  if (req.method !== "POST") return json({ error: "Use POST." }, 405);

  const auth = req.headers.get("Authorization") ?? "";
  const apikey = req.headers.get("apikey") ?? Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, apikey, { global: { headers: { Authorization: auth } } });
  const { data: isAdmin, error: adminError } = await supabase.rpc("is_admin");
  if (adminError || isAdmin !== true) return json({ error: "Not allowed." }, 403);

  let body: { id?: string; check?: boolean; mode?: string; photos?: Photo[]; clips?: Clip[] };
  try { body = await req.json(); } catch { return json({ error: "Send JSON: { id, check } or { id, mode, photos, clips }." }, 400); }
  if (typeof body.id !== "string" || !body.id) return json({ error: "Missing draft id." }, 400);

  const { data: listing, error } = await supabase.from("listings")
    .select("id,sku,status,photo_keys,release_id,release:releases(lines:release_lines(id,position))")
    .eq("id", body.id).maybeSingle();
  if (error) return json({ error: error.message }, 500);
  if (!listing || listing.status !== "draft") return json({ error: "No draft with this id (published, deleted or not a draft)." }, 404);

  // deno-lint-ignore no-explicit-any
  const lines = ((listing as any).release?.lines ?? []) as { id: string; position: number }[];
  const lineIdOf = new Map(lines.map((l) => [l.position, l.id]));
  const positionOf = new Map(lines.map((l) => [l.id, l.position]));
  const keys: string[] = (listing.photo_keys ?? []).slice();
  const { data: sData, error: sError } = await supabase.from("samples")
    .select("id,line_id,track_position,title,audio_key,sort").eq("release_id", listing.release_id).order("sort");
  if (sError) return json({ error: sError.message }, 500);
  const samples = (sData ?? []) as Sample[];
  const current = {
    draft: { id: listing.id, sku: listing.sku },
    photos: keys.map((key, i) => ({ role: i + 1, key })),
    clips: samples.filter((s) => s.line_id).map((s) => ({ line: positionOf.get(s.line_id!) ?? 0, key: s.audio_key })),
  };
  if (body.check) return json(current);

  const mode = body.mode === "fill" ? "fill" : body.mode === "replace" ? "replace" : null;
  if (!mode) return json({ error: 'mode must be "replace" or "fill".' }, 400);
  const photos = Array.isArray(body.photos) ? body.photos : [];
  const clips = Array.isArray(body.clips) ? body.clips : [];
  for (const p of photos) if (!Number.isInteger(p.role) || p.role < 1 || p.role > 12 || !KEY.photo.test(p.key)) return json({ error: "Bad photo: " + JSON.stringify(p) }, 400);
  for (const c of clips) if (!lineIdOf.has(c.line) || !KEY.sample.test(c.key)) return json({ error: "Bad clip (no such line or key): " + JSON.stringify(c) }, 400);

  const skipped: { kind: string; role?: number; line?: number }[] = [];

  // photos: slot role → photo_keys[role - 1]; a gap left by a missing role is closed (the gallery has no holes)
  const slots: (string | undefined)[] = keys.slice();
  for (const p of photos.slice().sort((a, b) => a.role - b.role)) {
    if (mode === "fill" && slots[p.role - 1]) { skipped.push({ kind: "photo", role: p.role }); continue; }
    slots[p.role - 1] = p.key;
  }
  const nextKeys = slots.filter((k): k is string => !!k);
  if (nextKeys.join() !== keys.join()) {
    const { error: e } = await supabase.from("listings").update({ photo_keys: nextKeys }).eq("id", listing.id).eq("status", "draft");
    if (e) return json({ error: e.message }, 500);
  }

  // clips: one sample per line; replace updates the row in place (keeps a typed title), fill only adds
  let clipCount = 0;
  for (const c of clips) {
    const lineId = lineIdOf.get(c.line)!;
    const have = samples.find((s) => s.line_id === lineId);
    if (have && mode === "fill") { skipped.push({ kind: "clip", line: c.line }); continue; }
    if (have) {
      if (have.audio_key !== c.key) {
        const { error: e } = await supabase.from("samples").update({ audio_key: c.key }).eq("id", have.id);
        if (e) return json({ error: e.message }, 500);
      }
    } else {
      const { error: e } = await supabase.from("samples").insert({
        release_id: listing.release_id, line_id: lineId, track_position: String.fromCharCode(64 + c.line), title: null, audio_key: c.key, sort: 0,
      });
      if (e) return json({ error: e.message }, 500);
    }
    clipCount++;
  }
  // sort as admin_save_listing: line samples in line order, then additional ones as they were
  if (clipCount) {
    const { data: all, error: e } = await supabase.from("samples").select("id,line_id,sort").eq("release_id", listing.release_id).order("sort");
    if (e) return json({ error: e.message }, 500);
    const ordered = ((all ?? []) as { id: string; line_id: string | null; sort: number }[]).slice().sort((a, b) =>
      (a.line_id ? positionOf.get(a.line_id)! : 1000 + a.sort) - (b.line_id ? positionOf.get(b.line_id)! : 1000 + b.sort));
    for (let i = 0; i < ordered.length; i++) if (ordered[i].sort !== i + 1) {
      const { error: u } = await supabase.from("samples").update({ sort: i + 1 }).eq("id", ordered[i].id);
      if (u) return json({ error: u.message }, 500);
    }
  }
  return json({ photos: photos.length - skipped.filter((s) => s.kind === "photo").length, clips: clipCount, skipped });
});
