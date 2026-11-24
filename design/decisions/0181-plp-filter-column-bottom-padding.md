# 0181 — PLP filter column: bottom padding above the open player

`2026-11-24` · accepted (Gio: "aggiungi un po' di padding bottom alla sezione dei filtri sulle PLP … se c'è il player aperto le ultime voci non si vedono") · Figma: page `PLP` → `filters` instances in the PLP grids (desktop, filtered, collection, paginated): paddingBottom bound to `medium-small`; note `note: filter column padding`

**Context.** The desktop filter column is sticky and scrolls on its own (Gio 2026-11-10); its height already stops at the open player (`--site-player-height`, set by `scripts/site.js`). Scrolled to its end, the last option sat flush on the player edge and its focus ring was clipped by the scroller, so it read as hidden behind the player.
**Decision.** `.plp-filters` gets `padding-bottom: var(--medium-small)` (16): the last option always ends 16 px above the player (or the window edge when the player is closed). Only on the PLP column, not in the `filters` component (the admin Drafts column is not sticky). The player height stays a measured variable, never a fixed number.
**Rule.** A sticky column that scrolls on its own ends with `medium-small` padding inside the scroller, and its height subtracts `--site-player-height` while the player is open.
**Where.** `apps/storefront/plp.css` (`.plp-filters`); Figma `PLP`.
