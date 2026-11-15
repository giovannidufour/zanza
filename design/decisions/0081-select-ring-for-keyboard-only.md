# 0081 — SelectButton: the focus ring shows for keyboard focus only

`2026-11-14` · accepted (Gio: "after I pick or click away the element stays focused, I want it fixed") · Figma: none (focus is still not designed, design/open.md)

**Context.** On the PLP the Sort (`SelectButton`, a native `<select>` invisible over a Button) kept the browser ring after a mouse pick or a click outside. The rule already used `:focus-visible` (0063), but Chrome and Safari count a `<select>` as a keyboard-input control: it matches `:focus-visible` even when opened with the mouse. Checkboxes, radios and buttons don't have this problem.
**Decision.** Focus is left where the browser puts it (no `blur()`: keyboard and screen-reader users keep their place). Only the ring hides: the shop marks `data-focus-source="pointer"` on the `.zz-select-button` on pointerdown and removes it on any key press or when focus leaves; while it is set, the ring is off. Text inputs keep their ring on click, as the platform does (the caret needs it, and the user is about to type).
**Rule.** A focus ring is never removed by moving focus away; when a native control shows the ring after a pointer interaction, hide the ring (pointer modality on the outer box) and bring it back on the first key press.
**Where.** `packages/ui/components.css` (`.zz-select-button[data-focus-source="pointer"]`), `apps/storefront/scripts/site.js` (section 8, `initSelectFocus`).
