# IconButton

An icon-only control: 24 × 24, the icon fills the box, no border. Figma: page `buttons` → `icon button` (state default | hover | pressed | disabled).

## API

<!-- api: IconButtonProps -->
<!-- generated from components.d.ts by build-docs.js: edit the .d.ts, not this table -->
| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `icon` | `ReactNode` |  | The 24px icon (an &lt;svg> using currentColor). Defaults to PlayIcon, the icon drawn in Figma. |
| `aria-label` * | `string` |  | Required: the button has no visible label. |
| `disabled` | `boolean` |  | Native disabled; also drives the Figma state=disabled colour. |
| `state` | `"default" \| "hover" \| "pressed" \| "disabled"` |  | Documentation only: pins an interaction state regardless of pointer. Do not use in product code. |

`*` required.
<!-- /api -->

States: [0009](../../../../design/decisions/0009-interaction-state-from-pseudo-classes.md).

## Tokens

Foreground on the icon, background on the box ([0007](../../../../design/decisions/0007-floating-actions-foreground-background.md)):

| state | foreground (icon) | background |
| --- | --- | --- |
| default | `action-floating-foreground-default` | `action-floating-background-default` |
| hover | `action-floating-foreground-hover` | `action-floating-background-hover` |
| pressed | `action-floating-foreground-pressed` | `action-floating-background-pressed` |
| disabled | `action-floating-foreground-disabled` | `action-floating-background-disabled` |

## Dimensions (Figma)

24 × 24 fixed · padding 0 · icon 24.
