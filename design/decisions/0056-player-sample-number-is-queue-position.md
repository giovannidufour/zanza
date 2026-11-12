# 0056 — The player's sample number is the sample's position in the queue

`2026-11-12` · accepted (Gio) · Figma: `player` → `sample number` (335:5078)

**Context.** The player showed the sample's `track_position` from the DB: `A`/`B` for a sample on line 1/2, `X1`, `X2`… for additional samples (no line). That value is an internal key (unique per release), not a label: shoppers saw A on one record, X1 on another.
**Decision.** The `sample number` shows the 1-based position of the playing sample in the queue (1, 2, 3…), the same number as the sample buttons on cards and in the bag. `track_position` stays an internal key and is not shown.
**Rule.** Never show a DB key as a label: a number the shopper sees is derived from what they see (order on the page), not from storage.
**Where.** `packages/ui/components.js` (Player renders `index`), `apps/storefront/scripts/site.js` (player render).
