# 0036 — PDP desktop gallery moves with the page and fits the window at rest

`2026-11-10` · accepted · Figma: PDP - desktop `gallery` (2138:1176) · partly supersedes [0033](0033-pdp-gallery-scrolls-on-its-own.md)

**Context.** With 0033 the gallery was sticky and as tall as the window, but it starts below the header and breadcrumbs, so its bottom was off screen and image 2 never showed entirely while scrolling inside. Gio also wants the gallery to leave with the rest of the page: reading "More for sale", the big product image is no longer relevant.
**Decision.** Not sticky. The gallery still scrolls on its own, with max height = window − its current top in the window − `page-margin-desktop` − the open site player, so its bottom stays one page margin above the window bottom (Gio): at rest the whole box is visible, and while the page scrolls the box grows until both images show whole (Gio: the container must not crop image 2 with page visible below it). The top is tracked by `scripts/site.js` (`--pdp-gallery-top`, on scroll via rAF, resize, web fonts, soft navigation), because the header and breadcrumb heights are not tokens.
**Rule.** A scroll area that must fit the window is sized from where it is in the window, not from the full viewport height, and never crops its content above visible page content.
**Where.** `apps/storefront/pdp.css`, `apps/storefront/scripts/site.js`.
