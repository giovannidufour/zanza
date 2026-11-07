# 0014 — Strokes included in layout: CSS border + full Figma padding

`2026-11-07` · accepted · supersedes [0006](0006-figma-strokes-are-inside.md) · Figma: `_button-states` (2004:7471), `_tab-states`

**Context.** 0006 assumed inside strokes never add to the box and removed 1px of padding. Wrong: `_button-states` and `_tab-states` have *strokes included in layout*, so in Figma the border adds too (medium = 36 + 2 = 38).
**Decision.** Keep the 1px CSS border with `box-sizing: border-box` and the Figma padding unchanged. Button heights: 46 / 38 / 32 / 24.
**Rule.** Before compensating a stroke, read `strokesIncludedInLayout` on the node that carries it: true → CSS border + Figma padding as is; false → padding minus stroke width. Always compare the rendered height with the outer Figma instance, not the inner `_sizes` frame.
**Where.** `components.css` Button, Tab.
