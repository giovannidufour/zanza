# 0043 — Hover only where the device hovers; nothing is focused on load

`2026-11-10` · accepted (Gio) · Figma: no change (every `state` variant stays as drawn)

**Context.** On phones a tap leaves `:hover` applied until the next tap elsewhere, so buttons, the sort select and tabs kept their hover/pressed look after release. The mobile filters layer also focused its close button on open and the first option of a facet level, and soft navigation focused the page h1.
**Decision.** `:hover` styles apply only inside `@media (hover: hover)`; `:active` (pressed) still shows while the finger is down. `[data-state]` pins are unchanged (0009). No control is focused when a page or a layer opens: the filters dialog takes focus itself (`tabindex=-1`), a facet level focuses its title, soft navigation the h1. These non-control targets show no focus ring. Focus still returns to the opener on close and moves to a neighbour when the focused element disappears (chip removed, player closed).
**Rule.** Write every `:hover` inside `@media (hover: hover)`, next to its `[data-state="hover"]` pin. Never focus a control on open or load; focus the container or its heading with `tabindex=-1`.
**Where.** `packages/ui/components.css` (Button, SelectButton, Tab, PlayerButton, IconButton, FileList handle, EntityChip); `apps/storefront/base.css`, `pages/plp.js`, `scripts/site.js`. Amends 0009.
