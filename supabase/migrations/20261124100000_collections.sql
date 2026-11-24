-- 0038 collections (2026-11-24, Gio; decision 0174, Figma page `Collections`).
-- A collection = a curated group of records defined by rules, shown as a card on the home and as its own page
-- /collections/<slug>/ (the PLP of the records that match). Gio sets them up in admin → Collections.
-- · rules: years (a year "1983" or a decade "1960s", decision 0082), genres, tags. A record is in when it matches every
--   rule that is filled in; inside a rule any value is enough (the PLP filter logic, decision 0028). At least one rule.
-- · genres and tags by id, so renaming one keeps the collection; an id whose genre / tag was deleted is ignored
--   (the matching lives in packages/collections/collections.js, the same file for the shop build and the admin)
-- · sort_order: the order of the cards on the home, set by drag & drop (admin_order_collections)
-- · on_home: off = no card on the home, the page still exists by its link
-- · a collection with 0 records keeps its card (Gio 2026-11-24: "I want to see it, to judge the strategy")
-- · every change rebuilds the shop (site_build, migration 0005): the home and the collection pages are static
begin;

create table public.collections (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (trim(name) <> ''),
  slug        text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  years       text[] not null default '{}' check (array_to_string(years, ',') ~ '^([0-9]{4}s?(,[0-9]{4}s?)*)?$'),
  genre_ids   uuid[] not null default '{}',
  tag_ids     uuid[] not null default '{}',
  on_home     boolean not null default true,
  sort_order  numeric not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint collections_has_rule check (cardinality(years) + cardinality(genre_ids) + cardinality(tag_ids) > 0)
);
create unique index collections_name on public.collections (lower(name));

-- public: the shop build reads them with the publishable key; only admins write (admin RLS, as tags and genres)
alter table public.collections enable row level security;
grant select on public.collections to anon, authenticated;
grant insert, update, delete on public.collections to authenticated;
create policy collections_read  on public.collections for select using (true);
create policy collections_admin on public.collections for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- a new collection goes last (the end of the row of cards); updated_at follows every change
create function public.collection_defaults() returns trigger
  language plpgsql security definer set search_path = ''
  as $$
begin
  if tg_op = 'INSERT' then
    new.sort_order := coalesce((select max(sort_order) from public.collections), 0) + 1;
  end if;
  new.updated_at := now();
  return new;
end
$$;
create trigger collections_defaults before insert or update on public.collections
  for each row execute function public.collection_defaults();
revoke execute on function public.collection_defaults() from public, anon, authenticated;

-- any change = the shop is out of date (site_build is not writable by the admin role: security definer)
create function public.collections_site_build() returns trigger
  language plpgsql security definer set search_path = ''
  as $$
begin
  update public.site_build set pending = true, requested_at = now() where id;
  return null;
end
$$;
create trigger collections_site_build after insert or update or delete on public.collections
  for each statement execute function public.collections_site_build();
revoke execute on function public.collections_site_build() from public, anon, authenticated;

-- the order after a drag & drop: p_ids = every collection, first to last (they are few: the whole list is sent)
create function public.admin_order_collections(p_ids uuid[]) returns void
  language plpgsql security invoker set search_path = ''
  as $$
begin
  if not public.is_admin() then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  update public.collections c set sort_order = o.n
    from unnest(p_ids) with ordinality as o(id, n)
   where c.id = o.id and c.sort_order is distinct from o.n;
end
$$;
revoke execute on function public.admin_order_collections(uuid[]) from public, anon;
grant execute on function public.admin_order_collections(uuid[]) to authenticated;

commit;
