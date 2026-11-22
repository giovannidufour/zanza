# Zanza Scanner

Small macOS app to scan record labels with the Canon CanoScan LiDE 100 straight to the file names of decision 0136.
Why and how it behaves: `design/decisions/0137-label-scanner-app.md`. Figma: BACKEND → `Scanner`.

## Build

```sh
apps/scanner/build.sh
```

Needs only the Command Line Tools (Swift 6, macOS SDK); no Xcode. Output: `apps/scanner/build/Zanza Scanner.app`
(git-ignored), signed ad hoc, so it runs on this Mac only. Copy it to `/Applications` to keep it in Launchpad.

`ZanzaScanner --snapshot out.png` renders the window with sample names and quits (design check; native pickers and
text fields are not drawn by the renderer).

## Files

| File | Holds |
| --- | --- |
| `Sources/Scanner.swift` | ImageCaptureCore: finds and opens the scanner, scans an area (mm from the corner of the glass) to a CGImage; size presets |
| `Sources/AppModel.swift` | State: names, settings (remembered), preview, selection square, Preview / Scan / save |
| `Sources/ImageOutput.swift` | Cuts and straightens the turned square; writes JPEG / PNG / TIFF with the dpi |
| `Sources/Names.swift` | Parses pasted names (`<sku>_<role>_<slug>`), role labels, next photo name |
| `Sources/ContentView.swift` | The window (mirrors the Figma screens) |
| `Sources/Theme.swift` | Colours and type styles from `packages/ui/tokens.json` (backend theme) |
