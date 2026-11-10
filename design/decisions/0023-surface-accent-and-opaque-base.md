# 0023 — `surface/accent` is the page; `surface/base` is opaque white

`2026-11-10` · accepted (Gio) · Figma: collection `color`, `surface/accent` (ex `surface/base`), new `surface/base`

**Context.** In the admin the active tab (`tab/background/active` = white) vanished on a white page. Gio set the backend page to `black-a4`, which made every surface bound to the old `surface/base` translucent, including the new dialog over its scrim.
**Decision.** The old `surface/base` is renamed `surface/accent` (frontend: accent, backend: black-a4) and keeps every existing binding (page, header, player, input fields). A new `surface/base` is white in every mode.
**Rule.** Page-level grounds use `surface-accent`. Anything that floats over other content (dialog, and any future menu, popover or toast) uses `surface-base`: a translucent ground is never stacked.
**Where.** `packages/ui/tokens.json`, every former `var(--surface-base)` in `packages/ui`, `apps/admin`, `apps/storefront`. Supersedes the "only `surface/base` changes" note in [0017](0017-figma-modes-are-themes.md).
