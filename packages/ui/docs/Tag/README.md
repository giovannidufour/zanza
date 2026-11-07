# Tag

A static label chip (`Tag`, Figma `tag item`) and a wrapping list of them (`TagGroup`, Figma `tag group`). Non-interactive: no states.

## API

### Tag

| Prop | Values | Figma |
| --- | --- | --- |
| `size` | `extra-small` (18px) · `small` (22px, default) · `medium` (24px) · `large` (28px) | variant `size` |
| `children` | label text | text `Label` |

### TagGroup

| Prop | Values | Figma |
| --- | --- | --- |
| `children` | `<Tag>` elements; wraps, gap 4 | slot `tags` |

Figma's `orientation` axis is **not ported**: both variants are horizontal wrapping rows, they only differ by the tag size inside.

## Tokens used

- Background `surface-support-1` (→ `support-1` → `light-blue`)
- Text `text-strong`; type `body-extra-small` (extra-small, small), `body-small` (medium), `body-medium` (large)

## Dimensions (as in Figma)

| | padding | type |
| --- | --- | --- |
| extra-small | 2 / 4 | body-extra-small |
| small | 4 / 8 | body-extra-small |
| medium | 4 / 8 | body-small |
| large | 4 / 8 | body-medium |

Group gap 4.

## Open

- Figma `tag group / orientation=vertical` is not vertical.
- Figma `tag item` has `gap 8` with a single child (harmless).
