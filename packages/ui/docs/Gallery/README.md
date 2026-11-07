# Gallery

The product images: two per product. Mirrors the PDP placement in Figma (`product image` ×2 on desktop, `mobile gallery` on mobile) — the Figma gallery component is still to be designed.

- **Desktop**: image 1 full width of its column, image 2 below at half width (2 of the 4 page columns), same gutter. Both visible, no interaction.
- **Mobile**: a horizontal swipe row, one column-wide square per screen, scroll-snap. The page sets `--zz-gallery-bleed` to its right margin so the scroller extends into it and the next image peeks (swipe hint, as in Figma). No indicators (none designed).

## API

| Prop | Values |
| --- | --- |
| `images` | `[{ src, alt }]` in order; the first is the main image |
| `device` | `desktop` · `mobile` · omitted = responsive |

## Dimensions (as in Figma)

Square images (1:1). Desktop gaps `gutter-small`. Mobile gap **1px** (Figma `mobile gallery` itemSpacing 1 — intentional).

## Open

- Figma `product image` fill is a plain `#f2f4f7` (ghost variable removed); no placeholder token decided yet.
- Figma gallery component to be designed; this follows the page placement.
