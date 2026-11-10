# 0049 — Toasts carry Undo and off-screen news; everything else stays inline

`2026-11-10` · accepted (Gio), amended by [0050](0050-added-to-bag-toast.md) (Add to bag gets a toast; actions also on the page time out) [0053](0053-toast-border-dash-16.md) (dashed border [16,16]) and [0052](0052-toast-clear-of-rounded-corners.md) (mobile bottom gap) · Figma: page `toast` (2177:438) → `toast` (2177:439), examples, placement desktop / mobile

**Context.** Feedback today is scattered: the Add buttons change label (0046), the admin writes a status line next to its buttons, bulk actions show a message bar with Undo, the PLP announces result counts to screen readers only. Removing a bag line has no feedback and no Undo. A toast was asked for; the map below shows it has a narrow job.

**Map of feedback points.** T = toast, I = inline, N = none (the UI change is the feedback; announce it to screen readers if it is visual only).

| # | Where | Event | Today | Proposed |
|---|---|---|---|---|
| 1 | Card, PDP, player | Add to bag | label "Added to bag" + tick + header count + SR announce | **N** (0046, 0047 are the feedback; keep the announce) |
| 2 | /bag/ | Remove a line | line disappears | **T** "Removed from bag." + Undo |
| 3 | /bag/ | A line is sold / reserved | `bag item` unavailable | **I** (state, stays until removed: 0044) |
| 4 | any page (future live check) | A copy in your bag was just sold | — | **T** "<record> was just sold." + View bag |
| 5 | /bag/ | Checkout cannot start (held, sold, network) | not built | **I** under Checkout, `role=alert` |
| 6 | Stripe return | cancel / success / hold expired | not built | **I** on /bag/ (cancel, expired) · **page** (order confirmation) |
| 7 | PLP | Filter, sort | count in a hidden status | **N** (keep the status) |
| 8 | Player | Sample cannot play | stays paused | **I** in the player (to design) |
| 9 | Trade form, account, favourites (paused) | sent / saved | — | **page** or **I** (button state like 0046); revisit with Q2 |
| 10 | Admin create / edit | Save, publish, status change, restore | status line, side column | **I** (keep: next to the button, holds the "shop updates in ~2 min" note) |
| 11 | Admin create / edit | Field errors, upload type rejected, Discogs error | field + status line | **I** (errors are never toasts) |
| 12 | Admin uploads | per-file progress / failure | status line | **I** in the `file item` row (to design) |
| 13 | Admin Listings, Attributes | Bulk publish / unpublish / archive / delete / merge | message bar with Undo, hidden while rows are selected | **T** (+ Undo for the reversible ones): the rows have moved tab or are gone |
| 14 | Admin | Data not loaded (suggestions, listings) | status line | **I** (persistent, with Retry when built) |

**Decision.**
- *When.* A toast confirms an action the person just did **whose result is no longer where they are looking** (the row left the list or the tab), or brings news about something **not on screen**. Inline when the result belongs to a field, control or region still visible, and for **every error** or anything that needs an answer (the Dialog asks first, 0025). None when the change on screen is the feedback.
- *One look, no types.* No success / info / warning / error variants, no icon: a toast never carries an error, and `text/alert` fails contrast anyway (open.md). Props: `message` (text), `action` (boolean, one secondary small Button), `dismiss` (boolean, IconButton ×). No `device` axis: width is page layout.
- *Look* (mirrors `dialog`, 0023): `surface/base`, 1px `border divider/strong`, padding and gap `medium-small`, body/medium `text/strong`, no radius, no shadow.
- *Where.* Bottom of the viewport, `gutter/small` above the player when it is open (the header hides on scroll, the bottom is stable and in thumb reach). Desktop: right-aligned at the page margin, 360 wide. Mobile: full width minus the page margins. Lives outside `.zz-page`, so it survives soft navigation (0015).
- *Stacking.* One at a time. A new toast replaces the current one; no queue.
- *Timing* (WCAG 2.2.1). Without an action: 6 s, paused while the pointer is over it, focus is inside it, or the tab is hidden. With an action: **no timeout**; it stays until dismissed, replaced, or acted on. After Undo it is replaced by a text-only "Undone." toast.
- *Accessibility.* One live region (`role=status`, `aria-live=polite`, `aria-atomic=true`) in the static HTML at load, filled when a toast shows. Never moves focus (0043). Esc closes it when focus is inside; then focus returns to where it came from, or the nearest neighbour if that is gone (0043). Contrast `text/strong` on `surface/base` 21:1. Motion: enter / leave with the placeholder 150 ms, none with reduced motion.
- *Copy.* Past tense, what + object, two lines at most, no "Successfully", no exclamation marks. Action = one verb ("Undo", "View bag").

**Rule.** Before adding feedback, place it in the map: a toast only for a done action whose result left the view, or for off-screen news; errors and anything needing an answer are inline or in a Dialog. One toast at a time, one action at most; a toast with an action never times out.

**Where.** `packages/ui/components.js` (Toast, ToastRegion), `components.css`, `toast.js` (behaviour, shared); `apps/storefront/build.js` (region + `js/toast.js` on every page), `base.css` (offset above the player), `scripts/site.js` (bag Remove + Undo); `apps/admin/index.html`, `build.js`, `admin.js` (Listings bulk actions + Undo, delete; Attributes delete, merge). Built: rows 2 and 13 of the map; row 4 waits for the live check.
