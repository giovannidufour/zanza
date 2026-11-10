# 0028 — PLP filters: facets from the data, plain text, OR inside / AND between

`2026-11-10` · accepted (Gio) · Figma: page `filters` (`filter`, `filter block`, `filters`), PLP - desktop

**Context.** The PLP filters were a hardcoded placeholder (Genre, Format, Decade). Gio sketched `filter` / `filter block` / `filters` and asked for them cleaned, integrated and working. Subgenres (Discogs styles) and Gio's own tags become two separate lists (admin Attributes, not yet in the database).
**Decision.** Blocks Subgenre, Format, Decade, Tags, built from the products of the page; a block with no options is not shown. Every option is plain text (`content=label`, Gio: the PDP keeps the tag chips) with a count in `text/moderate`. OR inside a block, AND between blocks; a count is what you would see by ticking that option given the other blocks; an option at 0 is hidden unless ticked. The state is in the URL (shareable, Back restores it) and in the breadcrumbs ("For sale / Dancehall / 7”"); the number of records is announced (role=status).
**Rule.** A shop filter is a native checkbox in a `<fieldset>` per facet (0018); facets come from the data, never from a hardcoded list; filtering is progressive (the static page lists everything, site.js hides).
**Where.** `packages/ui` `Filter`, `FilterBlock`, `Filters`; `apps/storefront/pages/plp.js` (facets), `apps/storefront/scripts/site.js` (behaviour).

**Update 2026-11-10 (Gio).** A filter block shows only when the current view has something to pick in it: when all its options drop to 0 (and none is ticked) the whole block hides, legend included. Facets with no values on the page are not rendered at all.

**Update 2026-11-10 (Gio).** On desktop the filter column is sticky at the top of the window and scrolls on its own when it is taller than the window (minus the open site player), the same pattern as the PDP gallery (0033). Not drawn in Figma.
