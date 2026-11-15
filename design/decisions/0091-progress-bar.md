# 0091 — Progress bar: an estimate while the photo is read

`2026-11-15` · accepted · Figma: BACKEND → `Memo` → `progress bar` (2304:18240), in `memo photo` state=reading

**Context.** Reading a label photo takes ~10 s (0090) and the status line alone felt static. Gio asked for a progress bar "even if not very realistic": the reader gives no real progress.
**Decision.** New DS component `ProgressBar` (packages/ui): 4px track `surface/subtle`, value `action/primary/background/default`, square ends, width = percent; `role=progressbar` + `aria-valuenow`, the status text stays beside it. Memo shows it under "Photo of the label" while working: it eases towards 85 % in ~10 s while the label is read (status "Reading the label…"), then towards 97 % while Discogs answers ("Looking for it on Discogs…"), never stopping and never reaching 100 % before the answer; hidden when done or failed. Width eases 0.3 s, none with reduced motion.
**Rule.** A progress bar with no real progress is an estimate: it keeps moving, slows down, and never claims 100 % before the work is done. Pair it with a status text; don't use it for waits under ~2 s.
**Where.** `packages/ui` (`ProgressBar`, `.zz-progress-bar`), `apps/admin/admin.js` (PhotoField `creep`).
