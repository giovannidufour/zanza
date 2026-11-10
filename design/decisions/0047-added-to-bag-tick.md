# 0047 — "Added to bag" carries a tick as its trailing icon

`2026-11-10` · superseded by [0054](0054-in-bag-add-becomes-remove.md) · Figma: Button `trailing icon` on, `icon/icon-tick-large-thin`

**Context.** "Added to bag" (0046) was a label change only, same look as "Add to bag".
**Decision.** The Add buttons of a copy in the bag turn on the Button's trailing icon with the tick (`TickLargeThinIcon`), on card (desktop and mobile "Added"), PDP and player. Removed again when the copy leaves the bag.
**Rule.** A done state on a Button is told by label + trailing tick, never by `disabled`.
**Where.** `packages/ui/components.js` (TickLargeThinIcon), `apps/storefront/build.js` (`#zz-icon-tick` template), `scripts/site.js` (`syncAddButton`). Amends 0046.
