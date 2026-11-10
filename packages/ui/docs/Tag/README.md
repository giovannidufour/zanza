# Tag

A static label chip (`Tag`, Figma `tag item`) and a wrapping list of them (`TagGroup`, Figma `tag group`). Non-interactive: no states. Figma's `orientation` axis is not ported (both variants are horizontal).

## API

<!-- api: TagProps TagGroupProps -->
<!-- generated from components.d.ts by build-docs.js: edit the .d.ts, not this table -->
### Tag

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `href` | `string` |  | Renders the tag as a link (&lt;a>). Same look; hover/focus states are not designed yet. |
| `size` | `"extra-small" \| "small" \| "medium" \| "large"` | `small` | Figma: `size`. extra-small = 18px, small = 22px, medium = 24px, large = 28px. |
| `children` * | `ReactNode` |  | Label text. Figma: `Label`. |

### TagGroup

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `children` * | `ReactNode` |  | &lt;Tag> elements; wraps, gap 4. Figma: slot `tags`. |

`*` required.
<!-- /api -->

## Tokens

Background `surface-support-1` · text `text-strong`.

## Dimensions (Figma)

| size | height | padding (v / h) | type |
| --- | --- | --- | --- |
| extra-small | 18 | 2 / 4 | body-extra-small |
| small | 22 | 4 / 8 | body-extra-small |
| medium | 24 | 4 / 8 | body-small |
| large | 28 | 4 / 8 | body-medium |

Group gap 4.
