# 0063 — Input focus: the ring goes around the whole field

`2026-11-12` · accepted (Gio) · Figma: none (focus is still not designed, design/open.md)

**Context.** The browser focus ring was drawn on the native `<input>` / `<select>` inside `.zz-input__field`: a ring inside the field's border, with the icons and buttons left outside it. Gio: the focus ring must sit outside the input.
**Decision.** The native control drops its own outline; the field (`.zz-input__field`, border included) shows the browser ring when its control matches `:focus-visible`. Applies to every `Input` variant (text, search, select, affixes, locked) and to `EntityField`. The × and magnifier buttons inside a search field keep their own ring when they have focus. Still the browser's ring (`outline: auto`): colour, width and offset wait for a `border/focus` token. Behind `@supports selector(:has(*))`, so a browser without `:has` keeps the control's ring instead of none.
**Rule.** Focus is shown on the outer box of a composite control (field, select button, chip), never on the bare native element inside it; removing a native outline always comes with its replacement in the same rule block.
**Where.** `packages/ui/components.css` (`.zz-input__control`, `.zz-input__field`).
