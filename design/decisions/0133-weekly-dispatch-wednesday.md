# 0133 — Dispatch: at least once a week, usually Wednesday

`2026-11-22` · accepted (Gio: "garantisco di spedire una volta a settimana, solitamente di mercoledì, a volte più frequentemente… valuta tu cosa menzionare e dove per non essere deterrente") · Figma: page `Legal` (Shipping), page `Checkout` (`order thanks` note)

**Context.** Shipping said "within 3 working days" (Claude's placeholder). Gio posts parcels once a week, usually on Wednesday, sometimes more often; a buyer who pays on a Thursday can wait up to a week. Stated everywhere it would scare buyers off; stated nowhere, a week's wait reads as neglect.
**Decision.**
- **Shipping page** (`/shipping/` → When it arrives) carries the full promise: at least once a week, usually Wednesday, sometimes more often; paid by Tuesday → leaves Wednesday; paid on Wednesday → that day or the following Wednesday; never more than a week. Linked from the footer and the Bag, so the buyer can read it before paying.
- **After paying** (order note on `/checkout/thanks/`, the confirmation email, a paid order in Account) one short line: "I pack every record by hand and post orders at least once a week, usually on Wednesday. You get the tracking number by email when it ships."
- **Not** on PDP, PLP, Bag or Stripe Checkout: a delay on the way to paying only deters; the Shipping link is already there.
- **Admin**: no new setting or field. The texts are editable in Content (Shipping page, Order confirmed); Orders' "To ship" tab is already the Wednesday packing list. A configurable dispatch day would be a setting for a single value that has never changed.
**Rule.** Any new text about when an order leaves says "at least once a week, usually on Wednesday" and nothing stricter; the paid-by-Tuesday detail lives only on the Shipping page.
**Where.** `apps/storefront/content/legal/shipping.md`, `packages/content/content.js` (short.order note default), `supabase/functions/stripe-webhook/index.ts` (buyer email), `apps/storefront/scripts/account.js` (PACKING).
