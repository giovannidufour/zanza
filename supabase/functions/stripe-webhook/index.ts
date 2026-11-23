// supabase/functions/stripe-webhook — Stripe tells the shop how a Checkout session ended (migrations 0021, 0028).
// First to pay wins (decision 0116): create-checkout holds nothing and Stripe only authorizes the payment.
// · checkout.session.completed / checkout.session.async_payment_succeeded → checkout_claim (all or nothing):
//   - got the copies → order + sold, payment CAPTURED, the other open sessions with those copies expired on Stripe,
//     two emails (Resend): the order confirmation to the buyer (Terms § 2.4) and "New order" to Gio's shop mailbox.
//   - a copy was sold first → nothing sold, the authorization is CANCELLED (the buyer is never charged; a payment
//     method that can't be authorized only, already charged, is refunded), an email to the buyer and a note to Gio.
// · checkout.session.expired → checkout_end (+ checkout_release for a hold made before 0028).
// The listing ids come from the session's line items (product metadata listing_id, set by create-checkout or by `offer`
// for an accepted offer: checkout_claim then charges the offer's amount and closes the other offers, emailed here).
// Called by Stripe, not by the browser: deploy with Verify JWT OFF; the Stripe-Signature header is the check.
// It lives on Supabase, not on the shop's domain: the shop is behind Cloudflare Access until launch.
// Secrets: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET (whsec_… of this endpoint), RESEND_API_KEY, MAIL_FROM, SHOP_URL,
// STORE_NAME, ORDERS_TO (Gio's shop mailbox; falls back to OFFER_TO). SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY by Supabase.
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const env = (k: string) => Deno.env.get(k) ?? "";
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const escapeHtml = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));
const euro = (cents: number) => `€${(cents / 100).toFixed(2).replace(/\.00$/, "")}`;

// Stripe-Signature: t=…,v1=… ; v1 = HMAC-SHA256(secret, `${t}.${raw body}`), max 5 minutes old
async function verify(raw: string, header: string | null) {
  const secret = env("STRIPE_WEBHOOK_SECRET");
  if (!secret || !header) return false;
  const parts = header.split(",").map((p) => p.split("="));
  const t = parts.find(([k]) => k === "t")?.[1];
  const sigs = parts.filter(([k]) => k === "v1").map(([, v]) => v);
  if (!t || !sigs.length || Math.abs(Date.now() / 1000 - Number(t)) > 300) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${t}.${raw}`)));
  const hex = Array.from(mac, (b) => b.toString(16).padStart(2, "0")).join("");
  return sigs.some((s) => s.length === hex.length && [...s].reduce((d, c, i) => d | (c.charCodeAt(0) ^ hex.charCodeAt(i)), 0) === 0);
}

async function stripeGet(path: string) {
  const res = await fetch(`https://api.stripe.com/v1/${path}`, { headers: { Authorization: `Bearer ${env("STRIPE_SECRET_KEY")}` } });
  if (!res.ok) throw new Error(`Stripe ${res.status}`);
  return res.json();
}

