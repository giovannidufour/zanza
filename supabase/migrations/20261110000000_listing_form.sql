-- 0002 listing form (Figma "Create listing", 2026-11-10):
-- · release lines: artist/title per side (line 1 = side A …). Line artist null = same as line 1 (not shown)
-- · samples can belong to a line; samples without a line are "additional" (dub, versions)
-- · listings: sku (auto), custom_title (overrides the displayed name), condition_notes
-- · featured image = first photo of the listing: release.cover_key moves into listings.photo_keys[1]
-- · test data: tag spelling fix (90S Dancehall → 90's Dancehall)

-- ── release lines ───────────────────────────────────────────────────────────
create table public.release_lines (
  id         uuid primary key default gen_random_uuid(),
  release_id uuid not null references public.releases on delete cascade,
  position   smallint not null check (position >= 1),
  artist     text,
  title      text not null,
  unique (release_id, position),
  constraint first_line_has_artist check (position > 1 or artist is not null)
);
insert into public.release_lines (release_id, position, artist, title)
  select id, 1, artist, title from public.releases;
alter table public.releases drop column artist, drop column title;

alter table public.samples add column line_id uuid references public.release_lines on delete set null;

-- ── listings ────────────────────────────────────────────────────────────────
alter table public.listings
  add column sku int generated always as identity unique,
  add column custom_title text,
  add column condition_notes text;

-- featured image: the release cover becomes the first photo of each listing (no duplicates)
update public.listings l
   set photo_keys = array[r.cover_key] || array_remove(l.photo_keys, r.cover_key)
  from public.releases r
 where r.id = l.release_id and r.cover_key is not null;
alter table public.releases drop column cover_key;

-- ── test data: one spelling per tag ─────────────────────────────────────────
update public.releases set style = array_replace(style, '90S Dancehall', '90''s Dancehall')
 where '90S Dancehall' = any (style);

-- ── access (new table, explicit grants as in 0001) ──────────────────────────
alter table public.release_lines enable row level security;
grant select on public.release_lines to anon, authenticated;
grant insert, update, delete on public.release_lines to authenticated;
create policy release_lines_read  on public.release_lines for select using (true);
create policy release_lines_admin on public.release_lines for all to authenticated using (public.is_admin()) with check (public.is_admin());
