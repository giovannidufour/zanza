# ProductInfo

The text block of a product page: name + price, release info, tags, description, grading, cover grade, sample players. Figma: `product info` (device=desktop | mobile).

Inner layout: 3-column grid, no gaps ([0012](../../../../design/decisions/0012-layout-mirrors-figma-grid.md)). Row 1 = details, full width. Row 2 = samples: **desktop columns 2–3, stacked (gap 8); mobile full width, in a row (gap 16).** Padding-bottom on the component itself: **64 desktop, 32 mobile** (literal, no spacing token yet).

## API

<!-- api: ProductInfoProps -->
<!-- generated from components.d.ts by build-docs.js: edit the .d.ts, not this table -->
| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `device` | `"desktop" \| "mobile"` |  | Omitted → responsive (breakpoint `--mobile` from tokens.json, &lt;768px placeholder). |
| `title` * | `ReactNode` |  | Figma `product name` — rendered as a heading, &lt;h1> by default. |
| `headingLevel` | `1 \| 2 \| 3 \| 4 \| 5 \| 6` | `1` | Heading level of the title. The PDP keeps 1; inside another page (the admin preview) pass a lower level. |
| `price` | `ReactNode` |  | Figma `price`, already formatted. |
| `releaseInfo` | `ReactNode` |  | Figma `release info`, e.g. "Label Format (Country)". |
| `tags` | `ReactNode` |  | A &lt;TagGroup>. |
| `description` | `ReactNode` |  | Figma `Description`. |
| `grading` | `ReactNode` |  | Figma `grading`: the record's grade, already formatted ("Record: VG+ / VG"). |
| `cover` | `ReactNode` |  | Figma `cover` (boolean + text): the cover/sleeve grade below the record's, already formatted ("Cover: NM"). Omit when not graded. |
| `conditions` | `ReactNode` |  |  |
| `samples` | `ReactNode` |  | &lt;PlayerButton>s. Desktop: columns 2–3, stacked; mobile: full width, in a row. |

`*` required.
<!-- /api -->

All text formatting (price, grading and cover labels) is done by the page, not here.

## Tokens

Text `text-strong`. Type: name, price, release info `body-extra-large` (desktop) / `body-large` (mobile); description, grading and cover `body-medium`. Title row gap `gutter-small`.

## Dimensions (Figma)

title block padding-bottom 16 · tags block gap 8, padding-bottom 16 · description block gap 4, padding-bottom 16.
Component padding-bottom 64 (desktop) · 32 (mobile).
