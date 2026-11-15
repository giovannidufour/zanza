# 0104 — Space above the site footer

`2026-11-15` · accepted (Gio: "aggiungi un tot di spazio sopra al footer, è sempre troppo appiccicato al contenuto") · Figma: page `footer` → `footer` (device=desktop | mobile), variable `dimension/large`

**Context.** The footer started right after the page content (only the content's own padding-bottom `small`, 8px), so it read as part of the page.
**Decision.** New dimension variable `large` = 48px. The `footer` component gets paddingTop `large`, above its `border` layer, on both variants; every screen frame follows through the instances. In code `.zz-footer` has `padding-top: var(--large)` and the top border moves to `.zz-footer__main`, the same order as Figma. Pages keep their own bottom padding: content end → footer border = page padding + 48 (56px on most pages).
**Rule.** The space between page content and footer belongs to the footer, never to the pages: no page adds a bottom margin to make room for it.
**Where.** `packages/ui/tokens.json` (`large`), `packages/ui/components.css` (`.zz-footer`, `.zz-footer__main`).
