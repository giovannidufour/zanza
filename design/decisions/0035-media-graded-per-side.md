# 0035 — The record is graded per side

`2026-11-10` · accepted (Gio) · Figma: BACKEND → Create, section "condition" (`2095:20560`); PDP → product info (`Grading: VG+ / VG`)

**Context.** One media grade per copy hides a worn side: a single often plays better on A than on B.
**Decision.** Two media grades: **side A** (required, `listings.condition_media`, unchanged meaning) and **side B** (optional, `listings.condition_media_b`, migration 0013). Admin form: Side A conditions and Side B conditions (Optional) side by side, 4 + 4 columns; Conditions comment on its own row; Cover/sleeve 4 + 4 below. Shop and admin preview: `Grading: VG+ / VG`, or `Grading: VG+` when side B is not graded (label renamed to `Record:` in 0037). Cover/sleeve grading stays one grade.
**Rule.** Write grades in side order, A first, joined by ` / `; leave out an ungraded side, never write a placeholder. A filter or sort on grading (none yet) must say which side it reads, or use the worse of the two.
**Where.** `supabase/migrations/20261110110000_media_grade_per_side.sql`; `apps/admin/admin.js` (form, payload `listing.condition_media_b`, preview); `apps/storefront/data/products.js` (`copy.condition_media_b`), `pages/shell.js` (`grading`).
