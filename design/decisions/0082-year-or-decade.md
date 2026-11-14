# 0082 — Year field: an exact year or a decade

`2026-11-14` · proposed (Gio: "the year field should also accept the decade, e.g. 1990s") · Figma: admin form, Year field placeholder

**Context.** Some records can't be dated to the year, only to the decade. `releases.year` is a smallint (1900–2100), used by the shop only for the PLP Decade filter (it is not displayed, searched or sorted on).
**Decision.** `year` stays a number; a decade is stored as its first year (1990) with `releases.year_precision = 'decade'` (default `'year'`, migration 0018; a decade must end in 0). The admin keeps one Year field: it accepts `1983` or `1990s` (text keyboard, placeholder "1983 or 1990s"), and shows a decade back as "1990s". No free text in the database: filters and any future sort by year work on the number without parsing.
**Rule.** A date that may be approximate is a number plus a precision, never free text; wherever the year is shown, write it with `year_precision` ("1990s"), never the bare number.
**Where.** `supabase/migrations/20261114000000_year_precision.sql`, `apps/admin/admin.js` (`parseYear`, `yearText`), `apps/storefront/data/products.js` (`release.year_precision`).
