# 0179 — Admin: Download video on every sample (photo + sample, square MP4 made in the browser)

`2026-11-24` · accepted · Figma: COMPONENTS → `uploads` → `file item` (type=audio, state=default): new `video` row (boolean `video`, ON in the main, OFF in the line samples) with `video image select` + `video button`; BACKEND → Create, Samples overview

**Context.** 0177 put the video export in the Scanner app, but the Scanner lists drafts only: records already live (or sold) never show up there, so they had no video. Gio (2026-11-24): "think of something sensible".
**Decision.**
- **Where:** the listing page in the admin (Create / Edit), Samples overview: every sample row gets **Video image** (select) and **Download video** (secondary button), below Length. Works for any listing, draft, live or sold, from the files already on R2. Nothing is saved: the file is downloaded.
- **What:** 1080 × 1080 MP4, H.264 30 fps + AAC 192 kbps 48 kHz. Image = the chosen photo, centre square, still, full frame; audio = the sample as it is on the site (its clip, if it has one). File name = the sample's name with `.mp4`.
- **Default image:** the label of the sample's side from the file names of 0136: a sample `<sku>_a…` → the photo `<sku>_1_…` (Label A), `<sku>_b…` → `<sku>_2_…` (Label B); without those names, line 2 → photo 2, else photo 1. The select lists the photos as Label A / Label B / Photo N.
- **How:** rendered in the browser with WebCodecs, packed by mp4-muxer 5.2.1 (MIT, jsDelivr + SRI, loaded only on the first video). Needs Chrome (Firefox cannot encode AAC): any other browser gets a plain message. While it renders, the button reads "Making video… N%" and is disabled.
- **Scanner (0177) stays** as the automatic export at sampling time; the admin is the one place that covers every record.
**Rule.** A tool that makes something per record must reach every record (draft, live, sold), not only the ones in a work queue.
**Where.** `apps/admin/admin.js` (makeVideo, videoRow), `apps/admin/admin.css` (`.admin-sample-video`); Figma `file item`.
