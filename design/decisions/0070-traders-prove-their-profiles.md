# 0070 — Traders prove their profiles with a code

**Date.** 2026-11-13 · **Status.** accepted (Gio)

**Context.** The offer form (0068) asks for the trader's Discogs and social profiles, but anyone can type someone else's username. Discogs alone is too anonymous for Gio (no references from people he knows) and its feedback does not cover off-platform trades.

**Decision.**
- The trader gives their **Discogs username (required) and their Instagram or Facebook** (at least one). "Where do we talk?" offers Discogs, Instagram, Facebook or meeting in person; the chosen network must be one they gave. Email is no longer a channel: it only carries the notification.
- After sending, the function returns a 4-character **code** (no 0/O/1/I/L) and puts it in Gio's email. "Offer sent" asks the trader to send that code to Gio **from their Discogs and from their Instagram or Facebook**, with one button per network they gave (a new message to Gio: Discogs compose, ig.me, m.me from `site.json` → owner).
- For Gio, an offer exists only when the code reached him from both profiles. Nothing is stored.

**Rule.** Identity on the trade side is proven by the trader acting from their own accounts (challenge, then response from the account), never by data they type. Gio answers on the profile, not by email.

**Where.** `apps/storefront/pages/trade.js` (Offer, STEPS), `scripts/site.js` (validation, code and buttons in the sent state), `trade.css`, `site.json` → owner (`discogs.message`, `instagram`, `facebook`), `supabase/functions/trade-offer` (code, Facebook, validation). Figma page `Trade`: `offer sent`, `contact block` channels, How trading works step 3.
