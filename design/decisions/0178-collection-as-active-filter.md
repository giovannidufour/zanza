# 0178 — The collection PLP shows its collection as a removable filter chip

`2026-11-24` · accepted (Gio: "il nome della card fosse come facciamo quando vengono selezionati dei filtri o dei tag, cioè che si possa chiudere, e alla chiusura mostrare tutti i prodotti") · amends [0174](0174-curated-collections.md) · Figma: page `PLP` → `PLP - desktop / collection` (the `active filter` row with an "Oldies" chip in place of the heading) + note

**Context.** 0174 headed `/collections/<slug>/` with a static "Oldies (23)" (`search heading`). Gio wants the collection to behave like any filter reached by a link (artist, label, genre, tag, 0041): a chip that can be closed, showing every record once closed.
**Decision.**
- The collection name is an `EntityChip` in the `active filter` row (medium on desktop, large on mobile), first in the row; the filters the visitor ticks add their chips after it.
- Removing it goes to `/sale/` (the collection pages hold sale records only) with the same filters and sort in the URL, so the visitor keeps what they chose and only the collection drops out.
- The remove control of that chip is a link (`EntityChip` `removeHref`), so it works before the page script runs; its name is "Remove collection Oldies, show all records".
- No visible heading or count: the page keeps an `h1` "Oldies (23)" for screen readers only, as the sale PLP shows no count either.
**Rule.** A page that is a fixed subset of a listing (collection, and later similar curated pages) shows that subset as a removable filter chip leading to the full listing, never as a static title.
**Where.** `apps/storefront/pages/plp.js` (`collection`), `apps/storefront/scripts/site.js` (active filter row keeps `[data-plp-fixed]` chips and updates their link), `packages/ui/components.js` + `components.d.ts` (`EntityChip` `removeHref`).
