# 0038 — Mobile filters: a full-screen layer with nested levels; ticks are a draft until Apply

`2026-11-10` · accepted (Gio) · Figma: page `filters` → `filters layer` (2148:6123), `filter facet` (2148:5811), `PLP header` (2147:25377), `filter` device=mobile, `entity chip` size=large; flow on page PLP, frames "PLP - mobile / …"

**Context.** The PLP filter column does not fit a phone; mobile had no filters (0028).
**Decision.** On mobile, `PLP header` ("Filter" + the number of applied filters as suffix, and the sort) opens a full-screen layer (Gio: nested levels, not an accordion). Level main: an "Applied" recap (every applied filter as a large entity chip, removable) and one row per facet showing what is ticked; a row opens that facet's level (back, title = the facet, its options). Reset and Apply are on every level, sticky at the bottom on `surface-accent`; Apply carries the number of records as suffix (0029). The ticks are a draft: the list changes only on Apply; close, Esc and Back-to-page discard it; Reset clears the draft and keeps the layer open. Mobile rows are bigger for touch: `filter` device=mobile (24px box, body/medium, 40px row: Gio accepts < 44), entity chip large (44px). Sort: a native select drawn as a button, on mobile in `PLP header`, on desktop at the top of the filter column ("Sort: Newest", Gio).
**Rule.** A shop control that opens a choice list is a native `<select>` drawn as a Button (`SelectButton`). A mobile multi-step picker is a native modal `<dialog>` whose changes are a draft confirmed by an explicit Apply. Counts next to labels are suffixes (0029).
**Where.** `packages/ui` `FiltersLayer`, `FilterFacet`, `PlpHeader`, `SelectButton`, `Button` `suffix`, `EntityChip` `size`, `Filter` (responsive); `apps/storefront/pages/plp.js`, `plp.css`, `scripts/site.js`.

**Update 2026-11-10 (Gio).** The layer title on level main is "Filter", the same word as the trigger.
