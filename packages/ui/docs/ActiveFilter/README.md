# ActiveFilter

PLP only: the filter reached from a link (artist, label, genre, tag) as one removable chip, in the place of the breadcrumbs, with the same frame (padding `small`, 1px rule below). Figma: page `active filter` → `active filter` (device=desktop | mobile). Decision [0041](../../../../design/decisions/0041-plp-active-filter-replaces-breadcrumbs.md).

## API

<!-- api: ActiveFilterProps -->
<!-- generated from components.d.ts by build-docs.js: edit the .d.ts, not this table -->
| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `children` | `ReactNode` |  | One removable &lt;EntityChip>: size medium on desktop, large on mobile (Figma `device`). Figma: `active filter`. |
| `aria-label` | `string` |  | Accessible name of the group. @default "Active filter" |

`*` required.
<!-- /api -->

A `role="group"` named "Active filter", not a `nav`: one chip is not a path. Hidden when no link filter is active; the list moves up (accepted). Figma `device` only switches the chip size (EntityChip `size` medium / large), so the code has no `device` prop.

## Tokens

Padding `small` (8) · rule `border-divider-strong`.

## Dimensions (Figma)

Desktop 57 (chip 40: the medium chip with padding-top/bottom 8, Figma 2026-11-12), mobile 61 (chip 44). Mobile matches the breadcrumbs; desktop no longer does (breadcrumbs 41, see `design/open.md`).
