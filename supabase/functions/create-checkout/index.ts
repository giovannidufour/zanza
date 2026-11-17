// supabase/functions/create-checkout — the Bag's Checkout button (_context/backend.md → Checkout con hold, migration 0021).
// POST { ids: [listing uuid], country: "DE" }           → { url } of a Stripe Checkout session, or an error below
// POST { ids, country, previous: "cs_…" }               → same; the buyer's earlier session is ended first (below)
// POST { action: "cancel", session: "cs_…" }             → the buyer came back from Stripe without paying (cancel_url,
//                                                          browser Back, Bag opened again): the session is expired and
//                                                          its copies are free again at once → { released, paid?, kept? }
// Steps: hold the copies (all or nothing, 33 min) → minimum order and shipping from the DB with packages/shipping
// (./shipping.js is a COPY, refreshed by `node supabase/scripts/sync-functions.js`) → Stripe session (expires in 31 min,
// before the hold ends, so a copy can never be paid after someone else got it) → the hold gets the session id.
// Prices always come from the DB, never from the browser. Any failure after the hold releases it.
// Errors: 409 { error: "unavailable", unavailable: [ids] } · 422 { error: "below_minimum", missing_cents } ·
//         422 { error: "shipping", status } (not-served, too-heavy, not-configured) · 4xx/5xx { error }.
// Called by the browser: deploy with Verify JWT OFF; allowed origins as trade-offer (SHOP_URL, ALLOWED_ORIGINS, pages.dev).
// Secrets: STRIPE_SECRET_KEY (sk_test_… until launch), SHOP_URL, optional ALLOWED_ORIGINS, MEDIA_BASE_URL
// (default https://media.rythem-works.com). SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and SUPABASE_ANON_KEY are set by Supabase.
import { createClient } from "npm:@supabase/supabase-js@2.45.4";
import "./shipping.js";

// deno-lint-ignore no-explicit-any
const Shipping = (globalThis as any).ZanzaShipping;
const env = (k: string) => Deno.env.get(k) ?? "";
const HOLD_MINUTES = 33;
const SESSION_MINUTES = 31;   // Stripe's minimum is 30
const MAX_RECORDS = 50;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
  return `${(env("MEDIA_BASE_URL") || "https://media.rythem-works.com").replace(/\/$/, "")}/${key}`;
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
  // The copies are freed ONLY when Stripe confirms the session can no longer be paid (expired), or does not know it:
  // a session that is complete (paid, or an async payment still processing) or that we cannot check keeps its hold,
  // which ends by itself (webhook, or effective_status after 33 min). Never a copy freed while someone can pay it.
  // deno-lint-ignore no-explicit-any
  async function endSession(session: string): Promise<{ released: number; paid?: boolean; kept?: boolean }> {
    // deno-lint-ignore no-explicit-any
    let s: any;
    try { s = await stripe(`checkout/sessions/${session}`); } catch (e) {
      if (!/Stripe 404/.test(String(e))) return { released: 0, kept: true };   // Stripe unreachable: keep the hold
      s = { status: "expired" };   // unknown to Stripe: nothing can be paid
    }
    if (s.status === "open") {
      try { s = await stripe(`checkout/sessions/${session}/expire`, {}); }
      catch { s = await stripe(`checkout/sessions/${session}`).catch(() => ({ status: "unknown" })); }
    }
    if (s.status === "complete") return { released: 0, paid: true };
    if (s.status !== "expired") return { released: 0, kept: true };
    const { data: n } = await db.rpc("checkout_release", { p_key: session });
    return { released: n ?? 0 };
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

  // the buyer's own earlier session (Checkout pressed again): end it first, so its copies are not "Reserved" for them
  const previous = String(b.previous ?? "");
  if (SESSION.test(previous)) {
    const ended = await endSession(previous);
    if (ended.paid) return json({ error: "already_paid", session: previous }, 409);
  }

  const token = `hold:${crypto.randomUUID()}`;
  const { data: held, error: holdError } = await db.rpc("checkout_hold", { p_ids: ids, p_token: token, p_minutes: HOLD_MINUTES });
  if (holdError) return json({ error: "Could not reserve the records." }, 500);
  if (!held || held.length !== ids.length) {
    // which ones are gone (sold, reserved by another checkout, no longer public): the Bag marks them
    const { data: rows } = await pub.from("listing_availability").select("id, status").in("id", ids);
    const free = new Set((rows ?? []).filter((r: { status: string }) => r.status === "available").map((r: { id: string }) => r.id));
    return json({ error: "unavailable", unavailable: ids.filter((id) => !free.has(id)) }, 409);
  }
  const release = () => db.rpc("checkout_release", { p_key: token });

  try {
    // deno-lint-ignore no-explicit-any
    const copies = held as any[];
    const { data: settings, error: settingsError } = await pub.from("shipping_settings").select("config").single();
    if (settingsError) throw new Error(`shipping_settings: ${settingsError.message}`);
    const config = settings?.config;
    const subtotal = copies.reduce((sum, c) => sum + c.price_cents, 0);

    const min = Shipping.minimumOrder(config, subtotal);
    if (!min.ok) { await release(); return json({ error: "below_minimum", min_cents: min.min_cents, missing_cents: min.missing_cents }, 422); }

    const est = Shipping.estimate(config, copies.map((c) => ({ format: c.format, weight_g: c.weight_g })), country);
    if (est.status !== "ok") { await release(); return json({ error: "shipping", status: est.status }, 422); }
    const services = [...new Set(est.parcels.map((p: { rate: { service: string } }) => p.rate.service))].join(" + ");
    const parcels = est.parcels.length > 1 ? ` (${est.parcels.length} parcels)` : "";

    const session = await stripe("checkout/sessions", {
      mode: "payment",
      client_reference_id: token,
      success_url: `${origin}/checkout/thanks/?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/bag/?checkout=cancelled`,
      expires_at: Math.floor(Date.now() / 1000) + SESSION_MINUTES * 60,
      locale: "en",
      billing_address_collection: "auto",
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
          product_data: { name: c.name.slice(0, 250), images: mediaUrl(c.photo_key) ? [mediaUrl(c.photo_key)] : undefined, metadata: { listing_id: c.id } },
        },
      })),
      // the listing ids travel on each line (product metadata): stripe-webhook reads them back from the line items
      metadata: { country },
    }, token);

    const { data: attached } = await db.rpc("checkout_attach", { p_token: token, p_session: session.id });
    if (attached !== copies.length) {
      await stripe(`checkout/sessions/${session.id}/expire`, {}).catch(() => {});
      await release();
      return json({ error: "unavailable", unavailable: [] }, 409);
    }
    return json({ url: session.url, session: session.id });
  } catch (e) {
    console.error(e);
    await release();
    return json({ error: "Could not start the checkout." }, 502);
  }
});
