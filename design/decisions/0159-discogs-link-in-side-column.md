# 0159 — Admin listing: the Discogs link sits in the side column on desktop

`2026-11-23` · accepted · Figma: BACKEND → `Create`, "Create listing - desktop" → `side` (instance of `discogs link`)

**Context.** Gio (2026-11-23): the link to the matched Discogs release (0150) sat under the Discogs match field and scrolled away; he wants it visible while scrolling the form.
**Decision.** Desktop: `DiscogsLink` moves to the side column, after the listing status, so it stays with the sticky side. Mobile keeps it under the Discogs match field (no side column there). Same visibility rules as 0150.
**Rule.** A link or status the admin needs at any scroll position goes in the desktop side column; mobile keeps it next to its field.
**Where.** `apps/admin/admin.js` (`discogsLink`, Discogs section on mobile, side column on desktop). Amends 0150 (placement only).
