// supabase/functions/read-label — reads a record label from a photo for the admin's Memo page (decision 0090):
// POST { image: "<base64 JPEG, no data: prefix>" } → { read: { artist, title, label, catno, barcode }, query }.
// Admin only: the caller's Supabase session must belong to a row of public.admins.
// The photo is read by a free vision model on Cloudflare Workers AI (Workers Free: 10,000 neurons a day,
// one photo ≈ 60 neurons) and is never stored. The Discogs search that follows is discogs-lookup { fields }.
// Secrets (Supabase → Edge Functions → Secrets): CF_ACCOUNT_ID (Cloudflare account id), CF_AI_TOKEN (API token with
// the "Workers AI: Read" permission only). Optional: CF_AI_MODEL (default below).
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const ALLOWED_ORIGINS = (Deno.env.get("ADMIN_ORIGINS") ?? "https://store-admin-3k1.pages.dev").split(",").map((s) => s.trim());
const DEFAULT_MODEL = "@cf/meta/llama-4-scout-17b-16e-instruct";
const MAX_BASE64 = 2_000_000;   // ~1.5 MB of JPEG: the admin sends ~1280 px, far less

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

const PROMPT = `This is a photo of a vinyl record: usually the centre label, sometimes a sleeve.
Read only what is printed. Answer with one JSON object and nothing else:
{"artist": "", "title": "", "label": "", "catno": "", "barcode": ""}
- artist: the performer as printed (for a 7" single, the A-side artist).
- title: the song or album title as printed (A side if there are two).
- label: the record label name (logo text), not the distributor.
- catno: the catalogue number exactly as printed (e.g. "ILPS 9721", "TJ 045").
- barcode: digits under a barcode, if any.
Leave a field "" when it is not printed or you are not sure. Never guess.`;

type Read = { artist: string; title: string; label: string; catno: string; barcode: string };
const str = (v: unknown, max = 120) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "");

// the model is asked for JSON; take the first {...} in the answer, whatever is around it
function parseRead(text: string): Read | null {
  const m = String(text ?? "").match(/\{[\s\S]*\}/);
  if (!m) return null;
  try {
    const o = JSON.parse(m[0]);
    const r = { artist: str(o.artist), title: str(o.title), label: str(o.label), catno: str(o.catno, 40), barcode: str(o.barcode, 20).replace(/\D/g, "") };
    if (r.barcode.length < 8) r.barcode = "";
    return r;
  } catch { return null; }
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

  const account = Deno.env.get("CF_ACCOUNT_ID")?.trim();
  const token = Deno.env.get("CF_AI_TOKEN")?.trim();
  if (!account || !token) return json({ error: "Reading photos needs the CF_ACCOUNT_ID and CF_AI_TOKEN secrets." }, 500, headers);

  let body: { image?: string };
  try { body = await req.json(); } catch { return json({ error: "Send JSON: { image }." }, 400, headers); }
  const image = typeof body.image === "string" ? body.image.replace(/^data:image\/\w+;base64,/, "") : "";
  if (!image || !/^[A-Za-z0-9+/=]+$/.test(image.slice(0, 200))) return json({ error: "image must be a base64 JPEG." }, 400, headers);
  if (image.length > MAX_BASE64) return json({ error: "Photo too large: send it at about 1280 px." }, 413, headers);

  const model = Deno.env.get("CF_AI_MODEL")?.trim() || DEFAULT_MODEL;
  const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${account}/ai/run/${model}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      messages: [{ role: "user", content: [
        { type: "text", text: PROMPT },
        { type: "image_url", image_url: { url: `data:image/jpeg;base64,${image}` } },
      ] }],
      max_tokens: 200,
      temperature: 0,
    }),
  });
  if (res.status === 429) return json({ error: "Today's free photo quota is used up: type the record, or try again tomorrow." }, 429, headers);
  // deno-lint-ignore no-explicit-any
  const data: any = await res.json().catch(() => null);
  if (!res.ok || !data?.success) {
    const why = data?.errors?.[0]?.message ?? `Cloudflare answered ${res.status}`;
    // the free daily allocation ends with an error, not a 429 (developers.cloudflare.com/workers-ai/platform/pricing)
    if (/neuron|limit|quota/i.test(why)) return json({ error: "Today's free photo quota is used up: type the record, or try again tomorrow." }, 429, headers);
    return json({ error: `The photo reader failed (${why}).` }, 502, headers);
  }
  const answer = typeof data.result?.response === "string" ? data.result.response : JSON.stringify(data.result?.response ?? "");
  const read = parseRead(answer);
  if (!read || !(read.artist || read.title || read.catno || read.barcode)) return json({ read: null, query: "" }, 200, headers);
  // what goes in the Record field: the words Gio can still correct
  const query = [read.artist, read.title, read.catno].filter(Boolean).join(" ");
  return json({ read, query }, 200, headers);
});
