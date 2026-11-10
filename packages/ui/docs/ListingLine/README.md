# ListingLine

One track line of a listing in the admin form: artist, title, "Different spelling" with "Artist name on label", and the line's sample. Figma: page `listing form` → `listing line` (2026-11-10).

## Figma → code

| Figma `listing line` | Code |
| --- | --- |
| `removable=false` (line 1) | no `onRemove` |
| `removable=true` (line 2+) | `onRemove` (+ `removeLabel`) |
| `sample=uploaded` | children = `<FileList>` with one `<FileItem>` (`handle=false`) |
| `sample=empty` | children = `<DropZone>` |
| `artist on label` | `credit` (pass it when the `spelling` Checkbox is checked) |
| exposed `artist`, `title`, `different spelling` | `artist`, `title`, `spelling` slots |

## API

<!-- api: ListingLineProps -->
<!-- generated from components.d.ts by build-docs.js: edit the .d.ts, not this table -->
| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `artist` * | `ReactNode` |  | Artist field (EntityField). Columns 1–4, or 1–3 when removable. |
| `title` * | `ReactNode` |  | Title field (Input). Columns 5–8, or 4–7 when removable. |
| `spelling` | `ReactNode` |  | The "Different spelling" Checkbox, row 2 under the artist. |
| `credit` | `ReactNode` |  | "Artist name on label" Input, row 2 under the title. Figma: `artist on label` boolean. Pass it only when `spelling` is checked. |
| `onRemove` | `() => void` |  | Figma `removable=true` (line 2+): shows the remove × in column 8 and narrows the artist to 3 columns. Omit for line 1. |
| `removeLabel` | `string` |  | Accessible name of the remove button, e.g. "Remove line 2". Default "Remove line". |
| `children` | `ReactNode` |  | The sample, below the fields (gap 8). Figma `sample`: uploaded = a FileList with one FileItem, empty = a DropZone (decision 0022). |

`*` required.
<!-- /api -->

## Dimensions (Figma)

Line: fields + sample, gap 8. Fields: 8-column grid, column gap 16, row gap 8. Line 1: artist 4 + title 4. Line 2+: artist 3 + title 4 + remove × (IconButton) in column 8. Row 2: spelling under the artist, credit under the title. Sample: gap 16.

Mobile (not drawn): one column in source order, like the other admin rows.

One sample per line ([0022](../../../../design/decisions/0022-one-sample-per-line.md)): the DropZone goes away once the line has one.
