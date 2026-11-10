# Design decisions

One file per decision, numbered, append-only. This is the record of **why** the system is the way it is; the code and Figma show **what** it is.

- **Never rewrite** an accepted decision. To change it, add a new one and mark the old `superseded by NNNN`.
- **Rule** is the line that gets applied to new components and pages. Write it as an instruction.
- No token values in a decision: name the tokens, the values live in `tokens.json`.
- Open questions and parked gaps are not decisions: they live in [`../open.md`](../open.md) until they are decided.

## Template

```md
# NNNN — Title

`YYYY-MM-DD` · accepted | superseded by NNNN · Figma: <node or —>

**Context.** What forced the choice (one or two sentences).
**Decision.** What was chosen.
**Rule.** The instruction to apply from now on.
**Where.** Files / components that implement it.
```

## Index

| # | Decision | Status |
| --- | --- | --- |
| [0001](0001-figma-decides.md) | Figma decides; code never invents visuals | accepted |
| [0002](0002-token-naming-and-tiers.md) | Token naming and three tiers | accepted |
| [0003](0003-type-styles-are-classes.md) | Text styles are classes that carry the sizes | accepted |
| [0004](0004-one-breakpoint-in-tokens.md) | One breakpoint, defined only in tokens.json | accepted |
| [0005](0005-border-pattern-carries-state.md) | The border pattern carries the interaction state | accepted |
| [0006](0006-figma-strokes-are-inside.md) | Figma strokes are inside: padding minus border | superseded by 0014 |
| [0007](0007-floating-actions-foreground-background.md) | Chromeless controls: floating foreground + background | accepted |
| [0008](0008-building-blocks-stay-internal.md) | `_` building blocks stay internal; nested props become flat props | accepted |
| [0009](0009-interaction-state-from-pseudo-classes.md) | Interaction states come from pseudo-classes; `state` is doc-only | accepted |
| [0010](0010-sticky-header-is-site-behaviour.md) | Sticky header is site behaviour, not a component prop | accepted |
| [0011](0011-mobile-gallery-bleed.md) | Mobile gallery bleeds into the page margins | accepted |
| [0012](0012-layout-mirrors-figma-grid.md) | Layout is CSS grid mirroring Figma grid auto layout | accepted |
| [0013](0013-docs-structure.md) | Docs: decision log, one backlog, API generated | accepted |
| [0014](0014-strokes-included-in-layout.md) | Strokes included in layout: CSS border + full Figma padding | accepted |
| [0015](0015-persistent-player.md) | Persistent player: native audio + soft navigation | accepted |
| [0016](0016-one-markup-blocks-placed-by-grid.md) | One markup per component; blocks moved between variants are placed by CSS grid | accepted |
| [0017](0017-figma-modes-are-themes.md) | Figma modes are themes on `[data-theme]` (frontend, backend) | accepted |
| [0018](0018-form-fields-map-to-the-platform.md) | Form fields: Figma states map to native state; props go to the control | accepted |
| [0019](0019-entity-suggestions-are-native.md) | Artist and label suggestions use the native datalist | superseded by 0020 |
| [0020](0020-entity-fields-are-chip-inputs.md) | Entity fields are chip inputs (the `input` with chips) | accepted |
| [0021](0021-sample-title-defaults-to-line-title.md) | The sample title defaults to its line title | accepted |
| [0022](0022-one-sample-per-line.md) | One sample per line | accepted |
| [0023](0023-surface-accent-and-opaque-base.md) | `surface/accent` is the page; `surface/base` is opaque white | accepted |
| [0024](0024-delete-drafts-archive-the-rest.md) | Delete drafts, archive the rest; bulk actions act where allowed | partly superseded by 0025 |
| [0025](0025-every-bulk-action-confirms-delete-any.md) | Every bulk action asks first; any listing can be deleted | accepted |
| [0026](0026-admin-blocks-are-components-layout-stays-frames.md) | Admin blocks are components; layout stays frames | accepted |
| [0027](0027-first-line-is-four-plus-four.md) | Line 1 is 4 + 4 columns, lines 2+ are 3 + 4 | accepted |
| [0028](0028-plp-filters.md) | PLP filters: facets from the data, plain text, OR inside / AND between | accepted |
| [0029](0029-counts-are-suffixes.md) | A count next to a label is the component's suffix | accepted |
| [0030](0030-admin-shop-preview.md) | The admin shows a live shop preview, built from the shop's components | accepted |
| [0031](0031-subgenres-and-tags.md) | Subgenres (Discogs styles) and tags (the shop's own) are separate | accepted |
| [0032](0032-create-page-on-surface-base.md) | The create / edit page is on `surface/base` | accepted |
| [0033](0033-pdp-gallery-scrolls-on-its-own.md) | PDP desktop gallery: images stacked, the column scrolls on its own | partly superseded by 0036 (not sticky) |
| [0034](0034-attributes-page.md) | Attributes: one admin page for artists, labels, subgenres and tags; removing a used one goes through Replace with | accepted |
| [0035](0035-media-graded-per-side.md) | The record is graded per side: `VG+ / VG`, side B optional | accepted |
| [0036](0036-pdp-gallery-moves-with-the-page.md) | PDP desktop gallery moves with the page and fits the window at rest | accepted |
| [0037](0037-record-and-cover-grade-lines.md) | Grading reads `Record: …`, plus `Cover: …` when the cover is graded | accepted |
| [0038](0038-mobile-filters-layer.md) | Mobile filters: full-screen layer, nested levels, draft until Apply; sort is a native select | accepted |
| [0039](0039-mobile-card-image-max-96.md) | Mobile product card: the image column is at most 96px | accepted |
| [0040](0040-card-title-links-to-pdp.md) | The product card title links to the product page | accepted |
| [0041](0041-plp-active-filter-replaces-breadcrumbs.md) | PLP: no breadcrumbs, only the filter reached from a link (artist, label, subgenre, tag) | accepted |
| [0042](0042-conditions-comment-own-line.md) | The stacked conditions comment is its own line, 4px from the cover grade like every line of the block | accepted |
| [0043](0043-hover-only-with-a-pointer-no-autofocus.md) | Hover only where the device hovers; nothing is focused on page or layer open | accepted |
| [0044](0044-bag-is-a-page.md) | The bag is a page; one line per copy; adding does not hold | accepted |
| [0045](0045-button-active-is-the-current-page.md) | Button `active` = the current page: a link with aria-current, never disabled | accepted |
| [0046](0046-added-to-bag-label.md) | A copy in the bag: its Add buttons read "Added to bag" and open the bag | accepted |
| [0047](0047-added-to-bag-tick.md) | "Added to bag" carries a tick as its trailing icon | accepted |
