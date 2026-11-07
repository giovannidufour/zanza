# 0003 — Text styles are classes that carry the sizes

`2026-11-07` · accepted · Figma: text styles `label/*`, `body/*`

**Context.** Size tokens for type do not exist yet; components were rewriting font values.
**Decision.** Each Figma text style is generated as a class (`.label-medium`, `.body-small`…) carrying family, size, line-height, weight and tracking, plus a `.<style>--mobile` variant inside the mobile breakpoint.
**Rule.** A text node gets its class; components never write font properties. For a responsive component use `<desktop-style> <mobile-style>--mobile`. Do not propose type variables until the designer adds them.
**Where.** `build-tokens.js` (`styleRule`), every text node in `components.js`.
