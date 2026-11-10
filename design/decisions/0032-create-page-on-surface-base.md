# 0032 — The create / edit page is on `surface/base`

`2026-11-10` · accepted (Gio) · Figma: BACKEND → Create, frame `Create listing - desktop` (2093:19086) fill `surface/base`

**Context.** With the shop preview (0030) in the side column, Gio set the Create frame back to `surface/base` (white). The listings page stays on `surface/accent` (black-a4), where the white active tab needs it (0023).
**Decision.** The admin page background is `surface-accent`, except create / edit, which is `surface-base`. Fields keep their `surface-accent` fill (black-a4), which reads as light grey on white, as in Figma.
**Rule.** A page frame's fill in Figma is the page background in code; `surface-base` is legal as a page ground when nothing translucent is meant to be stacked on it except the fields drawn that way in Figma. Narrows the "page-level grounds use `surface-accent`" rule of [0023](0023-surface-accent-and-opaque-base.md) for this page.
**Where.** `apps/admin/admin.css` (`html:has(.admin-page)`).
