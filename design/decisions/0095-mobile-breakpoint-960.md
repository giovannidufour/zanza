# 0095 — Mobile layout below 960px

`2026-11-15` · proposed · Figma: no breakpoint in Figma (decision 0004); frames unchanged (mobile 375, desktop as drawn)

**Context.** After the rename to "rythem-works" the desktop header (store name, For sale / For trade tabs, 280px search, Account, Bag) needs ~910px even without the logo (0094). Between 768px and ~910px (iPad portrait 768/810/820/834) the page scrolled sideways. The breakpoint `(max-width: 767px)` was a placeholder since 0004.
**Decision.** `tokens.json → breakpoint.mobile` = `(max-width: 959px)`: below 960px the whole site and the admin use the mobile layout (menu, magnifier, Bag only). 960 leaves ~50px of room for a longer Bag count. The logo rule of 0094 still applies on desktop: today it shows from ~1000px.
**Rule.** The desktop layout starts where the desktop header fits without the logo. If the header grows (new item, longer name), measure the widest header and move the breakpoint in tokens.json; never compact a component in a middle range.
**Where.** `packages/ui/tokens.json` (`breakpoint.mobile`); every `@media (--mobile)` and the admin's `CFG.media.mobile` follow at build time.
