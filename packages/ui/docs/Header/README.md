# Header

The site header: logo and store name on the left, section tabs in the middle (desktop), actions on the right, a 1px rule below. Figma: `header` (device=desktop | mobile). A composition of `Button` and `Tabs`: it defines no colours or type of its own besides the ones below.

## API

<!-- api: HeaderProps -->
<!-- generated from components.d.ts by build-docs.js: edit the .d.ts, not this table -->
| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `device` | `"desktop" \| "mobile"` |  | Which Figma variant to render. Omitted → responsive: one markup, CSS switches menu/tabs/logo size (breakpoint `--mobile` from tokens.json, &lt;768px placeholder). |
| `logo` | `ReactNode` |  | Logo image (&lt;img> or &lt;svg>). 64×64 on desktop, 48×48 on mobile. Figma: `logo` (boolean). Also rendered 36×36 inside the store name, shown only when the header sets `data-logo="inside"` (no room for the big one, decision 0094). |
| `storeName` | `ReactNode` |  | Store name shown in the bordered label box (from `site.json` → storeName). Figma: text layer `store name`. |
| `homeHref` | `string` |  | When set, logo + store name become ONE link to this URL (decision 0175): one tab stop, named by the store name. |
| `homeCurrent` | `boolean` |  | Figma `store name` state=active: the page is the home page. Lit like the active tab; aria-current="page" on the home link, which stays clickable (the storefront reloads the page). |
| `tabs` | `ReactNode` |  | A &lt;Tabs> element. Rendered on desktop only (Figma: no tabs in the mobile variant). |
| `actions` | `ReactNode` |  | Trailing actions, usually secondary &lt;Button>s (Figma: `trailing actions`, gap 8). |
| `search` | `ReactNode` |  | Figma boolean `search` (desktop): the search field, usually a &lt;form role="search"> with an &lt;Input variant="search">. Rendered 280px wide before `actions`. |
| `searchHref` | `string` |  | Figma boolean `search` (mobile): the magnifier Button links here (the search page). |
| `searchLabel` | `string` |  | Mobile only: accessible name of the magnifier Button. Default "Search". |
| `onMenuClick` | `() => void` |  | Mobile only: click handler of the hamburger button. |
| `menuLabel` | `string` |  | Mobile only: accessible name of the hamburger button. Default "Menu". |
| `menuProps` | `Record<string, unknown>` |  | Mobile only: extra attributes of the hamburger button (aria-controls, aria-haspopup="dialog", aria-expanded). |

`*` required.
<!-- /api -->

Without `device` it is responsive: one markup, CSS switches menu button / tabs / logo size at `--mobile` ([0004](../../../../design/decisions/0004-one-breakpoint-in-tokens.md)). Sticky behaviour is added by the site ([0010](../../../../design/decisions/0010-sticky-header-is-site-behaviour.md)).

## Tokens

- Background `surface-accent` (Figma fill on both variants)
- Store-name border (1px dashed `[8,8]`) and bottom rule: `border-divider-strong`
- Everything else comes from `Button` and `Tabs`

## Dimensions (Figma)

padding-top 8 · leading / trailing gap 8 · `space-between`, top-aligned · logo 64 desktop / 48 mobile · store-name box padding 8, `label-medium` · rule 1px.

## Placement

The header sits at the top of the page container, full width inside its padding (`page-margin-desktop` / `page-margin-mobile`, both 8 today). The preview shows it inside this container (dashed outline = page frame).
