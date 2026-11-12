# 0054 — A copy in the bag: its Add buttons read "Remove" and take it out

`2026-11-10` · superseded by [0058](0058-in-bag-opens-the-bag.md) · supersedes [0046](0046-added-to-bag-label.md) and [0047](0047-added-to-bag-tick.md) · Figma: no new variant (label text only)

**Context.** "Added to bag" + tick (0046, 0047) told the copy was in the bag and opened the bag. With the "Added to bag." toast and its View bag (0050), opening the bag from the button was a third way to the same place, while taking a copy out needed a trip to /bag/.
**Decision.** When a listing is in the bag, every Add button for it (product card desktop and mobile, PDP, player) reads "Remove", no icon, same Button. Pressing it takes the copy out of the bag and shows "Removed from bag." + Undo (0049), exactly as Remove on /bag/; Undo puts it back where it was and returns focus to the button. The button then reads its default label again.
**Rule.** A toggle between two actions on one Button is told by the label (the action it will do), never by `disabled`; the reversible half confirms with a toast + Undo.
**Where.** `apps/storefront/scripts/site.js` (6. Bag: `syncAddButton`, `addOrRemove`, `removeWithUndo`); `apps/storefront/build.js` (tick template removed).
