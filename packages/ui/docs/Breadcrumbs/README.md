# Breadcrumbs

The path above the page content: `body-medium` items separated by `/`, a 1px rule below. Mirrors the Figma component `breadcrumbs` (slot of labels).

## API

| Prop | Values | Figma |
| --- | --- | --- |
| `items` | `[{ label, href? } | string]` — in order; the last one is the current page | slot `slot container` |
| `aria-label` | default `"Breadcrumb"` | — |

Items with `href` render as links; the last item is never a link and carries `aria-current="page"`. Separators are `aria-hidden`.

## Tokens used

- Text `text-strong`, type `body-medium`
- Padding `small` (Figma dimension `small` = 8)
- Rule `border-divider-strong`

## Dimensions (as in Figma)

gap 4 between items and separators · padding 8 (token `small`) · rule 1px.

## Open

- Figma token `small` has no namespace (expected `space/small`).
