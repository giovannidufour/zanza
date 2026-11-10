-- 0001 init: catalogue (releases, listings, samples), grading scale, orders.
-- Spec: _context/backend.md. One physical copy = one listing (copies are always unique).
-- Media columns hold storage keys (e.g. 'samples/<release_id>/A.mp3'), never full URLs;
-- the base URL lives in config. Exception: imported test content may hold absolute URLs.

-- ── grading scale (Gio's scale, Q8 closed 2026-11-09) ───────────────────────
-- ordered: rank 1 = best. Filters like "VG+ or better" = rank <= (rank of VG+).
create table public.grades (
  code  text primary key,
  rank  smallint not null unique
);
insert into public.grades (code, rank) values
  ('M', 1), ('NM', 2), ('NM-', 3),
  ('EX+', 4), ('EX', 5), ('EX-', 6),
  ('VG+', 7), ('VG', 8), ('VG-', 9),
  ('G+', 10), ('G', 11), ('G-', 12),
  ('F', 13);

-- ── releases: the pressing. Imported once from Discogs, then ours ────────────
create table public.releases (
  id                 uuid primary key default gen_random_uuid(),
  discogs_release_id int unique,
  discogs_master_id  int,
  artist             text not null,
  title              text not null,
  label              text,
  cat_no             text,
  year               smallint check (year between 1900 and 2100),
  country            text,
  format             text not null,                       -- '7"', '10"', '12"', 'LP' (closed list: TBD)
  genre              text[] not null default '{}',
  style              text[] not null default '{}',
  tracklist          jsonb  not null default '[]',        -- [{position, title, duration}]
  cover_key          text,
  created_at         timestamptz not null default now()
);

-- ── listings: one physical copy, published in a section ─────────────────────
create table public.listings (
  id                uuid primary key default gen_random_uuid(),
  slug              text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  release_id        uuid not null references public.releases,
  section           text not null check (section in ('sale', 'trade')),
  status            text not null default 'draft'
                    check (status in ('draft', 'available', 'reserved', 'sold', 'traded')),
  price_cents       int check (price_cents >= 0),
  currency          char(3) not null default 'EUR',
  condition_media   text not null references public.grades,
  sleeve_type       text not null default 'original'
                    check (sleeve_type in ('original', 'generic', 'none')),
  condition_sleeve  text references public.grades,        -- only for an original sleeve
  notes             text,
  photo_keys        text[] not null default '{}',         -- ordered
  weight_g          int check (weight_g > 0),             -- shipping; default from format later
  reserved_until    timestamptz,                          -- checkout hold
  stripe_session_id text,
  import_source     jsonb,                                -- provenance of imported test content
  published_at      timestamptz,
  sold_at           timestamptz,
  created_at        timestamptz not null default now(),
  constraint sale_needs_price   check (section <> 'sale' or price_cents is not null),
  constraint sleeve_grade_only_for_original check (sleeve_type = 'original' or condition_sleeve is null)
);
create index listings_status_section on public.listings (section, status);
create index listings_release on public.listings (release_id);

-- ── samples: clips recorded by Gio, per release track ───────────────────────
create table public.samples (
  id             uuid primary key default gen_random_uuid(),
  release_id     uuid not null references public.releases on delete cascade,
  track_position text not null,                           -- 'A', 'B', 'A1'...
  title          text,
  audio_key      text not null,
  duration_s     smallint check (duration_s > 0),
  source         text not null default 'own',             -- 'own' | test sources
  sort           smallint not null default 0,
  unique (release_id, track_position)
);

-- ── orders (written by Edge Functions only) ─────────────────────────────────
create table public.orders (
  id                uuid primary key default gen_random_uuid(),
  stripe_session_id text not null unique,
  email             text not null,
  shipping_address  jsonb not null,
  shipping_country  char(2) not null,
  shipping_cents    int not null,
  total_cents       int not null,
  currency          char(3) not null,
  status            text not null default 'paid'
                    check (status in ('paid', 'shipped', 'refunded', 'cancelled')),
  tracking_number   text,
  created_at        timestamptz not null default now()
);
create table public.order_items (
  order_id    uuid not null references public.orders on delete cascade,
  listing_id  uuid not null references public.listings,
  price_cents int  not null,                              -- snapshot at purchase time
  primary key (order_id, listing_id)
);

-- ── admin: a single operator (Gio). Rows added by hand after sign-up ────────
create table public.admins (
  user_id uuid primary key references auth.users on delete cascade
);
create function public.is_admin() returns boolean
  language sql stable security definer set search_path = ''
  as $$ select exists (select 1 from public.admins where user_id = auth.uid()) $$;

-- ── access: RLS on every table; new tables are NOT auto-exposed in this project,
--    so grants are explicit ───────────────────────────────────────────────────
alter table public.grades      enable row level security;
alter table public.releases    enable row level security;
alter table public.listings    enable row level security;
alter table public.samples     enable row level security;
alter table public.orders      enable row level security;
alter table public.order_items enable row level security;
alter table public.admins      enable row level security;

grant select on public.grades, public.releases, public.listings, public.samples to anon, authenticated;
grant insert, update, delete on public.releases, public.listings, public.samples to authenticated;
grant select, update on public.orders to authenticated;
grant select on public.order_items to authenticated;
grant execute on function public.is_admin() to anon, authenticated;

-- public read: catalogue, but never drafts
create policy grades_read   on public.grades   for select using (true);
create policy releases_read on public.releases for select using (true);
create policy samples_read  on public.samples  for select using (true);
create policy listings_read on public.listings for select using (status <> 'draft' or public.is_admin());

-- admin write
create policy releases_admin on public.releases for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy listings_admin on public.listings for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy samples_admin  on public.samples  for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy orders_admin   on public.orders   for select to authenticated using (public.is_admin());
create policy orders_admin_update on public.orders for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy order_items_admin on public.order_items for select to authenticated using (public.is_admin());
-- admins: no policies → only the service role / SQL editor can read or write it
