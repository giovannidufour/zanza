# 0099 — Every admin page sits on cream: new tokens `scotch-mist` + `surface/page`

`2026-11-15` · accepted (Gio: "per tutte le pagine del admin usiamo questo colore: FDFBDD") · Figma: `_primitives/scotch-mist`, `color/surface/page`; every screen frame on the BACKEND pages (Create, Listings, Attributes, Shipping, Memo, Orders) fills with `surface/page`, mode backend

**Context.** Admin pages had two grounds: `surface/accent` (backend = black-a4, a light grey: Listings, Attributes, Memo, Orders) and `surface/base` (white: Create / edit, Shipping, 0032, 0057). Gio wants one cream for all of them.
**Decision.**
- New primitive `scotch-mist` = `#fdfbdd` (nearest Name-that-Color, as `pink-flamingo`).
- New semantic `surface/page` = the ground of a whole page: frontend `accent` (same as `surface/accent`, nothing changes in the shop), backend `scotch-mist`. Scopes frame/shape fill. A new token, not a new value of `surface/accent`: that one also fills fields, header and player, and fields must stay a step darker than the page.
- Code: `html { background: var(--surface-page) }` in `apps/admin/admin.css`; the per-page overrides to `surface-base` / `surface-accent` are gone. The mobile admin menu (and its backdrop) uses `surface-page` too, as the page look.
- Contrast on scotch-mist: `text-strong` 20.0:1, `text-moderate` (black-a56) 4.9:1, on a field (black-a4 over cream) 4.8:1: AA. Red alert box vs the page 4.6:1 (1.4.11 ok). Input error orange `#ff5d16` 2.9:1: fails, as it already did on white (open in `design/open.md`).
**Rule.** A page's ground is `surface/page`, set once on the page (html in code, the screen frame in Figma), never per section. Fields and subtle blocks stay translucent over it. Opaque floating layers (dialog, menus, ActionBar, the mobile bulk bar) stay `surface/base` (white): white on cream is 1.05:1, so they keep their border.
**Not done.** ActionBar / bulk bar on mobile are white bars on a cream page (with top border): kept as Gio set them (0089), to confirm visually.
