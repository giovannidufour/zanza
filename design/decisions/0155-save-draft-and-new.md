# 0155 — Create / Edit listing: Save draft and new

`2026-11-23` · accepted · Figma: BACKEND → `listing form` → `action panel` (2120:1908), slot `secondary 2` ON with "Save draft and new" on "Create listing - desktop" and on Create → "Create / Edit side · states (0118)": new, draft · unsaved, error

**Context.** Gio creates many drafts in a row. After Save draft the form stayed on the saved draft and a new one took a trip back to Listings → Create listing.
**Decision.**
- A third button in the action panel, "Save draft and new", wherever Save draft is (new listing and drafts): same validation and save as Save draft, then a blank Create listing opens at the top of the page. Toast: "Draft saved · SKU … Next one: a new listing."
- Back in the browser returns to the draft just saved (#edit-<id>), the blank form is a new history entry.
- It reuses the panel's third slot (`secondary 2`, until now only the hidden "View in store" spare): no new property. Published, reserved, sold, traded, archived: not shown (no Save draft there).
- Desktop only for now: the mobile `action bar` keeps Publish now + Save draft (three buttons do not fit one row). Open item in design/open.md.
**Rule.** A save meant to be repeated offers a "save and new" next to the plain save, with the same validation; it never replaces the plain save.
**Where.** `apps/admin/admin.js` (ListingForm `save(status, andNew)`), Figma `action panel` instances.
