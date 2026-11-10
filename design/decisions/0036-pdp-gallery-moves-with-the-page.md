# 0036 — PDP desktop gallery moves with the page and fits the window at rest

`2026-11-10` · proposed (Gio is testing it) · Figma: PDP - desktop `gallery` (2138:1176) · partly supersedes [0033](0033-pdp-gallery-scrolls-on-its-own.md)

**Context.** With 0033 the gallery was sticky and as tall as the window, but it starts below the header and breadcrumbs, so its bottom was off screen and image 2 never showed entirely while scrolling inside. Gio also wants the gallery to leave with the rest of the page: reading "More for sale", the big product image is no longer relevant.
**Decision.** Not sticky. The gallery still scrolls on its own, with max height = window − its resting top in the document − the open site player. The top is measured by `scripts/site.js` (`--pdp-gallery-top`, on load, after web fonts, on resize and after soft navigation), because the header and breadcrumb heights are not tokens.
**Rule.** A scroll area that must fit the window is sized from where it rests in the page, not from the full viewport height.
**Where.** `apps/storefront/pdp.css`, `apps/storefront/scripts/site.js`.
