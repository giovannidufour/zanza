# 0009 — Interaction states come from pseudo-classes; `state` is doc-only

`2026-11-07` · accepted · Figma: every `state` variant

**Context.** Figma models hover/pressed as variants; in the browser they are runtime conditions.
**Decision.** `:hover`, `:active`, `:disabled` drive the visuals. A `state` prop sets `data-state` only to pin a state in documentation and previews.
**Rule.** Every interactive component styles `:pseudo` and `[data-state]` with the same rule; `disabled` is a real prop (native attribute). Focus is not designed yet (`open.md`): do not invent one.
**Where.** Button, Tab, PlayerButton, IconButton.
