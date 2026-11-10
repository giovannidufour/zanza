// supabase/functions/sign-upload — returns a short-lived URL to PUT one file straight into R2 (bucket store-media).
// Admin only: the caller's Supabase session must belong to a row of public.admins.
// Keys are random and immutable (never overwritten): photos/<uuid>.<ext>, samples/<uuid>.<ext>.
// The database stores only the key; the public base URL lives in config (backend.md → Storage).
// Secrets (Supabase → Edge Functions → Secrets): R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET.
import { AwsClient } from "npm:aws4fetch@1.0.20";
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const ALLOWED_ORIGINS = (Deno.env.get("ADMIN_ORIGINS") ?? "https://store-admin-3k1.pages.dev").split(",").map((s) => s.trim());
const KINDS: Record<string, { prefix: string; types: Record<string, string>; maxBytes: number }> = {
  photo: { prefix: "photos", types: { "image/webp": "webp", "image/jpeg": "jpg", "image/png": "png" }, maxBytes: 8 * 1024 * 1024 },
  sample: { prefix: "samples", types: { "audio/mpeg": "mp3" }, maxBytes: 4 * 1024 * 1024 },
};

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

  // who is calling: the user's own session, checked against public.admins
  const auth = req.headers.get("Authorization") ?? "";
  // apikey: the publishable key the admin sent (supabase-js adds it); the legacy anon key only as fallback
  const apikey = req.headers.get("apikey") ?? Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, apikey, {
    global: { headers: { Authorization: auth } },
  });
  const { data: isAdmin, error: adminError } = await supabase.rpc("is_admin");
  if (adminError || isAdmin !== true) return json({ error: "Not allowed." }, 403, headers);

  let body: { kind?: string; contentType?: string; size?: number };
  try { body = await req.json(); } catch { return json({ error: "Send JSON: { kind, contentType, size }." }, 400, headers); }
  const kind = KINDS[body.kind ?? ""];
  if (!kind) return json({ error: "kind must be photo or sample." }, 400, headers);
  const ext = kind.types[body.contentType ?? ""];
  if (!ext) return json({ error: `File type not allowed for ${body.kind}: ${body.contentType}.` }, 400, headers);
  if (!body.size || body.size > kind.maxBytes) return json({ error: `File too large (max ${kind.maxBytes / 1024 / 1024} MB).` }, 400, headers);

  const accountId = Deno.env.get("R2_ACCOUNT_ID"), bucket = Deno.env.get("R2_BUCKET");
  // trimmed: values pasted into the dashboard often carry a trailing newline or space
  const accessKeyId = Deno.env.get("R2_ACCESS_KEY_ID")?.trim(), secretAccessKey = Deno.env.get("R2_SECRET_ACCESS_KEY")?.trim();
  if (!accountId || !bucket || !accessKeyId || !secretAccessKey) return json({ error: "Storage is not configured yet." }, 500, headers);
  // R2 S3 credentials: Access Key ID = 32 chars, Secret = 64 (not the "Token value" shown next to them).
  // R2 error responses carry no CORS headers, so a wrong key would only surface as "Failed to fetch" in the browser.
  if (accessKeyId.length !== 32 || secretAccessKey.length !== 64) {
    return json({ error: `Storage keys look wrong: R2_ACCESS_KEY_ID must be the 32-character Access Key ID and R2_SECRET_ACCESS_KEY the 64-character Secret Access Key (now ${accessKeyId.length} and ${secretAccessKey.length}).` }, 500, headers);
  }

  const key = `${kind.prefix}/${crypto.randomUUID()}.${ext}`;
  const r2 = new AwsClient({ accessKeyId, secretAccessKey, service: "s3", region: "auto" });
  const target = new URL(`https://${accountId}.r2.cloudflarestorage.com/${bucket}/${key}`);
  target.searchParams.set("X-Amz-Expires", "600");
  const signed = await r2.sign(new Request(target, { method: "PUT", headers: { "Content-Type": body.contentType! } }), {
    aws: { signQuery: true },
  });
  return json({ key, uploadUrl: signed.url, contentType: body.contentType }, 200, headers);
});
