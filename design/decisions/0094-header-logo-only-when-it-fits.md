# 0094 — Header: the logo shows only when everything fits

`2026-11-15` · accepted · Figma: `header` boolean `logo` (default on, bound to the `logo` layer in both variants)

**Context.** With the name "rythem-works" the mobile header no longer fits on a 375px phone (iPhone 13 mini): menu + logo + store name + Bag need ~361px of a 359px row, so the items touch and the page scrolls sideways. Gio: hide the logo and keep only the name on screens that cannot hold everything comfortably.
**Decision.** The header measures its own row: if its visible parts plus an 8px gap between each (the row's own gap) are wider than the row, it sets `data-logo="hidden"` and the logo disappears; the store name always stays. It re-measures when the row or the trailing actions resize (viewport, Bag count) and once the web font has loaded. No breakpoint: the room depends on the store name and on the Bag count, which a fixed width would not follow. Today: logo hidden at ≤ 375px, shown from 390px.
**Rule.** When a header part has to give way for lack of room, the logo goes first; the store name, the menu and Bag never do. Decide by measuring the content, not with a new breakpoint.
**Amendment 2026-11-15 (Gio).** Without the logo the store name sat flush on the bottom rule. `leading actions` gets a min height of store name + 8 (46px) in Figma and code: with the logo (48/64px) nothing changes; without it the name keeps 8px below, as the logo gave it.
**Where.** `packages/ui/components.css` (`.zz-header[data-logo="hidden"]`), `apps/storefront/scripts/site.js` (`fitHeaderLogo`, called from `initHeader`).
