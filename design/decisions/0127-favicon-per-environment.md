# 0127 — The favicon's ground names the environment: live white, staging green, admin cream

`2026-11-22` · accepted (Gio: "sfondi di colore diverso per le favicon dei 3 environment … live bianco, admin beige e staging verde, usa multiply") · Figma: component set `favicon` (page `assets`, 2407:22536), property `environment` = live / staging / admin. Refines 0097

**Context.** Shop, staging and admin all showed the same transparent logo in the browser tab: with several tabs open Gio could not tell the live shop from staging or the admin.
**Decision.**
- One Figma component `favicon`, 64 × 64: layer `background` (full frame, fill bound to a primitive) under layer `logo` (the logo image, 52 × 52 at 6/6, ~10% padding as the iOS icon of 0097) in blend mode **multiply**. The logo PNG is greyscale on white, so multiply drops its white and the lines sit on the ground colour.
- Grounds (existing primitives, no new value): live = `white`, staging = `acid-green` (the shop accent), admin = `scotch-mist` (the admin page ground, 0099).
- Files, exported from the component (export settings on each variant): `favicon-<env>.svg` (logo embedded, `mix-blend-mode: multiply`), `favicon-<env>-32.png`, `apple-touch-icon-<env>.png` (180) in `apps/storefront/public/`. The old `favicon.svg` (dark-mode inversion), `favicon-32.png`, `apple-touch-icon.png` are gone: an opaque ground reads on light and dark tabs, no inversion needed.
- Which one: admin always `admin`; coming-soon always `live` (it only runs on rythem-works.com). The shop is one build served on several hosts (staging.rythem-works.com, *.pages.dev, at launch rythem-works.com), so the HTML carries the `live` icon and an inline script in `<head>` switches the three links to `staging` on any host not in `site.json` → `liveHosts`.
**Rule.** A new environment or site gets a new `environment` variant (background bound to an existing primitive) and its exported files; never a second logo file. When the logo changes, swap the image in the component and re-export all variants.
**Not done.** Admin cream vs live white is a subtle difference at 16–32 px (#fdfbdd vs #ffffff, 1.05:1); the admin is told apart mainly by host and page title. If that is not enough, change the admin variant's ground, not the rule.
**Where.** `apps/storefront/public/favicon-*`, `apple-touch-icon-*`; `apps/storefront/build.js` (faviconLinks), `build-coming-soon.js`, `apps/admin/index.html` + `apps/admin/build.js` (copy), `apps/storefront/site.json` → `liveHosts`.
