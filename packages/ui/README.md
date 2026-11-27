# HIGHMUZIK

Design system for HIGHMUZIK (formerly rythem-works, and before that Zanza), a headless vinyl record store (For Sale first, For Trade later). This is the **code-side mirror of the Figma file** `HIGHMUZIK - Record Store`: every token here is a Figma variable, every component a Figma component. Figma is the source of design decisions; this system is where they become CSS variables and React components.

The source lives in the repo at `packages/ui/` (tokens.json, components.js, components.css, docs/). This artifact is **generated from it** by `npm run build:artifact` — edit the repo, not this page.

Deliberately minimal. Nothing is added here that is not defined in Figma.

## Principles

- **One decision, one place.** `accent` is the only brand decision. Change it and `surface-accent` and `text-accent` follow.
- **Three tiers.** `_primitives` (raw values) → `_config` (brand decisions) → semantic (`text-*`, `icon-*`, `surface-*`, `action-*`). Components bind only to semantic tokens.
- **Code is English, flat, predictable.** Figma path `action/primary/background/hover` becomes `--action-primary-background-hover`. No renaming between tools.
- **No invention.** No motion, radius, shadow or spacing scale exists yet, so none is defined here. Gaps are listed as open items, not filled.

## Color

A palette of black, white, acid green (accent) and light blue (support-1) — plus a black alpha ramp (`black-a0` … `black-a80`) for states and overlays.

- The page is `surface-accent` (→ `accent` → `acid-green`). Text on it is `text-strong` (black, ~16:1). `surface-base` is opaque white in every theme: use it under floating layers (dialog), never `surface-accent`.
- Two themes = the two Figma modes of `color`: `frontend` (the shop, `:root`) and `backend` (the admin, `data-theme="backend"`: `surface-accent` is black-a4, translucent). See decision 0017.
- `text-accent` is acid green and is only legal on dark grounds: never on `surface-accent`.
- Buttons use `action-{primary|secondary}-{background|border}-{default|hover|pressed|disabled}`.

## Typography

Inter only. Two scales, same steps (micro → extra-large):

- `label-*` — Medium (500), uppercase, 0.1em tracking. Buttons, nav, meta.
- `body-*` — Regular (400), sentence case, no tracking. Copy.

The text-style **classes carry the sizes** (generated from tokens.json; size tokens come later). Components never write font-size, line-height, weight or tracking: each text node gets its class (`label-medium`, `body-small`…). For `device` omitted (responsive), a `<style>--mobile` variant applies below the breakpoint, e.g. `body-extra-large body-large--mobile`.

Inter is loaded from Google Fonts; no font files are shipped.

## Components

