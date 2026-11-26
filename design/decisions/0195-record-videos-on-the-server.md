# 0195 — Admin record videos made on the server: Make video, then Download

`2026-11-26` · proposed · Figma: COMPONENTS → `uploads` → `file item` `video` row and `combined video`: button "Make video" / "Make A+B video", new primary "Download" next to it once the video exists, error line under them

**Context.** After 0194 the browser makes videos much faster, but only while the admin page stays open and in front (iPhone stops a page in the background). Gio (2026-11-26): it should work in the background, "even with the browser closed"; no email when a video is ready, but a Download button in the admin next to the video it made.
**Decision.**
- **Make video** (each sample) and **Make A+B video** ask the Edge Function `render-video`. It writes a `video_jobs` row (migration 0042) and starts the GitHub Actions workflow `render-video.yml`, which renders with ffmpeg (H.264 30 fps stillimage + AAC 192 kbps 48 kHz, 1080 square, hard cut for A+B: the same video as 0180 / 0191) and uploads `videos/<uuid>.mp4` to R2. Usually ready in about a minute; the admin can be closed meanwhile.
- **Download** (primary) appears next to Make video when the row has a finished video **for the same files** (audio + chosen photos, in play order). Another photo or sample = Make video again; the last video for the old choice comes back when the choice does. While a video is being made the button reads "Making video…" (no %, the server does not report it); the row is read again every 5 s while one is in progress. A failed one shows "Last video failed: …" under the buttons.
- **Fallback:** until `render-video` is deployed and has its token, or when it cannot be reached, Make video makes it in the browser as before (0194) and downloads it straight away.
- No email (Gio). The workflow authenticates to `render-video` with its GitHub OIDC token, so no shared secret lives in GitHub.
**Rule.** Work that can outlive the page (rendering, exports) runs on a server and leaves its result in the admin, next to what produced it.
**Where.** `apps/admin/admin.js` (requestVideo, videoButtons, jobs), `apps/admin/admin.css`, `supabase/functions/render-video`, `supabase/migrations/20261126000000_video_jobs.sql`, `.github/workflows/render-video.yml`, `.github/scripts/render-video.sh`. Videos are never purged for now (a few MB each).
