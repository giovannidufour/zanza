# 0092 — Create listing: Photo of the label next to Fetch Discogs

`2026-11-15` · accepted · Figma: BACKEND → `Create` → `discogs actions` (2306:2342, state default | reading | read), placed under Discogs match in the desktop and mobile frames

**Context.** Gio liked the label photo in Memo (0090) and wants it while creating a listing, next to Fetch Discogs.
**Decision.** Under Discogs match, one row (wraps on mobile, gap 8): **Fetch Discogs** · **Photo of the label** (secondary, hug). The photo flow is the Memo one (read-label → discogs-lookup `{ fields }`, estimated progress 0091, status line). The releases found show in a `ReleaseList` under the row; picking one puts its release link in Discogs match and runs Fetch Discogs at once, so the form fills as usual (artist/title lines, label, cat. no., year…). No match → the list says so; the link can still be pasted.
**Rule.** One photo component (`PhotoField`) for every place that reads a label: Memo uses it full width, Create beside other actions. A release picked from a photo goes through the same fetch as a pasted link, never a second filling path.
**Where.** `apps/admin/admin.js` (PhotoField `full` / `actions` / `pickHint`, ListingForm `photoFound`, `fetchDiscogs(id)`), `apps/admin/admin.css` (`.admin-photo-actions`).
