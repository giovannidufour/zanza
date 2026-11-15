# 0070 — Traders prove their profiles with a password phrase

**Date.** 2026-11-13 · **Status.** accepted (Gio)

**Context.** The offer form (0068) asks for the trader's Discogs and social profiles, but anyone can type someone else's username. Discogs alone is too anonymous for Gio (no references from people he knows) and its feedback does not cover off-platform trades.

**Decision.**
- The trader gives their **Discogs username (required) and their Instagram or Facebook** (at least one). These only prove who the trader is: **the conversation is by email** (Gio's favourite tool; Reply-To = the trader). "Where do we talk?" is gone; a checkbox "I'd rather meet in person" replaces the in-person channel.
- After sending, the function returns a 4-character **code** (no 0/O/1/I/L) and puts it in Gio's email. "Offer sent" asks the trader to send that code to Gio **from their Discogs and from their Instagram or Facebook**, with one button per network they gave (a new message to Gio: Discogs compose, ig.me, m.me from `site.json` → owner).
- For Gio, an offer exists only when the code reached him from both profiles. Nothing is stored.

**Rule.** Identity on the trade side is proven by the trader acting from their own accounts (challenge, then response from the account), never by data they type. Gio answers by email only once the code has arrived from the profiles.

**Where.** `apps/storefront/pages/trade.js` (Offer, STEPS; the in-person checkbox), `scripts/site.js` (validation, code and buttons in the sent state), `trade.css`, `site.json` → owner (`discogs.message`, `instagram`, `facebook`), `supabase/functions/trade-offer` (code, Facebook, validation). Figma page `Trade`: `offer sent`, `contact block` channels, How trading works step 3.

**Update 2026-11-13 (Gio: "we are humans, not computers").** The 4-character code becomes a **password of two friendly words** (adjective + noun, record and reggae flavour: "golden riddim", "mellow bassline"), shown in quotes. 48 × 48 words, easy to spell, nothing about drugs, religion or politics. It only pairs a message with an offer, it is not a secret. The API field is `phrase` (the page still reads an old `code`).
