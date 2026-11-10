# 0027 — Line 1 is 4 + 4 columns, lines 2+ are 3 + 4

`2026-11-10` · accepted (Gio) · Figma: `listing form` → `listing line` (`removable`)

**Context.** In the listing form the title of line 1 starts one column to the right of the titles of the lines added after it; it was flagged as an inconsistency (proposal: 3 + 4 on every line).
**Decision.** Kept as drawn. Line 1 (`removable=false`) has artist 4 + title 4; lines 2+ (`removable=true`) have artist 3 + title 4 + the remove × in column 8.
**Rule.** `listing line` / `ListingLine`: the column split follows `removable`; do not align line 1 to the later lines.
**Where.** `packages/ui/components.css` (`.zz-listing-line`), Figma `listing line`.
