# 0039 — Mobile product card: the image column is at most 96px

`2026-11-10` · accepted (Gio) · Figma: page PDP → `product card` device=mobile (2050:13490)

**Context.** On mobile the card image took 4 of 12 columns (≈109–114px on a phone, up to ≈245px just below the breakpoint): too big next to the info, in PLP and in "You may also like".
**Decision.** Mobile only: the image column is capped at 96px; the info column takes the rest. Figma: the variant's grid is now 2 tracks, image `FIXED 96` + details `FLEX 1` (gap `gutter/small` unchanged), image fill with max width 96. Code: `min(4 of 12 columns, 96px)`, so on a viewport narrower than 320px the image still shrinks with the grid. Desktop unchanged. 96 is a literal: the `dimension` collection has no size tokens (Gio picked "a bit smaller", value proposed by Claude: 12 × 8).
**Rule.** A media column next to text on mobile gets a max width, so a wider phone gives the space to the text, not to the image.
**Where.** `packages/ui/components.css` (ProductCard mobile + responsive below `--mobile`).
