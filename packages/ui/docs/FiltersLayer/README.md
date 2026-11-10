# FiltersLayer · FilterFacet · PlpHeader · SelectButton

The shop's mobile filters (decision [0038](../../../../design/decisions/0038-mobile-filters-layer.md)). Figma: page `filters` → `filters layer` (level main | facet), `filter facet`, `PLP header` (device=mobile); `filter` device=mobile, `entity chip` size=large.

<!-- api: FiltersLayerProps FilterFacetProps PlpHeaderProps SelectButtonProps -->
<!-- generated from components.d.ts by build-docs.js: edit the .d.ts, not this table -->
### FiltersLayer

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `level` | `"main" \| "facet"` | `main` | main = applied recap + FilterFacet rows; facet = the options of one facet, with Back. Figma: `level`. |
| `title` * | `ReactNode` |  | Bar title: "Filters" on main, the facet name on facet. Figma: `facet` (level=facet). |
| `applied` | `ReactNode` |  | Applied filters as EntityChip size=large (level=main). Figma: `applied`. |
| `appliedLabel` | `ReactNode` | `Applied` | Recap heading. |
| `applyCount` | `ReactNode` |  | Records the current choice would show, Apply's suffix (0029). |
| `applyLabel` | `ReactNode` | `Apply` |  |
| `resetLabel` | `ReactNode` | `Reset` |  |
| `onApply` | `() => void` |  |  |
| `onReset` | `() => void` |  |  |
| `onBack` | `() => void` |  |  |
| `onClose` | `() => void` |  |  |
| `backLabel` | `string` |  | Accessible names of the icon buttons. @default "Back to filters" / "Close filters" |
| `closeLabel` | `string` |  |  |
| `children` | `ReactNode` |  | Level content: FilterFacet rows (main) or a FilterBlock (facet). |

### FilterFacet

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `label` * | `ReactNode` |  | The facet ("Subgenre"). label/medium, uppercase. Figma: `label`. |
| `value` | `ReactNode` |  | The ticked options ("Dancehall, Roots"), body/small text-moderate, one line. Omit when none. Figma: `value` + `value visible`. |

### PlpHeader

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `filters` | `ReactNode` |  | The filters trigger: Button secondary small "Filter" with the applied count as `suffix`. |
| `sort` | `ReactNode` |  | The sort: a SelectButton. |

### SelectButton

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `options` * | `{ value: string; label: string }[]` |  | The choices; the visible text is the selected option's label. |
| `value` | `string` |  |  |
| `defaultValue` | `string` |  |  |
| `hierarchy` | `"primary" \| "secondary"` | `secondary` |  |
| `size` | `"large" \| "medium" \| "small" \| "extra-small"` | `small` |  |
| `layout` | `"hug" \| "fill"` | `hug` | hug = content width; fill = full width (Figma button `layout`). |
| `prefix` | `ReactNode` |  | Text before the value, same style, gap 4 ("Sort:", desktop). Figma: `prefix` + `prefix text`. |

`*` required.
<!-- /api -->

- **FiltersLayer**: full height on `surface-accent`. Bar (back on level=facet · title `label-medium` · close), body that scrolls on its own, actions outside the body so they stay at the bottom: Reset (secondary, large) + Apply (primary, large, fill) with the record count as `suffix` (0029). Level main: "Applied" recap (EntityChip `size="large"`, wrap, gap 4) + FilterFacet rows; level facet: one FilterBlock (`hideLabel`: the bar title names it).
- **FilterFacet**: a `<button>`, padding-y 16, gap 8, bottom border; label `label-medium`, value `body-small` `text-moderate` (ellipsis), chevron 24.
- **PlpHeader**: the filters trigger (Button secondary small "Filter" + `suffix` "(3)") and the sort, space-between, bottom rule.
- **SelectButton**: a native `<select>` invisible over a Button look; the platform picker opens (Gio: every select is native).
- The page does the behaviour (apps/storefront/scripts/site.js): the layer is a native modal `<dialog>`, its ticks are a draft until Apply, close discards, Reset clears the draft.
