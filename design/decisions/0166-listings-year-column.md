# 0166 — Listings: Year column

`2026-11-24` · accepted (Gio: "nella tabella drafts e vari listings mettimi anche year visibile in admin") · amends 0163 · Figma: BACKEND → Listings, `listings table row` (2413:1734) gets the text property `year` and a `year` column (48) after Format, in head and row

**Context.** 0163 added the overview columns but left the year out: to see it Gio had to open the copy.
**Decision.** Every Listings tab (Live, Drafts, Sold, Archived) shows Year between Format and Grading, 48 wide, tabular figures, left-aligned. It reads as entered: "1983" for an exact year, "1990s" for a decade (`releases.year_precision`, decision 0082, same `yearText` as the form). No year yet: "—" in text/moderate, read as "Missing" (0163 rule). Mobile unchanged.
**Rule.** A year shown in the admin is always written with `yearText` (exact or decade), never the bare `year` number.
**Where.** `apps/admin/admin.js` (`INFO_COLUMNS`, listings query adds `year, year_precision`), `apps/admin/admin.css` (`.admin-table .year`).
