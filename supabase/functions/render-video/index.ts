// supabase/functions/render-video — record videos made on a server (decision 0195, migration 0042 video_jobs).
// Two callers:
// 1. The admin (Verify JWT OFF, checked here: the caller's session must belong to public.admins):
//    { audio_keys, image_keys, name, listing_id? } → a row in video_jobs + a repository_dispatch to GitHub, which runs
//    .github/workflows/render-video.yml. Answers { job }. The admin then reads the row until it is done or failed.
// 2. The workflow, with a GitHub Actions OIDC token (no shared secret: the token proves it is this repository's
//    render-video workflow on main): { job_id, action: "start" } → media URLs + a signed PUT for videos/<uuid>.mp4;
//    { job_id, action: "done", video_key } / { job_id, action: "failed", error }.
// Secrets (Supabase → Edge Functions → Secrets): GITHUB_DISPATCH_TOKEN (fine-grained token, this repository only,
// Contents: read and write), the R2 ones of sign-upload. Optional: GITHUB_REPO (default giovannidufour/zanza),
// MEDIA_BASE_URL (default https://media.highmuzik.com), ADMIN_ORIGINS.
import { AwsClient } from "npm:aws4fetch@1.0.20";
import { createClient } from "npm:@supabase/supabase-js@2.45.4";
import { createRemoteJWKSet, jwtVerify } from "npm:jose@5.9.6";

const ALLOWED_ORIGINS = (Deno.env.get("ADMIN_ORIGINS") ?? "https://store-admin-3k1.pages.dev").split(",").map((s) => s.trim());
const REPO = (Deno.env.get("GITHUB_REPO") ?? "giovannidufour/zanza").trim();
const MEDIA = (Deno.env.get("MEDIA_BASE_URL") ?? "https://media.highmuzik.com").trim().replace(/\/$/, "");
const AUDIENCE = "render-video";
const GITHUB_JWKS = createRemoteJWKSet(new URL("https://token.actions.githubusercontent.com/.well-known/jwks"));
const KEY = /^(photos|samples)\/[A-Za-z0-9._-]+$/;

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

// the workflow's OIDC token: this repository, the render-video workflow, from main
async function isWorker(auth: string) {
  const token = auth.replace(/^Bearer\s+/i, "");
  if (!token || token.split(".").length !== 3) return false;
  try {
    const { payload } = await jwtVerify(token, GITHUB_JWKS, { issuer: "https://token.actions.githubusercontent.com", audience: AUDIENCE });
    return payload.repository === REPO && String(payload.workflow_ref ?? "").startsWith(`${REPO}/.github/workflows/render-video.yml@refs/heads/main`);
  } catch { return false; }
}

Deno.serve(async (req) => {
  const headers = cors(req.headers.get("Origin"));
  if (req.method === "OPTIONS") return new Response("ok", { headers });
  if (req.method !== "POST") return json({ error: "Use POST." }, 405, headers);
  const auth = req.headers.get("Authorization") ?? "";
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return json({ error: "Send JSON." }, 400, headers); }
  const service = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  // ── the workflow
  if (typeof body.action === "string") {
    if (!(await isWorker(auth))) return json({ error: "Not allowed." }, 403, headers);
    const id = String(body.job_id ?? "");
    const { data: job, error } = await service.from("video_jobs").select("*").eq("id", id).maybeSingle();
    if (error || !job) return json({ error: "No such job." }, 404, headers);
    if (body.action === "start") {
      if (job.status === "done") return json({ error: "Already done." }, 409, headers);
      const accountId = Deno.env.get("R2_ACCOUNT_ID"), bucket = Deno.env.get("R2_BUCKET");
      const accessKeyId = Deno.env.get("R2_ACCESS_KEY_ID")?.trim(), secretAccessKey = Deno.env.get("R2_SECRET_ACCESS_KEY")?.trim();
      if (!accountId || !bucket || !accessKeyId || !secretAccessKey) return json({ error: "Storage is not configured." }, 500, headers);
      const key = `videos/${crypto.randomUUID()}.mp4`;
      const r2 = new AwsClient({ accessKeyId, secretAccessKey, service: "s3", region: "auto" });
      const target = new URL(`https://${accountId}.r2.cloudflarestorage.com/${bucket}/${key}`);
      target.searchParams.set("X-Amz-Expires", "3600");
      const signed = await r2.sign(new Request(target, { method: "PUT", headers: { "Content-Type": "video/mp4" } }), { aws: { signQuery: true } });
      await service.from("video_jobs").update({ status: "rendering", error: null }).eq("id", id);
      return json({
        parts: job.audio_keys.map((a: string, i: number) => ({ audio: `${MEDIA}/${a}`, image: `${MEDIA}/${job.image_keys[i]}` })),
        video_key: key, upload_url: signed.url,
      }, 200, headers);
    }
    if (body.action === "done") {
      const key = String(body.video_key ?? "");
      if (!/^videos\/[0-9a-f-]+\.mp4$/.test(key)) return json({ error: "Bad video_key." }, 400, headers);
      await service.from("video_jobs").update({ status: "done", video_key: key, error: null }).eq("id", id);
      return json({ ok: true }, 200, headers);
    }
    if (body.action === "failed") {
      await service.from("video_jobs").update({ status: "failed", error: String(body.error ?? "render failed").slice(0, 500) }).eq("id", id);
      return json({ ok: true }, 200, headers);
    }
    return json({ error: "Unknown action." }, 400, headers);
  }

  // ── the admin
  const apikey = req.headers.get("apikey") ?? Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const user = createClient(Deno.env.get("SUPABASE_URL")!, apikey, { global: { headers: { Authorization: auth } } });
  const { data: isAdmin, error: adminError } = await user.rpc("is_admin");
  if (adminError || isAdmin !== true) return json({ error: "Not allowed." }, 403, headers);
  const token = Deno.env.get("GITHUB_DISPATCH_TOKEN")?.trim();
  if (!token) return json({ error: "Server videos are not set up yet (GITHUB_DISPATCH_TOKEN).", setup: true }, 501, headers);
  const audio = body.audio_keys, images = body.image_keys, name = String(body.name ?? "");
  const ok = (a: unknown) => Array.isArray(a) && a.length >= 1 && a.length <= 2 && a.every((k) => typeof k === "string" && KEY.test(k));
  if (!ok(audio) || !ok(images) || (audio as string[]).length !== (images as string[]).length) return json({ error: "Send audio_keys and image_keys (1 or 2 each)." }, 400, headers);
  if (!/^[A-Za-z0-9._-]+\.mp4$/.test(name)) return json({ error: "Bad file name." }, 400, headers);
  const { data: job, error } = await user.from("video_jobs")
    .insert({ audio_keys: audio, image_keys: images, name, listing_id: typeof body.listing_id === "string" ? body.listing_id : null })
    .select("*").single();
  if (error) return json({ error: error.message }, 400, headers);
  const res = await fetch(`https://api.github.com/repos/${REPO}/dispatches`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "User-Agent": "render-video", "X-GitHub-Api-Version": "2022-11-28" },
    body: JSON.stringify({ event_type: "render-video", client_payload: { job_id: job.id } }),
  });
  if (!res.ok) {
    const why = `GitHub said ${res.status}${res.status === 401 || res.status === 403 || res.status === 404 ? " (check GITHUB_DISPATCH_TOKEN)" : ""}`;
    await service.from("video_jobs").update({ status: "failed", error: why }).eq("id", job.id);
    return json({ error: why }, 502, headers);
  }
  return json({ job }, 200, headers);
});
