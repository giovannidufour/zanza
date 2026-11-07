# 0016 — One markup per component; variants that move a block are placed by CSS grid

`2026-11-07` · accepted · Figma: `product card` (2050:12869)

**Context.** In `product card` the description sits in the purchase column on desktop and in the info column on mobile. Figma auto layout cannot move a layer between frames, so the two variants have different layer trees; Gio asked to unify them only if the layout stays identical, which Figma cannot do.
**Decision.** Figma keeps one tree per variant, with the same layer names and the same spacing logic (container gap; extra space only where it is really needed). Code renders one markup and places the blocks with CSS grid per variant (`display: contents` on a wrapper when its children must join the outer grid). A control that changes label and size between variants (the add button) is rendered once per variant and shown by breakpoint in the responsive mode.
**Rule.** Never duplicate content nodes to follow a Figma tree; map both variants onto one DOM order (the reading order of the mobile variant) and place blocks with grid areas/rows. Spacing that must disappear with an optional block is a margin on that block, not a grid gap. Only controls whose label/size differ per variant may be duplicated, and the hidden one must be `display: none`.
**Where.** `packages/ui` ProductCard (`components.js`, `components.css`).
