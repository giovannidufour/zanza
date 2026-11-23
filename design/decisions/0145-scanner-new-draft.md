# 0145 — Scanner: New draft from a Discogs release (no form, no photo)

`2026-11-23` · proposed · Figma: BACKEND → `Scanner`: `draft picker` (title row, boolean `new draft`, default ON), section `new draft · components` → `new draft panel` (state results | duplicate | creating | no results), screen "Scanner v3 - new draft from Discogs"

**Context.** Gio (2026-11-23): create a draft straight from the macOS Scanner "with the ease of the Memo": no fields to fill, only pick the Discogs release. Unlike the Memo, no photo of the label (he is always at the laptop): a typed search only.
**Decision.**
- **New draft** (secondary button) in the head of the drafts column. It swaps the column for the `new draft panel`: Cancel, a Discogs search (artist, title or catalogue number; the same `discogs-lookup { query }` as the Memo, 8 results), the results as the admin's `release option` rows (title, label · cat no · year · country · format).
- **One click on a result creates the draft** and comes back to the drafts column with it selected (SKU ready for scans and clips). While saving: status line "Creating the draft of …".
- **Same release already listed** (any status): the panel says "You already have SKU 48213 (draft) of this release." with **Open 48213** and **Create another** (Gio may own two copies).
- **No results**: "No release found. Try the catalogue number, or fewer words." No free-text draft from the Scanner (that stays in the Memo).
- **One mapping.** The Discogs → listing mapping moves out of the admin into `packages/listing-draft` (form model: `emptyForm`, `patchFromDiscogs`, `payloadOf`, vocabularies; `draftPayload(release, entities)` = a draft from a release only). The admin (Create / Edit, Memo → Create draft) and the new Edge Function `scanner-draft` both use it, so a Scanner draft is identical to a Memo draft.
**Rule.** A second client that creates data (the Scanner) calls a server function that runs the admin's own mapping from a shared package; it never rebuilds the payload itself. A shortcut that only creates something asks nothing, except when it would duplicate.
**Where.** Figma; `packages/listing-draft/listing-draft.js` (+ copy in `supabase/functions/scanner-draft/`, `npm run sync:functions`); `apps/admin/admin.js` (aliases, Memo uses `draftPayload`); Edge Function `scanner-draft` (`{ releaseId, force? }` → `{ draft: { id, sku } }` or 409 `{ existing }`; Verify JWT ON); the Mac Scanner app (`apps/scanner`, PR #202 branch). No migration.
