# 0067 — `text/moderate` meets AA: black at 56%

`2026-11-12` · accepted (Gio) · Figma: primitive `black-a56` (`_primitives`), `text/moderate` → `black-a56` in modes `frontend` and `backend`

**Context.** `text/moderate` was `black-a48`: 3.5–3.7:1, under the 4.5:1 of WCAG 1.4.3 for the text that uses it (input placeholder, "Optional", locked value, filter count, facet value, menu detail). Gio asked for a dedicated primitive, always black with alpha.
**Decision.** New primitive `black-a56` (the next step of the 8-step alpha scale: 48, 56, 64), `text/moderate` points to it in every mode. Contrast of the composited text, measured on every ground `text/moderate` sits on in Figma:

| Ground | Mode | a48 (before) | a56 |
| --- | --- | --- | --- |
| white (`surface/base`, `tab/background/active`) | both | 3.71 | 4.94 |
| `surface/accent` = acid green | frontend | 3.55 | 4.63 |
| `surface/subtle` on acid green (worst) | frontend | 3.48 | 4.51 |
| `surface/accent` = black-a4 on white | backend | 3.65 | 4.83 |
| `surface/accent` nested twice / three times | backend | 3.59 / 3.53 | 4.72 / 4.60 |

**Rule.** Text alpha is chosen on the darkest ground it can sit on. `text/moderate` must not go on a ground darker than `surface/subtle` over acid green (L ≈ 0.69): there the margin is 0.01. A new darker ground for it → re-check, and step up to `black-a64` (5.9:1) if it fails.
**Where.** Figma variables; `packages/ui/tokens.json` (`black-a56`, `text-moderate`).
