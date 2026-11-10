# DropZone

The upload area under each file list of the admin: a dashed box with a secondary Button that opens the file picker; files can also be dropped on it. Figma: page `uploads` → `drop zone` (2026-11-10). Its button is an exposed instance: the label is set on the instance.

## API

<!-- api: DropZoneProps -->
<!-- generated from components.d.ts by build-docs.js: edit the .d.ts, not this table -->
| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `label` * | `ReactNode` |  | Button label, e.g. "Browse image". |
| `accept` | `string` |  | Native accept, e.g. "image/*" or "audio/mpeg". |
| `multiple` | `boolean` |  | Allow several files. |
| `onFiles` | `(files: File[]) => void` |  | Called with the picked or dropped files. Filter by type in the handler: `accept` does not apply to drops. |
| `disabled` | `boolean` |  | Disables the button and ignores drops. |
| `name` | `string` |  | Name of the hidden file input. |

`*` required.
<!-- /api -->

## Tokens

Background `surface-subtle` · dashed border `border-divider-strong` · the Button keeps its own tokens (secondary, medium).

## Dimensions (Figma)

Padding 24 0, gap 8, content centred → 88 with a medium Button · border 1, dash [16, 16], drawn like the outlined controls ([0005](../../../../design/decisions/0005-border-pattern-carries-state.md)) · width: fills the parent.

No drag-over state in Figma (`design/open.md`).
