// supabase/functions/offer — best offer, the shop side (migration 0034, decision 0158).
// A sale copy with price mode "offers" has no price: buyers make an offer, Gio accepts or declines it in the admin
// (Edge Function offer-decide), an accepted offer is paid through Stripe Checkout at the agreed amount.
//   GET                                              → a signed proof-of-work puzzle (as contact, decision 0132)
//   POST { action: "submit", listing, amount, country, email, note?, website, pow }
//        → honeypot, puzzle, time trap, offer_submit (rate limits) → email to the buyer with the confirmation link
//        → { ok } · 409 { error: "unavailable" } · 429 { error: "too_many" } · 4xx { error }
//   POST { action: "confirm", token }   → offer_confirm → first time: email to Gio → { result, name, slug, amount_cents }
//   POST { action: "pay-info", token }  → offer_pay_info: what the pay page shows { state, name, slug, amount_cents, … }
//   POST { action: "pay", token, country } → Stripe Checkout session for the accepted amount + shipping → { url }
// Stripe only authorizes (capture_method manual): stripe-webhook captures in checkout_claim, as for the Bag (0028).
// No minimum order for an accepted offer. ./shipping.js is a COPY of packages/shipping (npm run sync:functions).
// Called by the browser: deploy with Verify JWT OFF. Origins as create-checkout (SHOP_URL, ALLOWED_ORIGINS, pages.dev).
// Secrets: RESEND_API_KEY, MAIL_FROM, SHOP_URL, STORE_NAME, ORDERS_TO (or OFFER_TO), STRIPE_SECRET_KEY, optional
// ADMIN_URL (default https://admin.highmuzik.com), MEDIA_BASE_URL, POW_SECRET. SUPABASE_* are set by Supabase.
import { createClient } from "npm:@supabase/supabase-js@2.45.4";
import "./shipping.js";

// deno-lint-ignore no-explicit-any
const Shipping = (globalThis as any).HighmuzikShipping;
const env = (k: string) => Deno.env.get(k) ?? "";
const clip = (v: unknown, max: number) => String(v ?? "").trim().slice(0, max);
const euro = (cents: number) => `€${(cents / 100).toFixed(2).replace(/\.00$/, "")}`;
const TOKEN = /^[0-9a-f]{64}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SESSION = /^cs_(test|live)_[A-Za-z0-9]+$/;
const SESSION_MINUTES = 31;
const MAX_OFFER_CENTS = 10_000_00;   // €10,000: anything above is a typo or a joke
// the country name in emails ("ships to Germany")
const countryName = (code: string) => { try { return new Intl.DisplayNames(["en"], { type: "region" }).of(code) || code; } catch { return code; } };

// ── proof of work: the same puzzle as supabase/functions/contact (decision 0132) ──
const POW_MAX = 50_000;
const POW_TTL = 60 * 60;
const MIN_SECONDS = 3;
const enc = new TextEncoder();
const hex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
const sha256 = async (s: string) => hex(await crypto.subtle.digest("SHA-256", enc.encode(s)));
async function hmac(s: string) {
  const secret = env("POW_SECRET") || "offer-pow:" + env("SUPABASE_SERVICE_ROLE_KEY");
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return hex(await crypto.subtle.sign("HMAC", key, enc.encode(s)));
}
async function newPuzzle() {
  const issued = Math.floor(Date.now() / 1000);
  const salt = hex(crypto.getRandomValues(new Uint8Array(12)).buffer) + "." + issued + ".";
  const challenge = await sha256(salt + Math.floor(Math.random() * POW_MAX));
  return { algorithm: "SHA-256", salt, challenge, max: POW_MAX, signature: await hmac(challenge) };
}
// deno-lint-ignore no-explicit-any
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

// plain text only: transactional, so Gmail keeps it out of Promotions (no HTML part)
async function send(to: string, subject: string, text: string, replyTo?: string) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${env("RESEND_API_KEY")}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: env("MAIL_FROM"), to, subject, text, ...(replyTo ? { reply_to: replyTo } : {}) }),
  });
  if (!res.ok) console.error("Resend", res.status, await res.text());
  return res.ok;
}

