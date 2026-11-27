-- 0046 listing bargain (Gio, 2026-11-27, decision 0201): the Bargain crate. A sale copy flagged in the admin
-- (Create / Edit listing → Price → "Bargain crate") is listed on /bargain-crate/ and stays hidden on the other PLPs
-- until the visitor ticks "Show bargain crate". Public like the other listing columns (the shop build reads it);
-- changing it on a public copy rebuilds the shop (trigger listings_site_build, 0005).

alter table public.listings add column bargain boolean not null default false;
