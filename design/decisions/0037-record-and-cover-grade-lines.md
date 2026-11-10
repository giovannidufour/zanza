# 0037 — Grading reads "Record: …", with a "Cover: …" line when the cover is graded

`2026-11-10` · accepted (Gio) · Figma: PDP → `product info` and `product card`, layers `grading` + `cover` (boolean property `cover`)

**Context.** The shop said "Grading: VG+ / VG" for the record only; the cover/sleeve grade was saved but never shown.
**Decision.** The record line reads `Record: VG+ / VG` (per side, decision 0035). When the cover/sleeve has a grade, a second line `Cover: NM` sits right below it, same type. No grade (or sleeve type `none`) → no line. Same in the admin shop preview.
**Rule.** Grade lines are `<Thing>: <grade>`, one line per graded thing, record first; an ungraded thing has no line, never a placeholder. Components take the text already formatted (`grading`, `cover` props); the page formats it.
**Where.** `packages/ui/components.js` (`ProductInfo`, `ProductCard`: `cover` prop), `components.d.ts`; `apps/storefront/pages/shell.js` (`grading`, `coverGrading`), `pages/pdp.js`; `apps/admin/admin.js` (preview).
