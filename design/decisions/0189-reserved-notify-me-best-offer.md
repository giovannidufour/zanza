# 0189 — Every reserved copy reads "(Reserved) Notify me", Best offer too

`2026-11-25` · accepted (Gio: "tutti i reserved dovrebbero avere lo stesso comportamento indipendentemente dal tipo di vendita") · extends 0065 to Best offer (0158) · Figma: FRONTEND → `Offers` → `offer actions` state=reserved (button secondary, prefix "(Reserved)", label "Notify me", trailing `icon/icon-envelope`; its pitch text unlinked: "An offer was accepted. If it isn't paid within 48 h, the record is back and open to offers."), notes "best offer behaviour" and "offer emails" (6. Notify me)

**Context.** A Best offer copy Reserved for an accepted offer (48 h) showed a disabled "Reserved" button everywhere: nobody could ask to be told when it came back. Fixed-price copies have "(Reserved) Notify me" since 0065.
**Decision.**
- A reserved Best offer copy behaves like any reserved copy: card, home tile, PDP and player read "(Reserved) Notify me" (secondary, envelope, mobile "Reserved"; accessible name "Reserved. Notify me if it is back") and open the Reserved dialog. Its text: "An offer was accepted. If it isn't paid within 48 h, the record is back and open to offers."
- The buyer of the accepted offer (its token in this browser and the copy in the Bag, 0188) reads "In bag" instead, and pressing it opens the Bag.
- Back open to offers (live, before the rebuild): the same button reads "Make an offer" and leads to the offer page. Sold: "Sold out", disabled, as any copy.
- The Notify me email of a Best offer copy says "{record} is open to offers again at {store}. It's a single copy: make your offer here: {link to the offer page}".
**Rule.** A state looks and acts the same whatever the sale type; only the words that name the next step (Add to bag / Make an offer) differ.
**Where.** `apps/storefront/pages/offer.js` (`OfferActions`), `pages/shell.js` (`ProductCardFor`: `data-offer-href`), `pages/home.js` (`TileFor`), `scripts/site.js` (`syncAddButton`, `myOffer`, `addOrOpen`, player, `RESERVED_TEXT.offer`) · Edge Function `notify-back-in-stock`.
