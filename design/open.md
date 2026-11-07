# Open — the only backlog of design gaps

Everything undecided, parked or to fix lives here and nowhere else. When an item is decided it moves to a new file in [`decisions/`](decisions/README.md) and is deleted from this list. Product questions (Q1–Q7) are in [`../_context/open-questions.md`](../_context/open-questions.md).

## Pending decisions

- **Interaction overlay for all clickables.** Reuse `action/floating/background/*` as the hover/pressed tint everywhere, links included? Proposal: rename to `interaction/overlay/*`, add an inverse pair (`white-a4/a8`) for dark surfaces, keep the underline on links (WCAG 1.4.1), implement as a `::before` overlay. See [0007](decisions/0007-floating-actions-foreground-background.md).
- **Focus state.** None designed, none shipped. Needs a `border/focus` token before launch (WCAG 2.4.7). *Parked.*
- **Motion tokens.** 150ms ease-out (dashed border) and 200ms (header reveal) are placeholders. *Parked.*
- **Breakpoint value.** `<768px` is a placeholder in `tokens.json`. See [0004](decisions/0004-one-breakpoint-in-tokens.md).
- **Spacing scale / dimension tokens.** Paddings are hardcoded as in Figma; only `page-margin-*`, `gutter-small`, `small` exist. *Parked.*
- **Type size tokens.** Coming later; until then the classes carry the sizes ([0003](decisions/0003-type-styles-are-classes.md)).
- **PlayerButton disabled.** No strikethrough, unlike Button: intentional?
- **Gallery.** Figma component not designed yet; image placeholder fill `#f2f4f7` has no token. *Parked.*

- **Player track number.** Figma shows "1" next to the title and "1 of 3" in the controls; code maps the first to the track position on the record (A, B) — to confirm.
- **ProductCard link.** No link to the product page in Figma. Code: the cover is the link (`href`, no visual change, so the PLP is navigable). Proposal: the title becomes the link too (link style to design).
- **ProductCard "Add" (mobile).** Button small = 32px: passes WCAG 2.5.8 (24) but under the 44px touch recommendation (2.5.5).
- **"More for sale" content.** PDP `RelatedProducts` shows up to 3 other available products of the same section, most shared styles first (`apps/storefront/build.js` → `relatedTo`). Placeholder logic until the backend recommends.
- **PLP filters.** Hardcoded placeholder copied from Figma (`apps/storefront/pages/plp.js`), no state, no filtering, not focusable: replace with the filters component when designed (checkbox semantics, `filter/content=tag` variant).
- **PLP breadcrumbs.** Figma shows "For sale / Dancehall / 7”" (the applied filters); code shows only "For sale" until filters work.
- **PLP mobile filters.** Figma PLP - mobile has no filters: hidden below the breakpoint. Where they live on mobile (drawer from the hamburger? a "Filters" button?) is to design.
- **PLP sample labels.** Card samples are "1", "2" (Figma); the PDP shows the sample title. Accessible name in code: "<product>, sample 1: <title>".
- **Player "Add to bag".** Rendered, no action yet (no cart).
- **Sample audio.** `audio_url` must be a direct file (mp3/aac/ogg). Sample B uses a reggaefever.ch URL (hotlinking and rights to verify); sample A is still a generated test tone (`public/test-sample-a.mp3`). Depends on Q3.
- **Home link.** `/zanza/` is a meta-refresh page, so the soft navigation falls back to a full load there and the audio stops. Fixes itself with a real home page.

## Accessibility risks

- **IconButton** is exactly 24px: needs ≥ 24px clear space from neighbouring targets.

## Figma to fix

- Variables: `white-0/4/8/16/24` → `white-a*` · `border divider/strong` → `border/divider/strong` · `small`, `medium-small` → `space/*`.
- `_button-sizes`: `size` options ordered large, medium, extra small, small → order by size. Unported `prefix` / `suffix` slots and single-value `active` axis.
- `icon button`: no instance-swap property on the icon · `state=disabled` background bound to `…/default` instead of `…/disabled`.
- `tab`: single-value `hierarchy`, unused `layout` variant.
- `tag group / orientation=vertical` is not vertical · `tag item` gap 8 with one child.
- `product info`: 8 text nodes with hardcoded `#000000` → `text/strong` · placeholder name "Artist 1 - Title 1 / Artist 2 - Title 2" needs a data model for split releases.
- `product card`: all 10 text nodes have unbound fills (`#000000`) → `text/strong` · button and product image descriptions say "Codice: .cw-button · ui_button()" / ".cw-product-image · ui_product_image()": not Zanza names (`zz-`, React `Button`), looks copied from another project → rewrite · product image description says 80×80 (here it is 249 / 109).
- `you may also like`: padding 8 and gaps 8 literal (→ `small` / `gutter/small`?) · name vs title: component "you may also like", copy "More for sale:" → rename the component `related products` (code: `RelatedProducts`) · mobile variant width 375 hug vs desktop fill: make both fill · a loose instance (2061:18468) sits on the PDP page outside any frame: delete if it's a leftover.
- `PDP - mobile` › `pdp content`: padding-bottom 24 literal, no token for 24 (scale has 8 / 16) → add one (e.g. `medium`) or use 16.
- `PLP - desktop`: content frame named `pdp content`, list frame `Frame 46`, card instances `Frame 43/44/45` → `plp content`, `product list`, `product card`.
- `header` mobile: store-name frame named `logo` (desktop: `store name`).
- `player`: native-player placeholder fill unbound (placeholder only, fine).
- Icons: hamburger lines have a white stroke · `icon-pencil` uses unbound `#212121`.

## Code to do

- DS artifact (https://claude.ai/artifact/9Q7SAYDqDnBAj4MEKLnphz) not republished since the `--mobile` type variants: needs `npm run build:artifact` + publish.
- Component token tables in `docs/*/README.md` are still hand-written (API tables are generated).
