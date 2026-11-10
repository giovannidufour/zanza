# EntityField

A field whose value is one or more entities (artists, labels, tags): each chosen entity is a chip, typing opens a suggestion menu. Figma: the `input` with `chips` on (`_input-master` › `chips`, `chips content` = `_input chips`), `entity chip` (page tags), `entity option` (page input › building blocks). Decision [0020](../../../../design/decisions/0020-entity-fields-are-chip-inputs.md).

## API

<!-- api: EntityFieldProps -->
<!-- generated from components.d.ts by build-docs.js: edit the .d.ts, not this table -->
| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `id` | `string` |  | Id of the text box (the label points to it). |
| `label` | `ReactNode` |  | Figma: label text. |
| `optional` | `boolean` |  | Figma: optional. Shows "Optional" next to the label. |
| `optionalLabel` | `ReactNode` |  |  |
| `supportText` | `ReactNode` |  | Figma: support text. |
| `error` | `ReactNode` |  | Figma: state=error; replaces the support text. |
| `placeholder` | `string` |  | Placeholder of the text box. |
| `value` * | `EntityValue[]` |  | The chosen entities (controlled). |
| `options` | `EntityOption[]` |  | Suggestions. Matches: names that start with the text, then that contain it, then aliases; first 8. |
| `onChange` | `(value: EntityValue[], info: { added?: EntityValue; removed?: EntityValue; alias?: string \| null }) => void` |  | Called with the new list; `info.alias` is set when an alias was picked (the chip is the official name). |
| `multiple` | `boolean` |  | false = one chip; the text box is hidden while it is set (Label). |
| `allowCreate` | `boolean` |  | false hides "Create “…”". |
| `createLabel` | `string` |  | Verb of the create row. |
| `disabled` | `boolean` |  |  |
| `className` | `string` |  |  |
| `style` | `CSSProperties` |  |  |

`*` required.
<!-- /api -->

<!-- api: EntityChipProps -->
<!-- generated from components.d.ts by build-docs.js: edit the .d.ts, not this table -->
| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `label` | `ReactNode` |  |  |
| `onRemove` | `() => void` |  | Remove button handler; its accessible name is `removeLabel` or "Remove &lt;label>". |
| `removeLabel` | `string` |  |  |
| `state` | `"default" \| "hover" \| "focus"` |  | Documentation only: pins the Figma state. Do not use in product code. |

`*` required.
<!-- /api -->

- Menu rows: existing entity · alias ("spelling → official", picking it adds the official chip and reports `info.alias`) · "Create “…”" (last; hidden when the exact name exists). Highlighted row = `aria-activedescendant`.
- Keyboard: ↓ ↑ move, Enter picks, Escape closes, Backspace on the empty box removes the last chip. Leaving the field turns an exact official name into its chip; other text stays and is not a value.
- `multiple={false}` (Label): one chip, the text box is hidden while it is set; removing the chip gives the box back and focuses it.
- Height: chips are 24px and the field padding is 6 (Figma: instance override), so the field is 38px like a text field; it grows by rows when chips wrap.
- Focus: browser outline on the text box (as Input); chip focus = 2px `text-strong` outline (drawn, no focus token yet: design/open.md).

## Tokens

| part | token |
| --- | --- |
| field | `surface-accent`, border `border-divider-strong` (as Input) |
| chip | `surface-support-1`, label `text-strong` (body-small) |
| chip remove × (icon/icon-x-thin 16) | `icon-strong`; hover `surface-subtle` |
| menu | `surface-base` (opaque: it floats over the form, 0023), border `border-divider-strong` |
| option (body-medium) | `surface-base`, `text-strong`; active `surface-subtle`; alias official name `text-moderate` (body-small); create icon (icon/icon-plus-small-thin 20) `icon-strong` |
