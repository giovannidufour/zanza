# 0117 — Create listing: no section nav

`2026-11-17` · accepted · supersedes the section nav of [0113](0113-create-sections-and-fetch-from-label.md) · Figma: BACKEND → Create (`form section nav` deleted, screens back to main 8 + side 4)

**Context.** Gio tried the anchor links on the left of Create / Edit listing (0113) live and found they are not needed.
**Decision.** The section nav goes, in Figma and in code (DS `FormSectionNav`, the scroll spy, the mobile sticky row). The page is main 8 + side 4 columns again. Everything else of 0113 and 0114 stays: the order (Discogs, Images first), the section headings, Fetch from label, the markers, Price as its own block.
**Rule.** Sections keep their heading (`FormSectionHead`); no in-page navigation on the listing form.
**Where.** `apps/admin/admin.js`, `apps/admin/admin.css`, `packages/ui` (FormSectionNav removed).
