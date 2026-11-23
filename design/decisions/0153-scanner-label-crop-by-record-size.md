# 0153 — Scanner: the label crop depends on the record size (7" = 3.5", 10" / 12" = 4")

`2026-11-23` · accepted · Figma: BACKEND → `Scanner`: `scan preview` → `selection` → `label crop` (now 88.9 / 180 of the 7" square), Record menu text "7" · whole record + 3.5" label" on every screen

**Context.** The label image for the shop was always a 4" square (0137). Gio (2026-11-23): 4" fits the label of a 12" (and 10"); a 7" single's label is smaller, so a 4" crop shows too much of the grooves around it. The scanner has no inch unit for an area (the LiDE 100 reports centimetres; the app scans in inches and cuts in pixels from mm).
**Decision.**
- Label crop by record: **7" = 3.5" = 88.9 mm**; **10" and 12" = 4" = 101.6 mm** (unchanged). Whole glass has no label square.
- The original (whole record) is unchanged: 180 mm square for a 7", 216 mm for 10" / 12".
- The value lives once, `SizePreset.labelMM` (mm); the cut converts it to pixels of the scan (`mm × px/mm` at the chosen dpi), the dashed square of the guide and "Turn by itself" (which reads the text inside the label square) use the same value. The Record menu and the captions say 3.5" or 4".
**Rule.** A label crop is set per record size in one place (`SizePreset.labelMM`); never a fixed 4" in the code.
**Where.** `apps/scanner/Sources/Scanner.swift` (`SizePreset.labelMM`), `AppModel.swift` (cut, Turn by itself, captions), `GlassView.swift` (guide); Figma Scanner page.

**Follow-up (Gio, 2026-11-23).** The label crop guide is white (`text/strong-invert`), so it reads on the dark label; the outer 7" guide (record edge) stays black (`text/strong`).
