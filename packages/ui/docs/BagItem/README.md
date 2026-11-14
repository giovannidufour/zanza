# BagItem

One line of the bag: one copy (copies are unique, so there is no quantity: Remove only). Figma: page `Bag` → `bag item` (device desktop | mobile × status available | sold | reserved, text `notice`). Decision [0044](../../../../design/decisions/0044-bag-is-a-page.md).

## API

<!-- api: BagItemProps -->
<!-- generated from components.d.ts by build-docs.js: edit the .d.ts, not this table -->
| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `device` | `"desktop" \| "mobile"` |  | Omitted → responsive (breakpoint `--mobile` from tokens.json): desktop type = ProductCard desktop, mobile = ProductCard mobile. |
| `status` | `"available" \| "sold" \| "reserved" \| "unavailable"` | `available` | Figma `status`. sold: name in red (text-unavailable, decision 0078), "SOLD OUT" beside the struck price, no notice (decision 0064). reserved (held by someone else's checkout or by hand): the same, with "RESERVED" (decision 0065). Samples stay. `unavailable` is the pre-0064 name of reserved. |
| `notice` | `ReactNode` |  | The word beside the struck price of a sold / reserved line. @default "SOLD OUT" / "RESERVED" |
| `image` | `ProductCardImage` |  | Figma `cover`: the cover image, 96 × 96. |
| `href` | `string` |  | Product page URL: the title and the cover link to it. |
| `title` * | `ReactNode` |  | Figma `product name`. Rendered as a heading; it also names the line and its Remove button. |
| `headingLevel` | `2 \| 3 \| 4` | `2` | Heading level of the title, to fit the page outline. |
| `releaseInfo` | `ReactNode` |  | Figma `release info`. |
| `price` | `ReactNode` |  | Figma `price`, already formatted. status=sold: struck through, after "SOLD OUT". Not rendered when status=reserved. |
| `grading` | `ReactNode` |  | Figma `grading`, already formatted ("Record: VG+ / VG"). |
| `cover` | `ReactNode` |  | Figma `cover` grade line ("Cover: NM"). Omit when not graded. |
| `conditions` | `ReactNode` |  | The conditions comment on its own line, as in ProductCard. |
| `samples` | `ReactNode` |  | &lt;PlayerButton>s, in a row (gap 8), as in ProductCard. |
| `onRemove` | `() => void` |  | Click on Remove. |
| `removeLabel` | `string` | `Remove` | Remove button label. |

`*` required.
<!-- /api -->

## Anatomy (Figma)

Row, gap `gutter/small` (8, as ProductCard, [0074](../../../../design/decisions/0074-bag-item-gap-matches-product-card.md)): cover 96 × 96 · info (gap `small`: notice when sold or reserved, title block, grade lines with gap 4, samples) · purchase (right-aligned, gap `small`: price (struck through when sold, none when reserved), Remove = Button secondary small).
Type: desktop as ProductCard desktop (body/large, body/medium), mobile as ProductCard mobile (body/medium, body/small). Notice: label/small.

## Tokens

Text `text-strong`; record name of a sold / reserved line `text-unavailable` (red, [0078](../../../../design/decisions/0078-unavailable-name-in-red.md)). Remove: Button secondary tokens.

## Accessibility

The title is a heading and names the line (`aria-labelledby`); Remove is described by it, so a screen reader hears "Remove, Skullman - Gun Fool". The cover link is a duplicate of the title link: out of the tab order and hidden from screen readers.
