# 0139 — Bulk attach: files named with a SKU go to that listing

`2026-11-22` · accepted · Figma: BACKEND → `Bulk`: `bulk record` new state `attach` (mobile, desktop: no Review, Remove only), `bulk naming help` new TEXT prop `scans`

**Context.** Gio scans labels with the Scanner app (0138), which names them `<sku>_<role>_<slug>` (0136) for drafts that already exist. Bulk create (0107) did not read these names: the hyphenated slug made them "not recognised", so they went to the AI label read and could become a second draft of the same record. Gio asked (2026-11-23 00:01) whether a bulk upload of his scans puts them into the right drafts, and chose to build it.
**Decision.** On Bulk create, a file whose name starts with `<5 digits>_<role>` (role `1`, `2`… or `a`, `b`, `a1`…; the slug and a "copy" / "(2)" suffix are optional) belongs to the listing with that SKU:
- the batch shows one `bulk record` per SKU in state **attach**: the listing's title, "SKU 28529 · Draft", the files, and what will change ("Adds to this draft: photos 1, 2 (1 file replaced). No label read."); Remove only, no Review;
- **photos**: `_n` replaces the photo at place n of the gallery, or comes last when the gallery is shorter; **samples**: `_a` / `_b` / `_a1`… go to the line with that Discogs position (read once with `discogs-lookup`; a / b by line order without a release) and replace the sample on that line, anything else is an additional sample;
- only a **draft** or a **live** copy takes files; a SKU that is reserved, sold, traded, archived or unknown stays in the batch with the reason and is not saved;
- the save button reads "Save N records" when the batch has SKU records; each listing is saved with its own status (`admin_save_listing`), nothing else changes. Files without a SKU work as before (0107).
**Rule.** A SKU in a file name always wins over any other reading of it: never send a SKU-named file to the AI or to a new draft. Matching uses SKU and role only (0136).
**Where.** `apps/admin/admin.js` (SKU_NAME, skuParse, attachInto, attachStatus, Bulk → lookUpSkus, createDrafts), `packages/ui` (`BulkRecord` state `attach`).
