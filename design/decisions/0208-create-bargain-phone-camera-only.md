# 0208 — Create bargain: the phone's own camera only (Live removed)

`2026-11-27` · decided · replaces the Live | Phone camera switch of 0204 · Figma: `Crate photo` → Create bargain screens (switch and viewer removed, primary `Open camera`; the separate "phone camera" screen deleted)

**Context.** Gio, after shooting records with both: "phone camera native. I only ever want to use that one, I like it. You can remove the other one."
**Decision.**
- Create bargain has no camera switch and no live viewer. Primary action `Open camera` (`<input capture="environment">`, the phone's own camera app); secondary `From library` (side A) or `No side B` (side B).
- Every shot is `camera: 'phone'`, so it gets `LOOK.phone` (0205). The `localStorage hm-bargain-camera` key is no longer read.
- Messages (Working…, record not found, unreadable image) stay in the warning check line above the slots.
- Take photo in Edit listing (0200) keeps its live viewer: not asked.
**Rule.** One capture path per page; do not bring back a second camera mode without a request.
**Where.** `apps/admin/admin.js` (`BargainCapture`).
