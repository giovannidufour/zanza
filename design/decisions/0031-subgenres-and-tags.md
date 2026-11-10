# 0031 — Subgenres and tags are two different things

`2026-11-10` · accepted (Gio) · names changed by [0047](0047-macro-genre-and-genre.md) (subgenre → genre) · Figma: BACKEND → Create, section "genre and tags" (`2126:1404`); COMPONENTS → filters

**Context.** The admin had one "Tags" field that held the Discogs styles (Roots, Lovers, Dub…). Gio wants his own tags too (Rare, Killer version…), and the PLP filters showed both kinds mixed.
**Decision.** Two entities. **Subgenres** = Discogs styles (`subgenres`, `release_subgenres`; Fetch from Discogs fills them; `releases.style` keeps their names in order for the shop). **Tags** = the shop's own labels, added by hand (`tags`, `release_tags`). Migration 0011 moved the old tags into subgenres and emptied `tags`. Admin form: Genre + Subgenres on one row, Tags on the next. Shop: one tag group, subgenres first, then tags (card and PDP); the PLP has a Subgenre block and a separate Tags block.
**Rule.** Anything that comes from Discogs styles is a subgenre; a tag is only what Gio types. Never write a style into `tags`. A view that shows both shows subgenres first, in one group, without duplicates.
**Where.** `supabase/migrations/20261110090000_subgenres_and_tags.sql`; `apps/admin/admin.js` (form, payload `release.subgenres` + `release.tags`); `apps/storefront/data/products.js` (`release.tags`), `pages/shell.js` (`tagsOf`), `pages/pdp.js`, `pages/plp.js`.
