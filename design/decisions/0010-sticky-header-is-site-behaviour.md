# 0010 — Sticky header is site behaviour, not a component prop

`2026-11-07` · accepted · Figma: `header` fill `surface-base`

**Context.** The header must follow the page on scroll down and come back sticky on scroll up, on desktop and mobile.
**Decision.** The behaviour lives in the site: `.site-header` (sticky) + `scripts/site.js` (moves 1:1 with scroll down, reveals on scroll up past 4px or on `focusin`; 200ms reveal placeholder; off with reduced motion). The Header component only carries its Figma background.
**Rule.** Page-level behaviour (scroll, routing, audio) belongs to `apps/storefront`, not to `packages/ui`.
**Where.** `apps/storefront/base.css`, `scripts/site.js`, `pages/pdp.js`.
