# Alert

A message that blocks an action, in a red box: what is wrong and what to do. Figma: page `Bag` → `alert` (2026-11-14, decision [0077](../../../../design/decisions/0077-blocking-message-in-a-red-box.md)). First use: the bag's minimum order note above Checkout (BagSummary `minimumNote`). Not a toast: it stays while the condition holds.

## API

<!-- api: AlertProps -->
<!-- generated from components.d.ts by build-docs.js: edit the .d.ts, not this table -->
| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `children` | `ReactNode` |  | The message: what blocks the action and what to do, e.g. "Minimum order 20€. Add 8€ more to check out." |

`*` required.
<!-- /api -->

## Tokens

Background `surface-alert` (→ primitive `red` #e0201b) · text `text-strong-invert` (4.8:1, AA for body/small) · box against `surface-accent` 3.7:1, against white 4.8:1.

## Dimensions (Figma)

Padding 8 (`small`) all sides · text body/small · width: fills its container · no radius, no border.
