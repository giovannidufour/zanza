# RelatedProducts

A titled list of product cards below the product ("More for sale:"). Figma: page PDP → `you may also like` (device=desktop | mobile).

- Top rule 1px `border-divider-strong` (strokes included in layout → CSS border + full padding, [0014](../../../../design/decisions/0014-strokes-included-in-layout.md)), padding 8 top/bottom.
- Title `body-medium`, then the `products list` slot: cards stacked, gap 8.
- The Figma `device` variant only swaps the card variant inside the slot; the layout is the same. So there is no `device` prop: pass `ProductCard`s with the device you need (or responsive).

## API

<!-- api: RelatedProductsProps -->
<!-- generated from components.d.ts by build-docs.js: edit the .d.ts, not this table -->
| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `title` * | `ReactNode` |  | Figma `title` (PDP: "More for sale:"). Rendered as a heading; it also names the section. |
| `headingLevel` | `2 \| 3 \| 4` | `2` | Heading level of the title; give the cards' titles the next level. |
| `children` | `ReactNode` |  | Figma slot `products list`: &lt;ProductCard>s, stacked (gap 8). |

`*` required.
<!-- /api -->

The section is named by its title (`aria-labelledby`). Give the cards `headingLevel` one level below the section's, so the outline reads section → releases.

## Placement (PDP)

- **Desktop:** row 2 of `pdp content`, columns 5–12 (next to the second product image).
- **Mobile:** full width after `pdp content` (which has padding-bottom 24), before the player.

## Tokens

Rule `border-divider-strong` · text `text-strong` · title `body-medium`. Padding and gap are literal 8 in Figma (open.md).