| Component | Figma | Status |
| --- | --- | --- |
| Button | page `buttons` → section `button` | ported: hierarchy × size × state (incl. `active` = current page, aria-current), `suffix` |
| Pagination | page `pagination` → `pagination`, `_pagination gap` | ported (0179): Buttons; numbers from packages/pagination; desktop fluid, mobile 38 squares |
| Tabs / Tab | page `tabs` → `tab group`, `tab` | ported: controlled selection, 4 states, `suffix` (counts, 0029), size extra-small (account nav, 0101) |
| Header | page `header` → `header` | ported: device desktop/mobile or responsive, composition of Button + Tabs |
| Breadcrumbs | page `breadcrumbs` → `breadcrumbs` | ported (PDP; PLP uses ActiveFilter, 0041) |
| ActiveFilter | page `active filter` → `active filter` | ported: device = chip size, set by the consumer |
| Tag / TagGroup | page `tags` → `tag item`, `tag group` | ported: 3 sizes; `orientation` not ported |
| PlayerButton | page `buttons` → `player button` + `_player button-icon` | ported: state default/hover/pressed/disabled × nested `playing` |
| IconButton | page `buttons` → `icon button` | ported: state default/hover/pressed/disabled, 24px, icon slot |
| Player | page `player` → `player` + `_player controls` | ported: desktop / mobile / responsive, presentational (site owns playback) |
| ProductInfo | page `PDP` → `product info` | ported: desktop / mobile / responsive |
| ProductCard | page `PDP` → `product card` | ported: desktop / mobile / responsive |
| BagItem | page `Bag` → `bag item` | ported: desktop / mobile / responsive × status available / unavailable (`notice`) |
| OrderItem | page `Account` → `order item` | ported (0101): BagItem without Remove |
| OrderRow | page `Account` → `order row` | ported (0101): one link per order, View not a tab stop |
| BagSummary | page `Bag` → `bag summary` | ported: subtotal, shipping "Calculated at checkout", Checkout, note |
| RelatedProducts | page `PDP` → `you may also like` | ported: one layout, cards carry the device; `action` = Figma `view all` (0119) |
| ProductReturnCard | page `PDP` → `product return card` | ported (0119): state default / hover; desktop PDP behaviour lives in the page |
| Gallery | page `PDP` → `product image` ×2, `mobile gallery` | ported from page placement; Figma component pending |
| Input | page `input` → `input` + `_input-master` | ported: variant text field / search / select / text area (2026-11-12, default state only) × size medium / compact; error, locked (admin) |
| DropZone | page `uploads` → `drop zone` | ported |
| FileList / FileItem | page `uploads` → `file item` (list = layout frame) | ported: type audio / image, state default / dragging, handle, featured, title field |
| DragHandle / useDragOrder | `drag handle` (icon bars-three 24) in `file item`, `listing row`, `listings table row` | ported (0129): the one drag & drop order of the admin, extracted from FileList; used by FileList and Listings |
| Alert | page `Bag` → `alert` | ported (0077): red box, used by BagSummary `minimumNote` and `soldOutNote` |
| Divider | page `divider` → `divider` | ported |
| ActionPanel | page `listing form` → `action panel` | ported |
| ListingStatus | page `listing form` → `listing status` | ported |
| ListingLine | page `listing form` → `listing line` | ported: removable, sample empty / uploaded, artist on label, marker (number, 0114) |
| TradeNote | page `Trade` → `trade note` | ported (0068): title, body, signature |
| DiscogsCard | page `Trade` → `discogs card` | ported (0068): label, handle, stats, link |
| Step | page `Trade` → `step` (was `trade step`) | ported (0068, renamed 0152) |
| ReleaseOption | page `Trade` → `release option` | ported (0069) |
| ReleaseList | page `Trade` → `release list` | ported (0069) |
| ChosenRelease | page `Trade` → `chosen release` | ported (0069) |
| ListingNav | page `admin` → `listing nav` | ported (0199, replaces BackLink of 0146): Back = Button secondary small + leading chevron-left → Listings tab; boolean `show jump to` |
| JumpTo | page `admin` → `listing nav` › jump to + `jump to menu` | ported (0199): Button + menu, search combobox over ReleaseOption rows (state current) |
| DiscogsLink | page `Create` (BACKEND) → `discogs link` | ported (0150): "On Discogs ↗", body/small underlined, new tab; admin Create / Edit listing under Discogs match |
| ContentGroupHead | page `Content` (BACKEND) → `content group head` | ported (0106): heading + help of an admin Content group |
| ContentRow | page `Content` (BACKEND) → `content row` | ported (0106): device mobile / desktop (responsive), where, edited, condition, Edit link |
| ContentEditorHead | page `Content` (BACKEND) → `content editor head` | ported (0106): back, title, where, actions (desktop; mobile = ActionBar) |
| LinkRow | page `Content` (BACKEND) → `link row` | ported (0106): layout inline / stacked, Remove |
| SectionRow | page `Content` (BACKEND) → `section row` | ported (0106): heading + text + Remove (page sections, trade steps) |
| ProgressBar | page `admin` (COMPONENTS) → `progress bar` | ported (0091): value 0–100, role=progressbar |
| AdminBar | page `admin` → `admin bar` | ported (0089, 0125): device desktop / mobile (responsive); mobile opens a MenuLayer dialog; no Create (0125) |
| ListingsHead | page `Listings` (BACKEND) → `listings head` | ported (0125): device desktop / mobile (responsive), Listings title + Bulk create / Create listing |
| Stat | page `Dashboard` (BACKEND) → `stat` | ported (0169): label, value, optional note and link (booleans `note`, `link`) |
| ListingsFilter | page `Listings` (BACKEND) → `listings filter` | ported (0128): device desktop / mobile (responsive), status tabs + search |
| ListingRow | page `admin` → `listing row` | ported (0089, 0123): admin list row on mobile (Listings, Attributes, order records), select, thumbnail, meta, price |
| Thumbnail | page `media` → `product image` at 40 × 40 | ported (0123): the record's photo in admin lists, empty square without a photo |
| OrderBlock | page `Orders` (BACKEND) → `order block` | ported (0100): title, body (line breaks kept), optional action |
| FormSectionHead | page `Create` (BACKEND) → `form section head` | ported (0113): heading of a Create / Edit listing section |
| Marker | page `listing form` → `marker` | ported (0114): 48px circle before a form block (line number, €€), aria-hidden |
| PriceFields | page `Create` (BACKEND) → `price fields` | ported (0114): Marker + Sale type + Price (+ `bargain` 0201, `paid` 0206), desktop grid / mobile stacked |
| ActionBar | page `admin` → `action bar` | ported (0089): form actions sticky at the bottom on mobile, optional status line |
| Checkbox | page `controls` → `checkbox` | ported: state default / active (= checked) / indeterminate, `label` boolean (hideLabel), native input |
| Dialog · NewsletterDialog | page `dialog` → `dialog`, `newsletter dialog` | ported: native `<dialog>` + showModal, surface-base, backdrop surface-scrim, `choices` (radio group); NewsletterDialog = head with close + FooterNewsletter (0121) |
| Toast | page `toast` → `toast` | ported: `message`, `action` (Undo), `dismiss`; ToastRegion + `toast.js` (one at a time, 6 s without action, live region), decision 0049 |
| Radio · RadioGroup | page `controls` → `radio` | ported: state default / active, `label` boolean (hideLabel), native radio in a fieldset |
| Filter · FilterBlock · Filters | page `filters` → `filter`, `filter block`, `filters` | ported: content label / tag × state × device (responsive), count; shop PLP (0028) |
| FiltersLayer · FilterFacet · PlpHeader · SelectButton | page `filters` → `filters layer`, `filter facet`, `PLP header` | ported: mobile filters, level main / facet, sticky actions; sort = native select as a button (0038) |
| MenuLayer · MenuGroup · MenuItem | page `menu` → `menu layer`, `menu item` | ported: mobile menu opened by the header hamburger (0060); also the admin mobile menu, MenuItem without href = action button (0089) |
| Footer · FooterLinks · FooterNewsletter | page `footer` → `footer`, `footer link list`, `footer newsletter`, `footer legal` | ported (0077): `<footer>` landmark, newsletter slot, link columns, legal + copyright; desktop / mobile responsive |
| SectionHead · GenreLinks · HomeIntro · HomeNewsletter · ProductTile · GalleryCounter · ViewToggle · CollectionCard · HomeCollections | page `Home` → `section head`, `genre links`, `home intro`, `home newsletter`, `view toggle`, `collection card`, `home collections` (0174); page `product card` → `product tile`, `gallery counter` | ported (0120, Home v2; HomeAbout removed): home blocks; Header `homeCurrent` = `store name` state=active |
| EntityField · EntityChip | `input` › `chips` + `_input chips`, `entity chip` (tags), `entity option` (input › building blocks) | ported: chips, menu (entity / alias / create), keyboard; Label = one chip; chip size medium / large |
| LinkedInput | BACKEND → Create → `custom title`, `title link bar`, `title link menu` | ported (0147): links as character ranges over a native input; bar (Link artist / Clear link) never takes the focus; ⌘K; menu = search + record's artists first |

## Open items

Tracked in the repo, in `design/open.md` (the only backlog). The reasons behind the rules above are in `design/decisions/`.
