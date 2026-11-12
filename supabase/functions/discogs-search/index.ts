// supabase/functions/discogs-search — Discogs releases for the "Which record" field of the trade offer form (decision 0069).
// GET ?q=<text>   → { results: Release[] } (up to 8 releases)
// GET ?release=<id> → { release: Release | null } (a pasted discogs.com/release/<id> link)
// Release = { id, title: "Artist – Title", meta: "label · catno · year · country · format", thumb, uri }
// Why a function: Discogs search needs a token, which must never reach the browser; one identifying User-Agent.
// Called by the browser: deploy with Verify JWT OFF; abuse limits = allowed origins (as trade-offer), query size, GET only.
// Nothing is stored or cached (Discogs API terms); the page shows "Data from Discogs" under the results.
// Secrets (Supabase → Edge Functions → Secrets): DISCOGS_TOKEN (Gio's personal access token, shared with discogs-lookup),
// SHOP_URL (shared with trade-offer); optional ALLOWED_ORIGINS (comma-separated extra origins).
const env = (k: string) => Deno.env.get(k) ?? "";
const USER_AGENT = "StoreFront/1.0 +https://store-front-6fx.pages.dev";
const MAX_RESULTS = 8;

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

// Discogs disambiguates homonyms with " (2)"
const clean = (s: string) => String(s ?? "").replace(/\s+\(\d+\)(?=$|\s*[-–,])/g, "").trim();
const dash = (s: string) => s.replace(/\s+-\s+/, " – ");
const meta = (parts: unknown[]) => parts.map((p) => String(p ?? "").trim()).filter((p) => p && p !== "0" && p.toLowerCase() !== "none").join(" · ");
const uniq = (a: string[]) => [...new Set(a.filter(Boolean))];

// deno-lint-ignore no-explicit-any
function fromSearch(r: any) {
  const formats = uniq((r.format ?? []).filter((f: string) => !/^vinyl$/i.test(f))).slice(0, 2).join(", ");
  return {
    id: r.id,
    title: dash(clean(r.title)),
    meta: meta([(r.label ?? [])[0], r.catno, r.year, r.country, formats]),
    thumb: r.thumb || "",
    uri: `https://www.discogs.com/release/${r.id}`,
  };
}
// deno-lint-ignore no-explicit-any
function fromRelease(r: any) {
  const artists = (r.artists ?? []).map((a: { name: string; join?: string }, i: number, all: unknown[]) =>
    clean(a.name) + (i < all.length - 1 ? (a.join && a.join !== "," ? ` ${a.join} ` : ", ") : "")).join("");
  const f = (r.formats ?? [])[0] ?? {};
  const formats = uniq([...(f.descriptions ?? [])]).slice(0, 2).join(", ") || (f.name ?? "");
  const label = (r.labels ?? [])[0] ?? {};
  const img = (r.images ?? [])[0] ?? {};
  return {
    id: r.id,
    title: `${artists || "Unknown"} – ${r.title ?? ""}`.trim(),
    meta: meta([clean(label.name), label.catno, r.year, r.country, formats]),
    thumb: img.uri150 || r.thumb || "",
    uri: `https://www.discogs.com/release/${r.id}`,
  };
}

Deno.serve(async (req) => {
  const origin = allowedOrigin(req.headers.get("origin"));
  const cors: Record<string, string> = origin
    ? { "Access-Control-Allow-Origin": origin, "Access-Control-Allow-Methods": "GET, OPTIONS", Vary: "Origin" }
    : {};
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" } });

  if (req.method === "OPTIONS") return new Response(null, { status: origin ? 204 : 403, headers: cors });
  if (req.method !== "GET") return json({ error: "Use GET." }, 405);
  if (!origin) return json({ error: "Not allowed." }, 403);
  const token = env("DISCOGS_TOKEN").trim();
  if (!token) return json({ error: "Search not configured." }, 500);
  const headers = { "User-Agent": USER_AGENT, Accept: "application/vnd.discogs.v2.discogs+json", Authorization: `Discogs token=${token}` };

  const url = new URL(req.url);
  const id = (url.searchParams.get("release") ?? "").trim();
  if (id) {
    if (!/^\d{1,10}$/.test(id)) return json({ error: "Bad release id." }, 400);
    const r = await fetch(`https://api.discogs.com/releases/${id}`, { headers });
    if (r.status === 404) return json({ release: null });
    if (!r.ok) return json({ error: "Discogs error." }, 502);
    return json({ release: fromRelease(await r.json()) });
  }

  const q = (url.searchParams.get("q") ?? "").trim().slice(0, 100);
  if (q.length < 3) return json({ results: [] });
  const s = new URLSearchParams({ q, type: "release", per_page: String(MAX_RESULTS), page: "1" });
  const r = await fetch(`https://api.discogs.com/database/search?${s}`, { headers });
  if (!r.ok) return json({ error: "Discogs error." }, 502);
  const data = await r.json();
  return json({ results: (data.results ?? []).slice(0, MAX_RESULTS).map(fromSearch) });
});
