# 0191 — The buyer of an accepted offer sees its price on the record: "Your offer · 25€"

`2026-11-25` · accepted (Gio: "mostriamo un prezzo per il disco accettato anche in PLP e PDP e magari una label o info sul fatto che la proposta è accettata") · extends 0190 · Figma: FRONTEND → `Offers` → screen `Offer PDP - desktop · your accepted offer` (product info `price` on, "Your offer · 25€"; `offer actions` state=accepted; first "More for sale" card the same), note "best offer behaviour"

**Context.** A Best offer copy has no price (0158). After 0190 the buyer of an accepted offer gets "Add to bag", but the card and the PDP did not say at which price.
**Decision.** For the buyer of the accepted offer (link opened in this browser, hold running, copy Reserved) the price slot of the card, home tile, PDP and return card reads **"Your offer · 25€"**: the amount and, in the same words, the fact that it is their accepted offer (no separate badge: the PDP line under Add to bag says the rest, 0190). Everyone else: no price, as before.
**Rule.** A price shown only to one buyer names whose price it is, in the price slot itself.
**Where.** `apps/storefront/pages/shell.js` (`priceText`: an empty hidden `[data-offer-price]` slot for Best offer), `apps/storefront/base.css` (hides the slot while empty), `apps/storefront/scripts/site.js` (`applyStatus`).
