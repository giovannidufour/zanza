# 0154 — Scanner: Clear list for free scans (files stay)

`2026-11-23` · accepted · Figma: BACKEND → `Scanner`: `images head` boolean `clear list` (secondary small button "Clear list", default ON; off in every draft instance, on in "Free scans"); screen "Scanner v3 - free scan (no draft)"

**Context.** Gio (2026-11-23): during free scans he wants to empty the list of what he scanned without deleting the scans.
**Decision.**
- "Clear list" in the head of "Free scans · n this session" (shown only with at least one free scan).
- It empties the session list only: the files stay in the Free scans folder, nothing goes to the Trash. The next name is unchanged (names never overwrite, 0147).
- Feedback as 0149: toast "List cleared · n scans kept in Free scans", Undo (or ⌘Z) brings the rows back.
- No Clear list with a draft selected: draft images are files of the record, removed one by one with × (0149).
**Rule.** Clearing a list is not deleting: a list of files the app made can be emptied without touching the files, and the feedback says where they are.
**Where.** Figma; the Mac Scanner app (`apps/scanner`). Amends 0147.
