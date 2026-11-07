# Zanza

Design system for Zanza, a headless vinyl record store (For Sale first, For Trade later). This is the **code-side mirror of the Figma file** `Zanza - Record Store`: every token here is a Figma variable, every component a Figma component. Figma is the source of design decisions; this system is where they become CSS variables and React components.

The source lives in the repo at `packages/ui/` (tokens.json, components.js, components.css, docs/). This artifact is **generated from it** by `npm run build:artifact` — edit the repo, not this page.

Deliberately minimal. Nothing is added here that is not defined in Figma.

## Principles

- **One decision, one place.** `accent` is the only brand decision. Change it and `surface-base` and `text-accent` follow.
- **Three tiers.** `_primitives` (raw values) → `_config` (brand decisions) → semantic (`text-*`, `icon-*`, `surface-*`, `action-*`). Components bind only to semantic tokens.
- **Code is English, flat, predictable.** Figma path `action/primary/background/hover` becomes `--action-primary-background-hover`. No renaming between tools.
- **No invention.** No motion, radius, shadow or spacing scale exists yet, so none is defined here. Gaps are listed as open items, not filled.

## Color

A palette of black, white, acid green (accent) and light blue (support-1) — plus a black alpha ramp (`black-a0` … `black-a80`) for states and overlays.

- The page is `surface-base` (→ `accent` → `acid-green`). Text on it is `text-strong` (black, ~16:1).
- `text-accent` is acid green and is only legal on dark grounds: never on `surface-base`.
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
| Button | page `buttons` → section `button` | ported: hierarchy × size × state |
| Tabs / Tab | page `tabs` → `tab group`, `tab` | ported: controlled selection, 4 states |
| Header | page `header` → `header` | ported: device desktop/mobile or responsive, composition of Button + Tabs |
| Breadcrumbs | page `breadcrumbs` → `breadcrumbs` | ported |
| Tag / TagGroup | page `tags` → `tag item`, `tag group` | ported: 3 sizes; `orientation` not ported |
| PlayerButton | page `buttons` → `player button` + `_player button-icon` | ported: state default/hover/pressed/disabled × nested `playing` |
| IconButton | page `buttons` → `icon button` | ported: state default/hover/pressed/disabled, 24px, icon slot |
| Player | page `player` → `player` + `_player controls` | ported: desktop / mobile / responsive, presentational (site owns playback) |
| ProductInfo | page `PDP` → `product info` | ported: desktop / mobile / responsive |
| ProductCard | page `PDP` → `product card` | ported: desktop / mobile / responsive |
| Gallery | page `PDP` → `product image` ×2, `mobile gallery` | ported from page placement; Figma component pending |

## Open items

Tracked in the repo, in `design/open.md` (the only backlog). The reasons behind the rules above are in `design/decisions/`.
