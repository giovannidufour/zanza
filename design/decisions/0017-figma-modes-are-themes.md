# 0017 — Figma modes are themes on `[data-theme]`

`2026-11-10` · accepted · Figma: collection `color`, modes `frontend` | `backend`

**Context.** The admin (BACKEND → Create) uses the same components on white: Figma added a `backend` mode where only `surface/base` changes (accent → white).
**Decision.** Each mode of the `color` collection is a theme in `tokens.json` (`color.themes`). The first (`frontend`) is `:root`; every other theme is a `[data-theme="<id>"]` block that redeclares only the tokens whose value differs. Components never know the theme.
**Rule.** A token that changes per mode gets a `{ "<mode>": value }` value in `tokens.json`; pages pick a mode with `data-theme` on a container (the admin root: `data-theme="backend"`). Never fork a component or add a prop for a mode.
**Where.** `packages/ui/tokens.json`, `build-tokens.js`, previews (`data-theme`).
