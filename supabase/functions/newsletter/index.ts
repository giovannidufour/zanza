// supabase/functions/newsletter — newsletter signup with our own double opt-in (decision 0103). Buttondown's own form
// costs four steps (its "check your inbox" page, the email, its page with a Confirm button, its "confirmed" page); here
// the visitor stays on the site and confirms with the one link in the email.
//   POST { action: "subscribe", email, source, website }  → emails a signed confirm link (Resend). Nothing is stored.
//   POST { action: "confirm", token }                     → checks the link, adds the address to Buttondown as an
//                                                           active subscriber (API, type "regular"), with the consent proof,
//                                                           then emails the shop inbox (NEWSLETTER_TO, else OFFER_TO)
// The link is <origin of the signup page>/newsletter/confirm/#<token>: the token is in the fragment, so it never reaches a
// server log; the page posts it here (scripts/newsletter.js). A link scanner that only GETs the URL confirms nothing.
// Token = base64url({ e: email, t: signup time, s: source path }) + "." + HMAC-SHA256, valid 7 days. The HMAC key is
// derived from BUTTONDOWN_API_KEY, so there is no extra secret (rotating the API key voids the links not yet clicked).
// Called by the browser: deploy with Verify JWT OFF. Abuse limits = allowed origins, honeypot, size caps.
// Secrets (Supabase → Edge Functions → Secrets): BUTTONDOWN_API_KEY (new), RESEND_API_KEY, MAIL_FROM, SHOP_URL,
// STORE_NAME (shared with contact / trade-offer). Optional ALLOWED_ORIGINS (comma-separated, e.g. the pages.dev URLs).
// Signup notice to Gio: NEWSLETTER_TO (shop inbox), falls back to OFFER_TO; neither set = no notice. Never in code.
const env = (k: string) => Deno.env.get(k) ?? "";
const escapeHtml = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));
const clip = (v: unknown, max: number) => String(v ?? "").trim().slice(0, max);
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TTL_MS = 7 * 24 * 60 * 60 * 1000;

// the shop's own domain and its subdomains (highmuzik.com = coming-soon page, staging.… = shop), the pages.dev
// previews of SHOP_URL, and ALLOWED_ORIGINS
function allowedOrigin(origin: string | null) {
  if (!origin) return null;
  const extra = env("ALLOWED_ORIGINS").split(",").map((s) => s.trim()).filter(Boolean);
  if (extra.includes(origin)) return origin;
  let shopHost = "", host = "";
  try { shopHost = new URL(env("SHOP_URL")).host; host = new URL(origin).host; } catch { return null; }
  if (!origin.startsWith("https://")) return null;
  if (shopHost.endsWith(".pages.dev")) return host === shopHost || host.endsWith("." + shopHost) ? origin : null;
  const base = shopHost.split(".").slice(-2).join(".");
  return host === base || host.endsWith("." + base) ? origin : null;
}

const enc = new TextEncoder();
const b64url = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const fromB64url = (s: string) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));
async function hmac(data: string) {
  const key = await crypto.subtle.importKey("raw", enc.encode("newsletter-confirm:" + env("BUTTONDOWN_API_KEY")),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return b64url(new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(data))));
}
async function makeToken(p: { e: string; t: number; s: string }) {
  const body = b64url(enc.encode(JSON.stringify(p)));
  return body + "." + await hmac(body);
}
async function readToken(token: string): Promise<{ e: string; t: number; s: string } | null> {
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const want = await hmac(body);
  if (want.length !== sig.length) return null;
  let diff = 0;
  for (let i = 0; i < want.length; i++) diff |= want.charCodeAt(i) ^ sig.charCodeAt(i);
  if (diff) return null;
  try {
    const p = JSON.parse(new TextDecoder().decode(fromB64url(body)));
    if (!EMAIL.test(p.e) || typeof p.t !== "number" || Date.now() - p.t > TTL_MS) return null;
    return p;
  } catch { return null; }
}

