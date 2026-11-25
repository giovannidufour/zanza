// supabase/functions/discogs-oauth — "Check your wantlist": Discogs OAuth 1.0a for visitors (decision 0152).
// The function never reads a wantlist. It only does what needs the consumer secret:
//   POST { action: "start", callback }                 → { token, secret, authorizeUrl }   (request token)
//   POST { action: "finish", token, secret, verifier } → { token, secret }                 (access token)
//   POST { action: "sign", token, secret, requests: [{ path, query }] } → { urls: string[] }
// "sign" returns api.discogs.com URLs carrying an HMAC-SHA1 OAuth signature in the query string: the visitor's browser
// fetches them from Discogs directly and does the matching itself, so the wantlist never reaches us.
// Only two read paths can be signed: /oauth/identity and /users/<name>/wants (page, per_page).
// Nothing is stored or logged: the visitor's tokens live in their tab (sessionStorage) and are sent here only to sign.
// Called by the browser: deploy with Verify JWT OFF; abuse limits = allowed origins (as discogs-search), POST only,
// whitelisted paths, at most MAX_SIGN URLs per call.
// Secrets (Supabase → Edge Functions → Secrets): DISCOGS_CONSUMER_KEY, DISCOGS_CONSUMER_SECRET (the Discogs app
// "HIGHMUZIK", Gio's developer settings), SHOP_URL; optional ALLOWED_ORIGINS. SUPABASE_URL / SUPABASE_ANON_KEY are
// set by Supabase (the wantlist switch, shop_settings).
const env = (k: string) => Deno.env.get(k) ?? "";
const USER_AGENT = "highmuzik/1.0 +https://highmuzik.com";
const API = "https://api.discogs.com";
const MAX_SIGN = 60;

function allowedOrigin(origin: string | null) {
  if (!origin) return null;
  const shop = env("SHOP_URL").replace(/\/$/, "");
  const extra = env("ALLOWED_ORIGINS").split(",").map((s) => s.trim()).filter(Boolean);
  let host = "";
  try { host = new URL(shop).host; } catch { /* no shop url */ }
  if (origin === shop || extra.includes(origin)) return origin;
  if (host.endsWith(".pages.dev") && /^https:\/\/[a-z0-9-]+\./.test(origin) && origin.endsWith("." + host)) return origin;
  return null;
}

// the wantlist switch (admin → Settings): off = this function refuses everything. No column yet (migration not
// applied) = on; a database error = off.
async function wantlistEnabled() {
  const key = env("SUPABASE_ANON_KEY");
  const r = await fetch(`${env("SUPABASE_URL")}/rest/v1/shop_settings?select=*`, { headers: { apikey: key, Authorization: `Bearer ${key}` } })
    .catch(() => null);
  if (!r) return false;
  if (r.status === 404) return true;
  if (!r.ok) return false;
  const rows = await r.json().catch(() => []);
  return !rows[0] || rows[0].wantlist_enabled !== false;
}

