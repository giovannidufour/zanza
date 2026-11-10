# Dialog

A modal confirmation for irreversible actions. Figma: page `dialog` → `dialog` (2026-11-10, first used on BACKEND → Listings, "delete confirm").

## API

<!-- api: DialogProps -->
<!-- generated from components.d.ts by build-docs.js: edit the .d.ts, not this table -->
| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `open` * | `boolean` |  | Shown as a modal while true. Controlled. |
| `title` * | `ReactNode` |  | The question, with the count ("Delete 2 drafts?"). Figma: `title`. |
| `children` * | `ReactNode` |  | The consequence: what goes, what is skipped. Figma: `body`. |
| `confirmLabel` * | `ReactNode` |  | The confirm button: verb + count ("Delete 2 drafts"). Primary. |
| `cancelLabel` | `ReactNode` |  | Secondary button; gets the initial focus. Default "Cancel". |
| `onConfirm` * | `() => void` |  |  |
| `onCancel` * | `() => void` |  | Cancel button and Esc. |
| `busy` | `boolean` |  | The confirmed action is running: the confirm button ignores clicks and is aria-busy. |

`*` required.
<!-- /api -->

- Native `<dialog>` opened with `showModal()`: the browser traps focus, makes the page inert, and Esc fires `cancel` (→ `onCancel`). Closing returns focus to the element that opened it.
- Initial focus on Cancel: the safe choice for an action that cannot be undone.
- Title = the question with the count, body = the consequence (what goes, what is skipped), confirm label = verb + count. No destructive colour exists: the label carries the meaning.
- Reversible actions get no dialog: they show the result with Undo (decision [0024](../../../../design/decisions/0024-delete-drafts-archive-the-rest.md)).

## Tokens

| part | token |
| --- | --- |
| background | `surface-base` (opaque white in every mode, [0023](../../../../design/decisions/0023-surface-accent-and-opaque-base.md)) |
| border | `border-divider-strong` |
| text | `text-strong` |
| backdrop | `surface-scrim` |
