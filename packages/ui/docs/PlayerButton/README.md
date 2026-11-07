# PlayerButton

A play/pause control for a sample: 24px icon + label, no border. Figma: `player button` (state default | hover | pressed | disabled) with the nested `_player button-icon` (state default | playing) exposed as `playing` ([0008](../../../../design/decisions/0008-building-blocks-stay-internal.md)).

## API

<!-- api: PlayerButtonProps -->
<!-- generated from components.d.ts by build-docs.js: edit the .d.ts, not this table -->
| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `playing` | `boolean` |  | Nested `_player button-icon` state=playing: pause icon instead of play. Also sets aria-pressed. |
| `disabled` | `boolean` |  | Native disabled; also drives the Figma state=disabled colour. |
| `children` * | `ReactNode` |  | Label (body-medium): the sample / track name. |
| `state` | `"default" \| "hover" \| "pressed" \| "disabled"` |  | Documentation only: pins an interaction state regardless of pointer. Do not use in product code. |

`*` required.
<!-- /api -->

`playing` and the interaction state are independent axes (a playing sample can be hovered). The page owns the audio and passes `playing`. States: [0009](../../../../design/decisions/0009-interaction-state-from-pseudo-classes.md).

## Tokens

Icon and label share the foreground; the box takes the background ([0007](../../../../design/decisions/0007-floating-actions-foreground-background.md)):

| state | foreground (icon + label) | background |
| --- | --- | --- |
| default | `action-floating-foreground-default` | `action-floating-background-default` |
| hover | `action-floating-foreground-hover` | `action-floating-background-hover` |
| pressed | `action-floating-foreground-pressed` | `action-floating-background-pressed` |
| disabled | `action-floating-foreground-disabled` | `action-floating-background-disabled` |

Type `body-medium`. Icons `icon/icon-play-ultra`, `icon/pause-ultra` (`currentColor`).

## Dimensions (Figma)

icon 24 · gap 0 · padding 0 · hug.
