# Gallery

The product images, two per product. Mirrors the PDP placement in Figma (`product image` ×2 on desktop, `mobile gallery` on mobile): the Figma gallery component is not designed yet.

- **Desktop:** image 1 full width of its column, image 2 below at half width, same gutter.
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

Square images (1:1). Desktop gap `gutter-small`. Mobile gap 1px (Figma itemSpacing 1, intentional).
