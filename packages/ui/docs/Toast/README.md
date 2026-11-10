# Toast

A short, non-blocking confirmation of an action just done: Add to bag (+ View bag, 0050), a removed bag line or listings moved by a bulk action (+ Undo when reversible). Figma: page `toast` → `toast` (2177:439). Rules: decision [0049](../../../../design/decisions/0049-toast-feedback.md), including the map of which feedback is a toast, inline, or nothing.

## API

<!-- api: ToastProps ToastRegionProps -->
<!-- generated from components.d.ts by build-docs.js: edit the .d.ts, not this table -->
### Toast

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `message` * | `ReactNode` |  | What happened, past tense, two lines at most ("Removed from bag."). Figma: `message`. |
| `actionLabel` | `ReactNode` |  | One verb ("Undo", "View bag"): a secondary small Button. Omit for no action. Figma: `action`. With Undo it never times out; with an action also on the page (View bag) it closes after 6 s (0050). |
| `onAction` | `() => void` |  |  |
| `dismiss` | `boolean` |  | The × IconButton. Figma: `dismiss`. Default true. |
| `onDismiss` | `() => void` |  |  |
| `dismissLabel` | `string` |  | Accessible name of the ×. Default "Dismiss". |

### ToastRegion

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `aria-label` | `string` |  | Landmark name. Default "Notifications". |

`*` required.
<!-- /api -->

## Behaviour (`packages/ui/toast.js`)

`ZanzaToast.show({ message, actionLabel, onAction, actionElsewhere, returnFocus })` — framework-free, the same file in the shop and the admin. Needs one `ToastRegion` on the page (render it outside the content that soft navigation swaps, 0015).

- One at a time: a new toast replaces the current one. No queue.
- Without an action: closes after 6 s; the timer pauses while the pointer is over it, focus is inside it, or the tab is hidden.
- With an action only the toast offers (Undo): never times out (WCAG 2.2.1). With an action the page also offers (`actionElsewhere: true`, e.g. View bag = header Bag): 6 s like text only ([0050](../../../../design/decisions/0050-added-to-bag-toast.md)). The action runs `onAction` and closes the toast; after Undo, show "Undone.".
- Announced by the region's live region (`role=status`, polite, present at load). Focus never moves to a toast (0043). Esc closes it when focus is inside; focus then returns to `returnFocus` if it is still on the page.
- Never an error: errors stay inline or in a Dialog.

## Tokens

| part | token |
| --- | --- |
| background | `surface-base` (opaque in every mode, [0023](../../../../design/decisions/0023-surface-accent-and-opaque-base.md)) |
| border | `border-divider-strong`, 1px dashed [16,16] ([0053](../../../../design/decisions/0053-toast-border-dash-16.md)) |
| text | `text-strong` (body/medium) |
| padding, gap | `medium-small` |
| distance from the bottom / the open player | `gutter-small`; mobile without the player: `max(medium-small, safe area)` ([0055](../../../../design/decisions/0055-toast-mobile-gap-16.md)) |
| side margin | `page-margin-desktop` / `page-margin-mobile` |

## Dimensions

Desktop 360 wide, right-aligned at the page margin (Figma). Mobile: full width minus the page margins. Action: Button secondary small (32). Dismiss: IconButton 24 (WCAG 2.5.8 met with the 16 gap; under the 44 of 2.5.5, see `design/open.md`).
