# 0033 — PDP desktop gallery: images stacked, the column scrolls on its own

`2026-11-10` · accepted · Figma: PDP - desktop `gallery` (2138:1176) in `pdp content`

**Context.** Image 2 at half width (then at full width, 8px below: PR #3, not merged) did not convince Gio. He asked for both images 4 columns wide, 1px apart, with their own vertical scroll, without breaking the layout, and with "you may also like" on a new grid row aligned with the start of image 2. Gio chose "stacked in cols 1–4" over "side by side in cols 1–4 and 5–8", then asked for an 8px gap instead of 1px.
**Decision.** Figma: a vertical auto layout frame `gallery` (itemSpacing → `gutter/small`, clip, overflow vertical) at cols 1–4, rows 1–2; row 1 is FIXED at the image side (330.67 at 1024) so row 2 starts at image 2. Code: `Gallery` desktop is a flex column, gap `gutter-small`, `max-height: var(--zz-gallery-max-height)`, `overflow-y: auto`, no scrollbar, focusable. The PDP makes it sticky (`top: 0`) with max height = window − open site player, and gives row 1 `minmax(image side, auto)` (image side from `100cqw`), so a taller info block pushes row 2 down instead of overlapping. Mobile unchanged (horizontal swipe, 0011).
**Rule.** A scroll area's size limit is set by the page through a custom property, never inside the component (as `--zz-gallery-bleed`); a scroll container without focusable content gets `tabIndex 0`.
**Where.** `packages/ui` Gallery (`components.js`, `components.css`, `components.d.ts`), `apps/storefront/pdp.css`.
