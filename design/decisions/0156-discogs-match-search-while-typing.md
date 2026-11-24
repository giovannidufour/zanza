# 0156 — Create / Edit listing: Discogs match searches while typing

`2026-11-23` · accepted · Figma: Create → "Discogs match · search while typing (0156)" (2487:32671): `input` search · filled + Trade → `release list` (results) under it

**Context.** Gio: in Create listing, typing in Discogs match should search Discogs and offer results, as Memo's Record field does. Until now the field took only a release link or number, then Fetch Discogs.
**Decision.**
- 3+ letters that are not a link or a number ask `discogs-lookup { query }` (debounced 350 ms, a newer request wins) and show the `release list` under the field (same `ReleaseList` / `ReleaseOption` as Memo and the photo of the label).
- Picking a pressing puts its link in the field and runs Fetch Discogs at once (same as a pick from the photo, 0092).
- A pasted release link or number closes the list and still goes by Fetch Discogs; a master link says to pick a pressing.
- Combobox as in Memo (ARIA 1.2): focus stays in the input, arrows + Enter pick, Escape closes, results announced in a live region. The × of the search input (Figma state filled) clears the field.
- Text left in the field that is not a release blocks the save with "Pick a release from the list, paste its link or number, or empty the field."
- Not offered on reserved / sold / traded / archived copies (locked).
- One implementation: `useDiscogsSearch` in admin.js, now also behind Memo's Record field (no behaviour change there).
**Rule.** A field that wants a Discogs release accepts both a typed search and a pasted link, through `useDiscogsSearch`.
**Where.** `apps/admin/admin.js` (useDiscogsSearch, RecordField, ListingForm). No migration, no new function (discogs-lookup already answers `{ query }`).
