# Dialog

A modal confirmation before an action (admin: every bulk action, decision 0025). Figma: page `dialog` → `dialog` (2026-11-10, first used on BACKEND → Listings, "delete confirm").

## API

<!-- api: DialogProps -->
<!-- generated from components.d.ts by build-docs.js: edit the .d.ts, not this table -->
| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `open` * | `boolean` |  | Shown as a modal while true. Controlled. |
| `title` * | `ReactNode` |  | The question, with the count ("Delete 2 listings?"). Figma: `title`. |
| `children` * | `ReactNode` |  | The consequence: what goes, what is skipped. Figma: `body`. |
| `confirmLabel` * | `ReactNode` |  | The confirm button: verb + count ("Delete 2 listings"). Primary. |
| `cancelLabel` | `ReactNode` |  | Secondary button; gets the initial focus. Default "Cancel". |
| `onConfirm` * | `() => void` |  |  |
| `onCancel` * | `() => void` |  | Cancel button and Esc. |
| `busy` | `boolean` |  | The confirmed action is running: the confirm button ignores clicks and is aria-busy. |
| `choices` | `ReactNode` |  | A required pick under the body, e.g. which artist to keep when merging: pass a &lt;RadioGroup>. Figma: `choices`. |

`*` required.
<!-- /api -->

- Native `<dialog>` opened with `showModal()`: the browser traps focus, makes the page inert, and Esc fires `cancel` (→ `onCancel`). Closing returns focus to the element that opened it.
- Initial focus on Cancel: the safe choice.
- Title = the question with the count, body = the consequence (what goes, what is skipped), confirm label = verb + count. No destructive colour exists: the label carries the meaning.
- Reversible actions also show the result with Undo after they ran (decision [0025](../../../../design/decisions/0025-every-bulk-action-confirms-delete-any.md)).

## Tokens

| part | token |
| --- | --- |
| background | `surface-base` (opaque white in every mode, [0023](../../../../design/decisions/0023-surface-accent-and-opaque-base.md)) |
| border | `border-divider-strong` |
| text | `text-strong` |
| backdrop | `surface-scrim` |
