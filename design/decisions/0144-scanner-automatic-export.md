# 0144 — Scanner: clip export is automatic (files mirror the assignments); media chips red / orange / green

`2026-11-23` · proposed · Figma: BACKEND → `Scanner`: `media status` (state none | partial | some; new `partial` = orange), `export panel` (no Export button, title "Export · automatic", status line); tokens `orange` (primitive), `surface/warning`, `text/on-warning`

**Context.** Gio (2026-11-23): the clips chip on a draft row turned green as soon as clips were assigned, but nothing was exported yet; and he never exports before the label scans exist, or the ID3 cover (label of that side) would be missing. Asked for an intelligent fix, open to radical ones. Chose on a decision card: "Automatic, always in sync".
**Decision.**
- **Export is automatic.** The exported files mirror the assignments of each draft: assigning a clip writes `<name>.mp3` (and `.wav` if ticked); changing the assignment, the trim, the WAV tick, or scanning / replacing the label of that side rewrites the files (tags + cover). Unassigning moves the exported files to the Trash. Each write is a job of the queue (0143), with progress on the row and in the activity bar. No Export button. Folders stay in the `export panel`.
- **Complete = exported with full tags and cover.** A clip without the label scan of its side is exported anyway (so it can be listened to) but counts as not complete; scanning the label later rewrites it.
- **Media chips, three states.** none = red (nothing there), partial = orange (started, not finished: a clip assigned but not written yet or written without cover; images: Label A or Label B missing), some = green (complete). The number always shows; the tooltip / accessibility label says what is missing ("A1 needs the Label A scan").
- **Orange (same day).** Gio found #ff5d16 dull: primitive `orange` is now #ff9f1c (brighter, lighter; black on it 10.4:1). Image chip unchanged: orange while Label A or Label B is missing. All tracks of a side share that side's label as cover.
**Rule.** A status chip shows done only when the work is finished, never when it is merely started. Derived files (exports) are kept in sync by the app, not by a button.
**Where.** Figma; `packages/ui/tokens.json` (`orange`, `surface-warning`, `text-on-warning`); the Mac Scanner app (`apps/scanner`, PR #202 branch). Supersedes the manual Export of 0141.
