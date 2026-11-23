-- 0031 custom title links (2026-11-23, decision 0147): Gio links parts of a custom title to artists by hand in the admin
-- (select characters → Link artist; Clear unlinks exactly the selected characters).
-- · listings.custom_title_links = the links as character ranges of custom_title:
--     [{ "start": 0, "end": 14, "artist_id": "<uuid> | null", "name": "Gregory Isaacs" }]
--   start/end count characters of the saved (trimmed) custom_title; artist_id null = an artist not saved yet (by name).
-- · null = a title saved before 0147: the shop keeps deriving the links from the release's artists (decision 0111).
-- · written by the admin right after admin_save_listing (policy listings_admin); public read as the other columns.
begin;
alter table public.listings add column custom_title_links jsonb;
comment on column public.listings.custom_title_links is
  'Custom title links (decision 0147): [{start, end, artist_id, name}] character ranges of custom_title; null = derived (0111).';
commit;
