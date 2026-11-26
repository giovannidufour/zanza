# 0194 — Figma variable audit: every UI colour bound to a semantic variable

`2026-11-26` · accepted · Figma: local variables (`_primitives`, `color`); pages icons, product card, PDP, controls, input, player, Coming soon, BACKEND Offers / Scanner / admin titles

**Context.** Gio (2026-11-26) found elements not bound to the right variables (e.g. `icon-square-tick`, 54:4118: the boolean's fill was a raw #000). A full pass over the file found: 67 nodes bound to orphan `text/strong` / `icon/strong` from collections no longer in the file (copy-paste from another file); ~120 raw black/white paints in components and screen titles; the input error / success colours and the Scanner guide lines without a semantic variable; 35 texts without a text style; every `color` variable scoped to "All".
**Decision.**
- **Rebind, same values (no visual change).** Orphans → the local variable of the same name. Raw icon paints → `icon/strong`. Raw black UI text → `text/strong`. Offer row divider → `border/divider/strong`. Native player slot → `surface/base`. Unstyled titles/texts → the text style with the same font, size, line height and tracking (`label/extra large` page titles, `label/large` dialog titles, `body/*`). Create caption + placeholder → `body/extra small` (line height auto → 14) and Scanner help → `body/small` (18 → 16): the only 1–2 px changes, approved by Gio.
- **New variables** (Gio, 2026-11-26), same names as the provisional code tokens where they existed:
  - primitives `orange-red` #ff5d16, `green` #009951;
  - `text/alert`, `border/alert` → orange-red (input state=error); `text/success` → green (input support text, emphasis success; Figma only);
  - `border/subtle` → black-a16, `border/moderate` → black-a48 (Scanner guide lines, thumbnail / cover outlines).
- **Rename** `border divider/strong` → `border/divider/strong`: one `border` group; the code token name `border-divider-strong` does not change.
- **Declared exceptions, primitives allowed:** the favicons (`white`, `acid-green`: brand assets per environment, 0127) and the Scanner `record video` illustration (`black`, `scotch-mist`). Not UI, no semantic needed.
- **Scopes.** `text/*` → text fill, shape fill, stroke (they also colour the waveform bars, the logo and icons on alert / success surfaces); `icon/*` → shape fill, stroke; `surface/*`, `*/background/*` → frame + shape fill; `*/border/*` → stroke; `border/*` → stroke + fills (rules drawn as 1 px rectangles); floating foreground → text, shape, stroke. Primitives stay unscoped (hidden from pickers).
- Left as they are: component-set purple dashed outlines, Section fills, notes, captions and proposal frames (documentation, not UI).
**Rule.** A visible paint in a component or screen is bound to a `color` variable (never raw, never a primitive) unless it is a declared exception above. A colour without a semantic variable gets one in Figma and in `tokens.json` in the same change; code never ships a "provisional" literal.
**Where.** `packages/ui/tokens.json` (`orange-red`, `green`, `text-alert`, `text-success`, `border-alert`, `border-subtle`, `border-moderate`), `apps/scanner/Sources/Theme.swift` + `GlassView.swift` (guide lines).
