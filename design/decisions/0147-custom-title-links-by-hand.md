# 0147 — Custom title: links set by hand

`2026-11-23` · accepted · Figma: BACKEND → Create → `custom title`, `title link bar` (2474:30694), `title link menu` (2474:30739), states in "Custom title · links (0147)" (2474:30749) · migration 0031

**Context.** Gio: with a custom title (typed, or filled by From Discogs, 0111) it was not clear what becomes clickable in the shop and where it goes: the links were derived at build from the release's artists, invisible in the admin, and an alias or abbreviation ("D. Brown") was never linked. A support text that named the links (first draft of this decision) was not enough. Gio asked for: select part of the title, pick an artist, see it underlined in the field; Clear on exactly the selected characters (e.g. only " -"); no help text around the field (the form is already crowded).
**Decision.** Custom title is a `LinkedInput`: the links are character ranges of the title, underlined in the field.
- From Discogs fills the title and links the artists of the lines found in it (name, or the printed credit of a one-artist line).
- Select characters, or click a name of the record or a link: a small bar (`title link bar`) appears under the field: Link artist / Change link, and Clear link / Remove link when the selection holds links. The bar never takes the focus: Delete and typing work as usual and hide it.
- Link artist (or ⌘K / Ctrl+K) opens `title link menu`: search + the record's artists first (the one matching the selection = "Suggested"), then every artist.
- Clear unlinks exactly the selected characters; a link can split. The selection is exact (never widened to words).
- Typing moves the links with the text: inside a link stays in it, right before or after it does not; replaced characters lose their link.
- No support text, no hints around the field.
- Saved in `listings.custom_title_links` ([{start, end, artist_id, name}] of the trimmed title), written by the admin right after `admin_save_listing`. The shop links exactly those ranges (artist by id, else by name; not found = text). `null` (titles saved before) = the shop derives as in 0111, and the admin shows those derived links when the listing is opened, so saving it makes them explicit.
**Rule.** Links inside free text are explicit character ranges set in the admin and shown in the field itself; any floating tool on a text field must not take its focus.
**Where.** `packages/ui/components.js` (LinkedInput, LinkMenu), `components.css`, `components.d.ts`, `docs/LinkedInput/`; `apps/admin/admin.js` (titleArtists, autoTitleLinks, titleLinksRow, formFromRow, save, titleFromDiscogs); `apps/storefront/data/products.js` (titleLinksOf, artists read once), `pages/shell.js` (rangeNodes); `supabase/migrations/20261123100000_custom_title_links.sql`.
Also: the first draft of 0147 (a support text naming the links) was dropped before merging.
