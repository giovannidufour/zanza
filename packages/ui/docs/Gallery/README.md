# Gallery

The product images, two per product. Mirrors the PDP frames in Figma (`gallery` 2138:1176 on desktop, `mobile gallery` on mobile): the Figma gallery component is not designed yet.

- **Desktop:** images stacked at the full width of the column, gap `gutter-small`. The box scrolls vertically on its own when it is taller than `--zz-gallery-max-height` (the page sets it; default none). No scrollbar; focusable, so the keyboard can scroll it ([0033](../../../../design/decisions/0033-pdp-gallery-scrolls-on-its-own.md)).
- **Mobile:** horizontal swipe row with scroll-snap, bleeding into the page margins ([0011](../../../../design/decisions/0011-mobile-gallery-bleed.md)). No indicators (none designed).

## API

<!-- api: GalleryProps GalleryImage -->
<!-- generated from components.d.ts by build-docs.js: edit the .d.ts, not this table -->
### Gallery

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `device` | `"desktop" \| "mobile"` |  | Omitted → responsive (breakpoint `--mobile` from tokens.json, &lt;768px placeholder). |
| `images` * | `GalleryImage[]` |  | In order; the first is the main image. |

### GalleryImage

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `src` * | `string` |  | Image URL. |
| `alt` | `string` |  | Alt text; empty = decorative. |

`*` required.
<!-- /api -->

## Dimensions (Figma)

Square images (1:1). Desktop gap `gutter-small`; mobile gap 1px (Figma itemSpacing 1, intentional).
