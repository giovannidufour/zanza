# 0136 — File names for a listing's scans and clips: SKU, role, readable slug

`2026-11-22` · accepted · Figma: BACKEND → `Create`: `file name` (state default | copied, TEXT props `role`, `file name`), section `file names` in the side of "Create listing - desktop"

**Context.** Gio scans the labels and records the clips after a record is in drafts (often from Memo, 0135). He wants to copy, from the draft, the exact name to give each file, so that a later bulk upload can put labels and clips into the right draft by itself. He proposed artist + title + label + format + a code for duplicate copies; in chat he then asked that the name say what is in that file (he searches the B-side tune in Finder) and that the role come right after the SKU, so Finder's name sort lists a record's files in order.
**Decision.** A file name is `<sku>_<role>_<slug>` + the extension the file already has, e.g. `48213_1_gregory-isaacs-why-did-you-leave.jpg`, `48213_b1_sly-and-robbie-hard-drugs-dub.mp3`.
- **sku** = the listing's random 5-digit SKU (0020): unique per copy and never reused, so it is the only key; two copies of the same record never share it.
- **role** = the roles of Bulk create (0107), not new ones: `1` label A, `2` label B, `3` other photos (then `4`, `5`… in gallery order); `a1`, `b1`… = the Discogs position of the line (`a`, `b` by line order when the listing has no release).
- **slug** = for Gio in Finder only, never read by the parser: artist + title of what is in the file (the line for a clip, the main line of that side for a label, line 1 for other photos); ASCII, lowercase, hyphens, `&` → `and`, at most 60 characters cut at a hyphen. Underscores separate the three parts and never appear inside them.
On Edit listing (draft or published, once there is a SKU) the side column has **File names**: a help line and one `FileNameRow` per file (Label A, Label B, Other photos, then each line by position) with **Copy**, which copies the name without extension (renaming in Finder keeps the extension); the button reads "Copied" for 2 s and a status line announces it. The Discogs positions are read once per release (the same `discogs-lookup` as Fetch Discogs), 600 ms after the Discogs match stops changing.
**Rule.** A file is matched to its listing by SKU and role only; any human-readable part of a name is decoration and must never be required to match. New file roles extend the Bulk role list, never a parallel one.
**Where.** `apps/admin/admin.js` (fileSlug, fileNamesOf, positionsOf, ListingForm → fileNamesPanel), `apps/admin/admin.css`, `packages/ui` (`FileNameRow`).
**Next (not built).** Bulk create recognises `<sku>_<role>_<slug>` and adds the files to the existing listing with that SKU (no AI read, no new draft); see design/open.md.

> **2026-11-23 (0146):** the admin File names / Copy UI (the `FileNameRow` list) was removed — the Scanner now names and uploads files itself (0145). The naming rule in `packages/file-names` stays (Scanner + `scan-targets`).
