# PlayerButton

A play/pause control for a sample: 24px icon + label, no background or border. Mirrors the Figma component `player button` (state default | playing).

## API

| Prop | Values | Figma |
| --- | --- | --- |
| `playing` | boolean — swaps play → pause icon, sets `aria-pressed` | variant `state` |
| `children` | label (the sample / track name), `body-medium` | text `Label` |
| `onClick` | handler | — |

Playback itself is not in the component: the page owns the audio and passes `playing`.

## Tokens used

Label `text-strong`, icon `icon-strong`. Icons: `icon/icon-play-ultra`, `icon/pause-ultra` (exported paths).

## Dimensions (as in Figma)

icon 24 · gap 0 between icon and label.

## Open

- Figma: label fill hardcoded `#000000` → bind `text/strong`; `pause-ultra` fill unbound → `icon/strong`.
