# 0008 — `_` building blocks stay internal; nested props become flat props

`2026-11-07` · accepted · Figma: `_player button-icon` (2033:10614), `_button-sizes`, `_button-states`

**Context.** Figma composes components from `_`-prefixed building blocks exposed as nested instances.
**Decision.** A `_` component becomes an internal function (not exported). A nested exposed variant becomes a flat prop on the public component (`_player button-icon state=playing` → `playing`).
**Rule.** Public API = the public Figma component's props + exposed nested props, flattened. Never export a `_` component.
**Where.** `components.js` PlayerButtonIcon, Button.
