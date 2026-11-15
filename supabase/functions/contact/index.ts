// supabase/functions/contact — the contact form of /contact/ (decision 0093: Gio sells privately, no address or phone on
// the site, only email and this form). The page posts JSON { name, email, message, website }; the function emails it to
// Gio (Reply-To = the sender). Nothing is stored.
// Called by the browser: deploy with Verify JWT OFF; abuse limits = allowed origins (as trade-offer), honeypot, size caps.
// Secrets (Supabase → Edge Functions → Secrets): RESEND_API_KEY, MAIL_FROM, SHOP_URL, STORE_NAME (shared with trade-offer)
// + CONTACT_TO (where messages go; falls back to OFFER_TO, Gio's address, never in code). Optional ALLOWED_ORIGINS.
const env = (k: string) => Deno.env.get(k) ?? "";
const escapeHtml = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));
const clip = (v: unknown, max: number) => String(v ?? "").trim().slice(0, max);

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
    ? { "Access-Control-Allow-Origin": origin, "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "content-type", Vary: "Origin" }
    : {};
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

  if (req.method === "OPTIONS") return new Response(null, { status: origin ? 204 : 403, headers: cors });
  if (req.method !== "POST") return json({ error: "Use POST." }, 405);
  if (!origin) return json({ error: "Not allowed." }, 403);
  const to = env("CONTACT_TO") || env("OFFER_TO");
  for (const k of ["RESEND_API_KEY", "MAIL_FROM"]) if (!env(k)) return json({ error: "Contact not configured." }, 500);
  if (!to) return json({ error: "Contact not configured." }, 500);
  if (Number(req.headers.get("content-length") || 0) > 12000) return json({ error: "Too long." }, 413);

  let b: any;
  try { b = await req.json(); } catch { return json({ error: "Bad request." }, 400); }
  if (clip(b.website, 200)) return json({ ok: true });   // honeypot: pretend it went through

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
