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
| [0031](0031-subgenres-and-tags.md) | Subgenres (Discogs styles) and tags (the shop's own) are separate | accepted |
