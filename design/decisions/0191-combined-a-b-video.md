# 0191 — Admin: A+B video (two samples in one video, hard cut)

`2026-11-25` · accepted · Figma: uploads → component `combined video` (2575:41934); BACKEND → Create, Samples overview (desktop + mobile), under the file list

**Context.** 0180 makes one video per sample. Gio (2026-11-25) also wants one video for the whole record, for the HIGHMUZIK YouTube channel: typically the vocal on side A, then the version on side B, each with its own label, no transitions.
**Decision.**
- **Where:** listing page in the admin (Create / Edit), Samples section, under the samples and above the drop zone: **First** (select), **Then** (select), **Download A+B video** (secondary button). Shown only when the listing has two samples or more. Admin only: the ZANZA Mac app keeps the single videos of 0177 (Gio's choice, 2026-11-25).
- **Defaults:** First = the first sample of side A, Then = the first sample of side B (sides from the file names of 0136: `<sku>_a…` / `<sku>_b…`; else line 1 / line 2; else the first two samples). Options read `A1 · <title>`. Both are changeable; nothing is saved.
- **What:** the same file as 0180 (1080 × 1080 MP4, H.264 30 fps + AAC 192 kbps 48 kHz), made of the two samples end to end, sample-exact, no fade, no gap. Each sample shows **its own Video image** (the select of 0180 on its row). The picture changes on the frame nearest to the end of the first sample (≤ 17 ms off), which is also a key frame. A mono sample is copied to both channels when the other is stereo.
- **File name:** `<sku>_a1-b1_<slug>.mp4` (the two roles joined), else the first name + `-ab`.
- **How:** `makeVideo(parts)` of 0180 now takes a list of parts; one part = the single video, unchanged.
**Rule.** A combined media file is built from the per-item choices already made (here each sample's Video image), never from a second set of settings.
**Where.** `apps/admin/admin.js` (makeVideo, combinedVideoRow), `apps/admin/admin.css` (`.admin-combined-video`); Figma `combined video`.
