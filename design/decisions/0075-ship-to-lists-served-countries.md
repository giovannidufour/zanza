# 0075 — "Ship to" lists only the countries the shop ships to

`2026-11-14` · accepted (Gio: "È inutile mettere la lista completa dei countries per il calculate shipping. Vorrei nel menu della select mostrare solo quelli disponibili") · Figma: page `Bag` → `bag summary` (2201:4454), unchanged (it draws the closed select only)

**Context.** The bag's "Ship to" select offered every ISO country (~250), and most of them led to "We don't ship to … yet".
**Decision.** The options are the countries of the zones that have at least one rate, read from the shipping config (admin page Shipping) at build time: one source, so a country added to a zone appears with the next storefront build (the Pages deploy hook already rebuilds when the settings change). Names from `Intl`, sorted by name; codes outside the ISO list are dropped. Default Germany, else the first country. No served country = no select, "Calculated at checkout", as without rates.
**Consequence.** `bag summary` destination=not served is no longer reachable from the select: it stays as the fallback for a config change that is not yet built (open point in `design/open.md`).
**Rule.** A select whose options depend on configured data lists only what the configuration can serve, derived from that configuration; never a hand-kept or full reference list.
**Where.** `apps/storefront/data/shipping.js` (`countries(config)`), `apps/storefront/pages/bag.js`, `apps/storefront/build.js`. Amends 0057.
