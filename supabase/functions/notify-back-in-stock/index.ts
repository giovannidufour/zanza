// supabase/functions/notify-back-in-stock — "Notify me" (migration 0016): emails the visitors waiting for a copy that is
// available again, then deletes their address. Called by the pg_cron job send_back_in_stock() only when a request is
// due, never by the browser: the caller must send the shared secret (x-notify-secret).
// Deploy with --no-verify-jwt (the cron job has no user session; the secret is the check).
// Secrets (Supabase → Edge Functions → Secrets): NOTIFY_SECRET (same value as the Vault secret
// notify_back_in_stock_secret), RESEND_API_KEY, MAIL_FROM ("Name <address>"), SHOP_URL (e.g. https://store-front-6fx.pages.dev),
// STORE_NAME (the shop's name in the email: provisional, see _context/provisional-names.md).
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set by Supabase.
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const env = (k: string) => Deno.env.get(k) ?? "";
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const escapeHtml = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));

// same rule as public.effective_status (migration 0004): an expired checkout hold counts as available
const isAvailable = (l: { status: string; reserved_until: string | null }) =>
  l.status === "available" || (l.status === "reserved" && !!l.reserved_until && new Date(l.reserved_until) <= new Date());

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "Use POST." }, 405);
  if (!env("NOTIFY_SECRET") || req.headers.get("x-notify-secret") !== env("NOTIFY_SECRET")) return json({ error: "Not allowed." }, 403);
  if (!env("RESEND_API_KEY") || !env("MAIL_FROM") || !env("SHOP_URL")) return json({ error: "Email not configured." }, 500);

  const db = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false } });
  const { data: rows, error } = await db
    .from("back_in_stock")
    .select("id, email, listing:listings(id, slug, status, reserved_until, custom_title, release:releases(artist, title))")
    .is("sent_at", null)
    .limit(50);
  if (error) return json({ error: error.message }, 500);

  const shop = env("SHOP_URL").replace(/\/$/, "");
  const store = env("STORE_NAME") || "the shop";
  let sent = 0;
  for (const row of rows ?? []) {
    // deno-lint-ignore no-explicit-any
    const l = (row as any).listing;
    if (!l || !isAvailable(l)) continue;           // still reserved: wait for the next run
    const name = l.custom_title || [l.release?.artist, l.release?.title].filter(Boolean).join(" - ") || "The record";
    const href = `${shop}/products/${l.slug}/`;
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${env("RESEND_API_KEY")}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: env("MAIL_FROM"),
        to: row.email,
        subject: `It's back: ${name}`,
        text: `${name} is available again at ${store}. It's a single copy, so the first to check out gets it:\n${href}\n\n` +
          `You asked to be told once. We have now deleted your email address.`,
        html: `<p>${escapeHtml(name)} is available again at ${escapeHtml(store)}. It's a single copy, so the first to check out gets it.</p>` +
          `<p><a href="${escapeHtml(href)}">View the record</a></p>` +
          `<p>You asked to be told once. We have now deleted your email address.</p>`,
      }),
    });
    if (!res.ok) {
      await db.from("back_in_stock").update({ last_error: `Resend ${res.status}: ${(await res.text()).slice(0, 300)}` }).eq("id", row.id);
      continue;
    }
    // one email per address and copy: mark, then delete (the address is not kept)
    await db.from("back_in_stock").update({ sent_at: new Date().toISOString() }).eq("id", row.id);
    await db.from("back_in_stock").delete().eq("id", row.id);
    sent++;
  }
  return json({ sent });
});
