# 0118 — Create / Edit listing: status at the top, save feedback

`2026-11-17` · accepted · Figma: BACKEND → `listing form` → `listing status` (2369:23575), `change status` (2369:23585); Create → "Create / Edit side · states (0118)" (2369:23644), side of "Create listing - desktop" and the mobile viewport frame

**Context.** Gio: the right column of Create / Edit was scattered (SKU as a read-only field, the save result in a small line, the Status as a read-only field at the very bottom after the Preview, a separate "can no longer be edited" note) and gave no clear feedback after Publish / Update.
**Decision.**
- `listing status` at the top of the side column (mobile: under the page title): status (Not saved yet, Draft, Published, Reserved, Sold, Traded, Archived) · details = when + SKU ("Published 15 Nov 2026, 10:00 · Updated 21:40 · SKU 48213", "Saved … / Created …" for a draft, the date for sold/traded + "No longer editable") · "Unsaved changes" when the form differs from the last save, in an `Alert` (block, alert colours: Gio 2026-11-18) · "The shop updates in about 2 minutes." for 2.5 minutes after a publish, an update or a status change. No migration: published_at, created_at, sold_at are read from the listing; "Updated" is this visit's save.
- Buttons: new / draft = Publish now + Save draft; published = Update (disabled until something changes) + View in store, no Save draft (Unpublish is under Change status); reserved / sold / traded / archived = View in store only.
- Feedback: a successful save or status change = toast ("Published · SKU …", "Updated · SKU …", "Draft saved · SKU …") + the status block changes. A failure or fields to fix = an `Alert` under the buttons until the next save. Other notes (Discogs filled, From Memo) stay a line of text there.
- `change status` (new component) replaces the read-only Status field: heading "Change status", optional note, the actions of the current status, Sell again for sold/traded. Order: status, buttons, Change status, Preview. The SKU field is gone (the SKU is in the details).
- Mobile: the ActionBar shows the error, or "Unsaved changes", above the buttons.
**Rule.** A form that saves something shows its state at the top (what it is, when, unsaved) and reports a save with a toast; errors stay on screen as an Alert.
**Where.** `packages/ui` (`ListingStatus`), `apps/admin/admin.js` (ListingForm), Figma `alert` set now hugs vertically (it was fixed height and clipped two-line messages).
