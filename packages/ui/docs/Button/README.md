# Button

The single action control: two hierarchies, two sizes, four interaction states, optional icon slots. One component — `layout` (hug/fill) is not a prop: the parent decides the width.

## API

| Prop | Values | Default | Figma |
| --- | --- | --- | --- |
| `hierarchy` | `primary` · `secondary` | `primary` | variant `hierarchy` |
| `size` | `large` (44px) · `medium` (36px) · `extra-small` (22px) | `medium` | variant `size` |
| `disabled` | boolean | `false` | variant `state=disabled` |
| `leadingIcon` | `<svg>` | — | boolean `leading icon` |
| `trailingIcon` | `<svg>` | — | boolean `trailing icon` |
| `children` | label text | — | text `label` |

`hover` and `pressed` come from `:hover` / `:active`. `data-state` exists only for documentation.

## Tokens used

- Background: `action-{hierarchy}-background-{state}`
- Border (1px, inside): `action-{hierarchy}-border-{state}`
- Label / icon, primary: `text-strong-invert` / `icon-strong-invert`; disabled and secondary: `text-strong` / `icon-strong`
- Type: `label-medium` (large, medium), `label-extra-small` (extra-small) — Inter 500 (Medium), uppercase, 0.1em tracking
- Disabled: label struck through (`text-decoration: line-through`), both hierarchies

## Dimensions (hardcoded, no dimension tokens yet)

| | padding | gap | icon |
| --- | --- | --- | --- |
| large | 12 | 8 | 20 |
| medium | 8 | 8 | 20 |
| extra-small | 4 | 2 | 14 |

## Open

- **Focus state**: not defined in Figma yet, so no focus style is shipped. Add a `border/focus` token before launch (WCAG 2.4.7).
- **extra-small is 22px tall**: below the 24px minimum target size (WCAG 2.5.8). Keep it for inline/dense contexts only.
- Figma still carries `prefix` / `suffix` text slots and an `active` axis with one value; not ported until their use case is decided.
