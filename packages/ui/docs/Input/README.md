# Input

Form field of the admin: label row, bordered field, support text. Figma: page `input` → `input` (type text field | search | select) over `_input-master` (size medium | compact × state default | filled | error | locked) and `_input-master-support text`.

## API

<!-- api: InputProps -->
<!-- generated from components.d.ts by build-docs.js: edit the .d.ts, not this table -->
| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `variant` | `"text-field" \| "search" \| "select"` | `text-field` | Figma `type` (renamed: `type` is the native input attribute). search adds the magnifying glass, select the chevron. |
| `size` | `"medium" \| "compact"` | `medium` | Figma `size`. medium = 38px field, compact = 30px. |
| `label` | `ReactNode` |  | Figma `label`. Rendered as a &lt;label> (body-small). Without it, pass `aria-label`. |
| `optional` | `boolean` |  | Figma `optional`: shows "Optional" right-aligned in the label row (part of the accessible name). |
| `optionalLabel` | `string` |  | Text of the optional marker. Default "Optional". |
| `supportText` | `ReactNode` |  | Figma `support text` (emphasis neutral). Linked with aria-describedby. |
| `error` | `ReactNode` |  | Figma state=error: alert border + this message in place of the support text (emphasis alert); sets aria-invalid. |
| `prefix` | `ReactNode` |  | Figma `prefix`, e.g. "€". Visual only: say it in the label too. |
| `suffix` | `ReactNode` |  | Figma `suffix`. Visual only. |
| `leadingIcon` | `ReactNode` |  | Figma `leading icon` (20px). Default: SearchIcon for search, none otherwise. |
| `trailingIcon` | `ReactNode` |  | Figma `trailing icon` (20px). Default: ChevronDownIcon for select, none otherwise. |
| `readOnly` | `boolean` |  | Figma state=locked: read-only, surface-subtle, no border (e.g. the automatic SKU). A locked select is disabled. |
| `placeholder` | `string` |  | Placeholder text. For select: the empty first option (Figma "Select"). |
| `children` | `ReactNode` |  | For select: the &lt;option>s. |
| `id` | `string` |  | id of the native control; generated when omitted. |
| `className` | `string` |  | On the wrapper. |

`*` required.
<!-- /api -->

## Mapping Figma → code

| Figma | Code |
| --- | --- |
| `type` text field / search / select | `variant` (`type` is the native attribute); select is a native `<select>` |
| state=default / filled | runtime: placeholder vs value |
| state=error | `error` (message replaces the support text, `aria-invalid`, `aria-describedby`) |
| state=locked | `readOnly` (select: `disabled`) |
| `_input-master-support text` emphasis neutral / alert | `supportText` / `error`; emphasis=success not ported (no use yet) |
| `label`, `optional`, `prefix`, `suffix`, `leading icon`, `trailing icon` | same names, flat ([0008](../../../../design/decisions/0008-building-blocks-stay-internal.md)) |

## Tokens

| Part | Token |
| --- | --- |
| field background | `surface-accent` (white in the backend theme) · locked: `surface-subtle` |
| field border | `border-divider-strong` · error: `border-alert` (provisional) · locked: none |
| label, value, prefix, suffix, support | `text-strong` |
| placeholder, "Optional", locked value | `text-moderate` |
| error message | `text-alert` (provisional) |
| icons | `icon-strong` |

## Dimensions (Figma)

Column gap 4 · label row gap 8 · field padding 8 / gap 8 (compact 4 / 4) · border 1, strokes included → field 38 (compact 30), locked 36 (28) · icons 20 · width: fills the parent.

Open points (contrast of the alert colour and `text-moderate`, focus, compact gap): [`design/open.md`](../../../../design/open.md).
