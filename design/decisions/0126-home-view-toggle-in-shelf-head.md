# 0126 — Home view toggle sits in each shelf head, next to "Play all"

`2026-11-22` · accepted (Gio: "nella home il pulsante list view / grid mettilo affianco al play all sia su figma che code", then "fallo poi merge") · amends [0120](0120-home-v2.md) · Figma: page `Home` → `section head` gets a nested `view toggle` instance between `play` and `see all`, boolean `view toggle` (ON in the component); `home shelf` view=list sets it to view=list, device=mobile and both `home newsletter` heads turn it off; the toggle is removed from the side column of `Home - desktop`

**Context.** In 0120 the grid | list toggle sat in the side column under the genres, far from the shelves it switches.
**Decision.** The toggle moves into the actions of every shelf head: Play all · List view / Grid view · See all (gap 8, the existing gap of the actions). Both shelves ("This week", "Recent") carry one; it still switches every shelf on the page and the choice is still remembered in the browser; after a click the focus stays on the toggle of the same shelf. The side column holds only the genres. Mobile is unchanged: no list view, no toggle.
**Rule.** A control that changes how a list is shown sits in that list's section head, next to the list's other actions, not in a side column.
**Where.** `apps/storefront/pages/home.js` (Shelf), `apps/storefront/home.css`, `apps/storefront/scripts/site.js` (focus).
