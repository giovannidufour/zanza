# 0097 — Favicon = the logo illustration, on every site

`2026-11-15` · accepted, grounds refined by 0127 · Figma: none (the logo is the existing `apps/storefront/public/logo.png`)

**Context.** Gio (2026-11-15) wants the logo illustration as the favicon on all sites: shop, admin, coming-soon. The logo is black line art on a transparent background, so on a dark browser tab it would disappear.
**Decision.** Three files next to the logo, generated from it: `favicon.svg` (the logo inside an SVG that inverts it to white when the browser is in dark mode; Chrome, Firefox, Edge), `favicon-32.png` (transparent fallback, Safari) and `apple-touch-icon.png` (180 px, logo on a white square with ~10% padding, because iOS fills transparent icons with black). Shop and coming-soon serve them from `/assets/`, the admin copies them into its `dist/`.
**Rule.** The favicon is always derived from the logo; when the logo changes, regenerate the three files from it. No other colours or shapes: white is used only where the platform needs an opaque icon (iOS).
**Where.** `apps/storefront/public/favicon*`, `apple-touch-icon.png`; `<head>` in `apps/storefront/build.js`, `build-coming-soon.js`, `apps/admin/index.html` (+ copy in `apps/admin/build.js`). PR #106 (SEO, not merged) adds its own `<link rel="icon">` to logo.png: when merging it, keep these three links instead.
