# ProductInfo

The text block of a product page: name + price, release info, tags, description, grading, and the sample players. Mirrors the Figma component `product info` (device=desktop | mobile).

Inner layout: a 3-column grid, no gaps. Row 1 = details (full width). Row 2 = samples — **desktop: middle column, stacked (gap 8); mobile: full width, in a row (gap 16, padding-bottom 8)**.

## API

| Prop | Values | Figma |
| --- | --- | --- |
| `device` | `desktop` · `mobile` · omitted = responsive | variant `device` |
| `title` | product name → `<h1>` | `product name` |
| `price` | formatted string | `price` |
| `releaseInfo` | "Label Format (Country)" | `release info` |
| `tags` | a `<TagGroup>` | `tags container` |
| `description` | copy notes | `Description` |
| `grading` | "Grading: VG+" | `Grading: VG+` |
| `samples` | `<PlayerButton>`s | `samples container` |

All text formatting (price, grading label) is done by the page, not here.

## Tokens used

Text `text-strong`. Type: `body-extra-large` (desktop) / `body-large` (mobile) for name, price, release info; `body-medium` for description and grading. Title row gap `gutter-small`.

## Dimensions (as in Figma)

title block padding-bottom 16 · tags block gap 8, padding-bottom 16 · description block gap 4, padding-bottom 16.

## Open

- Figma: all 8 text nodes have fill hardcoded `#000000` → bind `text/strong`.
- Figma `product name` placeholder reads "Artist 1 - Title 1 / Artist 2 - Title 2": split releases need a data model (sides) — not decided.
- Breakpoint: `--mobile` from tokens.json (<768px placeholder).
