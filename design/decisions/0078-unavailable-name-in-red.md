# 0078 — Unavailable records in the bag: name in red (`text/unavailable`), no longer struck through

`2026-11-14` · accepted (Gio: "i dischi non disponibili nel bag, anziché avere il titolo crossato, usino quel colore rosso") · Figma: `_primitives/red-dark`, `color/text/unavailable`; page Bag → `bag item` status=sold | reserved, `product name`

**Context.** In the bag, sold and reserved lines struck the record name through (0064, 0065). Gio wants the red of the alert (0077) instead. `red` #e0201b is only 3.7:1 on acid green: fine for the alert box (white text on it), not for 14–16px text on the page.
**Decision.**
- New primitive `red-dark` = `#c11c17`, the same hue darkened until it passes AA as text: 4.7:1 on acid green (`surface-accent`), 6.1:1 on white.
- New semantic `text/unavailable` → `red-dark` (both modes, scope text fill). Named for its role, not `text/alert`, because code already has a PROVISIONAL `text-alert` (the orange of the input error, still an open question in `design/open.md`).
- Bag item status=sold | reserved: `product name` and the `status label` ("SOLD OUT" / "RESERVED", Gio: "anche quelle scritte fai le rosse") in `text/unavailable`; no strikethrough on the name. The price stays black and struck. The price stays struck and "SOLD OUT" / "RESERVED" stays beside it, so colour is never the only cue (WCAG 1.4.1); the screen reader text ", not in your order," is unchanged.
**Rule.** An unavailable item's name and the word that says why are shown in `text/unavailable`; the word is always there; strikethrough stays only on prices and on disabled actions.
**Supersedes.** The "name struck through" part of 0064 / 0065 (bag only).