async function stripePost(path: string, body: Record<string, string> = {}) {
  const res = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${env("STRIPE_SECRET_KEY")}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Stripe ${res.status}: ${data?.error?.message ?? "error"}`);
  return data;
}

async function send(to: string, subject: string, text: string, html: string) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${env("RESEND_API_KEY")}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: env("MAIL_FROM"), to, subject, text, html }),
  });
  if (!res.ok) console.error("Resend", res.status, await res.text());
}

// deno-lint-ignore no-explicit-any
type Address = Record<string, any>;
const addressLines = (name: string, a: Address) =>
  [name, a.line1, a.line2, [a.postal_code, a.city].filter(Boolean).join(" "), a.state, a.country].filter(Boolean) as string[];

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "Use POST." }, 405);
  const raw = await req.text();
  if (!(await verify(raw, req.headers.get("stripe-signature")))) return json({ error: "Bad signature." }, 400);
  const event = JSON.parse(raw);
  const session = event.data?.object;
  const db = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false } });

  if (event.type === "checkout.session.expired") {
    await db.rpc("checkout_end", { p_session: session.id, p_status: "expired" });
    const { data: n } = await db.rpc("checkout_release", { p_key: session.id });   // legacy hold (0021), if any
    return json({ ok: true, released: n ?? 0 });
  }
  if (event.type !== "checkout.session.completed" && event.type !== "checkout.session.async_payment_succeeded") {
    return json({ ok: true, ignored: event.type });
  }
  const piId = typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id ?? "";
  if (!piId) return json({ ok: true, ignored: "no payment intent" });
  const pi = await stripeGet(`payment_intents/${piId}`);
  // requires_capture = authorized (manual capture, 0028) · succeeded = already charged (a method without authorization,
  // or a session started before 0028) · anything else (processing…) waits for async_payment_succeeded
  if (pi.status !== "requires_capture" && pi.status !== "succeeded") return json({ ok: true, waiting: pi.status });

  // the copies of this session, from the line items (create-checkout puts listing_id on each product)
  const items = await stripeGet(`checkout/sessions/${session.id}/line_items?limit=100&expand[]=data.price.product`);
  // deno-lint-ignore no-explicit-any
  const ids = (items.data as any[]).map((li) => li.price?.product?.metadata?.listing_id).filter(Boolean);
  // shipping address: collected_information (API 2025-03+) or shipping_details (older API versions)
  const ship = session.collected_information?.shipping_details ?? session.shipping_details ?? {};
  const customer = session.customer_details ?? {};
  const shippingCents = session.shipping_cost?.amount_total ?? session.total_details?.amount_shipping ?? 0;
  const order = {
    listing_ids: ids,
    email: customer.email ?? "",
    customer_name: ship.name ?? customer.name ?? "",
    shipping_address: { name: ship.name ?? "", ...(ship.address ?? {}) },
    shipping_country: ship.address?.country ?? session.metadata?.country ?? "",
    shipping_cents: shippingCents,
    subtotal_cents: session.amount_subtotal,
    total_cents: session.amount_total,
    currency: session.currency,
    payment_intent: piId,
  };
  const { data: result, error } = await db.rpc("checkout_claim", { p_session: session.id, p_order: order });
  if (error) { console.error(error); return json({ error: "Could not record the order." }, 500); }   // Stripe retries
  const store = env("STORE_NAME") || "rythem-works";
  const shop = env("SHOP_URL").replace(/\/$/, "");
  const to = env("ORDERS_TO") || env("OFFER_TO");
  const dashboard = `https://dashboard.stripe.com/${session.livemode ? "" : "test/"}payments/${piId}`;

  // ── someone paid first: cancel (or refund), tell the buyer and Gio ───────
  if (result.result === "lost") {
    let note = "";
    try {
      if (pi.status === "requires_capture") await stripePost(`payment_intents/${piId}/cancel`, { cancellation_reason: "abandoned" });
      else if (pi.status === "succeeded") { await stripePost("refunds", { payment_intent: piId }); note = "refunded"; }
    } catch (e) {
      if (!/already|canceled|refunded/i.test(String(e))) { console.error(e); return json({ error: "Could not cancel." }, 500); }   // Stripe retries
    }
    if (pi.status === "requires_capture" || note) {   // first time only: a repeated event finds the PI already cancelled
      if (order.email) {
        const text = [
          "Sorry: someone else bought " + (ids.length > 1 ? "one of these records" : "this record") + " a moment before you.", "",
          note === "refunded" ? "Your payment has been refunded in full." : "Your payment was not taken: the amount reserved on your card or account is released.",
          "", `The rest of the shop is here: ${shop}/sale/`, "", store,
        ].join("\n");
        await send(order.email, `${store}: your order could not be completed`, text, text.split("\n").map(escapeHtml).join("<br>"));
      }
      if (to) {
        const text = [`Lost checkout: ${order.email} paid for ${result.lost.join(", ")} after it was sold.`,
          note === "refunded" ? "The payment was refunded." : "The authorization was cancelled: nothing charged.", "", `Stripe: ${dashboard}`].join("\n");
        await send(to, "Lost checkout (record sold first)", text, text.split("\n").map(escapeHtml).join("<br>"));
      }
    }
    return json({ ok: true, lost: result.lost });
  }

  // ── got the copies: capture, close the other sessions with these copies ──
  let captureNote = "";
  if (pi.status === "requires_capture") {
    try { await stripePost(`payment_intents/${piId}/capture`); } catch (e) {
      if (!/already|succeeded/i.test(String(e))) {
        captureNote = `Payment capture failed (${String(e).slice(0, 120)}): check on Stripe before shipping`;
        console.error(e);
        await db.rpc("checkout_attention", { p_session: session.id, p_note: captureNote });
      }
    }
  }
  const { data: rivals } = await db.rpc("checkout_rivals", { p_session: session.id });
  for (const rival of (rivals ?? []) as string[]) {
    await stripePost(`checkout/sessions/${rival}/expire`).catch(() => { /* already complete or expired */ });
    await db.rpc("checkout_end", { p_session: rival, p_status: "expired" });
  }
  if (!result.created) return json({ ok: true, duplicate: true });
  result.attention = captureNote || null;

  // ── emails ───────────────────────────────────────────────────────────────
  const ref = String(result.order_id).slice(0, 8).toUpperCase();
  // deno-lint-ignore no-explicit-any
  const lines = (result.items as any[]).map((it) => ({ text: `${it.name} — ${euro(it.price_cents)}`, href: `${shop}/products/${it.slug}/` }));
  const totals = [`Records: ${euro(order.subtotal_cents)}`, `Shipping: ${euro(shippingCents)}`, `Total paid: ${euro(order.total_cents)}`];
  const address = addressLines(order.customer_name, order.shipping_address);

  if (order.email) {
    const text = [
      `Thank you for your order ${ref}.`, "",
      "Your records:", ...lines.map((l) => `· ${l.text}`), "", ...totals, "",
      "Shipping to:", ...address, "",
      "I pack every record by hand and post orders at least once a week, usually on Wednesday. You get the tracking number by email when it ships.",
      "Questions? Just reply to this email.", "", store,
    ].join("\n");
    const html = `<p>Thank you for your order <strong>${ref}</strong>.</p>` +
      `<p><strong>Your records</strong><br>${lines.map((l) => `<a href="${escapeHtml(l.href)}">${escapeHtml(l.text)}</a>`).join("<br>")}</p>` +
      `<p>${totals.map(escapeHtml).join("<br>")}</p>` +
      `<p><strong>Shipping to</strong><br>${address.map(escapeHtml).join("<br>")}</p>` +
      `<p>I pack every record by hand and post orders at least once a week, usually on Wednesday. You get the tracking number by email when it ships.<br>Questions? Just reply to this email.</p>` +
      `<p>${escapeHtml(store)}</p>`;
    await send(order.email, `${store}: order ${ref} confirmed`, text, html);
  }

  if (to) {
    const warn = result.attention ? [`⚠ ${result.attention}`, ""] : [];
    const text = [...warn, `New order ${ref}`, "", ...lines.map((l) => `· ${l.text}  ${l.href}`), "", ...totals, "",
      "Ship to:", ...address, "", `Buyer: ${order.email}`, `Stripe: ${dashboard}`].join("\n");
    const html = text.split("\n").map(escapeHtml).join("<br>");
    await send(to, `${result.attention ? "⚠ CHECK " : ""}New order ${ref}: ${lines.length} record${lines.length === 1 ? "" : "s"}, ${euro(order.total_cents)}`, text, html);
  }

  // best offer (0034, decision 0158): the other open offers on the records just sold are closed; tell those buyers
  // deno-lint-ignore no-explicit-any
  for (const o of (result.closed_offers ?? []) as any[]) {
    const text = [`${o.name} has been sold, so your offer of ${euro(o.amount_cents)} is closed. Thanks for it.`, "",
      `Other records: ${shop}/sale/`, "", store].join("\n");
    await send(o.email, `${store}: ${o.name} is sold`, text, text.split("\n").map(escapeHtml).join("<br>"));
  }
  return json({ ok: true, order: result.order_id });
});
