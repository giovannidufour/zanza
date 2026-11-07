# design/ — how Zanza's design system is kept

> Design source: Figma **Zanza - Record Store** (`X9aI5cZ8UF3T2fskPdUChY`). Code source: `packages/ui/`.

| File | Holds | Rule |
| --- | --- | --- |
| [`decisions/`](decisions/README.md) | **Why**: one file per design decision, with the rule to apply | append-only; supersede, never rewrite |
| [`open.md`](open.md) | **What is not decided**: gaps, parked items, Figma fixes | the only backlog; a closed item becomes a decision |
| `packages/ui/docs/<Comp>/README.md` | **What a component is**: purpose, Figma mapping, tokens, dimensions | API block generated from `components.d.ts` |
| `packages/ui/components.d.ts` | **The component API** | single source of props |
| `packages/ui/tokens.json` | **The token values** (mirror of Figma variables) | `tokens.css` is generated |

## Flow (one direction)

```
Figma variables / text styles / components
        │  mirrored by hand (Claude reads Figma via MCP; exact values, nothing invented — 0001)
        ▼
tokens.json ──build-tokens.js──▶ tokens.css
components.js + components.css + components.d.ts ──build-docs.js──▶ docs/<Comp>/README.md (API)
        │                                   │
        ▼                                   ▼
apps/storefront (build.js → dist/)          build-artifact.js → claude.ai "Zanza Design System"
```

## Porting a Figma component (checklist)

1. Read the node: variants, exposed nested props, layout, bound variables, text styles.
2. Map to the decisions: props ([0008](decisions/0008-building-blocks-stay-internal.md), [0009](decisions/0009-interaction-state-from-pseudo-classes.md)), colour ([0002](decisions/0002-token-naming-and-tiers.md), [0005](decisions/0005-border-pattern-carries-state.md), [0007](decisions/0007-floating-actions-foreground-background.md)), type ([0003](decisions/0003-type-styles-are-classes.md)), size ([0014](decisions/0014-strokes-included-in-layout.md)), layout ([0004](decisions/0004-one-breakpoint-in-tokens.md), [0012](decisions/0012-layout-mirrors-figma-grid.md)).
3. Anything not covered by Figma or a decision → flag it, add it to `open.md`, do not ship a guess ([0001](decisions/0001-figma-decides.md)).
4. Write `components.js`, `components.css`, `components.d.ts`, `docs/<Comp>/README.md` (with an `<!-- api: … -->` block) and `preview.html`.
5. Build, check rendered sizes and colours against Figma, then list Figma fixes in `open.md`.
6. A new choice made along the way → a new decision file.
