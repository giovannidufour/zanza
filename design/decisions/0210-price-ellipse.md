# 0210 — Store prices in an ellipse

`2026-11-27` · accepted (Gio, after a live test, PR #295) · Figma `price` on page `product card`

**Context.** Gio wanted the prices of the store in a black-bordered shape (Figma 2629:35192, a loose frame in the tile), then: "un ovale con altezza fissa in base al line height, e larghezza che si adatta". Tried live on a branch preview, merged as a test (#295), then asked for a clean design-system version.
**Decision.**
- One component, Figma `price` (page `product card`): auto-layout hug, padding 2 top/bottom, font size / 2 + 1 left/right; `outline` = an ellipse (1px border/divider/strong, inside) that stretches with the frame, because a corner radius can only draw a pill. TEXT prop `price`.
- `size` = small | medium | large | extra large = body/small | medium | large | extra large, i.e. the text style of the slot: card desktop large, card mobile medium, tile medium, PDP desktop extra large, PDP mobile large, return card small.
- `outline` (boolean, on): off for text that sits in the price slot but is not a price ("Trade only", "Your offer · 25€").
- Code: `Price` in packages/ui (`.hm-price`): height `1lh + 4px`, padding `0 0.5em`, 1px border, `border-radius: 50%`. No size prop: it inherits the slot's type class. Used by `priceText` (storefront shell) for fixed prices only.
- In product card, product info, product return card and product tile the old `price` text is now an exposed `price` instance (same visibility booleans; the tile and return card TEXT props `price` moved onto the instance).
- Not in the Bag (bag item, bag summary) nor in the order history (order item), not in admin: there a price is a line of a receipt, not a label on a record.
**Rule.** A price shown on a record in the store is a `Price` / Figma `price` instance at the slot's text size; anywhere else (Bag, orders, admin) a price is plain text.
**Where.** `packages/ui/components.js` (`Price`), `components.css` (`.hm-price`), `components.d.ts`; `apps/storefront/pages/shell.js` (`priceText`). Figma: `price` 2630:49557.
