# 0149 — Scanner: every removal shows a toast with Undo, no confirmation

`2026-11-23` · proposed · Figma: BACKEND → `Scanner`, screen "Scanner v3 - deleted, toast with Undo" (2476:8200), DS `toast` (2177:439, page `toast`)

**Context.** Gio (2026-11-23): removing something in the Scanner app also moves the file on his Mac. He wants no confirmation dialog, only a small feedback of what happened, with Undo. Today the app already has pieces of this (Undo in the images head for a removed scan, ⌘Z in the Samples session, a caption line), each in a different place.
**Decision.**
- **One feedback.** Every destructive action shows the DS toast (message + Undo + ×), the same component as shop and admin (0049). No confirm dialog anywhere. It replaces the "Undo" link in the images head and the caption line for removals.
- **Messages** (file name in full, the toast wraps):
  - scan or free scan × / Delete → "Moved to Trash: <file>"
  - clip slot × → "<position> unassigned · MP3 and WAV moved to Trash"
  - WAV untick → "<position> WAV moved to Trash"
  - session clip × → "Removed from the session" (the Zoom copy is never touched)
  - Clear session → "Session cleared (n clips)"
- **Undo** (button or ⌘Z while the toast is up) puts every file back from the Trash to its original path (the URL `trashItem` returns) and restores the app state: slot scanned + thumbnail, clip assignment, session rows, the target slot and the next file name. If the original path is taken again, Undo fails inline ("Can't restore: <file> exists") and the file stays in the Trash.
- **Timing.** About 6 s, paused while the pointer is over it (0050). A new removal replaces the toast; the earlier removal stays done (its file stays in the Trash, recoverable from Finder).
- **Place.** Top right of the window, 16 below the title bar, width 400 (0071's top placement, desktop).
- **Accessibility.** VoiceOver announces the message (accessibility announcement, polite); Undo and × are buttons with labels; Esc closes the toast only when it has focus (Esc elsewhere keeps deselecting the draft, 0147 free scans).
- **Errors** stay inline where they happen, never in the toast (0049).
**Rule.** Removing a file needs no confirmation when it goes to the Trash and the toast offers Undo; anything that can't be undone (none today) would need a confirm.
**Where.** Figma; the Mac Scanner app (`apps/scanner`, PR #202 branch). No backend change.
