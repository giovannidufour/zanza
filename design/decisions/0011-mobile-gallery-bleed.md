# 0011 — Mobile gallery bleeds into the page margins

`2026-11-07` · accepted · Figma: PDP mobile `mobile gallery` (frame 390, image 374)

**Context.** In Figma the second image peeks to the screen edge; in code it was clipped by the page margin.
**Decision.** The scroller extends into both margins (`width: auto`, negative margin = padding = scroll-padding = `--zz-gallery-bleed`, set by the page to `page-margin-mobile`). Items are 100% wide and snap.
**Rule.** A horizontal scroller inside a padded page bleeds with this pattern; the page, not the component, sets the bleed.
**Where.** `components.css` Gallery, `apps/storefront/pdp.css`.
