# 0172 — Admin: Bulk create removed

`2026-11-24` · accepted · Figma: BACKEND → `Listings`: `listings head` without the Bulk create button; page `Bulk` renamed "Bulk (removed · 0172, reference only)"

**Context.** Bulk create (0107) turned named photos and samples into drafts. The Scanner app now makes the drafts (New draft, 0145), names the files and pushes scans and clips to them (Push to admin, 0142). Gio (2026-11-24): "with the new app we designed, bulk upload is no longer needed: remove it completely from the code". Bulk attach by SKU (0139, never merged) is dropped with it.
**Decision.**
- Admin: no `#bulk` route, no Bulk create button on Listings, no Bulk page code (name parsing, AI read of photo 1, review Next / Skip, Create N drafts) and no `RecordField`, which only Bulk used. Create listing keeps Discogs search and Photo of the label.
- DS: `BulkRecord` and `BulkHelp` removed (component, CSS, types, README rows); `ListingsHead` loses `bulkHref` / `bulkLabel`.
- Kept: incomplete drafts (migration 0026, the publish check), since Scanner New draft and Memo-born drafts rely on them; `ProgressBar`, `DropZone`, `FileItem` (used elsewhere).
**Rule.** When another tool owns a flow end to end, remove the admin's version (route, UI, DS components only it used); keep the data rules the new tool still relies on.
**Where.** `apps/admin/admin.js`, `apps/admin/admin.css`, `packages/ui` (components.js, .css, .d.ts, README). Supersedes 0107.
