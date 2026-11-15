// supabase/functions/stripe-webhook — Stripe tells the shop how a Checkout session ended (migration 0021).
// · checkout.session.completed (paid) / checkout.session.async_payment_succeeded → checkout_complete: order +
//   order_items + copies sold, then two emails (Resend): the order confirmation to the buyer (the contract is made
//   with it, Terms § 2.4) and "New order" to Gio's shop mailbox.
// · checkout.session.expired → checkout_release: the copies are available again.
// The listing ids come from the session's line items (product metadata listing_id, set by create-checkout).
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
    const { data: n } = await db.rpc("checkout_release", { p_key: session.id });
    return json({ ok: true, released: n ?? 0 });
  }
  const paid = (event.type === "checkout.session.completed" && session.payment_status === "paid") ||
    event.type === "checkout.session.async_payment_succeeded";
  if (!paid) return json({ ok: true, ignored: event.type });

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
    payment_intent: typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id ?? "",
  };
  const { data: result, error } = await db.rpc("checkout_complete", { p_session: session.id, p_order: order });
  if (error) { console.error(error); return json({ error: "Could not record the order." }, 500); }   // Stripe retries
  if (!result.created) return json({ ok: true, duplicate: true });

  // ── emails ───────────────────────────────────────────────────────────────
  const store = env("STORE_NAME") || "rythem-works";
  const shop = env("SHOP_URL").replace(/\/$/, "");
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
      "I pack every record by hand and write to you with the tracking number when it ships.",
      "Questions? Just reply to this email.", "", store,
    ].join("\n");
    const html = `<p>Thank you for your order <strong>${ref}</strong>.</p>` +
      `<p><strong>Your records</strong><br>${lines.map((l) => `<a href="${escapeHtml(l.href)}">${escapeHtml(l.text)}</a>`).join("<br>")}</p>` +
      `<p>${totals.map(escapeHtml).join("<br>")}</p>` +
      `<p><strong>Shipping to</strong><br>${address.map(escapeHtml).join("<br>")}</p>` +
      `<p>I pack every record by hand and write to you with the tracking number when it ships.<br>Questions? Just reply to this email.</p>` +
      `<p>${escapeHtml(store)}</p>`;
    await send(order.email, `${store}: order ${ref} confirmed`, text, html);
  }

  const to = env("ORDERS_TO") || env("OFFER_TO");
  if (to) {
    const warn = result.attention ? [`⚠ ${result.attention}`, ""] : [];
    const text = [...warn, `New order ${ref}`, "", ...lines.map((l) => `· ${l.text}  ${l.href}`), "", ...totals, "",
      "Ship to:", ...address, "", `Buyer: ${order.email}`, `Stripe: https://dashboard.stripe.com/${session.livemode ? "" : "test/"}payments/${order.payment_intent}`].join("\n");
    const html = text.split("\n").map(escapeHtml).join("<br>");
    await send(to, `${result.attention ? "⚠ CHECK " : ""}New order ${ref}: ${lines.length} record${lines.length === 1 ? "" : "s"}, ${euro(order.total_cents)}`, text, html);
  }
  return json({ ok: true, order: result.order_id });
});
