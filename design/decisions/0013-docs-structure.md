# 0013 — Docs: decision log, one backlog, API generated

`2026-11-07` · accepted · Figma: —

**Context.** The same facts were repeated in 3–4 markdown files and drifting; the reasons behind choices were not in the repo.
**Decision.** `design/decisions/` (this log, English) records why; `design/open.md` is the only backlog of gaps; component READMEs keep purpose, Figma mapping, behaviour, tokens and links; API tables are generated from `components.d.ts` by `build-docs.js`. `CLAUDE.md` is a map, not a status page. Product context stays in `_context/` (Italian).
**Rule.** Each fact lives in one file. A closed open item becomes a decision. Edit the `.d.ts`, never the generated API block.
**Where.** `design/`, `packages/ui/docs/`, `packages/ui/build-docs.js`.
