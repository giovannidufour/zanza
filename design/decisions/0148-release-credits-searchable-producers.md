# 0148 — Release credits from Discogs; producers searchable, not shown

`2026-11-23` · accepted · Figma: none (no UI change)

**Context.** Gio (2026-11-23): a listing is bound to a Discogs release, so we know who produced it (e.g. Coxsone Dodd on a Studio One single). Not shown in the shop for now, but the search should find the record with "Dodd" or "Coxsone"; one day the producers may be shown.
**Decision.**
- **Store every Discogs credit** (release and track "extraartists": Producer, Mixed By, Arranged By, Backing Band, Written-By …) in `release_credits` (migration 0032): release, position, artist entity, role as written, credit as printed (ANV), tracks. Gio chose "all credits, search producers" (2026-11-23): reading Discogs again later is the expensive part, so all roles are kept now.
- **Same entities as the performers.** A credit points to `artists` (Lee Perry, King Tubby produce and perform). Showing producers later = links to the existing `?artist=` filter; one place for spelling variants.
- **Spellings.** The printed credit and, for producers, the Discogs name variations + real name of the person (one extra Discogs request per producer, only the first time) become `artist_aliases`.
- **Search only.** The shop search text (`pages/plp.js` `searchTextOf`) adds the producers' official name, printed credit and aliases. `SEARCH_ROLES = /produc/i` decides which roles are searchable. Nothing is rendered; the names are in the card's `data-search` attribute.
- **Where it is filled.** `discogs-lookup { releaseId }` returns `credits`; `packages/listing-draft` carries them in the form (`credits: null` = not read now, the stored ones stay) and `saveCredits` calls `admin_set_release_credits` after `admin_save_listing` (Create / Edit after Fetch Discogs, Memo → Create draft, Bulk create, Scanner `scanner-draft`). A credits failure never undoes the save. Existing releases: one-off Edge Function `release-credits` (admin, 20 releases a call, `releases.credits_fetched_at` marks the done ones).
- **Attributes.** Credits count as artist links (`entity_links`): an artist still credited is not deleted, and Replace moves the credits to the first target.
**Rule.** Data imported from Discogs that the shop does not show yet is still stored as entities (not strings) when it names people or labels, so showing it later is a template change, not a data migration.
**Where.** `supabase/migrations/20261123000000_release_credits.sql`; `supabase/functions/discogs-lookup`, `release-credits` (new), `scanner-draft`; `packages/listing-draft/listing-draft.js`; `apps/admin/admin.js`; `apps/storefront/data/products.js` (`release.credits`), `pages/plp.js`.
