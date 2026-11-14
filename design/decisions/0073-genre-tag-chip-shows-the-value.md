# 0073 — The PLP genre / tag chip shows only the value; the type stays in the accessible name

`2026-11-14` · accepted (Gio: "Non vorrei mostrare la label ma solo il valore") · Figma: `active filter` (2166:6183) unchanged, its example is a label chip

**Context.** Following a genre or tag link on a card/PDP shows the active filter chip in place of the breadcrumbs (0041) as "Genre: Street Soul". Gio wants only the value.
**Decision.** Genre and tag chips in the PLP `active filter` row show the value only ("Street Soul", "Rare"). The remove button keeps the type in its name: "Remove filter Genre: Street Soul". Artist and label chips keep "Label: Kesta" / "Artist: …" (Figma example, and a bare name is ambiguous between artist and label); the mobile layer recap is unchanged (its options were already value-only).
**Rule.** A filter chip drops its type when the value is self-explanatory, never from the accessible name.
**Where.** `apps/storefront/scripts/site.js` (`rowChipsOf`, `makeChip` `name`). Amends 0041 ("Subgenre: Roots" example).
