# 0143 — Scanner: export (and push) run as background jobs, with progress on the draft row and in an activity bar

`2026-11-23` · proposed · Figma: BACKEND → `Scanner`: section `samples · components` → `job progress` (state running | waiting | done | failed), `draft row` (new boolean `progress`), `activity bar` (state running | done | failed); screen "Scanner v3 - samples, assigning" (activity bar at the bottom, SKU 71590 exporting while 48213 is selected)

**Context.** Gio (2026-11-23): exporting 2 clips should show progress, he wants to switch SKU without stopping the export, and the progress must stay visible somewhere.
**Decision.**
- **Jobs, not modal work.** Export (0141) and Push to admin (0142) are jobs in ONE queue owned by the app, not by the selected draft. Pressing Export or Push adds a job for that draft and returns at once; selecting another SKU, switching tab or importing a session never stops it. One job runs at a time (LAME and the uploads are heavy), the others wait in order. The job takes a snapshot of the draft's assignments when queued, so editing slots afterwards does not change a running export.
- **Where progress shows.** (1) the job's `draft row`: `job progress` under the media chips ("Exporting 1 of 2 · 45%", "Waiting to export", "Exported 2 clips", "Export failed · retry"); (2) the `activity bar`, a status bar along the bottom of the window in both tabs: the running job ("Exporting SKU 71590 · clip 1 of 2" + bar + "+1 waiting"); a click on it selects that draft; (3) the export button of the selected draft reads "Exporting…" (disabled) while that draft's job is queued or running.
- **End states.** done: row and bar say what was written; the bar offers Show in Finder; the row line goes away when Gio selects that draft again. failed: the reason stays (row + bar) with Retry; nothing half-written is left (write to a temp file, rename when complete).
- **Quit.** Quitting with jobs running asks "Quit and stop 1 export?"; the session folder keeps the sources, so nothing is lost.
- **Accessibility.** Progress is text + bar (never bar only); VoiceOver reads the activity bar as a status (announce start, done, failed; not every percent).
**Rule.** Long work in the Scanner never blocks choosing a draft: it is a queued job shown on its draft row and in the activity bar.
**Where.** Figma; the Mac Scanner app (`apps/scanner`, PR #202 branch).

**Update 2026-11-26.** The single queue is replaced by one lane per job kind (export, push) by 0193: a push no longer waits for exports.
