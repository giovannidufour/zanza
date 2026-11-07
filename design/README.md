# design/ — Zanza design system

> Source of design decisions: Figma file **Zanza - Record Store** (`X9aI5cZ8UF3T2fskPdUChY`).
> Source of code: `packages/ui/`. This folder only documents how the two connect.

## Flow (one direction)

```
Figma variables / text styles / components
        │  manual mirror (Claude reads the file via MCP; values exact, nothing invented)
        ▼
packages/ui/tokens.json ──build-tokens.js──▶ packages/ui/tokens.css   (never edited by hand)
packages/ui/components.js + components.css + components.d.ts + docs/<Comp>/
        │                                   │
        ▼                                   ▼
apps/storefront (site, build.js → dist/)    build-artifact.js → claude.ai "Zanza Design System"
```

## Rules

- **Figma decides.** Code mirrors Figma; it never adds colors, motion, radius, spacing or states that are not in the file. Gaps are declared TODOs (focus state, breakpoint).
- **Token naming.** Figma path `a/b/c` → token `a-b-c` → CSS `--a-b-c`. Three tiers: `_primitives` → `_config` (brand decisions: `accent`, `support-1`) → semantic (`text-*`, `surface-*`, `action-*`, `tab-*`, `border-*`).
- **Type = classes.** Text styles are generated as classes (`.label-medium`…, plus `.<style>--mobile` for responsive) that carry the sizes; components apply the class and never rewrite font values.
- **One implementation.** Components live once, in `packages/ui`. The artifact is generated from it (`npm run build:artifact`), never edited on its own.
- **Layout = CSS grid** mirroring Figma grid auto-layout (`pdp content`: 12 cols desktop / 4 mobile, gap `gutter-small`).
- **Figma hygiene** (Claude does it while porting): flag typos and residues from other files; rename anonymous layers (`Frame 17`) in the components being worked on.

## Known placeholders

- Breakpoint desktop/mobile: not defined in Figma (auto layout fill; mobile drawn at 375). **One value** in `packages/ui/tokens.json → breakpoint.mobile` (`<768px`); CSS sources write `@media (--mobile)` and `packages/ui/media.js` expands it in every build.
- Focus state: none designed → none shipped.
- Store name "Store-name", logo from Figma image fill (brand not final, Q7 in `_context/open-questions.md`).

## Figma naming to fix (open)

`white-0/4/8/16/24` → `white-a*` · `border divider/strong` → `border/divider/strong` · `small`, `medium-small` → `space/*` · `tag group / orientation=vertical` is not vertical · `hierarchy` single-value on `tab` · hardcoded `#000000` text fills in `product info`, `player button`.
