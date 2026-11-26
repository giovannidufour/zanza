# ZANZA

Small macOS app to scan record labels with the Canon CanoScan LiDE 100 straight to the file names of decision 0136.
Why and how it behaves: `design/decisions/0137-label-scanner-app.md`. Figma: BACKEND → `Scanner`.

## Build

```sh
apps/scanner/build.sh
```

Needs only the Command Line Tools (Swift 6, macOS SDK); no Xcode. Output: `apps/scanner/build/ZANZA.app`
(git-ignored), signed ad hoc, so it runs on this Mac only. Copy it to `/Applications` to keep it in Launchpad.

`Zanza --snapshot out.png` renders the window with sample names and quits (design check; native pickers and
text fields are not drawn by the renderer). `Zanza --test-scan <folder> <x mm> <y mm>` does a real Preview + Scan (300 dpi, 7") centred at x, y and writes preview.png, labels/ and originals/ in <folder>.

## Files

| File | Holds |
| --- | --- |
| `Sources/Scanner.swift` | ImageCaptureCore: finds and opens the scanner, scans an area (mm from the corner of the glass) to a CGImage; record presets (7", 10", 12", whole glass; 4" label) |
| `Sources/AppModel.swift` | State: names, settings (remembered), preview, selection square, Preview / Scan / save |
| `Sources/ImageOutput.swift` | Cuts and straightens the turned square; writes JPEG / PNG / TIFF with the dpi |
| `Sources/AutoTurn.swift` | Finds the upright turn of a label by reading its text (Vision) |
| `Sources/Names.swift` | Parses pasted names (`<sku>_<role>_<slug>`), role labels, next photo name |
| `Sources/ContentView.swift` | The window (mirrors the Figma screens) |
| `Sources/GlassView.swift` | The preview under the fixed guide (AppKit): drag, turn, trackpad rotate, grid and up figure while turning |
| `Sources/Pricing.swift` | Price tab (0196): sale type, price and conditions of a draft, read and written on the listing's own columns (PostgREST, admin session); € chip of the draft rows |
| `Sources/Theme.swift` | Colours and type styles from `packages/ui/tokens.json` (backend theme) |

## Icon

`AppIcon.icns` = the **ZANZA logo** (the illustration that was the shop logo until 0183; `apps/storefront/public/logo.png`,
Figma `zanza logo` on page assets) on the staging favicon's acid-green ground (0127), in the macOS rounded square (decision 0185).
The app is a Zanza platform tool, not HIGHMUZIK: never use the HM mark here. Figma: `favicon`, variant `environment=scanner`.
To remake it: `swift tools/make-icon.swift apps/storefront/public/logo.png icon1024.png`, then the iconset sizes with `sips`
and `iconutil -c icns`.
