# 0167 — Home: Recent shows 12 records, then "View all for sale" full width

`2026-11-24` · proposed (Gio: "voglio più dischi nella home, e in fondo un pulsante tipo view all full width della grid che va a for sale") · amends [0120](0120-home-v2.md) · Figma: page `Home` → `home shelf` gets two booleans, `more records` (tiles / cards 7–12) and `view all` (the PDP's `view all` button, fill), both ON in the component, ON in `recent`, OFF in `this week`; note `home behaviour` updated

**Context.** The home showed at most 12 records (This week 6 + Recent 6), then nothing pointed to the rest of the shop except the small "See all" in each shelf head.
**Decision.**
- **Recent** shows the next **12** newest sale records (desktop 4 rows of 3), was 6. This week stays at 6, so the newsletter box keeps its place right after the week's batch. The home now shows up to 18 records.
- Under the last shelf (Recent; This week when there is no Recent) a **"View all for sale"** secondary large Button, full width of the main column, → `/sale/`. Same component and label as the PDP's `view all` (0119), gap 8 under the tiles (the shelf gap). It sits outside the grid/list views, so it shows in both and on mobile.
**Rule.** A home shelf count is a constant in `home.js` mirrored by the Figma `home shelf` (`SHELF_COUNT` 6, `RECENT_COUNT` 12); the home ends with exactly one full-width "View all for sale", on its last shelf.
**Where.** `apps/storefront/pages/home.js` (`RECENT_COUNT`, Shelf `viewAll`), `apps/storefront/home.css` (`.home-shelf__action`).
