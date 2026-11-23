# 0165 — Scanner: Push all, one action on the drafts column that pushes every draft out of sync

`2026-11-23` · proposed · Figma: BACKEND → `Scanner`: section `push all · components` → `push all` (state ready | pushing | failed | synced, TEXT `summary`), `push all · replace confirm` (instance of `dialog`, choices on); screens "Scanner v3 - push all, pushing", "Scanner v3 - push all, confirm replace"

**Context.** Push to admin (0142) is one button per draft row. After a session Gio has several SKUs scanned and clipped and presses Push on each, opening each draft first (the app needs the draft's clip lines). He asked (2026-11-23) for one action on the SKU column that pushes everything that needs pushing and skips what is already aligned.
**Decision.**
- **Where.** A `push all` row in the drafts column, under the draft picker and above the rows, in both tabs (the column is shared, 0141). Left: `summary` (label/extra small, text/moderate); right: secondary `button` "Push N". It sits above the column of row push icons, like a "select all" for them.
- **Scope = the drafts in the list.** Every listed draft whose `push status` is *push* or *failed*. Skipped: *synced* (local truth, 0142), nothing to push (`push` off), already pushing or waiting. A search narrows the list, so it narrows Push all too; the count in the button always says how many.
- **No opening drafts.** Each pushed draft reads its own image names and clip lines from `scan-targets` inside its job; the selected draft does not change. (This also removes today's "Draft opened: press Push again" for the row button.)
- **Ask once.** Before queueing, the app checks all of them (`scanner-push { id, check }`, one call per draft). If none has files in the admin, it pushes without asking. Otherwise ONE `dialog` lists, per SKU, what is already in the admin, with two choices: *Replace them with the Scanner's files* (default, as the row Push) or *Keep them, add only what is missing* (`mode: "fill"`; those files are not even uploaded). Cancel = nothing queued.
- **Jobs.** One push job per draft in the existing queue (0143), list order: row progress, activity bar ("Pushing SKU 48213 · image 2 of 3 · 1 of 2 drafts", "+1 waiting"). A failed draft does not stop the others.
- **States** of `push all`: *ready* "N to push" + "Push N"; *pushing* "1 of 2 · 1 waiting" + "Pushing…" (disabled); *failed* "1 push failed · 2 pushed" + "Retry 1" (only the failed ones); *synced* "All N synced" + `push status` synced icon, no button. Hidden while signed out or with an empty list.
- **Accessibility.** The button's label says the count ("Push 2 drafts to the admin"); the summary is plain text, read with it; progress stays text + bar (0143).
- **Shortcut.** ⇧⌘P.
**Rule.** A bulk action in the Scanner reuses the single action's job and states per draft; it asks at most once for the whole batch, never once per draft.
**Not covered.** Synced is local: a change made in the admin after a push is not seen (as 0142). Videos (0164) stay local and are not pushed.
**Where.** Figma; the Mac Scanner app (`apps/scanner/Sources/AppModel.swift` push, `AdminPanel.swift` drafts list). No backend change (`scanner-push` already has `check` and `fill`).
