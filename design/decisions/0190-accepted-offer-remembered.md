# 0190 — The buyer of an accepted offer can put the record back in the Bag from its page

`2026-11-25` · accepted (Gio: after Remove, the record's page should still show the offer as accepted, without a new offer) · extends 0188, 0189 · Figma: FRONTEND → `Offers` → `offer actions` state=accepted ("Add to bag", primary; line "Your offer of 25€ was accepted. It's held for you until Thu 26 Nov, 17:28: add it to your bag and pay when you like."), note "best offer behaviour"

**Context.** With 0188 the email link puts the record in the Bag. A buyer who pressed Remove and then opened the record's page saw "(Reserved) Notify me" like everyone else (0189), and had to find the email again.
**Decision.**
- The browser keeps each opened offer link with its amount and the end of the hold (`highmuzik-offers`: `{ t, a, e }` by listing id; an old entry with the token alone still works). Remove takes the record out of the Bag, not the offer.
- While the copy is Reserved and the hold runs, the buyer's card, home tile, PDP and player read "Add to bag" (the button's own hierarchy), and "In bag" once it is in the Bag. The PDP line under the button becomes `offer actions` state=accepted. Everyone else keeps "(Reserved) Notify me" (0189).
- After the hold ends (or the offer is paid / closed) nothing special shows: the button follows the copy's status as before.
**Rule.** What a buyer has already been granted must survive the actions that don't cancel it (Remove from the Bag, a new visit): show it where they look for the record.
**Where.** `apps/storefront/scripts/site.js` (`readOffers`, `heldOffer`, `syncAddButton`, `addOrOpen`, `applyStatus` → `[data-offer-note]`, `initOfferPay`) · `apps/storefront/pages/offer.js` (`OfferActions`: `data-offer-note`).
