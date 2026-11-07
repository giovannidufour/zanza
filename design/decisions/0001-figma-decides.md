# 0001 — Figma decides; code never invents visuals

`2026-11-07` · accepted · Figma: whole file `X9aI5cZ8UF3T2fskPdUChY`

**Context.** A header background was added in code without being in Figma.
**Decision.** Every colour, size, radius, motion and state comes from Figma. A value missing in Figma is a gap, not a guess.
**Rule.** If something looks needed and is not in Figma (background, motion, focus, bleed), stop, flag it and propose it; ship it only after the designer adds it or approves it. Unavoidable technical values (e.g. transition durations) ship as marked placeholders and are listed in `open.md`.
**Where.** All of `packages/ui`, `apps/storefront`.
