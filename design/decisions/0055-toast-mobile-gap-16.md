# 0055 — On mobile the toast sits medium-small above the bottom, or the safe area if larger

`2026-11-10` · accepted (Gio) · supersedes [0052](0052-toast-clear-of-rounded-corners.md) · Figma: page `toast` → "toast — placement mobile, no player" (2183:387)

**Context.** 0052 (2 × `medium-small` + safe area) lifted the toast too high on an iPhone: Gio wants just enough room for the rounded screen corners.
**Decision.** On mobile, with nothing docked at the bottom, the toast region sits `medium-small` above the bottom edge, or `env(safe-area-inset-bottom)` when the browser reports a larger inset (`max()`, not a sum). With the shop player open it stays `gutter-small` above the player. Desktop unchanged.
**Rule.** Anything fixed to the bottom edge on mobile keeps `max(medium-small, safe area)` from it: never the sum.
**Where.** `packages/ui/components.css` (`--zz-toast-gap`).
