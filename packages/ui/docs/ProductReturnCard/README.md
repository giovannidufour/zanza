# ProductReturnCard

"Back to this record": a small card that takes the page back to the product it belongs to. Figma: page PDP → `product return card` (state default | hover).

- One `<button>`: cover 48 × 48 · name (`body-small`, max 2 lines, then …) + price (`body-small`) · chevron up (`icon-chevron-up-small-thin`).
- Padding and gap `small`, 1px border `border-divider-strong` (inside, [0014](../../../../design/decisions/0014-strokes-included-in-layout.md)), background `surface-accent`; hover lays `surface-hover` over it, so the card stays opaque over a photo.
- Presentational: the page decides when it shows and what pressing it does.

## API

<!-- api: ProductReturnCardProps -->
<!-- generated from components.d.ts by build-docs.js: edit the .d.ts, not this table -->
| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `image` | `{ src: string; alt?: string }` |  | Figma `cover`: 48 × 48, cropped to fill. Usually decorative (alt ""): the name is in the text. |
| `name` * | `ReactNode` |  | Figma `name` (body/small, max 2 lines, then …). |
| `price` | `ReactNode` |  | Figma `price` (body/small): the price, or "Trade only". |
| `state` | `'default' \| 'hover'` |  | Documentation only: pins the Figma state. Do not use in product code. |

`*` required.
<!-- /api -->

Give it an `aria-label` that says where it goes ("Back to Gregory Isaacs - Why Did You Leave"): the visible text alone ("name, 6€") does not say what the button does. The cover is decorative (`alt=""`).

## Placement (PDP desktop, [0119](../../../../design/decisions/0119-pdp-sticky-scroll.md))

- Docked `small` inside the bottom of the anchored gallery (columns 1–4), above the photos.
- Hidden until the "More for sale" band reaches its anchor (the record is fully covered); fades in and rises 8 (motion placeholder: 200ms ease-out, none with reduced motion). Hidden = `visibility: hidden`, so it is out of the tab order.
- Pressing it scrolls the page to the top and the gallery to its first photo in one animation (600ms placeholder), then moves focus to the record's title.
- Not on mobile.

## Tokens

Border `border-divider-strong` · background `surface-accent` (+ `surface-hover` on hover) · text `text-strong` · cover placeholder `surface-subtle` · padding / gap `small`.
