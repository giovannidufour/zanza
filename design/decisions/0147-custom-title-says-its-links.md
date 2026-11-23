# 0147 — Custom title: the support text says which artists link

`2026-11-23` · proposed · Figma: BACKEND → Create → `custom title` (2351:3767, support text on), states in frame "Custom title · support text states" (2472:31066)

**Context.** Gio: with a custom title (typed, or filled by From Discogs, 0111) it was not clear what becomes clickable in the shop and where it goes. The links are derived at build (0111), so the admin showed nothing of them. Gio rejected a preview block, inline chips and a markup syntax: least work, but clear.
**Decision.** No new UI. The Custom title support text is computed from the title and the artists of the lines, as the shop matches them (artist name, or the printed credit of a line with one artist; whole words, case-insensitive):
- empty → `Empty = "Artist - Title" from the lines.`
- artists found → `Artist links in the shop: A, B.`
- some not found → `… Not linked: C (write it as in Artist).`
- no artist in the lines → `Replaces "Artist - Title" in the shop.`
After From Discogs the confirmation message says the same (`Custom title from Discogs. Artist links in the shop: …`).
**Rule.** When the shop derives something from a field (links, names), the admin field says what it will derive, in its support text.
**Where.** `apps/admin/admin.js` (titleLinks, titleLinksNote, ListingForm `admin-custom-title`, titleFromDiscogs).
Known gap: the shop also cuts a shared printed credit ("A & B" spelled differently) at its join; the admin does not, so in that rare case it may say "Not linked" while the shop links. Fix if it shows up: move the matching into a shared package used by admin and shell.js.
