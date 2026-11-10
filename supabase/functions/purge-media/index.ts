// supabase/functions/purge-media — deletes from R2 the files nothing uses any more (migration 0009, public.media_trash).
// Admin only (the caller's session must belong to public.admins). The admin calls it when the Listings page opens.
// What to delete is decided by the database (admin_media_to_purge): trashed more than 7 days ago AND referenced by no
// listing photo and no sample. A key R2 answers 204 or 404 for is gone: it leaves the trash (admin_media_purged).
// Secrets: the same as sign-upload (R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET).
import { AwsClient } from "npm:aws4fetch@1.0.20";
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const ALLOWED_ORIGINS = (Deno.env.get("ADMIN_ORIGINS") ?? "https://store-admin-3k1.pages.dev").split(",").map((s) => s.trim());

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

Deno.serve(async (req) => {
  const headers = cors(req.headers.get("Origin"));
  if (req.method === "OPTIONS") return new Response("ok", { headers });
  if (req.method !== "POST") return json({ error: "Use POST." }, 405, headers);

  const auth = req.headers.get("Authorization") ?? "";
  const apikey = req.headers.get("apikey") ?? Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, apikey, { global: { headers: { Authorization: auth } } });

  // the database checks is_admin() itself; a non-admin gets an error here
  const { data: keys, error } = await supabase.rpc("admin_media_to_purge", { p_limit: 100 });
  if (error) return json({ error: error.message }, 403, headers);
  if (!keys || keys.length === 0) return json({ purged: [], failed: [] }, 200, headers);

  const accountId = Deno.env.get("R2_ACCOUNT_ID"), bucket = Deno.env.get("R2_BUCKET");
  const accessKeyId = Deno.env.get("R2_ACCESS_KEY_ID")?.trim(), secretAccessKey = Deno.env.get("R2_SECRET_ACCESS_KEY")?.trim();
  if (!accountId || !bucket || !accessKeyId || !secretAccessKey) return json({ error: "Storage is not configured yet." }, 500, headers);
  const r2 = new AwsClient({ accessKeyId, secretAccessKey, service: "s3", region: "auto" });

  const purged: string[] = [], failed: { key: string; status: number }[] = [];
  for (const key of keys as string[]) {
    if (!/^(photos|samples)\/[\w.-]+$/.test(key)) { failed.push({ key, status: 0 }); continue; }   // never anything else
    const res = await r2.fetch(`https://${accountId}.r2.cloudflarestorage.com/${bucket}/${key}`, { method: "DELETE" });
    if (res.status === 204 || res.status === 200 || res.status === 404) purged.push(key);
    else failed.push({ key, status: res.status });
  }
  if (purged.length) {
    const { error: doneError } = await supabase.rpc("admin_media_purged", { p_keys: purged });
    if (doneError) return json({ error: doneError.message, purged, failed }, 500, headers);
  }
  return json({ purged, failed }, 200, headers);
});
