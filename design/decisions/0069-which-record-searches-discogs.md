# 0069 — "Which record" searches Discogs

**Date.** 2026-11-12 · **Status.** accepted (Gio: "fai tutto")

**Context.** In the trade offer form (0068) the trader names each record they offer in a free text field. Gio wants the exact pressing: Discogs releases while typing, and a pasted Discogs release link accepted too.

**Decision.** "Which record" is an ARIA 1.2 combobox when `site.json` → `trade.searchEndpoint` is set (Figma page `Trade`: `which record` with states empty · results · no results · chosen; `release list`; `release option`; `chosen release`).
- Typing 3+ letters asks the Supabase function `discogs-search` (debounced 350 ms, the previous request aborted) and lists up to 8 releases: cover thumb 40, "Artist – Title", then label · catalog number · year · country · format, so pressings can be told apart.
- A pasted `discogs.com/release/<id>` link resolves to that release. A master link (`/master/`) is refused with a message: a master is every pressing.
- Picking a release replaces the field with the chosen release (link to Discogs, Change). The release id travels with the offer and the email to Gio links the release.
- The text stays free: no match, Discogs down, or no endpoint → the trader types artist – title.
- "Data from Discogs" is always under the list; nothing from Discogs is stored (API terms, as in `discogs-lookup`).

**Rule.** A field that suggests external data stays usable as plain text when the service fails, shows its source, and keeps focus in the input (arrows + Enter, Escape closes). The Discogs token lives only in the function (`DISCOGS_TOKEN`).

**Where.** `packages/ui` (ReleaseOption, ReleaseList, ChosenRelease), `apps/storefront/pages/trade.js` (OfferedRecord), `apps/storefront/scripts/site.js` (initReleasePicker builds the same markup in the browser), `apps/storefront/trade.css` (`.release-picker`), `supabase/functions/discogs-search`, `supabase/functions/trade-offer` (release id → link in the email).
