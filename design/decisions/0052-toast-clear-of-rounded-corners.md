# 0052 — On mobile the toast sits 2 × medium-small above the bottom, plus the safe area

`2026-11-10` · superseded by [0055](0055-toast-mobile-gap-16.md) · amends [0049](0049-toast-feedback.md) · Figma: page `toast` → "toast — placement mobile, no player" (2183:387)

**Context.** At `gutter-small` from the bottom, iPhones with rounded screen corners clipped the toast's corners.
**Decision.** On mobile, with nothing docked at the bottom, the toast region sits 2 × `medium-small` above the bottom edge plus `env(safe-area-inset-bottom)` when the browser reports one. With the shop player open the toast stays `gutter-small` above the player, which already covers the corners. Desktop is unchanged.
**Rule.** Anything fixed to the bottom edge on mobile keeps clear of the rounded corners: at least 2 × `medium-small` plus the safe area.
**Where.** `packages/ui/components.css` (`--zz-toast-gap`), `apps/storefront/base.css` (player open).
