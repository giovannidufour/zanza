# 0134 — Terms and Shipping in the same minimal, generic style as Privacy

`2026-11-22` · proposed (Gio: "finalizziamo le pagine legali"; text by Claude, not legal advice) · Figma: page `Legal` → `Legal - desktop · Terms` (2266:2299), `Legal - mobile · Terms` (2266:4419), text updated

**Context.** 0130 cut Privacy to the legal minimum with no provider names. Terms still named Stripe and linked /grading/ (no such page: 404); Shipping named Stripe and kept a placeholder for delivery times (`[[p:…]]`) that nobody confirmed.
**Decision.** Terms: five short bullets (records as described, how the sale is agreed, no withdrawal and no warranty beyond the description, shipping and duties, German law; Trades only when trade is on), no provider names, no link to a page that does not exist. Shipping: no provider name; delivery time = "depends on the carrier and the destination" instead of numbers we can't promise. No placeholders left in the legal texts.
**Rule.** Legal texts name no provider (only categories, as 0130) and promise no number the shop does not control; a link in them points only to a page that exists.
**Where.** `apps/storefront/content/legal/terms.md`, `shipping.md`. If Terms or Shipping were saved in the admin (Content → Pages), the saved text wins over the file: reset it there.
