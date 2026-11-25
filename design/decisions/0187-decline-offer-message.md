# 0187 — Decline an offer with an optional message; Dialog gets a `field`

`2026-11-25` · accepted (Gio: "Aggiungi dall'admin la possibilità di inviare un messaggio quando rifiuto un'offerta, come in modo opzionale.") · amends 0158 (Decline) · Figma: COMPONENTS → `dialog` (new boolean `field`, a text area `input`, ON in the component, off in every existing instance), BACKEND → `Offers` → `Offer - decline dialog`

**Context.** Declining an offer sent a fixed "This time I'll pass." Gio wants to say why, or suggest a price, when he feels like it.
**Decision.** The Decline dialog of admin → Offers has a text area "Message to the buyer" (Optional, max 1000 characters, placeholder "Optional. It goes in the email after "This time I'll pass.""). Empty = the email as before. Written = it goes in the decline email as its own paragraph after "This time I'll pass." and before "Other records". It is not stored. Accept has no message.
The `dialog` component gets the `field` slot the code already had as a proposal (`Dialog` prop `field`, under the body, before `choices`).
**Rule.** A message Gio writes to a buyer is optional, plain text, and sits inside the standard email, never replacing it.
**Where.** `apps/admin/admin.js` (Offers: `declineNote`, `Dialog` `field`) · `supabase/functions/offer-decide` (`message`) · `packages/ui/components.d.ts` (`DialogProps.field`).
**Open.** The `dialog` component's `choices` boolean is still OFF in the component (a hidden layer), against the "booleans ON in the component" rule: to flip with Gio, it changes every instance.
