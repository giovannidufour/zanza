# 0018 — Form fields: Figma states map to native state; props go to the control

`2026-11-10` · accepted · Figma: `input` (193:4046), `_input-master` (183:1909)

**Context.** `_input-master` has state default | filled | error | locked and `input` has `type`; in the browser these are properties of the native element, and forms need `name`, `value`, `onChange` on the control, not on a wrapper.
**Decision.** filled = the control has a value (no prop); error = `error` (message replaces the support text, `aria-invalid`, `aria-describedby`); locked = `readOnly` (a select has none, so it is `disabled`). Figma `type` becomes `variant` (`type` is the native attribute); select is a native `<select>`. Every prop that is not part of the component API goes to the native control; `className`/`style` stay on the wrapper. The label row is a real `<label>` (the "Optional" marker is part of the name); prefix/suffix are visual only.
**Rule.** Future form components (checkbox, textarea, chip input) follow the same split: Figma-only props on the wrapper, everything else on the native element; never re-implement a native control.
**Where.** `components.js` Input.
