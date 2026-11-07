# 0007 — Chromeless controls: floating foreground + background

`2026-11-07` · accepted · Figma: `player button` (2018:10086), `icon button` (2033:11904)

**Context.** Controls without border or fill still need visible hover/pressed feedback.
**Decision.** `action/floating/foreground/{default,hover,pressed,disabled}` colours icon and label; `action/floating/background/*` tints the box. Values live in `tokens.json` (mirror of Figma), not here.
**Rule.** Every chromeless control uses these two families: foreground on content, background on the box. Proposed extension to all clickables (renamed `interaction/overlay/*`, inverse for dark surfaces, underline kept on links) is pending in `open.md`.
**Where.** `components.css` PlayerButton, IconButton.
