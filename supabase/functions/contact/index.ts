// supabase/functions/contact — the contact form of /contact/ (decision 0093: Gio sells privately, no address or phone on
// the site, only email and this form). The page posts JSON { name, email, message, website }; the function emails it to
// Gio (Reply-To = the sender). Nothing is stored.
// Called by the browser: deploy with Verify JWT OFF; abuse limits = allowed origins (as trade-offer), honeypot, size caps
// and an invisible proof of work (decision 0132): GET returns a signed puzzle, the page solves it in the background
// (sha256(salt + n) = challenge, n < max), POST must carry the answer. Stateless: the signature is an HMAC with a key
// derived from SUPABASE_SERVICE_ROLE_KEY (always present in Edge Functions; POW_SECRET overrides it). No cookies, nothing
// stored, no third party. A message sent less than MIN_SECONDS after the puzzle was issued is refused (bots are instant).
// Secrets (Supabase → Edge Functions → Secrets): RESEND_API_KEY, MAIL_FROM, SHOP_URL, STORE_NAME (shared with trade-offer)
// + CONTACT_TO (where messages go; falls back to OFFER_TO, Gio's address, never in code). Optional ALLOWED_ORIGINS.
const env = (k: string) => Deno.env.get(k) ?? "";
const escapeHtml = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));
const clip = (v: unknown, max: number) => String(v ?? "").trim().slice(0, max);

const POW_MAX = 50_000;          // the browser tries ~25k sha256 on average: well under a second on a phone
const POW_TTL = 60 * 60;         // a puzzle is valid for an hour (someone writing a long message)
const MIN_SECONDS = 3;           // fastest plausible human: open the page, type, send
const enc = new TextEncoder();
const hex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
const sha256 = async (s: string) => hex(await crypto.subtle.digest("SHA-256", enc.encode(s)));
async function hmac(s: string) {
  const secret = env("POW_SECRET") || "contact-pow:" + env("SUPABASE_SERVICE_ROLE_KEY");
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return hex(await crypto.subtle.sign("HMAC", key, enc.encode(s)));
}
async function newPuzzle() {
  const issued = Math.floor(Date.now() / 1000);
  const salt = hex(crypto.getRandomValues(new Uint8Array(12)).buffer) + "." + issued + ".";
  const challenge = await sha256(salt + Math.floor(Math.random() * POW_MAX));
  return { algorithm: "SHA-256", salt, challenge, max: POW_MAX, signature: await hmac(challenge) };
}
// "ok" | "missing" | "bad" | "fast"
async function checkPuzzle(p: any): Promise<string> {
  if (!p || typeof p !== "object") return "missing";
  const salt = String(p.salt ?? ""), challenge = String(p.challenge ?? ""), n = Number(p.number);
  const issued = Number(salt.split(".")[1]);
  if (!Number.isInteger(n) || n < 0 || n > POW_MAX || !issued) return "bad";
  if (String(p.signature ?? "") !== await hmac(challenge)) return "bad";
  if (await sha256(salt + n) !== challenge) return "bad";
  const age = Date.now() / 1000 - issued;
  if (age > POW_TTL) return "bad";
  if (age < MIN_SECONDS) return "fast";
  return "ok";
}

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

Deno.serve(async (req) => {
  const origin = allowedOrigin(req.headers.get("origin"));
  const cors: Record<string, string> = origin
    ? { "Access-Control-Allow-Origin": origin, "Access-Control-Allow-Methods": "GET, POST, OPTIONS", "Access-Control-Allow-Headers": "content-type", Vary: "Origin" }
    : {};
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

  if (req.method === "OPTIONS") return new Response(null, { status: origin ? 204 : 403, headers: cors });
  if (!origin) return json({ error: "Not allowed." }, 403);
  if (req.method === "GET") return json(await newPuzzle());   // the page asks for a puzzle as it opens
  if (req.method !== "POST") return json({ error: "Use POST." }, 405);
  const to = env("CONTACT_TO") || env("OFFER_TO");
  for (const k of ["RESEND_API_KEY", "MAIL_FROM"]) if (!env(k)) return json({ error: "Contact not configured." }, 500);
  if (!to) return json({ error: "Contact not configured." }, 500);
  if (Number(req.headers.get("content-length") || 0) > 12000) return json({ error: "Too long." }, 413);

  let b: any;
  try { b = await req.json(); } catch { return json({ error: "Bad request." }, 400); }
  if (clip(b.website, 200)) return json({ ok: true });   // honeypot: pretend it went through
  const pow = await checkPuzzle(b.pow);
  if (pow === "fast") return json({ ok: true });         // sent faster than a person can: pretend, like the honeypot
  if (pow !== "ok") return json({ error: "Check failed. Reload the page and try again." }, 403);

  const msg = { name: clip(b.name, 100), email: clip(b.email, 200), message: clip(b.message, 4000) };
  if (!msg.message || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(msg.email)) return json({ error: "Missing or invalid fields." }, 422);

  const store = env("STORE_NAME") || "Shop";
  const who = msg.name ? `${msg.name} <${msg.email}>` : msg.email;
  const text = [`Message from the ${store} contact form`, "", `From: ${who}`, "", msg.message, "", "Reply to this email to answer them."].join("\n");
  const html = `<p>Message from the ${escapeHtml(store)} contact form</p><p>From: ${escapeHtml(who)}</p>` +
    `<p>${escapeHtml(msg.message).replace(/\n/g, "<br>")}</p><p>Reply to this email to answer them.</p>`;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${env("RESEND_API_KEY")}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: env("MAIL_FROM"), to, reply_to: msg.email, subject: `Contact: ${msg.name || msg.email}`, text, html }),
  });
  if (!res.ok) return json({ error: "Could not send." }, 502);
  return json({ ok: true });
});