// Stripe's API takes form encoding with brackets (as create-checkout)
function form(obj: Record<string, unknown>, prefix = "", out = new URLSearchParams()) {
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null) continue;
    const key = prefix ? `${prefix}[${k}]` : k;
    if (typeof v === "object") form(v as Record<string, unknown>, key, out);
    else out.append(key, String(v));
  }
  return out;
}
async function stripe(path: string, body?: Record<string, unknown>) {
  const headers: Record<string, string> = { Authorization: `Bearer ${env("STRIPE_SECRET_KEY")}` };
  if (body) headers["Content-Type"] = "application/x-www-form-urlencoded";
  const res = await fetch(`https://api.stripe.com/v1/${path}`, { method: body ? "POST" : "GET", headers, body: body ? form(body) : undefined });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Stripe ${res.status}: ${data?.error?.message ?? "error"}`);
  return data;
}
const mediaUrl = (key: string | null) => {
  if (!key) return undefined;
  if (/^https:\/\//.test(key)) return key;
  return `${(env("MEDIA_BASE_URL") || "https://media.highmuzik.com").replace(/\/$/, "")}/${key}`;
};

Deno.serve(async (req) => {
  const origin = allowedOrigin(req.headers.get("origin"));
  const cors: Record<string, string> = origin
    ? { "Access-Control-Allow-Origin": origin, "Access-Control-Allow-Methods": "GET, POST, OPTIONS", "Access-Control-Allow-Headers": "content-type", Vary: "Origin" }
    : {};
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

  if (req.method === "OPTIONS") return new Response(null, { status: origin ? 204 : 403, headers: cors });
  if (!origin) return json({ error: "Not allowed." }, 403);
  if (req.method === "GET") return json(await newPuzzle());
  if (req.method !== "POST") return json({ error: "Use POST." }, 405);
  for (const k of ["RESEND_API_KEY", "MAIL_FROM"]) if (!env(k)) return json({ error: "Offers not configured." }, 500);
  if (Number(req.headers.get("content-length") || 0) > 8000) return json({ error: "Too long." }, 413);

  // deno-lint-ignore no-explicit-any
  let b: any;
  try { b = await req.json(); } catch { return json({ error: "Bad request." }, 400); }
  const db = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false } });
  const pub = createClient(env("SUPABASE_URL"), env("SUPABASE_ANON_KEY"), { auth: { persistSession: false } });
  const store = env("STORE_NAME") || "HIGHMUZIK";
  const shop = (env("SHOP_URL") || origin).replace(/\/$/, "");

  // ── a new offer ──────────────────────────────────────────────────────────
  if (b.action === "submit") {
    if (clip(b.website, 200)) return json({ ok: true });   // honeypot: pretend it went through
    const pow = await checkPuzzle(b.pow);
    if (pow === "fast") return json({ ok: true });
    if (pow !== "ok") return json({ error: "Check failed. Reload the page and try again." }, 403);
    const listing = String(b.listing ?? "");
    // whole euros or with cents ("25", "25,50", "25.5")
    const amountText = clip(b.amount, 12).replace(/\s|€/g, "").replace(",", ".");
    const amount = /^\d+(\.\d{1,2})?$/.test(amountText) ? Math.round(Number(amountText) * 100) : NaN;
    const country = clip(b.country, 2).toUpperCase();
    const email = clip(b.email, 254);
    if (!UUID.test(listing) || !/^[A-Z]{2}$/.test(country) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: "Missing or invalid fields." }, 422);
    if (!(amount > 0) || amount > MAX_OFFER_CENTS) return json({ error: "amount" }, 422);
    const { data: r, error } = await db.rpc("offer_submit", { p_listing: listing, p_amount: amount, p_country: country, p_email: email, p_note: clip(b.note, 1000) });
    if (error) { console.error(error); return json({ error: "Could not send." }, 500); }
    if (r.result === "unavailable") return json({ error: "unavailable" }, 409);
    if (r.result === "too_many") return json({ error: "too_many" }, 429);
    const link = `${origin}/offer/confirm/?t=${r.token}`;
    const text = [`You offered ${euro(amount)} for ${r.name}, shipping to ${countryName(country)} not included.`, "",
      `Confirm it here: ${link}`, "", "The link works for 24 hours. Your offer reaches me only after you confirm it.",
      "If it wasn't you, ignore this email.", "", store].join("\n");
    const sent = await send(email, `Please confirm your email: ${r.name}`, text);
    if (!sent) return json({ error: "Could not send the email." }, 502);
    return json({ ok: true });
  }

  // ── the confirmation link of the email ───────────────────────────────────
  if (b.action === "confirm") {
    const token = String(b.token ?? "");
    if (!TOKEN.test(token)) return json({ result: "invalid" });
    const { data: r, error } = await db.rpc("offer_confirm", { p_token: token });
    if (error) { console.error(error); return json({ error: "Could not confirm." }, 500); }
    if (r.result === "confirmed" && r.first) {
      const to = env("ORDERS_TO") || env("OFFER_TO");
      if (to) {
        const admin = (env("ADMIN_URL") || "https://admin.highmuzik.com").replace(/\/$/, "");
        const text = [`New offer: ${euro(r.amount_cents)} for ${r.name} (SKU ${r.sku})`, "",
          `Ships to: ${countryName(r.country)}`, `From: ${r.email}`, ...(r.note ? ["", `“${r.note}”`] : []), "",
          `Accept or decline: ${admin}/#offers`, `The record: ${shop}/products/${r.slug}/`, "",
          "Reply to this email to write to the buyer."].join("\n");
        await send(to, `New offer: ${r.name}`, text, r.email);
      }
    }
    return json({ result: r.result, name: r.name, slug: r.slug, amount_cents: r.amount_cents });
  }

  // ── the email link of an accepted offer ──────────────────────────────────
  // pay-info: the page /offer/pay/ (since 0186 it puts the record in the Bag, whose checkout is create-checkout; since
  // 0188 without sign-in) and the Bag, which prices an offer line by its token. pay: the single-record Stripe Checkout of 0158, no longer called by the shop; kept for a page
  // still open in a tab during the deploy.
  if (b.action === "pay-info" || b.action === "pay") {
    const token = String(b.token ?? "");
    if (!TOKEN.test(token)) return json({ state: "invalid" });
    const { data: info, error } = await db.rpc("offer_pay_info", { p_token: token });
    if (error) { console.error(error); return json({ error: "Could not read the offer." }, 500); }
    // listing: the page puts the copy in the Bag (0186, 0188)
    const view = { state: info.state, name: info.name, slug: info.slug, amount_cents: info.amount_cents, country: info.country,
      listing_id: info.listing_id,
      expires_at: info.expires_at, format: info.format, weight_g: info.weight_g, image: mediaUrl(info.photo_key) };
    if (b.action === "pay-info") return json(view);
    if (info.state !== "ready") return json(view, 409);
    if (!env("STRIPE_SECRET_KEY") || !Shipping) return json({ error: "Checkout not configured." }, 500);

    const country = clip(b.country, 2).toUpperCase();
    if (!/^[A-Z]{2}$/.test(country)) return json({ error: "Bad request." }, 400);
    try {
      // the earlier session of this offer (Back from Stripe, a second tab): expire it, so only one can be paid
      if (info.session && SESSION.test(info.session)) {
        // deno-lint-ignore no-explicit-any
        const s: any = await stripe(`checkout/sessions/${info.session}`).catch(() => ({ status: "expired" }));
        if (s.status === "complete") return json({ ...view, state: "paid" }, 409);
        if (s.status === "open") await stripe(`checkout/sessions/${info.session}/expire`, {}).catch(() => {});
        await db.rpc("checkout_end", { p_session: info.session, p_status: "expired" });
      }
      const { data: settings, error: settingsError } = await pub.from("shipping_settings").select("config").single();
      if (settingsError) throw new Error(`shipping_settings: ${settingsError.message}`);
      const est = Shipping.estimate(settings?.config, [{ format: info.format, weight_g: info.weight_g }], country);
      if (est.status !== "ok") return json({ error: "shipping", status: est.status }, 422);
      const services = [...new Set(est.parcels.map((p: { rate: { service: string } }) => p.rate.service))].join(" + ");
      const session = await stripe("checkout/sessions", {
        mode: "payment",
        payment_intent_data: { capture_method: "manual" },
        success_url: `${origin}/checkout/thanks/?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${origin}/offer/pay/?t=${token}`,
        expires_at: Math.floor(Date.now() / 1000) + SESSION_MINUTES * 60,
        locale: "en",
        billing_address_collection: "auto",
        shipping_address_collection: { allowed_countries: [country] },
        shipping_options: [{ shipping_rate_data: { type: "fixed_amount", display_name: (services || "Shipping").slice(0, 100),
          fixed_amount: { amount: est.price_cents, currency: "eur" } } }],
        line_items: [{ quantity: 1, price_data: { currency: "eur", unit_amount: info.amount_cents,
          product_data: { name: `${info.name} (your accepted offer)`.slice(0, 250), images: mediaUrl(info.photo_key) ? [mediaUrl(info.photo_key)] : undefined,
            metadata: { listing_id: info.listing_id } } } }],
        metadata: { country, offer_id: info.offer_id },
      });
      const { data: opened, error: openError } = await db.rpc("offer_pay_open", { p_token: token, p_session: session.id });
      if (openError || !opened) {
        await stripe(`checkout/sessions/${session.id}/expire`, {}).catch(() => {});
        if (openError) throw new Error(`offer_pay_open: ${openError.message}`);
        return json({ ...view, state: "expired" }, 409);
      }
      return json({ url: session.url });
    } catch (e) {
      console.error(e);
      return json({ error: "Could not start the checkout." }, 502);
    }
  }

  return json({ error: "Bad request." }, 400);
});