// RFC 3986 percent-encoding, as OAuth 1.0a wants it
const pct = (s: string) => encodeURIComponent(s).replace(/[!'()*]/g, (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase());
const nonce = () => crypto.randomUUID().replace(/-/g, "");
const now = () => String(Math.floor(Date.now() / 1000));

function oauthParams(token?: string) {
  const p: Record<string, string> = {
    oauth_consumer_key: env("DISCOGS_CONSUMER_KEY"),
    oauth_nonce: nonce(),
    oauth_timestamp: now(),
    oauth_version: "1.0",
  };
  if (token) p.oauth_token = token;
  return p;
}

// PLAINTEXT, server to Discogs only (request and access token), as the Discogs docs suggest
function plaintextHeader(params: Record<string, string>, tokenSecret = "") {
  const all = { ...params, oauth_signature_method: "PLAINTEXT", oauth_signature: `${env("DISCOGS_CONSUMER_SECRET")}&${tokenSecret}` };
  return "OAuth " + Object.entries(all).map(([k, v]) => `${k}="${pct(v)}"`).join(", ");
}

async function hmacSha1(key: string, text: string) {
  const k = await crypto.subtle.importKey("raw", new TextEncoder().encode(key), { name: "HMAC", hash: "SHA-1" }, false, ["sign"]);
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", k, new TextEncoder().encode(text)));
  return btoa(String.fromCharCode(...sig));
}

// HMAC-SHA1 signed GET URL with the OAuth params in the query (the browser cannot send an Authorization header to
// api.discogs.com: Discogs answers no CORS preflight)
async function signedUrl(path: string, query: Record<string, string>, token: string, tokenSecret: string) {
  const params: Record<string, string> = { ...query, ...oauthParams(token), oauth_signature_method: "HMAC-SHA1" };
  const norm = Object.keys(params).sort().map((k) => `${pct(k)}=${pct(params[k])}`).join("&");
  const base = ["GET", pct(API + path), pct(norm)].join("&");
  const sig = await hmacSha1(`${pct(env("DISCOGS_CONSUMER_SECRET"))}&${pct(tokenSecret)}`, base);
  return `${API}${path}?${norm}&oauth_signature=${pct(sig)}`;
}

// only these reads, with only these params
function checkRequest(r: unknown): { path: string; query: Record<string, string> } | null {
  if (!r || typeof r !== "object") return null;
  const { path, query } = r as { path?: unknown; query?: unknown };
  if (path !== "/oauth/identity" && !(typeof path === "string" && /^\/users\/[A-Za-z0-9._-]{1,64}\/wants$/.test(path))) return null;
  const q: Record<string, string> = {};
  for (const [k, v] of Object.entries((query ?? {}) as Record<string, unknown>)) {
    if (path === "/oauth/identity") return null;
    if (k === "page" && /^\d{1,4}$/.test(String(v))) q.page = String(v);
    else if (k === "per_page" && /^\d{1,3}$/.test(String(v)) && Number(v) <= 100) q.per_page = String(v);
    else return null;
  }
  return { path: path as string, query: q };
}

const str = (v: unknown, max = 200) => (typeof v === "string" && v.length > 0 && v.length <= max ? v : "");

Deno.serve(async (req) => {
  const origin = allowedOrigin(req.headers.get("origin"));
  const cors: Record<string, string> = origin
    ? { "Access-Control-Allow-Origin": origin, "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "content-type", Vary: "Origin" }
    : {};
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" } });

  if (req.method === "OPTIONS") return new Response(null, { status: origin ? 204 : 403, headers: cors });
  if (req.method !== "POST") return json({ error: "Use POST." }, 405);
  if (!origin) return json({ error: "Not allowed." }, 403);
  if (!(await wantlistEnabled())) return json({ error: "Not found." }, 404);
  if (!env("DISCOGS_CONSUMER_KEY") || !env("DISCOGS_CONSUMER_SECRET")) return json({ error: "Not configured." }, 500);

  // deno-lint-ignore no-explicit-any
  const body: any = await req.json().catch(() => null);
  if (!body) return json({ error: "Bad request." }, 400);

  if (body.action === "start") {
    const callback = str(body.callback, 300);
    let cb: URL;
    try { cb = new URL(callback); } catch { return json({ error: "Bad callback." }, 400); }
    if (cb.origin !== origin) return json({ error: "Bad callback." }, 400);
    const params = { ...oauthParams(), oauth_callback: callback };
    const r = await fetch(`${API}/oauth/request_token`, {
      method: "GET",
      headers: { "User-Agent": USER_AGENT, "Content-Type": "application/x-www-form-urlencoded", Authorization: plaintextHeader(params) },
    });
    if (!r.ok) return json({ error: "Discogs error." }, 502);
    const out = new URLSearchParams(await r.text());
    const token = out.get("oauth_token") ?? "";
    return json({ token, secret: out.get("oauth_token_secret") ?? "", authorizeUrl: `https://www.discogs.com/oauth/authorize?oauth_token=${pct(token)}` });
  }

  if (body.action === "finish") {
    const token = str(body.token), secret = str(body.secret), verifier = str(body.verifier);
    if (!token || !secret || !verifier) return json({ error: "Bad request." }, 400);
    const params = { ...oauthParams(token), oauth_verifier: verifier };
    const r = await fetch(`${API}/oauth/access_token`, {
      method: "POST",
      headers: { "User-Agent": USER_AGENT, "Content-Type": "application/x-www-form-urlencoded", Authorization: plaintextHeader(params, secret) },
    });
    if (!r.ok) return json({ error: "Discogs error." }, 502);
    const out = new URLSearchParams(await r.text());
    return json({ token: out.get("oauth_token") ?? "", secret: out.get("oauth_token_secret") ?? "" });
  }

  if (body.action === "sign") {
    const token = str(body.token), secret = str(body.secret);
    const list = Array.isArray(body.requests) ? body.requests.slice(0, MAX_SIGN + 1) : [];
    if (!token || !secret || !list.length || list.length > MAX_SIGN) return json({ error: "Bad request." }, 400);
    const checked = list.map(checkRequest);
    if (checked.some((c: unknown) => !c)) return json({ error: "Not allowed." }, 400);
    const urls = await Promise.all(checked.map((c: { path: string; query: Record<string, string> }) => signedUrl(c.path, c.query, token, secret)));
    return json({ urls });
  }

  return json({ error: "Bad request." }, 400);
});
