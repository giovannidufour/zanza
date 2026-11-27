# 0203 — Admin Create bargain: from the phone menu, one photo = one draft with its SKU in the Bargain crate

`2026-11-27` · proposed (screens and capture step replaced by [0204](0204-create-bargain-two-sides.md)) · Figma: `admin menu` (2299:1884) → new group `actions` with `create bargain` on top; page `Crate photo` → `Create bargain - camera` (2620:948), `Create bargain - result` (2620:1022), `Create bargain - draft created (toast), camera again` (2620:1269); notes 2612:5477

**Context.** Gio (2026-11-27): in the admin's mobile hamburger menu, a "Create bargain" button that opens Take photo (0200); taking the photo creates a SKU even with no title, so the record is registered, and he completes it later from the computer with the photos at hand.
**Decision.**
- **Entry**: admin mobile Menu → first group → `Create bargain` (`#bargain`). Not in the desktop bar (the phone is where the camera is). The route lights no section.
- **Screen**: the Take photo screen (CratePhoto) with title "Create bargain", line "New bargain draft · 7″", primary `Create draft` (in place of Add to listing).
- **Create draft**: uploads the Label (photo 1) and the Full (`original_keys`, 0200), then saves a draft through `admin_save_listing` with line 1 "Untitled bargain" (a draft needs a line-1 title, 0026), format 7″ (the crops are a 7″'s), For sale, no price; then sets `bargain = true` (0201). The toast says "Bargain draft saved · SKU 48213. Next record." and the camera opens again for the next record.
- **Later, from the computer**: Listings → Drafts → "Untitled bargain" rows; the rest of the form as for any draft. The slug follows the name until the first publish (0026), so the placeholder title never reaches a URL.
**Rule.** A bargain made on the phone is a normal draft (SKU, photo, original, `bargain`), never a separate record type; its placeholder title is `Untitled bargain`.
**Open.** (1) If the save fails after the uploads, the uploaded files stay in R2 unreferenced (not trashed) · (2) Label B is not asked on this route (one label = photo 1) · (3) not tested against Supabase before merge.
**Where.** `apps/admin/admin.js` (`BargainCapture`, route `#bargain`, Nav menu group; `CratePhoto` props `title`, `addLabel`, awaited `onAdd`).
