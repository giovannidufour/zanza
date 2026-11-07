# 0004 — One breakpoint, defined only in tokens.json

`2026-11-07` · accepted · Figma: none (frames are auto layout fill; mobile drawn at 375 on purpose)

**Context.** Figma has no breakpoint; values were starting to repeat in CSS files.
**Decision.** `tokens.json → breakpoint.mobile` = `(max-width: 767px)` (placeholder value). CSS writes `@media (--mobile)`; `media.js` expands it in every build.
**Rule.** Never write a pixel media query. Components with a `device` prop render the pinned variant; without it they are responsive.
**Where.** `tokens.json`, `media.js`, `build.js`, `build-artifact.js`.
