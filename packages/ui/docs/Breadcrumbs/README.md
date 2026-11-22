# Breadcrumbs

The path above the PDP content (the PLP shows ActiveFilter, 0041): `body-medium` items separated by `/`, a 1px rule below. Figma: `breadcrumbs` (slot of labels).

## API

<!-- api: BreadcrumbsProps BreadcrumbItem -->
<!-- generated from components.d.ts by build-docs.js: edit the .d.ts, not this table -->
### Breadcrumbs

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `items` * | `Array<BreadcrumbItem \| string>` |  | In order. Items without a label are dropped. The last item is the current page only when it has no href (0122). |

### BreadcrumbItem

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `label` * | `ReactNode` |  | Item text. |
| `href` | `string \| null` |  | Link target; omitted or null = plain text. A last item without href is the current page (aria-current="page"). |

`*` required.
<!-- /api -->

Items with `href` are links, the last one included; a last item without `href` is the current page (`aria-current="page"`). Empty items are dropped, so a missing value never leaves a double "/". Each "/" is an `aria-hidden` span inside the following item, so the list holds only the path. Default `aria-label`: "Breadcrumb".

The PDP trail is **section / genre**, both links (0122): the record is the page's h1, the format is in the release info.

## Tokens

Text `text-strong` · padding `small` (8) · rule `border-divider-strong`.

## Dimensions (Figma)

item gap 4 · rule 1px.
