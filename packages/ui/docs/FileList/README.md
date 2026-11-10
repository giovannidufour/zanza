# FileList · FileItem

Ordered list of uploaded files in the admin (images, the sample of a line, samples overview). Figma: page-local `uploaded list` frames on BACKEND → Create — **no Figma component yet**.

## API

<!-- api: FileListProps FileItemProps -->
<!-- generated from components.d.ts by build-docs.js: edit the .d.ts, not this table -->
### FileList

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `onMove` | `(from: number, to: number) => void` |  | Called on drop after dragging a row (the other rows shift live to preview the new order), or when a row is moved with ↑ ↓ on its handle. Omit for a fixed order (no handles). |
| `children` | `ReactNode` |  | &lt;FileItem>s, each with a stable key. |

### FileItem

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `name` * | `string` |  | File name, e.g. "sample-name.mp3". Also names the buttons for screen readers. |
| `position` | `ReactNode` |  | Shown before the name. Default: the row number inside FileList, two digits ("01"). |
| `image` | `{ src?: string; alt?: string }` |  | Image file: the 40 × 40 thumbnail (empty = surface-support-1). |
| `featured` | `boolean` |  | Shows "(featured)". The admin sets it on the first image (the featured image is always position 1). |
| `featuredLabel` | `string` |  | Text of the featured marker. Default "(featured)". |
| `playing` | `boolean` |  | Audio file: pause icon instead of play. |
| `onTogglePlay` | `() => void` |  | Audio file: shows the play / pause IconButton. |
| `onRemove` | `() => void` |  | Shows the remove (×) IconButton. |
| `removeLabel` | `string` |  | Accessible name of the remove button. Default "Remove &lt;name>". |
| `reorderLabel` | `string` |  | Accessible name of the drag handle. Default "Move &lt;name>, position n of m (arrow up / down)". |
| `children` | `ReactNode` |  |  |

`*` required.
<!-- /api -->

## Behaviour

- FileList numbers the rows `01`, `02`… so a reorder never leaves stale positions.
- Reorder (only with `onMove`): drag a row: it follows the pointer, its number showing where it will land, leaves an empty slot there, and the other rows slide to the order it would have on drop, and the numbers follow the preview; dropping outside the list (or Escape) restores the old order. Or focus the handle and press ↑ ↓: the focus stays on the handle and the new position is announced (polite live region). Slides are disabled with `prefers-reduced-motion`.
- The featured image is always position 1: the admin sets `featured` on the first image (Gio, 2026-11-10).
- Play and remove are `IconButton`s, named "Play / Pause / Remove <file name>".
- `children` make the item full width: the remove button moves next to the file name (`file row`, gap 16) and the children go under it (gap 16): the samples overview puts the sample title `Input` there (Figma 2095:20507, [0021](../../../../design/decisions/0021-sample-title-defaults-to-line-title.md)). Dragging from a field inside the row selects text instead of moving the row.

## Tokens

Text `text-strong` · empty thumbnail `surface-support-1` · handle, play and remove: `action-floating-*` ([0007](../../../../design/decisions/0007-floating-actions-foreground-background.md)).

## Dimensions (Figma)

List gap 8 · row gap 16 (handle · content · remove) · content gap 8, top-aligned (image rows) or centred (audio rows) · thumbnail 40 × 40 · handle, play and remove 24 × 24 · text body-medium.
