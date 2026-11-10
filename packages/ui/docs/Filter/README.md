# Filter · FilterBlock · Filters

The shop filter column (PLP). Figma: page `filters` (Gio's sketch, cleaned 2026-11-10): `filter` (content label | tag × state default | active, `count`), `filter block` (heading + slot), `filters` (the column).

## API

<!-- api: FilterProps FilterBlockProps FiltersProps -->
<!-- generated from components.d.ts by build-docs.js: edit the .d.ts, not this table -->
### Filter

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `label` | `ReactNode` |  | Option name. Figma: `Label`. |
| `count` | `ReactNode` |  | Records matching this option. Figma: `count` + `count text`. Omit to hide. |
| `content` | `"label" \| "tag"` | `label` | label = plain text (shop PLP), tag = a medium Tag. Figma: `content`. |
| `state` | `"default" \| "active"` |  | Documentation only: pins the Figma state when `checked` is not given. Do not use in product code. |

### FilterBlock

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `label` * | `ReactNode` |  | The facet ("Subgenre", "Format"). Figma: `Label`. |
| `hideLabel` | `boolean` |  | Keep the heading for assistive tech only. Figma: `label` = false. |
| `children` * | `ReactNode` |  | &lt;Filter> elements. Figma: slot. |

### Filters

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `children` * | `ReactNode` |  | &lt;FilterBlock> elements. |

`*` required.
<!-- /api -->

- **Filter**: a native checkbox (0018), 16px box (icon/icon-square ↔ icon/icon-square-tick), gap 8, label `body-small`, count `body-small` `text-moderate`. The whole row is the `<label>`: 16px high + gap 8 = 24px pitch (WCAG 2.5.8 by spacing).
- **FilterBlock**: `<fieldset>` + `<legend>` (`label-extra-small`), gap 16, options gap 8.
- **Filters**: blocks gap 24, padding 0 8.
- Shop: every option is `content="label"` (Gio, decision [0028](../../../../design/decisions/0028-plp-filters.md)). The logic is the page's (apps/storefront/scripts/site.js).
- Count in `text-moderate`: below 4.5:1, worse on the acid green page (design/open.md). Gio will change the value of `text/moderate`.

## Tokens

| part | token |
| --- | --- |
| box | `icon-strong` |
| label, heading | `text-strong` |
| count | `text-moderate` |
