# ProductCard

A release in a list: cover, name and release info, tags, sample players, add button, price, description, grading and cover grade. Figma: page PDP → `product card` (device=desktop | mobile).

One markup for both variants; CSS grid places the blocks ([0016](../../../../design/decisions/0016-one-markup-blocks-placed-by-grid.md)):

- **Desktop:** 9-column grid, gap `gutter-small`. Image cols 1–2 (square) · info cols 3–5 (title block, tags, samples; gap 16) · purchase cols 6–9 (button fill, price; gap 8) with description + grading + cover below it.
- **Mobile:** 12-column grid, gap `gutter-small`. Image 4 cols, max 96px (0039) · info (title block, description, tags, samples) fills · purchase hugs, right-aligned (button hug, price). 16 below the content.

## API

<!-- api: ProductCardProps ProductCardImage -->
<!-- generated from components.d.ts by build-docs.js: edit the .d.ts, not this table -->
### ProductCard

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `device` | `"desktop" \| "mobile"` |  | Omitted → responsive (breakpoint `--mobile` from tokens.json, &lt;768px placeholder). |
| `image` | `ProductCardImage` |  | Figma `product image`: the cover, square. |
| `href` | `string` |  | Product page URL: the cover becomes a link to it (no visual change; a designed link style is in open.md). |
| `title` * | `ReactNode` |  | Figma `product name`. Rendered as a heading; it also names the card and its button. |
| `headingLevel` | `2 \| 3 \| 4` | `2` | Heading level of the title, to fit the page outline. |
| `releaseInfo` | `ReactNode` |  | Figma `release info`, e.g. "Label Format (Country)". |
| `price` | `ReactNode` |  | Figma `price`, already formatted. |
| `description` | `ReactNode` |  | Figma `description`. Desktop: purchase column, below the price; mobile: info column, below the title. |
| `grading` | `ReactNode` |  | Figma `grading`: the record's grade, already formatted ("Record: VG+ / VG"). |
| `cover` | `ReactNode` |  | Figma `cover` (boolean + text): the cover/sleeve grade below the record's, already formatted ("Cover: NM"). Omit when not graded. |
| `conditions` | `ReactNode` |  |  |
| `tags` | `Array<string \| { label: string; href?: string }>` |  | Tag labels, or `{ label, href }` for a tag that links somewhere. Rendered as a TagGroup: size large on desktop, small on mobile. |
| `samples` | `ReactNode` |  | &lt;PlayerButton>s, in a row (gap 8). |
| `onAdd` | `() => void` |  | Click on the add button. |
| `addHref` | `string` |  | Makes the add button a link (trade listings: the offer page, label "Make an offer" / "Offer"). |
| `addLabel` | `string` |  | Desktop button label (Figma: "Add to bag"). Default "Add to bag". |
| `addLabelShort` | `string` |  | Mobile button label (Figma: "Add"). Default "Add". |

### ProductCardImage

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `src` | `string` |  | Cover URL. Omitted → the empty square (surface/support-1). |
| `alt` | `string` |  | Alt text; empty = decorative (the title already names the release). |

`*` required.
<!-- /api -->

The title is a heading (`headingLevel`, default h2) and names the card (`aria-labelledby`); the add button points to it with `aria-describedby`, so a list of "Add" buttons stays distinguishable for screen readers.

Responsive (no `device`): both buttons are in the markup and CSS shows one per breakpoint (labels and sizes differ).

## Tokens

Text `text-strong` · image placeholder `surface-support-1` · grid gaps `gutter-small` · button = Button secondary.

Type:

| | desktop | mobile |
| --- | --- | --- |
| name, release info, price | `body-large` | `body-medium` |
| description, grading, cover | `body-medium` | `body-small` |
| tags | Tag `large` (`body-medium`) | Tag `small` (`body-extra-small`) |
| button | Button `medium`, fill | Button `small`, hug |

## Dimensions (Figma)

Info gap 16 (desktop) / 8 (mobile) · samples gap 8, mobile padding-top 8 · purchase gap 8 · description gap 4 · mobile details padding-bottom 16. Image square (proportions locked).