// a confirmed signup → short email to the shop inbox. Best effort: a failure here never fails the confirm.
async function notifyShop(p: { e: string; t: number; s: string }, origin: string, store: string) {
  const to = env("NEWSLETTER_TO") || env("OFFER_TO");
  if (!to) return;
  const rows: [string, string][] = [
    ["Email", p.e],
    ["Signed up on", origin + p.s],
    ["Signed up at", new Date(p.t).toISOString()],
    ["Confirmed at", new Date().toISOString()],
  ];
  const text = [`New confirmed subscriber to the ${store} newsletter.`, "", ...rows.map(([k, v]) => `${k}: ${v}`)].join("\n");
  const html = `<p>New confirmed subscriber to the ${escapeHtml(store)} newsletter.</p><p>` +
    rows.map(([k, v]) => `${k}: ${escapeHtml(v)}`).join("<br>") + "</p>";
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${env("RESEND_API_KEY")}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: env("MAIL_FROM"), to, subject: `New newsletter subscriber: ${p.e}`, text, html }),
    });
    if (!res.ok) console.error("notify", res.status, (await res.text()).slice(0, 300));
  } catch (e) { console.error("notify", String(e)); }
}

Deno.serve(async (req) => {
  const origin = allowedOrigin(req.headers.get("origin"));
  const cors: Record<string, string> = origin
    ? { "Access-Control-Allow-Origin": origin, "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "content-type", Vary: "Origin" }
    : {};
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

  if (req.method === "OPTIONS") return new Response(null, { status: origin ? 204 : 403, headers: cors });
  if (req.method !== "POST") return json({ error: "Use POST." }, 405);
  if (!origin) return json({ error: "Not allowed." }, 403);
  for (const k of ["BUTTONDOWN_API_KEY", "RESEND_API_KEY", "MAIL_FROM"]) if (!env(k)) return json({ error: "Newsletter not configured." }, 500);
  if (Number(req.headers.get("content-length") || 0) > 4000) return json({ error: "Too long." }, 413);

  let b: any;
  try { b = await req.json(); } catch { return json({ error: "Bad request." }, 400); }
  const store = env("STORE_NAME") || "the shop";

  if (b.action === "subscribe") {
    if (clip(b.website, 200)) return json({ ok: true });   // honeypot: pretend it went through
    const email = clip(b.email, 200).toLowerCase();
    if (!EMAIL.test(email)) return json({ error: "Invalid email." }, 422);
    const source = clip(b.source, 200).startsWith("/") ? clip(b.source, 200) : "/";
    const link = `${origin}/newsletter/confirm/#${await makeToken({ e: email, t: Date.now(), s: source })}`;
    const text = [`Confirm your subscription to the ${store} newsletter:`, "", link, "",
      "The link works for 7 days. If you didn't sign up, ignore this email: you won't hear from us again."].join("\n");
    const html = `<p>Confirm your subscription to the ${escapeHtml(store)} newsletter:</p>` +
      `<p><a href="${escapeHtml(link)}">Confirm subscription</a></p>` +
      `<p>The link works for 7 days. If you didn't sign up, ignore this email: you won't hear from us again.</p>`;
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${env("RESEND_API_KEY")}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: env("MAIL_FROM"), to: email, subject: `Confirm your ${store} subscription`, text, html }),
    });
    if (!res.ok) return json({ error: "Could not send." }, 502);
    return json({ ok: true });
  }

  if (b.action === "confirm") {
    const p = await readToken(clip(b.token, 1000));
    if (!p) return json({ error: "expired" }, 410);
    const ip = (req.headers.get("cf-connecting-ip") || req.headers.get("x-forwarded-for") || "").split(",")[0].trim();
    const res = await fetch("https://api.buttondown.com/v1/subscribers", {
      method: "POST",
      headers: {
        Authorization: `Token ${env("BUTTONDOWN_API_KEY")}`, "Content-Type": "application/json",
        // already on the list (or unsubscribed earlier and now confirming again): merge and make active
        "X-Buttondown-Collision-Behavior": "add",
      },
      body: JSON.stringify({
        email_address: p.e,
        type: "regular",   // confirmed by the link in our email: Buttondown must not send its own confirmation
        referrer_url: origin + p.s,
        ...(ip ? { ip_address: ip } : {}),
        // proof of consent (double opt-in): when they signed up, where, and when they clicked the link
        metadata: { optin: "double opt-in, confirm link", signup_at: new Date(p.t).toISOString(), signup_page: origin + p.s, confirmed_at: new Date().toISOString() },
      }),
    });
    if (res.ok) {
      await notifyShop(p, origin, store);
      return json({ ok: true });
    }
    const err = await res.text();
    if (/subscriber_suppressed/.test(err)) return json({ error: "suppressed" }, 409);   // blocked / bounced address
    console.error("buttondown", res.status, err.slice(0, 500));
    return json({ error: "Could not subscribe." }, 502);
  }

  return json({ error: "Bad request." }, 400);
});
