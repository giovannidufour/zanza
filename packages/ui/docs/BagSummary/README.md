# BagSummary

The bag's subtotal and the way to checkout. Figma: page `Bag` → `bag summary`. Decision [0044](../../../../design/decisions/0044-bag-is-a-page.md).

## API

<!-- api: BagSummaryProps -->
<!-- generated from components.d.ts by build-docs.js: edit the .d.ts, not this table -->
| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `subtotalLabel` | `ReactNode` | `Subtotal` | Figma `subtotal label`, e.g. "Subtotal (3 records)". |
| `subtotal` | `ReactNode` |  | Figma `subtotal`, already formatted ("33€"). |
| `shippingLabel` | `ReactNode` | `Shipping` |  |
| `shipping` | `ReactNode` |  | Default "Calculated at checkout". The estimate ("5€") or "Not available" (Figma destination=not served). |
| `shipTo` | `ReactNode` |  | Figma `ship to`: the country select (Input variant select, label "Ship to") above the rows. |
| `totalLabel` | `ReactNode` | `Total` |  |
| `total` | `ReactNode` |  | Figma `total`, subtotal + shipping ("38€"). Omitted → no total row (destination=not served, or shipping not set up). |
| `checkoutLabel` | `string` | `Checkout` | Checkout button label (primary, large, fill). |
| `onCheckout` | `() => void` |  | Click on Checkout. |
| `checkoutDisabled` | `boolean` |  | Disables Checkout (e.g. nothing available to buy). |
| `checkoutProps` | `Record<string, unknown>` |  | Extra attributes for the Checkout button (data-*, aria-*). |
| `note` | `ReactNode` |  | Figma `note`, body/small, below the button. |

`*` required.
<!-- /api -->

## Anatomy (Figma)

Column, gap `small` (8): Divider · subtotal row · shipping row (label left, value right, body/medium) · Checkout (Button primary, large, fill) · note (body/small).
Shipping (rates per zone) and tax are set in Stripe Checkout: the bag never shows a total.

## Accessibility

A `section` named "Summary"; the rows are a description list (`dt` / `dd`).
