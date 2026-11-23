# LinkedInput

A text field whose characters link to an artist: the Custom title of Create / Edit listing. Select characters (or click a name of the record, or a link): a small bar under the field offers **Link artist** (or ⌘K / Ctrl+K) and **Clear link** / **Remove link**. The bar never takes the focus, so Delete and typing work as usual. Link artist opens a menu: a search box, the record's artists first (the one matching the selection as *Suggested*), then the matches. Clear unlinks exactly the selected characters (a link can split in two). Typing moves the links with the text: inside a link stays in it, right before or after it does not.

Figma: BACKEND → Create → `custom title`, `title link bar`, `title link menu`. Decision [0147](../../../../design/decisions/0147-custom-title-links-by-hand.md).

How: the native input stays (caret, selection, editing, autofill); its text is transparent and a backdrop behind it draws the same text with the links underlined. Helpers on the function: `LinkedInput.cut(links, start, end)`, `.tidy(links)`, `.shift(links, oldText, newText)`, `.find(text, part)` (first whole-word match).

## API

<!-- api: LinkedInputProps -->
<!-- generated from components.d.ts by build-docs.js: edit the .d.ts, not this table -->
| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `id` | `string` |  |  |
| `label` | `ReactNode` |  | Figma: label text. |
| `optional` | `boolean` |  |  |
| `error` | `ReactNode` |  |  |
| `value` * | `string` |  | The text (controlled). |
| `links` * | `TextLink[]` |  | The links, as character ranges of `value` (controlled). |
| `onChange` | `(value: string, links: TextLink[]) => void` |  | Called with the new text and links (typing moves the links; Link / Clear change them). |
| `options` | `EntityOption[]` |  | Every artist the menu can search. |
| `suggested` | `{ id: string \| null; name: string }[]` |  | The record's artists: listed first in the menu (the one matching the selection as "Suggested"). |
| `names` | `string[]` |  | Names on the record: a click on one of them (not linked yet) offers Link artist for the whole name. |
| `linkLabel` | `string` |  | @default "Link artist" |
| `menuPlaceholder` | `string` |  | @default "Search artist" |
| `readOnly` | `boolean` |  |  |
| `disabled` | `boolean` |  |  |
| `className` | `string` |  |  |
| `style` | `CSSProperties` |  |  |

`*` required.
<!-- /api -->
