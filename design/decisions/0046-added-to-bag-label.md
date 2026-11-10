# 0046 — A copy in the bag: its Add buttons read "Added to bag" and open the bag

`2026-11-10` · accepted (Gio) · Figma: no new variant (label text only)

**Context.** After Add to bag the only feedback was the header count (0044), and a copy already in the bag could be added again.
**Decision.** When a listing is in the bag, every Add button for it (product card, PDP, player) reads "Added to bag" ("Added" on the mobile card, whose default is "Add"). It is not disabled and not struck through (Gio): it stays a normal button and opens the bag. Remove brings the default label back.
**Rule.** Never use `disabled` for "already done" on a button that can still lead somewhere; change the label instead.
**Where.** `apps/storefront/scripts/site.js` (6. Bag: `syncAddButton`, `addOrOpen`). Amends 0044.
