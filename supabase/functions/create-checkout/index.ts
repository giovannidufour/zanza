// supabase/functions/create-checkout — the Bag's Checkout button (_context/backend.md → Checkout, migrations 0021 + 0028).
// First to pay wins (decision 0116): starting a checkout holds NOTHING. The copies stay available for everyone while
// the buyer is on Stripe; Stripe only authorizes the payment (capture_method manual) and stripe-webhook captures it
// if the copies are still free when the session completes (checkout_claim), or cancels the authorization if not.
// POST { ids: [listing uuid], country: "DE", previous?: "cs_…", offers?: [pay token] } → { url, session } of a Stripe
//      Checkout session. offers = the tokens of the email links of accepted offers that the Bag keeps (decision 0188, no
//      sign-in): a copy Reserved for one of them counts too, at the offer's amount (checkout_items(ids, tokens), migration
//      0041), and Stripe gets the offer's email (fixed); the offers remember the session (checkout_open_offers, 0040)
//      so checkout_claim lets it buy them. A Bag with an accepted offer has no minimum order (0158: an offer never had one).
// POST { action: "cancel", session: "cs_…" }   → the buyer came back without paying (cancel_url, browser Back, Bag
//                                                opened again): the session is expired on Stripe → { ok, paid? }
// Steps: copies from the DB (checkout_items: all available or nothing) → minimum order and shipping with
// packages/shipping (./shipping.js is a COPY, `npm run sync:functions`) → Stripe session (31 min) → checkout_open.
// Prices always come from the DB, never from the browser.
// Errors: 409 { error: "unavailable", unavailable: [ids] } · 409 { error: "already_paid" } ·
//         422 { error: "below_minimum", missing_cents } · 422 { error: "shipping", status } · 4xx/5xx { error }.
// Called by the browser: deploy with Verify JWT OFF; allowed origins as trade-offer (SHOP_URL, ALLOWED_ORIGINS, pages.dev).
// Secrets: STRIPE_SECRET_KEY (sk_test_… until launch), SHOP_URL, optional ALLOWED_ORIGINS, MEDIA_BASE_URL
// (default https://media.highmuzik.com). SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and SUPABASE_ANON_KEY are set by Supabase.
import { createClient } from "npm:@supabase/supabase-js@2.45.4";
import "./shipping.js";

// deno-lint-ignore no-explicit-any
const Shipping = (globalThis as any).HighmuzikShipping;
const env = (k: string) => Deno.env.get(k) ?? "";
const SESSION_MINUTES = 31;   // Stripe's minimum is 30
const MAX_RECORDS = 50;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TOKEN = /^[0-9a-f]{64}$/;   // an offer's pay_token (0034)

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

