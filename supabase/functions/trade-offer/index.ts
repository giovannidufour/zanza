// supabase/functions/trade-offer — a trade offer from the storefront (decision 0068, Figma page `Trade`).
// The offer page (/products/<slug>/offer/) posts JSON here; the function checks it and emails it to Gio, with the
// trader's address as Reply-To, so he answers personally. Nothing is stored (MVP: no table, no migration).
// Called by the browser: deploy with Verify JWT OFF; abuse limits = allowed origins, honeypot, size caps, the listing
// must be an available trade copy.
// Secrets (Supabase → Edge Functions → Secrets): RESEND_API_KEY, MAIL_FROM, SHOP_URL, STORE_NAME (shared with
// notify-back-in-stock) + OFFER_TO (Gio's address, never in code). Optional ALLOWED_ORIGINS: comma-separated extra
// origins (e.g. a preview URL). SUPABASE_URL and SUPABASE_ANON_KEY are set by Supabase.
const env = (k: string) => Deno.env.get(k) ?? "";
const escapeHtml = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));

const GRADES = ["M", "NM", "NM-", "EX+", "EX", "EX-", "VG+", "VG", "VG-", "G+", "G", "G-", "F"];
const CHANNELS: Record<string, string> = {
  discogs: "Discogs messages", instagram: "Instagram DM", email: "Email", "in-person": "In person, at one of my gigs",
};
const MAX_RECORDS = 5;

function allowedOrigin(origin: string | null) {
  if (!origin) return null;
  const shop = env("SHOP_URL").replace(/\/$/, "");
  const extra = env("ALLOWED_ORIGINS").split(",").map((s) => s.trim()).filter(Boolean);
  let host = "";
  try { host = new URL(shop).host; } catch { /* no shop url */ }
  // the shop, its Cloudflare Pages branch previews (<branch>.<project>.pages.dev), and the listed extras
  if (origin === shop || extra.includes(origin)) return origin;
  if (host.endsWith(".pages.dev") && /^https:\/\/[a-z0-9-]+\./.test(origin) && origin.endsWith("." + host)) return origin;
  return null;
}

const clip = (v: unknown, max: number) => String(v ?? "").trim().slice(0, max);

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
  for (const k of ["RESEND_API_KEY", "MAIL_FROM", "SHOP_URL", "OFFER_TO"]) if (!env(k)) return json({ error: "Offers not configured." }, 500);
  if (Number(req.headers.get("content-length") || 0) > 20000) return json({ error: "Too long." }, 413);

  // deno-lint-ignore no-explicit-any
  let b: any;
  try { b = await req.json(); } catch { return json({ error: "Bad request." }, 400); }
  if (clip(b.website, 200)) return json({ ok: true });   // honeypot: pretend it went through

  const slug = clip(b.listing, 200);
  const records = (Array.isArray(b.records) ? b.records : []).slice(0, MAX_RECORDS).map((r: Record<string, unknown>) => ({
    record: clip(r.record, 300), media: clip(r.media, 4), sleeve: clip(r.sleeve, 4),
  }));
  const offer = {
    pitch: clip(b.pitch, 2000), about: clip(b.about, 2000),
    discogs: clip(b.discogs, 100), instagram: clip(b.instagram, 100),
    channel: CHANNELS[clip(b.channel, 20)] ? clip(b.channel, 20) : "email",
    email: clip(b.email, 200),
  };
  const bad = !slug || !records.length || records.some((r: { record: string; media: string; sleeve: string }) =>
      !r.record || !GRADES.includes(r.media) || (r.sleeve && r.sleeve !== "none" && !GRADES.includes(r.sleeve))) ||
    !offer.about || !(offer.discogs || offer.instagram) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(offer.email);
  if (bad) return json({ error: "Missing or invalid fields." }, 422);

  // the listing must be a trade copy that is open to offers (public view, migration 0004)
  const q = `${env("SUPABASE_URL")}/rest/v1/listing_availability?select=slug,section,status&slug=eq.${encodeURIComponent(slug)}`;
  const lr = await fetch(q, { headers: { apikey: env("SUPABASE_ANON_KEY"), Authorization: `Bearer ${env("SUPABASE_ANON_KEY")}` } });
  const rows = lr.ok ? await lr.json() : [];
  const listing = rows[0];
  if (!listing || listing.section !== "trade" || listing.status !== "available") return json({ error: "This record is not open to offers." }, 409);

  const shop = env("SHOP_URL").replace(/\/$/, "");
  const href = `${shop}/products/${slug}/`;
  const discogsUrl = offer.discogs ? `https://www.discogs.com/user/${encodeURIComponent(offer.discogs.replace(/^@/, ""))}` : "";
  const igUrl = offer.instagram ? `https://www.instagram.com/${encodeURIComponent(offer.instagram.replace(/^@/, ""))}/` : "";
  const recLine = (r: { record: string; media: string; sleeve: string }, i: number) =>
    `${i + 1}. ${r.record} (record ${r.media}${r.sleeve ? `, cover ${r.sleeve === "none" ? "none" : r.sleeve}` : ""})`;
  const text = [
    `New trade offer for ${href}`,
    "",
    "Offered:", ...records.map(recLine),
    "", `Pitch: ${offer.pitch || "-"}`,
    "", `About them: ${offer.about}`,
    `Discogs: ${discogsUrl || "-"}`, `Instagram: ${igUrl || "-"}`,
    `Talk on: ${CHANNELS[offer.channel]}`, `Email: ${offer.email}`,
    "", "Reply to this email to answer them directly.",
  ].join("\n");
  const link = (u: string) => (u ? `<a href="${escapeHtml(u)}">${escapeHtml(u)}</a>` : "-");
  const html = `<p>New trade offer for <a href="${escapeHtml(href)}">${escapeHtml(href)}</a></p>` +
    `<p><strong>Offered</strong><br>${records.map((r: { record: string; media: string; sleeve: string }, i: number) => escapeHtml(recLine(r, i))).join("<br>")}</p>` +
    `<p><strong>Pitch</strong><br>${escapeHtml(offer.pitch || "-").replace(/\n/g, "<br>")}</p>` +
    `<p><strong>About them</strong><br>${escapeHtml(offer.about).replace(/\n/g, "<br>")}</p>` +
    `<p>Discogs: ${link(discogsUrl)}<br>Instagram: ${link(igUrl)}<br>Talk on: ${escapeHtml(CHANNELS[offer.channel])}<br>Email: ${escapeHtml(offer.email)}</p>` +
    `<p>Reply to this email to answer them directly.</p>`;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${env("RESEND_API_KEY")}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: env("MAIL_FROM"), to: env("OFFER_TO"), reply_to: offer.email,
      subject: `Trade offer: ${slug} (${offer.discogs || offer.instagram})`, text, html,
    }),
  });
  if (!res.ok) return json({ error: "Could not send." }, 502);
  return json({ ok: true });
});
