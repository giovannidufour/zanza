# MenuLayer · MenuGroup · MenuItem

The mobile menu, opened by the header hamburger ([0059](../../../../design/decisions/0059-mobile-menu.md)). Figma: page `menu` → `menu layer`, `menu item` (state default | current). The page puts `MenuLayer` in a native modal `<dialog>` (`apps/storefront/pages/shell.js` → `SiteMenu`).

## API

<!-- api: MenuLayerProps -->
<!-- generated from components.d.ts by build-docs.js: edit the .d.ts, not this table -->
| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `title` | `ReactNode` | `Menu` | Bar title, also the name of the &lt;nav>. |
| `children` | `ReactNode` |  | MenuGroup elements. |
| `legal` | `ReactNode` |  | Legal links (&lt;a> elements), body-small, wrapping. Figma: `legal`. |
| `legalLabel` | `string` | `Legal` | Accessible name of the legal links group. |
| `closeLabel` | `string` |  | Accessible name of the close button. @default "Close menu" |
| `onClose` | `() => void` |  | Click on the close button (the storefront closes the dialog in scripts/site.js instead). |

`*` required.
<!-- /api -->

<!-- api: MenuGroupProps -->
<!-- generated from components.d.ts by build-docs.js: edit the .d.ts, not this table -->
| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `children` | `ReactNode` |  |  |

`*` required.
<!-- /api -->

<!-- api: MenuItemProps -->
<!-- generated from components.d.ts by build-docs.js: edit the .d.ts, not this table -->
| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `href` * | `string` |  |  |
| `label` * | `ReactNode` |  | Figma: `label`. Uppercase via CSS. |
| `detail` | `ReactNode` |  | Secondary text at the end of the row (Account: "Sign in to see your orders" or the email). Figma: `detail` + `detail text`. |
| `current` | `boolean` |  | The page you are on: aria-current="page", fill tab-background-active. Figma: state=current. |

`*` required.
<!-- /api -->

## Tokens

Layer `surface-accent` · bar and rows `border-divider-strong` · current row `tab-background-active` · detail `text-moderate` · bar padding `medium-small` × `page-margin-mobile` · body padding `small` / `medium-small` × `page-margin-mobile`, groups 24 apart (Figma literal, no token) · row padding `medium-small` × `small`.

## Accessibility

- Hamburger: `aria-haspopup="dialog"`, `aria-controls`, `aria-expanded`; accessible name "Menu".
- Native modal dialog: focus trapped, page behind inert, Esc and × close, focus back to the hamburger. On open the dialog itself takes focus (as the filters layer, 0043).
- The body is a `<nav>` named by the bar title; the current page row has `aria-current="page"`.
