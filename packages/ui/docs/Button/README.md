# Button

The single action control: two hierarchies, four sizes, four interaction states, optional icon slots. Figma: page `buttons` → `button` (wraps `_button-states` and `_button-sizes`). `layout` (hug/fill) is not a prop: the parent decides the width.

## API

<!-- api: ButtonProps -->
<!-- generated from components.d.ts by build-docs.js: edit the .d.ts, not this table -->
| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `hierarchy` | `"primary" \| "secondary"` | `primary` | Visual weight. Figma: `hierarchy`. |
| `size` | `"large" \| "medium" \| "small" \| "extra-small"` | `medium` | Figma: `size`. large = 46px, medium = 38px, small = 32px, extra-small = 24px (border included). |
| `disabled` | `boolean` |  | Native disabled; also drives the disabled visual state. |
| `leadingIcon` | `ReactNode` |  | Icon slot before the label. Pass an &lt;svg>; it is sized and colored by the button. Figma: `leading icon`. |
| `trailingIcon` | `ReactNode` |  | Icon slot after the label. Figma: `trailing icon`. |
| `suffix` | `ReactNode` |  | Text after the label, same text style, gap 4: a count ("(3)", "21"), never concatenated into the label (0029). Figma: `suffix` + `suffix text`. |
| `children` | `ReactNode` |  | Label text. Rendered uppercase by the label text style. Omit for an icon-only button — then `aria-label` is required. |
| `state` | `"default" \| "hover" \| "pressed" \| "disabled" \| "active"` |  |  |
| `href` | `string` |  | When set, renders an &lt;a> styled as the button (navigation). |

`*` required.
<!-- /api -->

States: [0009](../../../../design/decisions/0009-interaction-state-from-pseudo-classes.md). Disabled: label struck through, both hierarchies.

## Tokens

- Background `action-{hierarchy}-background-{state}` · border (1px) `action-{hierarchy}-border-{state}`
- Secondary: the border pattern carries the state, background stays `black-a0` ([0005](../../../../design/decisions/0005-border-pattern-carries-state.md))
- Label / icon: primary `text-strong-invert` / `icon-strong-invert`; secondary and disabled `text-strong` / `icon-strong`
- Type: `label-medium` (large, medium), `label-extra-small` (small, extra-small)

## Dimensions (Figma, hardcoded)

| size | height | padding | gap | label gap | icon |
| --- | --- | --- | --- | --- | --- |
| large | 46 | 12 | 8 | 4 | 20 |
| medium | 38 | 8 | 8 | 4 | 20 |
| small | 32 | 8 | 8 | 4 | 14 |
| extra-small | 24 | 4 | 2 | 2 | 14 |

Heights include the 1px border: Figma includes strokes in layout ([0014](../../../../design/decisions/0014-strokes-included-in-layout.md)).
