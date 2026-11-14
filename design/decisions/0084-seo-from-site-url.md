# 0084 — SEO: one site URL in config, noindex until launch

`2026-11-14` · accepted · Figma: — (404 page has no frame yet, see open.md)

**Context.** Before launch every page had only a `<title>`. No description, canonical, Open Graph, structured data, sitemap or robots.txt; Cloudflare Pages served the home page with status 200 for any unknown path (soft 404), and the `*.pages.dev` address was indexable. The domain is not bought yet (rythem-trax.com planned, name provisional, Q7). Gio, 2026-11-14: "vai" on the audit's must-haves.
**Decision.**
- `site.json` → `siteUrl` (per target) is the shop's public origin. Empty = not launched: every page `noindex, follow`, `robots.txt` disallows all, no canonical / `og:url` / sitemap. Set = canonical, `og:url`, JSON-LD `url` and `sitemap.xml` all start from it.
- Every page: meta description, Open Graph + Twitter card (PDP image = the cover), favicon (the logo, until a proper icon exists).
- Indexed: PLPs `/sale/` `/trade/` (canonical without query string, so `?genre=` and other filters fold into the clean URL), every PDP (sold too: samples and details stay useful), About, How trading works, Shipping. `noindex, follow`: search results, bag, offer pages, Impressum, Privacy, Terms, Withdrawal, 404.
- PDP of a sale listing: JSON-LD `Product` + `Offer` (EUR, used condition). Availability: available → InStock, reserved → LimitedAvailability (a 30-minute checkout hold), sold → SoldOut. Trade listings get no JSON-LD (no price, no valid Offer).
- Cloudflare Pages only: `_headers` sends `X-Robots-Tag: noindex` on every `*.pages.dev` host, so the shop is indexed only on its own domain; `_redirects` makes `/` a 301 to `/sale/` only while the root is the redirect stub (a real home page turns it off); `404.html` is served with status 404.
**Rule.** Every new page passes `meta` to `page()` in `build.js`: a description, its `path`, and `index: false` if it is a utility, form or personal page. Never write a domain in code: absolute URLs come from `abs()` (= `siteUrl`). A new indexable page is pushed to `indexable` so it lands in the sitemap.
**Where.** `apps/storefront/pages/seo.js` (head tags, PDP description, JSON-LD, sitemap, robots, Pages headers/redirects), `apps/storefront/pages/not-found.js`, `apps/storefront/build.js`, `apps/storefront/site.json` → `siteUrl`.
