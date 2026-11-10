# Radio

A native radio with the Figma control and a label: 24px control with the 18px icon centred, gap 8, label `body-medium`. Figma: page `controls` → `radio` (state default | active, boolean `label`), drawn by Gio 2026-11-10. `RadioGroup` = `<fieldset>` + `<legend>`, gap 8 (Figma: the `choices` of `dialog`).

## API

<!-- api: RadioProps RadioGroupProps -->
<!-- generated from components.d.ts by build-docs.js: edit the .d.ts, not this table -->
### Radio

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `label` | `ReactNode` |  | Text next to the control. Figma: the text layer. |
| `value` * | `string` |  | The value this radio stands for inside its RadioGroup. |
| `hideLabel` | `boolean` |  | Hide the label visually; it stays the accessible name. Figma: `label` = false. |
| `state` | `"default" \| "active"` |  | Documentation only: pins the Figma state outside a RadioGroup. Do not use in product code. |

### RadioGroup

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `name` | `string` |  | Shared input name. Default: a generated id. |
| `value` | `string` |  | The picked value (controlled). |
| `onValueChange` | `(value: string) => void` |  |  |
| `legend` | `ReactNode` |  | The question the group answers; required for screen readers. |
| `hideLegend` | `boolean` |  | Keep the legend for assistive tech only (e.g. inside a Dialog whose body already asks the question). |
| `children` * | `ReactNode` |  | &lt;Radio> elements. |

`*` required.
<!-- /api -->

- state=active = checked; the native input is visually hidden over the control, the row is the `<label>` (decision [0018](../../../../design/decisions/0018-form-fields-map-to-the-platform.md)). Arrow keys move between the radios of a group (browser).
- First use: the admin merge dialog ("keep which artist"), `Dialog` `choices`.
- Focus: browser ring around the control (no `border/focus` token yet). Disabled, error: not designed.

## Tokens

| part | token |
| --- | --- |
| control (icon/icon-radio-empty, icon/icon-radio-dot) | `icon-strong` |
| label | `text-strong` |
