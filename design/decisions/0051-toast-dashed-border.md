# 0051 — The toast border is dotted: dashed [1,1]

`2026-11-10` · superseded by [0053](0053-toast-border-dash-16.md) · amends [0049](0049-toast-feedback.md) · Figma: `toast` (2177:439) stroke dashPattern [1,1]

**Context.** 0049 gave the toast the dialog's solid 1px border. Gio wants it dashed, black, and a pattern no state uses.
**Decision.** The toast keeps `border-divider-strong` at 1px, dashed [1,1] (it reads as dots). Drawn in CSS as four 1px repeating gradients, like the outlined controls and the drop zone. Checked on 2026-11-10: no other node in the Figma file uses [1,1].
**Rule.** Dash patterns carry meaning: [4,4] hover and [2,2] pressed of outlined controls (0005), [16,16] the drop zone, [1,1] the toast. A new dashed element takes a pattern that is not on this list, or reuses one only for the same meaning.
**Where.** `packages/ui/components.css` (`.zz-toast`).
