# 0147 — Scanner: deselect the draft, Free scans

`2026-11-23` · proposed · Figma: BACKEND → `Scanner`: `draft head` boolean `deselect` (×, default ON); section `free scan · components` → `free scan head`; screen "Scanner v3 - free scan (no draft)"

**Context.** Gio (2026-11-23): once a draft is picked he wants to deselect it, so the scanner works "generic": scans that belong to no draft, scans for himself.
**Decision.**
- **Deselect.** × in the `draft head` (top right), or Esc, or clicking the selected draft row again → no draft selected. The drafts column keeps its search and list, with no row selected.
- **Free scan.** With no draft the right column shows `free scan head` ("No draft · Free scan" + one help line). The File name field starts with `scan_<yyyy-mm-dd>_<hhmm>` and stays editable; an existing name gets `_2`, `_3`… (never overwrites). Every scan setting stays (Record, Resolution, File type, Center, Turn by itself, the Originals copy).
- **Where they go.** Free scans are saved in a **Free scans** subfolder of the Labels folder (Gio's choice on the card; separate from the draft scans that get uploaded).
- **List.** Under the head, "Free scans · n this session": `image slot` rows without drag handle (role "Free scan", the name), thumbnail → lightbox, × → Trash; the last row is the target "Next scan" with the next name.
- **Off without a draft.** Push to admin, clip slots and media chips belong to a draft: not shown. The Samples tab with no draft shows the session list only (assigning needs a draft, as today).
- **Later (not built).** "Attach to draft": rename a free scan as Label A / B / other photo of a chosen draft.
**Rule.** A tool that names files for records also works without one: a neutral, dated, never-overwriting name, kept apart from the record files.
**Where.** Figma; the Mac Scanner app (`apps/scanner`, PR #202 branch). No backend change.
