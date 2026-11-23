// supabase/functions/offer-decide — admin → Offers: Accept / Decline a pending offer (migration 0034, decision 0158).
// POST { id, accept: true|false } with the admin's session (Verify JWT ON). admin_offer_decide runs AS THE ADMIN (it
// checks is_admin()): accept → the copy goes Reserved for 48 h and the offer gets its payment link; decline → declined.
// Then the email to the buyer: the payment link (SHOP_URL/offer/pay/?t=…) or a polite no. → { ok, status, emailed }.
// Secrets: RESEND_API_KEY, MAIL_FROM, SHOP_URL, STORE_NAME (shared), ADMIN_ORIGINS (as sign-upload).
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const env = (k: string) => Deno.env.get(k) ?? "";
const euro = (cents: number) => `€${(cents / 100).toFixed(2).replace(/\.00$/, "")}`;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const countryName = (code: string) => { try { return new Intl.DisplayNames(["en"], { type: "region" }).of(code) || code; } catch { return code; } };
const berlin = (iso: string) => new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Berlin", weekday: "short", day: "numeric",
  month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(iso)) + " (Berlin time)";

// the admin's origins, as sign-upload: ADMIN_ORIGINS (comma separated), localhost for development
const ALLOWED_ORIGINS = (env("ADMIN_ORIGINS") || "https://admin.rythem-works.com,https://store-admin-3k1.pages.dev").split(",").map((s) => s.trim());
function allowedOrigin(origin: string | null) {
  if (!origin) return null;
  if (ALLOWED_ORIGINS.includes(origin) || /^http:\/\/localhost(:\d+)?$/.test(origin)) return origin;
  return null;
}

Deno.serve(async (req) => {
  const origin = allowedOrigin(req.headers.get("origin"));
  const cors: Record<string, string> = origin
    ? { "Access-Control-Allow-Origin": origin, "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info", Vary: "Origin" }
    : {};
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
  if (req.method === "OPTIONS") return new Response(null, { status: origin ? 204 : 403, headers: cors });
  if (req.method !== "POST") return json({ error: "Use POST." }, 405);
  const auth = req.headers.get("authorization") ?? "";
  if (!auth) return json({ error: "Sign in." }, 401);

  // deno-lint-ignore no-explicit-any
  let b: any;
  try { b = await req.json(); } catch { return json({ error: "Bad request." }, 400); }
  if (!UUID.test(String(b.id ?? "")) || typeof b.accept !== "boolean") return json({ error: "Bad request." }, 400);

  const db = createClient(env("SUPABASE_URL"), env("SUPABASE_ANON_KEY"), { auth: { persistSession: false }, global: { headers: { Authorization: auth } } });
  const { data: r, error } = await db.rpc("admin_offer_decide", { p_offer: b.id, p_accept: b.accept });
  if (error) return json({ error: error.message }, error.code === "42501" ? 403 : 409);

  const store = env("STORE_NAME") || "rythem-works";
  const shop = env("SHOP_URL").replace(/\/$/, "");
  let text: string, subject: string;
  if (r.status === "accepted") {
    subject = `${r.name}: you can buy it now`;
    text = [`I accept your offer of ${euro(r.amount_cents)} for ${r.name}.`, "",
      `Pay here by ${berlin(r.expires_at)}: ${shop}/offer/pay/?t=${r.pay_token}`, "",
      `Shipping to ${countryName(r.country)} is added at checkout. The record is held for you until then; after that it goes back on sale.`,
      "", "Questions? Just reply to this email.", "", store].join("\n");
  } else {
    subject = `${r.name}: my answer`;
    text = [`Thanks for your offer of ${euro(r.amount_cents)} for ${r.name}. This time I'll pass.`, "",
      `Other records: ${shop}/sale/`, "", store].join("\n");
  }
  let emailed = false;
  if (env("RESEND_API_KEY") && env("MAIL_FROM")) {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${env("RESEND_API_KEY")}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: env("MAIL_FROM"), to: r.email, subject, text }),
    });
    emailed = res.ok;
    if (!res.ok) console.error("Resend", res.status, await res.text());
  }
  return json({ ok: true, status: r.status, expires_at: r.expires_at ?? null, emailed });
});
