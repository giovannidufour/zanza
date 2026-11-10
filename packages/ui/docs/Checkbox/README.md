# Checkbox

A native checkbox with the Figma box and a label: 24px icon, gap 8, label `body-medium`. Figma: page `controls` → `checkbox` (state default | active).

## API

<!-- api: CheckboxProps -->
<!-- generated from components.d.ts by build-docs.js: edit the .d.ts, not this table -->
| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `label` | `ReactNode` |  | Text next to the box. Figma: the text layer (e.g. "Different spelling"). |
| `checked` | `boolean` |  | Native checked (controlled, with onChange). Figma: state=active. |
| `state` | `"default" \| "active"` |  | Documentation only: pins the Figma state when `checked` is not given. Do not use in product code. |

`*` required.
<!-- /api -->

- state=active = `checked`; the native input is visually hidden over the box, the row is the `<label>` (decision [0018](../../../../design/decisions/0018-form-fields-map-to-the-platform.md)).
- Focus: the browser ring around the box (no `border/focus` token yet). Disabled: not designed.

## Tokens

| part | token |
| --- | --- |
| box (icon/icon-square, icon/icon-square-tick) | `icon-strong` |
| label | `text-strong` (Figma: unbound `#000000`, see design/open.md) |
