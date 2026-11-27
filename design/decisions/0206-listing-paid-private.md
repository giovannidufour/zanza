# 0206 — Paid: what Gio paid for a copy, private, next to Price

`2026-11-27` · accepted · Figma: BACKEND → `Create` → `price fields` (2362:4410) boolean `paid` (Input "Paid", optional, after Price; price=offers: after the note, which goes from 6 to 4 columns); on in the Create screens, off in the Scanner `price panel` (2601:16387)

**Context.** Gio (2026-11-27): a small field next to Price to enter, when he wants, what he paid for the record. Never shown anywhere.
**Decision.**
- **Data**: table `public.listing_costs` (`listing_id` PK → listings, `paid_cents`, `updated_at`; migration 0048), not a column of `listings`: anon can select every column of a public listing, so a column there would be readable with the publishable key. No grant to anon, RLS on, policy `is_admin()` only.
- **Admin**: Create / Edit listing → Price → Input `Paid` (€, optional) after Price, for every sale type (fixed, Best offer, trade). Saved right after the listing (like the title links): a value upserts the row, an empty field deletes it. Not in the `admin_save_listing` payload, not copied by Sell again (a twin is another copy, bought for another price).
- **Shop / Scanner**: never read. The Scanner Price tab does not show it (Figma `paid` off in its `price panel`).
**Rule.** A private number of a listing goes in an admin-only table (no anon grant, `is_admin()` policy), never in a column of `listings` or of a view the shop reads.
**Open.** (1) Margin (Price − Paid) in Listings or Dashboard: not asked · (2) Scanner Price tab: only if Gio wants it.
**Where.** `supabase/migrations/20261127300000_listing_costs.sql`, `apps/admin/admin.js` (empty form, load, validate, save, Price block; kept out of `packages/listing-draft` so the Edge Function copies stay as they are), `packages/ui` (`PriceFields` `paid`).
