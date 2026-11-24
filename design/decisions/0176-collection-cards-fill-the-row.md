# 0176 — Collection cards fill the row, with a minimum width

`2026-11-24` · accepted (Gio: "coprissero full width se ce ne sono 2, se ce ne sono 3, eccetera… un minimum width sensato e ragionato… decidi tu") · amends [0174](0174-curated-collections.md) · Figma: page `Home` → `home collections` (device desktop | mobile): wrapping auto layout, cards fill with min width

**Context.** 0174 put the home collection cards in a fixed grid (4 per row on desktop, 2 on mobile): with 2 or 3 collections the row stopped halfway. Gio wants the cards to share the full width whatever their number.
**Decision.**
- The cards share the full width: 1 card = the whole row, 2 = halves, 3 = thirds, and so on, as many per row as fit at their minimum width (CSS grid `repeat(auto-fit, minmax(min, 1fr))`).
- When they do not fit, the next card wraps and keeps the column width of the row above (rows stay aligned; the last row may end short). A stretched last card would make a single collection look more important than the others.
- **Minimum width, desktop 200**: about 2:1 against the 96 min height, so a card still reads as a banner; it holds a two-word label in label/large ("Dancehall Digi") on one line inside the 16 padding. At 960 (the breakpoint) that is 4 per row, at 1440 6 per row.
- **Minimum width, mobile 144**: always 2 per row from a 320 screen (2 × 144 + 8 = 296), 3 from 448; labels that do not fit wrap inside the card (the card grows, min height 96); a single word too long for the card breaks with a hyphen (`hyphens: auto`, the page is `lang="en"`), never mid-word without one.
**Rule.** A row of equal-weight cards fills its width; set a minimum card width and let the count per row follow, never a fixed count per row.
**Where.** `packages/ui/components.css` (`.zz-home-collections`, `--zz-collection-min`), `components.js` (comment), `packages/ui/docs/Home/README.md`.
