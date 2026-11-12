# 0066 — Icons are 1px strokes that keep their thickness at any size

`2026-11-12` · accepted (Gio) · Figma: page `icons` (each icon is a union of 1px-stroked vectors, lines, rectangles and ellipses)

**Context.** The icons in code came from Figma's SVG export, which flattens strokes into filled outlines. So an icon drawn at 24 and shown at 20 (or 14) got thinner lines, and a larger one got thicker lines. In Figma the strokes stay 1px whatever the size.
**Decision.** Every icon in `packages/ui` is drawn as in Figma: one `<path>` per Figma layer, `stroke="currentColor"`, `stroke-width="1"`, `vector-effect="non-scaling-stroke"`, with Figma's caps and joins. Inside-aligned strokes (envelope frame, radio ring, player triangles) are a 2px stroke clipped to the shape, which gives 1px inside. Solid shapes stay fills (play triangle, radio dot). Thin solid bars (pause, the bars of next and previous) become 1px lines. The markup is generated from the Figma layers (geometry, transforms, stroke settings) and lives in `strokeIcon(w, h, markup)`.
**Rule.** A new icon is copied from its Figma layers as strokes, not from "Export SVG" (that outlines strokes). Lines are 1px on screen at every size, and color comes from `currentColor` (Button, Tab and Input set it).
**Where.** `packages/ui/components.js` (`strokeIcon` and every `*Icon`).
