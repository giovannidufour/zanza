# Alert

A message that blocks an action or changes what the user gets, in a red box: what is wrong and what to do. Figma: page `Bag` → `alert` (2026-11-14, decision [0077](../../../../design/decisions/0077-blocking-message-in-a-red-box.md)). Used by the bag: `layout=block` for the minimum order and sold out notes above Checkout (BagSummary `minimumNote`, `soldOutNote`); `layout=inline` for SOLD OUT / RESERVED on a bag line (BagItem, decision 0078). Not a toast: it stays while the condition holds.

## API

<!-- api: AlertProps -->
<!-- generated from components.d.ts by build-docs.js: edit the .d.ts, not this table -->
| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `layout` | `"block" \| "inline"` | `block` | Figma `layout`. block: a &lt;p>, padding small, fills its container. inline: a &lt;span>, padding 2/4, hugs (bag item SOLD OUT / RESERVED, decision 0078). |
| `children` | `ReactNode` |  | The message: what blocks the action and what to do, e.g. "Minimum order 20€. Add 8€ more to check out." |

`*` required.
<!-- /api -->

## Tokens

Background `surface-alert` (→ primitive `red` #e0201b) · text `text-strong-invert` (4.8:1, AA for body/small) · box against `surface-accent` 3.7:1, against white 4.8:1.

## Dimensions (Figma)

block: padding 8 (`small`) all sides, fills its container · inline: padding 2/4 (as Tag extra-small), hugs · text body/small · no radius, no border.
