-- 0019 Memo (2026-11-15, decision 0087): Gio's own reminder list of records he wants to sell later, jotted from
-- the admin on his phone. Not part of the shop: no listing, no release row, nothing public.
-- · title: free text ("Barrington Levy 7" on Jah Life") or the Discogs release picked in the admin ("Artist – Title").
-- · discogs_release_id + discogs_meta (label · cat no · year · country · format): only when a release was picked;
--   "Create listing" from the list opens the listing form with that release fetched. No other Discogs data is kept.
-- · note: optional free text (sleeve, condition, where it is).
-- Admin only (RLS + grants to authenticated, as the other admin tables). No anon access at all.

create table public.memos (
  id                  uuid primary key default gen_random_uuid(),
  title               text not null check (length(btrim(title)) between 1 and 300),
  note                text check (note is null or length(note) <= 1000),
  discogs_release_id  integer check (discogs_release_id is null or discogs_release_id > 0),
  discogs_meta        text check (discogs_meta is null or length(discogs_meta) <= 300),
  created_at          timestamptz not null default now()
);
create index memos_created_at on public.memos (created_at desc);

alter table public.memos enable row level security;
grant select, insert, update, delete on public.memos to authenticated;
create policy memos_admin on public.memos for all to authenticated using (public.is_admin()) with check (public.is_admin());
