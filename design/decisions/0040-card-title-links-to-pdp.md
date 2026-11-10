# 0040 — In a product card, the record title links to the product page

`2026-11-10` · accepted (Gio) · Figma: page PDP → `product card` (no visual change)

**Context.** Only the cover linked to the PDP (open.md proposal: the title too). The card title already holds the artist links (→ PLP filtered by artist), so the whole heading cannot be one link (no nested links).
**Decision.** Gio: clicking the record title opens its product page, desktop and mobile (PLP and "You may also like"). In "Artist - Title" the artist stays a link to the PLP, the title part links to the PDP; a custom title links to the PDP as a whole. Same look as the other inline links (`site-inline-link`: text colour, underline on hover). The title link is mouse-only (`tabindex=-1`): the cover link, named by the whole title, stays the one keyboard / screen reader stop to the PDP. The PDP's own heading is unchanged.
**Rule.** One card, one focusable link to its destination; other clickable areas to the same place are `tabindex=-1`.
**Where.** `apps/storefront/pages/shell.js` `productNameLinked(product, url, pdpHref)`, `ProductCardFor`.
