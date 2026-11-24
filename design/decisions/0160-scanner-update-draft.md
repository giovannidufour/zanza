# 0160 — Scanner: Update re-reads the open draft from the admin

`2026-11-23` · accepted · Figma: BACKEND → `Scanner`: `draft head` (2431:1138) new boolean `update` (icon `icon-clock-counter-clockwise`, before the deselect ×)

**Context.** Gio (2026-11-23) edited a draft in the admin while the Scanner was open (lines added, Discogs match changed): the app kept what it had read when the draft was opened, so the new clip slots never appeared.
**Decision.**
- **Update** button in the draft head (also ⌘R): reloads the draft list and the open draft from `scan-targets` (image names, clip slots, tags). Scanned files, assignments and the automatic export (0144) follow: slots that now exist get their clips, changed tags rewrite the exports.
- The same reload runs silently whenever the app comes back to the front with a draft open (Gio usually edits in the browser, then returns to the app).
**Rule.** What the app shows of a draft is re-read from the admin on demand and on return to the app; it never needs a restart to see admin edits.
**Where.** `apps/scanner/Sources/DraftSession.swift` (`refresh`), `ContentView.swift` (`DraftHead`, app activation); Figma `draft head`.
