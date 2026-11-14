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
| `soldOutNote` | `ReactNode` |  | Figma `sold out` + `sold out note`, an `Alert` (red box, decision 0077) above Checkout: says that sold lines are not in the order ("1 record sold out, not included.", decision 0064). Omit when the bag has no sold lines. |
| `soldOutNoteProps` | `Record<string, unknown>` |  | Extra attributes for the sold out note (data-*, hidden), so a script can fill it; rendered even without `soldOutNote`. |
| `minimumNote` | `ReactNode` |  | Figma `minimum note` (variant minimum=below), an `Alert` (red box, decision 0077) above Checkout: the minimum order and what is missing ("Minimum order 20€. Add 8€ more to check out.", decision 0072). Pass it with `checkoutDisabled` and point Checkout's aria-describedby (via `checkoutProps`) at the note, so the disabled button is never unexplained. |
| `minimumNoteProps` | `Record<string, unknown>` |  | Extra attributes for the minimum note (id, data-*, hidden), so a script can fill it; rendered even without `minimumNote`. |

`*` required.
<!-- /api -->

## Anatomy (Figma)

Column, gap `small` (8): Divider · subtotal row · shipping row (label left, value right, body/medium) · Checkout (Button primary, large, fill) · note (body/small).
Shipping (rates per zone) and tax are set in Stripe Checkout: the bag never shows a total.

## Accessibility

A `section` named "Summary"; the rows are a description list (`dt` / `dd`).
