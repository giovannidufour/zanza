# 0074 — The bag item row uses the ProductCard gap

`2026-11-14` · accepted (Gio: the gap between the record image and its info in the bag should be the same as in the PLP cards) · Figma: page `Bag` → `bag item` (2169:6239), all variants

**Context.** `bag item` spaced cover, info and purchase with `medium-small` (16), twice the ProductCard column gap (`gutter/small`, 8) used on the PLP, so the same record read differently in the bag.
**Decision.** `bag item` itemSpacing is bound to `gutter/small` in every variant, in Figma and in code. One gap for the whole row, as the ProductCard grid uses one column gap: info → purchase becomes 8 too.
**Rule.** A card that shows a record (cover + info) spaces cover and info with `gutter/small`, the ProductCard column gap; never a literal or a different spacing token.
**Where.** `packages/ui/components.css` (`.zz-bag-item`), `packages/ui/docs/BagItem/README.md`. Amends 0044.
