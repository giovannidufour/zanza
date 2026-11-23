# 0151 — Tags and chips are light blue in the admin too

`2026-11-23` · accepted · Figma: variable `color` → `surface/support-1`, mode `backend` → alias `support-1`

**Context.** Since 0123 `surface/support-1` was black-a8 in the backend mode (it matched Figma then), so admin tags and artist / genre chips turned translucent black. 0124 later moved every image placeholder to `surface/media`, so `surface/support-1` only paints tags and chips. Gio (2026-11-23): keep them light blue as in the shop.
**Decision.** `surface/support-1` = `support-1` (light blue) in both modes, in Figma and tokens.json. Text on it stays text/strong (~13:1). Thumbnails are unaffected (they use `surface/media`, 0124).
**Rule.** Tag and chip colours are the same in shop and admin; a backend override needs a reason that the admin is different, not just a mode.
**Where.** Figma variable, `packages/ui/tokens.json` (tokens.css regenerated). Partly supersedes the token note of 0123.
