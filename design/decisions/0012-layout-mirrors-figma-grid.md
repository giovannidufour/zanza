# 0012 — Layout is CSS grid mirroring Figma grid auto layout

`2026-11-07` · accepted · Figma: `pdp content`, `product info` (2018:10107)

**Context.** Figma uses grid auto layout with anchors and spans.
**Decision.** Port Figma grids 1:1 to CSS grid: `gridColumnAnchorIndex` + `gridColumnSpan` → `grid-column: <anchor+1> / <anchor+1+span>` (e.g. product info samples: anchor 1, span 2 → `2 / 4`).
**Rule.** Read anchor and span from Figma; never approximate with flex or fixed widths.
**Where.** `apps/storefront/pdp.css`, `components.css` ProductInfo.
