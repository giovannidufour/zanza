# Player

The sample player docked at the bottom of the site: now playing (cover, track position, sample, product), actions, transport (`n of total`, previous · play/pause · next), the browser's native audio controls, close. Figma: `player` (device mobile | desktop) with the building block `_player controls` (state default | playing), page `player`.

- **Desktop:** one row, top-aligned: actions · now playing (fill) · controls (136) · native player (326) · close.
- **Mobile:** now playing + close / actions · controls (centred, space-between) / native player.

## API

<!-- api: PlayerProps -->
<!-- generated from components.d.ts by build-docs.js: edit the .d.ts, not this table -->
| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `device` | `"desktop" \| "mobile"` |  | Omitted → responsive (breakpoint `--mobile` from tokens.json). |
| `image` | `{ src: string; alt?: string }` |  | Cover of the product, 48 × 48. Figma: `product image`. |
| `trackPosition` | `ReactNode` |  | Track position on the record, e.g. "A". Figma: `sample number`. |
| `sampleTitle` * | `ReactNode` |  | The sample title, e.g. "Vocal". Figma: first `product name` text. |
| `productName` * | `ReactNode` |  | "Artist - Title". Figma: second `product name` text. |
| `index` | `number` | `1` | 1-based position of the sample in the queue ("1 of 3"). Previous is disabled at 1. |
| `total` | `number` | `1` | Queue length. Next is disabled at the last sample. |
| `playing` | `boolean` |  | Nested `_player controls` state=playing: pause icon instead of play. |
| `src` | `string` |  | Audio URL for the native player (a direct file: mp3, aac, ogg). |
| `actions` | `ReactNode` |  | Small secondary Buttons, e.g. "Add to bag" and "View" (href). Figma: gap 4. |
| `onPrevious` | `() => void` |  | Previous sample. |
| `onNext` | `() => void` |  | Next sample. |
| `onTogglePlay` | `() => void` |  | Play / pause. |
| `onClose` | `() => void` |  | Close button (top right): the site stops playback and hides the player. |
| `audioRef` | `Ref<HTMLAudioElement>` |  | Ref to the native audio element. |

`*` required.
<!-- /api -->

Presentational: it renders one sample and the native audio element. The site owns the queue, playback, docking and the slide in/out ([0015](../../../../design/decisions/0015-persistent-player.md)). Play and pause icons are both in the markup; `data-playing` on the player shows one, so a static page can switch them without React.

## Accessibility

`section` landmark "Player" · transport buttons labelled (Previous sample, Play/Pause, Next sample, Close player) · previous/next disabled at the ends of the queue · the title is a polite live region, so a track change is announced · "n of total" is hidden from screen readers (the live title carries the change).

## Tokens

- Background `surface-base` · top rule 1px `border-divider-strong` · text `text-strong`, type `body-medium`
- Transport and close: IconButton ([0007](../../../../design/decisions/0007-floating-actions-foreground-background.md)) · actions: Button secondary small

## Dimensions (Figma)

padding 8 / `page-margin-*` · desktop gap `gutter-small` · cover 48 · title row gap 8 · actions gap 4 · controls 136, gap 8 · native player 326 × 32 (desktop), full width × 32 with padding-bottom 8 (mobile). Height 65 desktop, 153 mobile.
