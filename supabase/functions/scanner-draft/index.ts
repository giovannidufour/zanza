// supabase/functions/scanner-draft — the macOS Scanner's "New draft" (decision 0145): one Discogs release → one draft.
// The Scanner searches with discogs-lookup { query } (as the admin's Memo), then sends the release it picked here.
//   POST { releaseId }              → { draft: { id, sku } }   or 409 { existing: [{ id, sku, status }] } when a listing of
//                                     the same release exists (Gio may own two copies: send again with force)
//   POST { releaseId, force: true } → { draft: { id, sku } }   always creates
// The draft is the same as Memo → Create draft (0135): the release read by discogs-lookup, mapped by
// packages/listing-draft (./listing-draft.js is a COPY, `npm run sync:functions`), saved by admin_save_listing,
// then its Discogs credits by admin_set_release_credits (decision 0148).
// Incomplete like every draft (grading, price, photos come later). Credits need migration 0032.
// Admin only: the caller's Supabase session (email OTP) must belong to public.admins. Deploy with "Verify JWT" ON.
import { createClient } from "npm:@supabase/supabase-js@2.45.4";
import "./listing-draft.js";

// deno-lint-ignore no-explicit-any
const ListingDraft = (globalThis as any).ZanzaListingDraft;
const headers = {
  "Access-Control-Allow-Origin": "*",   // a native app sends no Origin; the session token is what protects it
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...headers, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers });
  if (req.method !== "POST") return json({ error: "Use POST." }, 405);

  const auth = req.headers.get("Authorization") ?? "";
  const apikey = req.headers.get("apikey") ?? Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, apikey, { global: { headers: { Authorization: auth } } });
  const { data: isAdmin, error: adminError } = await supabase.rpc("is_admin");
  if (adminError || isAdmin !== true) return json({ error: "Not allowed." }, 403);

  let body: { releaseId?: number; force?: boolean };
  try { body = await req.json(); } catch { return json({ error: "Send JSON: { releaseId }." }, 400); }
  const releaseId = Number(body.releaseId);
  if (!Number.isInteger(releaseId) || releaseId <= 0) return json({ error: "releaseId must be a Discogs release number." }, 400);

  // a listing of the same release already (any status): say so first, Gio decides
  if (!body.force) {
    const { data, error } = await supabase.from("listings").select("id,sku,status,release:releases!inner(discogs_release_id)")
      .eq("release.discogs_release_id", releaseId);
    if (error) return json({ error: error.message }, 500);
    if (data && data.length) return json({ existing: data.map((l) => ({ id: l.id, sku: l.sku, status: l.status })) }, 409);
  }

  // the release as the admin reads it (same function, same shape)
  const { data: release, error: lookupError } = await supabase.functions.invoke("discogs-lookup", { body: { releaseId } });
  if (lookupError || !release || release.error) {
    let msg = release?.error ?? lookupError?.message ?? "Discogs lookup failed.";
    // deno-lint-ignore no-explicit-any
    try { const ctx = (lookupError as any)?.context; if (ctx?.json) msg = (await ctx.json()).error ?? msg; } catch { /* keep msg */ }
    return json({ error: msg }, 502);
  }

  // artists, labels, genres and tags by name, so the draft binds to the existing entities (as the admin does)
  const one = async (table: string) => {
    const { data, error } = await supabase.from(table).select("id,name").order("name");
    if (error) throw new Error(error.message);
    return data ?? [];
  };
  let entities = null;
  try {
    const [artists, labels, genres, tags] = await Promise.all([one("artists"), one("labels"), one("genres"), one("tags")]);
    entities = { artists, labels, genres, tags };
  } catch { entities = null; }   // bound by name on save

  const payload = ListingDraft.draftPayload(release, entities);
  const { data: saved, error: saveError } = await supabase.rpc("admin_save_listing", { payload });
  if (saveError) return json({ error: saveError.message }, 500);
  // the Discogs credits (0148) go with the release; a failure does not undo the draft (the backfill catches it)
  await ListingDraft.saveCredits(supabase.rpc.bind(supabase), saved, payload);
  return json({ draft: { id: saved.listing_id, sku: saved.sku } });
});
