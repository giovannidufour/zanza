# Zanza

Design system for Zanza, a headless vinyl record store (For Sale first, For Trade later). This is the **code-side mirror of the Figma file** `Zanza - Record Store`: every token here is a Figma variable, every component a Figma component. Figma is the source of design decisions; this system is where they become CSS variables and React components.

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
| Button | page `buttons` → section `button` | ported: hierarchy × size × state, `suffix` |
| Tabs / Tab | page `tabs` → `tab group`, `tab` | ported: controlled selection, 4 states, `suffix` (counts, 0029) |
| Header | page `header` → `header` | ported: device desktop/mobile or responsive, composition of Button + Tabs |
| Breadcrumbs | page `breadcrumbs` → `breadcrumbs` | ported (PDP; PLP uses ActiveFilter, 0041) |
| ActiveFilter | page `active filter` → `active filter` | ported: device = chip size, set by the consumer |
| Tag / TagGroup | page `tags` → `tag item`, `tag group` | ported: 3 sizes; `orientation` not ported |
| PlayerButton | page `buttons` → `player button` + `_player button-icon` | ported: state default/hover/pressed/disabled × nested `playing` |
| IconButton | page `buttons` → `icon button` | ported: state default/hover/pressed/disabled, 24px, icon slot |
| Player | page `player` → `player` + `_player controls` | ported: desktop / mobile / responsive, presentational (site owns playback) |
| ProductInfo | page `PDP` → `product info` | ported: desktop / mobile / responsive |
| ProductCard | page `PDP` → `product card` | ported: desktop / mobile / responsive |
| RelatedProducts | page `PDP` → `you may also like` | ported: one layout, cards carry the device |
| Gallery | page `PDP` → `product image` ×2, `mobile gallery` | ported from page placement; Figma component pending |
| Input | page `input` → `input` + `_input-master` | ported: variant text field / search / select × size medium / compact; error, locked (admin) |
| DropZone | page `uploads` → `drop zone` | ported |
| FileList / FileItem | page `uploads` → `file item` (list = layout frame) | ported: type audio / image, state default / dragging, handle, featured, title field |
| Divider | page `divider` → `divider` | ported |
| ActionPanel | page `listing form` → `action panel` | ported |
| ListingLine | page `listing form` → `listing line` | ported: removable, sample empty / uploaded, artist on label |
| Checkbox | page `controls` → `checkbox` | ported: state default / active (= checked) / indeterminate, `label` boolean (hideLabel), native input |
| Dialog | page `dialog` → `dialog` | ported: native `<dialog>` + showModal, surface-base, backdrop surface-scrim, `choices` (radio group) |
| Radio · RadioGroup | page `controls` → `radio` | ported: state default / active, `label` boolean (hideLabel), native radio in a fieldset |
| Filter · FilterBlock · Filters | page `filters` → `filter`, `filter block`, `filters` | ported: content label / tag × state × device (responsive), count; shop PLP (0028) |
| FiltersLayer · FilterFacet · PlpHeader · SelectButton | page `filters` → `filters layer`, `filter facet`, `PLP header` | ported: mobile filters, level main / facet, sticky actions; sort = native select as a button (0038) |
| EntityField · EntityChip | `input` › `chips` + `_input chips`, `entity chip` (tags), `entity option` (input › building blocks) | ported: chips, menu (entity / alias / create), keyboard; Label = one chip; chip size medium / large |

## Open items

Tracked in the repo, in `design/open.md` (the only backlog). The reasons behind the rules above are in `design/decisions/`.
