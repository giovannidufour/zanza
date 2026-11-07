# 0005 — The border pattern carries the interaction state

`2026-11-07` · accepted · Figma: `tab` (2006:8519, 2006:8524), `_button-states` secondary (2004:7471)

**Context.** Outlined controls keep a black border in every state; the state had to be readable without a colour change.
**Decision.** Solid = default/active/disabled, dashed `[4,4]` = hover, dashed `[2,2]` = pressed. Background stays transparent. Solid → dashed animates by opening the gaps (`@property --zz-dash-on/off`, four 1px gradients), 150ms ease-out placeholder, off with `prefers-reduced-motion`.
**Rule.** Any outlined control (Tab, Button secondary, future ones) uses this pattern and the same mechanism; do not tint the background.
**Where.** `components.css` Tab, Button secondary.
