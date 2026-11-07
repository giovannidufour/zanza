# 0006 — Figma strokes are inside: padding minus border

`2026-11-07` · superseded by [0014](0014-strokes-included-in-layout.md) · Figma: `_button-sizes` (2004:7442)

**Context.** Buttons rendered 2px taller than Figma: Figma inside strokes do not add to the box, CSS borders do.
**Decision.** Keep the 1px CSS border and write the padding as `calc(<figma padding> - 1px)`.
**Rule.** For any component with an inside stroke, padding = Figma padding − stroke width. Check rendered heights against Figma after porting.
**Where.** `components.css` Button. Tab and other bordered components: to verify (`open.md`).
