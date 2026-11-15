# 0098 — Checkout: thanks page, cancel and failures in the Bag

`2026-11-15` · accepted · Figma: page `Checkout` (after Bag), component `order thanks` (device=desktop | mobile), screens Checkout thanks - desktop / mobile, note "checkout behaviour"

**Context.** Stripe Checkout (migration 0021) needs a page for a paid order and a way back for a cancelled one. Gio (2026-11-15): Figma first, built from existing components.
**Decision.** `/checkout/thanks/` has the layout of the empty bag: title "Thank you", then `order thanks` = Divider, message (order confirmed, email on its way), note (packed by hand, tracking by email), "Browse records for sale" (secondary; hug on desktop, fill on mobile). No order details on the page: they are in the confirmation email, so the static page never reads an order. The paid records leave the bag. A cancel on Stripe returns to the Bag with the toast "Checkout cancelled. Your records are still in your bag." and the hold ends at once. A checkout that cannot start answers with a toast in the Bag (records just taken: the lines update; minimum; shipping; try again).
**Rule.** Results of a checkout are told with existing patterns: a page only for success, toasts for everything that keeps the buyer in the Bag. Never a new visual for a state the Bag already shows (sold, reserved, minimum).
**Where.** `apps/storefront/pages/checkout.js`, `bag.css` (shared with the empty bag), `scripts/site.js` (startCheckout, checkoutReturn).
**Open.** Button has no loading state in Figma: while create-checkout answers, Checkout is aria-disabled and ignores clicks with no visual change (`design/open.md`).
