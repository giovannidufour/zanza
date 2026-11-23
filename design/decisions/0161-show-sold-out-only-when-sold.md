# 0161 — "Show sold out" only when the page has a sold record

`2026-11-23` · accepted · Figma: `filters` (2052:16051) and `filters layer` (2148:6123) new boolean `show sold out` (ON in the main components, bound to the `show sold out` row)

**Context.** Gio (2026-11-23): there are no sold records yet, so the "Show sold out" tick (0061) in the filters does nothing and is noise.
**Decision.**
- The tick (filter column and mobile filter layer) is rendered only when at least one record on that page is sold or traded. Pages: For sale, Search, Catalog, Wantlist, For trade.
- Build-time check: the shop rebuilds when a listing's sale state changes (`_context/backend.md` → Pubblicazione), so the tick comes back by itself with the first sold record.
- Behaviour with the tick is unchanged (0061: ticked by default, `?sold=hide`, Reset ticks it again). Without it, `?sold=hide` is ignored (nothing to hide).
**Rule.** A filter control appears only when it can change the list on that page.
**Where.** `apps/storefront/pages/plp.js` (`showSold`); `scripts/site.js` already handles a missing tick.
