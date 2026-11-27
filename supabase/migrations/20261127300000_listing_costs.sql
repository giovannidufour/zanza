-- 0048 listing costs (Gio, 2026-11-27, decision 0206): what Gio paid for a copy ("Paid" next to Price in admin
-- Create / Edit listing → Price). Private: never shown in the shop and never readable with the publishable key.
-- A table of its own, not a column of public.listings, because anon can select every column of a public listing
-- (grant select … to anon, policy listings_read): a column there would be readable by anyone through the API.
-- Here: no grant to anon, RLS on, only the admin (public.is_admin()) reads and writes. The shop build never reads it.
-- One row per listing; no row = not entered. Deleting a listing deletes its row.

create table public.listing_costs (
  listing_id  uuid primary key references public.listings on delete cascade,
  paid_cents  integer not null check (paid_cents >= 0),
  updated_at  timestamptz not null default now()
);

alter table public.listing_costs enable row level security;

grant select, insert, update, delete on public.listing_costs to authenticated;
revoke all on public.listing_costs from anon;

create policy listing_costs_admin on public.listing_costs for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
