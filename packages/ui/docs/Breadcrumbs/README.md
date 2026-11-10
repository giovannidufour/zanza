# Breadcrumbs

The path above the page content: `body-medium` items separated by `/`, a 1px rule below. Figma: `breadcrumbs` (slot of labels).

## API

<!-- api: BreadcrumbsProps BreadcrumbItem -->
<!-- generated from components.d.ts by build-docs.js: edit the .d.ts, not this table -->
### Breadcrumbs

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `items` * | `Array<BreadcrumbItem \| string>` |  | In order; the last item is the current page (never a link, aria-current="page"). |
| `active` | `ReactNode` |  |  |

### BreadcrumbItem

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `label` * | `ReactNode` |  | Item text. |
| `href` | `string \| null` |  | Link target; omitted or null = plain text. Ignored on the last item. |

`*` required.
<!-- /api -->

Items with `href` are links; the last item is never a link and carries `aria-current="page"`. Separators are `aria-hidden`. Default `aria-label`: "Breadcrumb".

## Tokens

Text `text-strong` · padding `small` (8) · rule `border-divider-strong`.

## Dimensions (Figma)

item gap 4 · rule 1px.
