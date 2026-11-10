# 0050 — Add to bag shows a toast too; an action that is also on the page lets the toast time out

`2026-11-10` · accepted (Gio) · amends [0049](0049-toast-feedback.md) · Figma: page `toast` → example "Added to bag." + View bag (2180:372), placement desktop / mobile

**Context.** 0049 mapped Add to bag as "no toast": the button label and tick (0046, 0047) and the header count already change. Gio wants the toast anyway, redundancy accepted. 0049 also said a toast with an action never times out, which would leave a "View bag" toast on screen after every add.
**Decision.** Adding a copy to the bag (card, PDP, player) shows "Added to bag." with the action "View bag" (opens the bag, as the header Bag). Adding a copy already in the bag opens the bag and shows nothing. The timeout depends on where else the action lives: an action only the toast offers (Undo) keeps it open (WCAG 2.2.1); an action that is also on the page (View bag = header Bag) closes after 6 s like a text-only toast, same pauses.
**Rule.** Before giving a toast an action, ask whether the page offers it elsewhere: if yes, the toast times out (`actionElsewhere: true`); if no, it stays until dismissed.
**Where.** `packages/ui/toast.js` (`actionElsewhere`), `apps/storefront/scripts/site.js` (6. Bag: `addToBag`).
