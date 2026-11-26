# 0197 — Dark ink: a `frontend-dark` mode in the semantic `color` collection

`2026-11-26` · proposed · Figma: collections `color` (new mode `frontend-dark`), `_primitives` (`white-48`, `white-56`, `white-64`, `white-80`); demo: page Home → section `dark mode test (0197)`

**Context.** Gio tests palettes by switching the `_config` mode (accent, support-1): one change recolours every surface. Foreground semantics (text, icons, dividers, button fills and borders, overlays) point straight to `_primitives` black / black-aN, so on a dark palette (e.g. `_config` Mode 3, #636ab4) they lose contrast. Gio (2026-11-26): keep foregrounds pointing to primitives (`_config` must not become a copy of `_primitives`); choose the ink with a second mode, next to the `_config` one.
**Decision.**
- The `color` collection gets a third mode, `frontend-dark` (= the shop, white ink). A frame picks two modes: `_config` (palette) and `color` (`frontend` = black ink, `frontend-dark` = white ink). The backend stays light: no backend-dark.
- In `frontend-dark` every black-family foreground points to its white twin: `black` → `white`, `black-aN` → `white-N`, and the inverts swap (`*-invert`, button `active` fills, `surface/base` white → black). 36 variables; values still point to `_primitives` only.
- Unchanged in `frontend-dark`: `surface/page`, `surface/accent`, `surface/support-1`, `text/accent` (from `_config`), `surface/scrim`, the fixed pairs `surface/alert|success|warning` + `text/on-*`, `text/alert`, `text/success`, `border/alert`, `waveform/silence`.
- New primitives `white-48`, `white-56`, `white-64`, `white-80` (the white twins of the black alpha steps). Named like the existing `white-N` siblings; the `white-aN` rename stays open.
- Code: `frontend-dark` is a theme in `tokens.json` (0017): `[data-theme="frontend-dark"]`. Every non-default theme block now declares **every** per-mode token (a missing value falls back to `frontend`), so a theme nested in another never inherits the outer one.
- Guard: `npm run check:contrast` checks text (4.5:1) and UI (3:1) pairs per theme; `-- --accent=#… --support-1=#…` tries a palette before it goes into `_config`.
**Rule.** A foreground semantic that is black (or black-aN) in `frontend` gets its white twin in `frontend-dark`; a new surface says whether it follows `_config` (no dark value) or is a fixed light/dark ground (it flips). Ink follows the ground it sits on, not the page: a light chip on a dark page keeps black ink (needs `text/on-<surface>`, like `text/on-alert`). Before adopting a `_config` palette, run the contrast check in the mode it will be used with.
**Findings (check, 2026-11-26).**
- The mode is manual: a light palette with `frontend-dark` (or a dark one with `frontend`) fails everywhere. The check makes it visible.
- Mid-tones fail both inks: #636ab4 gives black 4.3:1, white 4.9:1, and `text/moderate` (56 %) 2.6–2.7:1 either way. For `white-56` to reach 4.5:1 the accent must be about #353a6e or darker (white ≥ 10.6:1); on the light side `black-56` needs the ground at least as light as #d3d7ff (Mode 2, 4.5:1).
- `surface/support-1` stays light in every `_config` mode (light blue, lime): in `frontend-dark` the genre tags on it read white on lime (1.2:1). Proposal: `text/on-support-1` = black in every mode, bound in `tag item`.
- Already open, unchanged by this: `text/alert` 2.4:1 and `text/success` 2.9:1 on the green page; `text/moderate` on light blue 4.29:1.
**Where.** Figma variables; `packages/ui/tokens.json`, `build-tokens.js`, `check-contrast.js`, `package.json` (`check:contrast`).
