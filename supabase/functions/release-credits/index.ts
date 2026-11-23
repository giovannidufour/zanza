// supabase/functions/release-credits — reads the Discogs credits (Producer, Mixed By …, decision 0146) of the releases
// saved before credits existed, and stores them with admin_set_release_credits. One-off backfill, safe to run again.
//   POST { limit? }  → { done, failed: [{ releaseId, error }], remaining }
// Takes the releases with a Discogs id whose credits were never read (releases.credits_fetched_at is null), at most
// `limit` per call (default 20, max 40) so a call stays far below the Edge Function time limit; call again until
// remaining = 0. One release = one discogs-lookup (plus one request per new producer for the name variations),
// spaced 1.5 s apart to stay under the Discogs rate limit.
// Admin only: the caller's Supabase session must belong to public.admins (as discogs-lookup). Deploy with "Verify JWT" ON.
import { createClient } from "npm:@supabase/supabase-js@2.45.4";
import "./listing-draft.js";

// deno-lint-ignore no-explicit-any
const ListingDraft = (globalThis as any).ZanzaListingDraft;   // ./listing-draft.js is a COPY, `npm run sync:functions`

const headers = {
  "Access-Control-Allow-Origin": "*",   // the session token is what protects it
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...headers, "Content-Type": "application/json" } });
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers });
  if (req.method !== "POST") return json({ error: "Use POST." }, 405);

  const auth = req.headers.get("Authorization") ?? "";
  const apikey = req.headers.get("apikey") ?? Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, apikey, { global: { headers: { Authorization: auth } } });
  const { data: isAdmin, error: adminError } = await supabase.rpc("is_admin");
  if (adminError || isAdmin !== true) return json({ error: "Not allowed." }, 403);

  let body: { limit?: number } = {};
  try { body = await req.json(); } catch { /* no body = defaults */ }
  const limit = Math.min(Math.max(Number(body.limit) || 20, 1), 40);

  const { data: todo, error } = await supabase.from("releases").select("id,discogs_release_id")
    .not("discogs_release_id", "is", null).is("credits_fetched_at", null).order("id").limit(limit);
  if (error) return json({ error: error.message }, 500);

  let done = 0;
  const failed: { releaseId: number; error: string }[] = [];
  for (const [i, r] of (todo ?? []).entries()) {
    if (i > 0) await sleep(1500);
    const { data: release, error: lookupError } = await supabase.functions.invoke("discogs-lookup", { body: { releaseId: r.discogs_release_id } });
    if (lookupError || !release || release.error) {
      let msg = release?.error ?? lookupError?.message ?? "Discogs lookup failed.";
      // deno-lint-ignore no-explicit-any
      try { const ctx = (lookupError as any)?.context; if (ctx?.json) msg = (await ctx.json()).error ?? msg; } catch { /* keep msg */ }
      failed.push({ releaseId: r.discogs_release_id, error: msg });
      if (/busy|429/.test(msg)) break;   // Discogs says slow down: stop here, the next call goes on
      // a release Discogs no longer has: stored with no credits, so it does not come back on every call
      if (/has no release/.test(msg)) await supabase.rpc("admin_set_release_credits", { p_release_id: r.id, p_credits: [] });
      continue;
    }
    const { error: saveError } = await supabase.rpc("admin_set_release_credits", { p_release_id: r.id, p_credits: ListingDraft.creditsOf(release) });
    if (saveError) failed.push({ releaseId: r.discogs_release_id, error: saveError.message });
    else done++;
  }

  const { count } = await supabase.from("releases").select("id", { count: "exact", head: true })
    .not("discogs_release_id", "is", null).is("credits_fetched_at", null);
  return json({ done, failed, remaining: count ?? null });
});