// Stripe's API takes form encoding with brackets: line_items[0][price_data][currency]=eur
function form(obj: Record<string, unknown>, prefix = "", out = new URLSearchParams()) {
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null) continue;
    const key = prefix ? `${prefix}[${k}]` : k;
    if (typeof v === "object") form(v as Record<string, unknown>, key, out);
    else out.append(key, String(v));
  }
  return out;
}
async function stripe(path: string, body?: Record<string, unknown>, idempotencyKey?: string) {
  const headers: Record<string, string> = { Authorization: `Bearer ${env("STRIPE_SECRET_KEY")}` };
  if (body) headers["Content-Type"] = "application/x-www-form-urlencoded";
  if (idempotencyKey) headers["Idempotency-Key"] = idempotencyKey;
  const res = await fetch(`https://api.stripe.com/v1/${path}`, { method: body ? "POST" : "GET", headers, body: body ? form(body) : undefined });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Stripe ${res.status}: ${data?.error?.message ?? "error"}`);
  return data;
}

const mediaUrl = (key: string | null) => {
  if (!key) return undefined;
  if (/^https:\/\//.test(key)) return key;   // test data from the seed (absolute URLs)
  return `${(env("MEDIA_BASE_URL") || "https://media.highmuzik.com").replace(/\/$/, "")}/${key}`;
};

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
  if (!env("STRIPE_SECRET_KEY") || !Shipping) return json({ error: "Checkout not configured." }, 500);
  if (Number(req.headers.get("content-length") || 0) > 10000) return json({ error: "Too long." }, 413);

  // deno-lint-ignore no-explicit-any
  let b: any;
  try { b = await req.json(); } catch { return json({ error: "Bad request." }, 400); }
  const db = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false } });
  // public tables (shipping_settings, listing_availability) are read with the anon key: this project grants no table
  // privileges to service_role by default (migration 20261112020000), only the checkout_* functions
  const pub = createClient(env("SUPABASE_URL"), env("SUPABASE_ANON_KEY"), { auth: { persistSession: false } });

  // ── a session of this buyer ends without payment ─────────────────────────
  // Expired on Stripe so it can't be paid any more (nothing is held: this keeps Stripe and checkout_sessions tidy, and
  // frees a hold made before 0028 — checkout_release only frees a session Stripe confirms expired).
  async function endSession(session: string): Promise<{ paid?: boolean; kept?: boolean }> {
    // deno-lint-ignore no-explicit-any
    let s: any;
    try { s = await stripe(`checkout/sessions/${session}`); } catch (e) {
      if (!/Stripe 404/.test(String(e))) return { kept: true };   // Stripe unreachable
      s = { status: "expired" };
    }
    if (s.status === "open") {
      try { s = await stripe(`checkout/sessions/${session}/expire`, {}); }
      catch { s = await stripe(`checkout/sessions/${session}`).catch(() => ({ status: "unknown" })); }
    }
    if (s.status === "complete") return { paid: true };
    if (s.status !== "expired") return { kept: true };
    await db.rpc("checkout_end", { p_session: session, p_status: "expired" });
    await db.rpc("checkout_release", { p_key: session });   // legacy hold (0021), if any
    return {};
  }
  const SESSION = /^cs_(test|live)_[A-Za-z0-9]+$/;

  // ── back from Stripe without paying (cancel_url, the browser's Back, or the Bag opened again) ──
  if (b.action === "cancel") {
    const session = String(b.session ?? "");
    if (!SESSION.test(session)) return json({ error: "Bad session." }, 400);
    return json({ ok: true, ...(await endSession(session)) });
  }

  // ── new checkout ─────────────────────────────────────────────────────────
  const ids: string[] = [...new Set<string>((Array.isArray(b.ids) ? b.ids : []).map(String))].filter((id) => UUID.test(id));
  const country = String(b.country ?? "").toUpperCase();
  if (!ids.length || ids.length > MAX_RECORDS || !/^[A-Z]{2}$/.test(country)) return json({ error: "Bad request." }, 400);

  // the buyer's own earlier session, still open (its end on return failed): end it first, so only one can be paid
  const previous = String(b.previous ?? "");
  if (SESSION.test(previous)) {
    const ended = await endSession(previous);
    if (ended.paid) return json({ error: "already_paid", session: previous }, 409);
  }

  // the email links of accepted offers kept by the Bag (0188)
  const tokens = (Array.isArray(b.offers) ? b.offers : []).map(String).filter((s: string) => TOKEN.test(s)).slice(0, MAX_RECORDS);
  const { data: items, error: itemsError } = await db.rpc("checkout_items", { p_ids: ids, p_tokens: tokens });
  if (itemsError) return json({ error: "Could not read the records." }, 500);
  if (!items || items.length !== ids.length) {
    // which ones are gone (sold, held by hand, no longer public): the Bag marks them
    const { data: rows } = await pub.from("listing_availability").select("id, status").in("id", ids);
    const free = new Set((rows ?? []).filter((r: { status: string }) => r.status === "available").map((r: { id: string }) => r.id));
    return json({ error: "unavailable", unavailable: ids.filter((id) => !free.has(id)) }, 409);
  }

  try {
    // deno-lint-ignore no-explicit-any
    const copies = items as any[];
    const { data: settings, error: settingsError } = await pub.from("shipping_settings").select("config").single();
    if (settingsError) throw new Error(`shipping_settings: ${settingsError.message}`);
    const config = settings?.config;
    const subtotal = copies.reduce((sum, c) => sum + c.price_cents, 0);

    const withOffer = copies.some((c) => c.offer_id);
    const min = Shipping.minimumOrder(config, subtotal);
    if (!min.ok && !withOffer) return json({ error: "below_minimum", min_cents: min.min_cents, missing_cents: min.missing_cents }, 422);

    const est = Shipping.estimate(config, copies.map((c) => ({ format: c.format, weight_g: c.weight_g })), country);
    if (est.status !== "ok") return json({ error: "shipping", status: est.status }, 422);
    const services = [...new Set(est.parcels.map((p: { rate: { service: string } }) => p.rate.service))].join(" + ");
    const parcels = est.parcels.length > 1 ? ` (${est.parcels.length} parcels)` : "";

    const session = await stripe("checkout/sessions", {
      mode: "payment",
      // authorize only: stripe-webhook captures once checkout_claim got the copies, or cancels (never a double charge)
      payment_intent_data: { capture_method: "manual" },
      success_url: `${origin}/checkout/thanks/?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/bag/?checkout=cancelled`,
      expires_at: Math.floor(Date.now() / 1000) + SESSION_MINUTES * 60,
      locale: "en",
      billing_address_collection: "auto",
      // the email of an accepted offer (0188): Stripe shows it fixed, so receipt and order go to the offer's inbox
      ...(copies.find((c) => c.offer_email) ? { customer_email: copies.find((c) => c.offer_email).offer_email } : {}),
      shipping_address_collection: { allowed_countries: [country] },
      shipping_options: [{
        shipping_rate_data: {
          type: "fixed_amount", display_name: `${services || "Shipping"}${parcels}`.slice(0, 100),
          fixed_amount: { amount: est.price_cents, currency: "eur" },
        },
      }],
      line_items: copies.map((c) => ({
        quantity: 1,
        price_data: {
          currency: "eur", unit_amount: c.price_cents,
          product_data: { name: (c.offer_id ? `${c.name} (your accepted offer)` : c.name).slice(0, 250), images: mediaUrl(c.photo_key) ? [mediaUrl(c.photo_key)] : undefined, metadata: { listing_id: c.id } },
        },
      })),
      // the listing ids travel on each line (product metadata): stripe-webhook reads them back from the line items
      metadata: { country },
    });

    const { error: openError } = await db.rpc("checkout_open", { p_session: session.id, p_ids: copies.map((c) => c.id) });
    if (openError) {   // without the bookkeeping, a rival session could not be expired: don't start this one
      await stripe(`checkout/sessions/${session.id}/expire`, {}).catch(() => {});
      throw new Error(`checkout_open: ${openError.message}`);
    }
    const offerIds = copies.filter((c) => c.offer_id).map((c) => c.offer_id);
    if (offerIds.length) {
      const { data: opened, error: offersError } = await db.rpc("checkout_open_offers", { p_session: session.id, p_offers: offerIds });
      if (offersError || opened !== offerIds.length) {   // an offer ran out meanwhile: this session could not buy it
        await stripe(`checkout/sessions/${session.id}/expire`, {}).catch(() => {});
        if (offersError) throw new Error(`checkout_open_offers: ${offersError.message}`);
        return json({ error: "unavailable", unavailable: copies.filter((c) => c.offer_id).map((c) => c.id) }, 409);
      }
    }
    return json({ url: session.url, session: session.id });
  } catch (e) {
    console.error(e);
    return json({ error: "Could not start the checkout." }, 502);
  }
});
