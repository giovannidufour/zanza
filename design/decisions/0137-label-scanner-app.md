# 0137 — Label scanner: a small macOS app that scans straight to the 0136 file name

`2026-11-22` · proposed · Figma: BACKEND → `Scanner` (page `2423:4080`): `scan step` (state next | current | scanned; TEXT `role`, `file name`; boolean `thumbnail`), `scan preview` (state empty | scanning | scanned; booleans `crop guide`, `caption`; TEXT `caption text`), `scanner status` (TEXT `status`, boolean `dot`); screens "Scanner - no names", "Scanner - ready", "Scanner - label A saved"

**Context.** Gio scans labels with a Canon CanoScan LiDE 100 (works in Preview / Image Capture, so ImageCaptureCore sees it). Today he scans, then renames each file in Finder with a name copied from Edit listing → File names (0136). He wants to name the file while scanning.
**Decision (proposed, waiting for Gio's ok).**
- A native macOS app, **Zanza Scanner** (SwiftUI + ImageCaptureCore), in `apps/scanner`. One window: the record on the left (SKU, name, one `scan step` per file), the scanner bed on the right with a round crop guide, then Preset, Save to and **Scan**.
- **Names come from the clipboard**, not from a sign-in: the admin's File names block gets **Copy all** (all rows of that listing, one name per line); the app's **Paste names** (⌘V, also offered when the app comes to the front with names on the clipboard) turns them into the steps. A single copied name works too (one step). So the app never re-computes a slug and needs no Supabase key: 0136's rule (match by SKU + role only) stays in one place.
- **Scan** saves `<name>.jpg` in the Save to folder and moves to the next step (Label A → Label B → Other photo, then `_4`, `_5`… on "Add photo"). An existing file is never overwritten without asking.
- **Presets** (the crop is a square around the guide, from the bed's top-left corner): *7" label* ≈ 90 mm, *12" label* ≈ 110 mm, *Whole record* = full bed; 600 dpi, JPEG. Values to confirm on the first real scans.
- Built with the Command Line Tools (no Xcode on the Mac) into an ad-hoc-signed `.app`: runs on Gio's Mac, not notarised (no Apple Developer account).
**Rule.** The scanner app never invents a file name: it only uses names produced by the admin (0136).
**Next (not built).** Upload the scan straight to the draft (needs the admin sign-in in the app) once Bulk reads SKU-prefixed names (0136 Next).
