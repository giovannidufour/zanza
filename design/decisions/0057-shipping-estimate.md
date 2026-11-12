# 0057 — Shipping: rate tables, max records per package, an estimate in the bag by country

`2026-11-12` · accepted (Gio: "costruisci") · Figma: BACKEND → `Shipping` (2201:4782), Bag → `bag summary` destination=served | not served (2201:4454), `Bag - desktop · country not served` (2201:4524)

**Context.** Shipping depends on destination, weight and parcel size, all driven by the formats and number of records. Gio sells privately from Germany: carrier rate APIs (DHL business) need a contract, aggregators cost a monthly fee. Stripe Checkout fixes its shipping options when the session is created.
**Decision.**
- Rates are tables Gio copies from the carriers' price lists, edited on the admin page Shipping: weight per format, packages (max records **per format**, Gio: "ogni mailer deve avere un massimo di dischi per formato", plus the package's own weight), zones (lists of countries), rates (zone × package × "up to" weight → service + price).
- A parcel is full when Σ records/max of their format reaches 1 (mixed orders share the space). The bag tries every package, in one parcel or several (largest records first), and keeps the cheapest total.
- The bag asks the **country** only (no postcode: German private price lists have no postcode zones), default Germany, remembered. Not served → "Not available", no total, Checkout disabled.
- One implementation, `packages/shipping/shipping.js`, for the bag (estimate), the admin ("Check an order") and create-checkout (the price charged, never the browser's).
- Storage: one `shipping_settings` row with the config as JSON (migration 0015); saving it rebuilds the shop.
**Rule.** A price the shop shows is computed by the same shared function the server charges with; the browser's number is only ever an estimate.
**Where.** `packages/shipping/shipping.js` · `apps/admin/admin.js` (Shipping) · `apps/storefront/pages/bag.js`, `scripts/site.js`, `data/shipping.js` · `packages/ui` BagSummary (`shipTo`, `total`) · `supabase/migrations/20261112000000_shipping.sql`.
