# Pagination

The page bar under a PLP list: Previous, the page numbers with a gap "…", Next. Figma: page `pagination` → `pagination` (device desktop | mobile × position first | middle | last) and `_pagination gap`. Decision [0179](../../../../design/decisions/0179-plp-pagination.md).

- Built from secondary `Button`s. The current page is `state="active"` (link + `aria-current="page"`, [0045](../../../../design/decisions/0045-button-active-is-the-current-page.md)).
- Which numbers show is decided by `packages/pagination/pagination.js` (first, last, current ± 1 on desktop, current only on mobile; a gap stands for 2+ pages; 7 / 5 slots). The same file runs in the browser (`scripts/site.js`).
- Previous / Next only when there is a page to go to: never disabled (disabled = sold out, struck label).
- Desktop fluid: pages and gaps share the width, Previous / Next hug. Mobile: 38 × 38 squares, arrows without label (`aria-label` "Previous page" / "Next page").

## API

<!-- api: PaginationProps -->
<!-- generated from components.d.ts by build-docs.js: edit the .d.ts, not this table -->
| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `items` * | `PaginationItem[]` |  | The items to show, from packages/pagination `items(current, total)`. |
| `href` | `(page: number) => string` |  | The link of page n. @default n => "?page=" + n |
| `aria-label` | `string` | `Pages` | Accessible name of the nav. |

`*` required.
<!-- /api -->
