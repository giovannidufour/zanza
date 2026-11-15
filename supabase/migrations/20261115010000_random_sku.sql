-- 0020 Random SKUs (2026-11-15): a listing's SKU is a random 5-digit number (10000–99999), never issued twice,
-- instead of the progressive identity of 0002. The SKU is admin-only (not in URLs, not shown in the shop).
-- · public.used_skus: every SKU ever issued. Its primary key makes "never twice" hold even after a listing is
--   deleted, and makes the pick race-safe: two concurrent inserts of the same number → one wins, the other retries.
-- · public.next_sku(): random pick + insert ... on conflict do nothing, retried until a free number is found.
-- · trigger listings_assign_sku: every new listing gets next_sku(); a client-sent sku is ignored. The SKU never
--   changes afterwards. Trigger (not a column default) so there is no RPC anyone can call to burn numbers: a
--   rejected insert (RLS) rolls back its used_skus row too.
-- · existing listings get a random SKU too (they were 1, 2, 3 …).
-- · "newest first" in the admin was "order by sku desc": now created_at desc.

-- ── registry ────────────────────────────────────────────────────────────────
create table public.used_skus (
  sku       int primary key check (sku between 10000 and 99999),
  issued_at timestamptz not null default now()
);
alter table public.used_skus enable row level security;   -- no grants, no policies: only the functions below

create function public.next_sku() returns int
  language plpgsql volatile security definer set search_path = ''
  as $$
declare v_try int; v_got int;
begin
  for i in 1..200 loop
    v_try := 10000 + floor(random() * 90000)::int;
    insert into public.used_skus (sku) values (v_try) on conflict do nothing returning sku into v_got;
    if v_got is not null then return v_got; end if;
  end loop;
  raise exception 'no free SKU found' using errcode = 'P0001';
end
$$;
revoke execute on function public.next_sku() from public, anon, authenticated;

-- ── listings.sku: identity → random ─────────────────────────────────────────
alter table public.listings alter column sku drop identity if exists;

-- existing listings: one random SKU each (rows are few; next_sku() is volatile, so one call per row)
update public.listings set sku = public.next_sku();

alter table public.listings
  alter column sku set not null,
  add constraint sku_five_digits check (sku between 10000 and 99999);

create function public.listings_assign_sku() returns trigger
  language plpgsql security definer set search_path = ''
  as $$
begin
  if tg_op = 'INSERT' then
    new.sku := public.next_sku();
  elsif new.sku is distinct from old.sku then
    raise exception 'sku cannot change' using errcode = '42501';
  end if;
  return new;
end
$$;
revoke execute on function public.listings_assign_sku() from public, anon, authenticated;

create trigger listings_assign_sku before insert or update of sku on public.listings
  for each row execute function public.listings_assign_sku();

-- ── admin_entity: records newest first by created_at (was sku desc) ─────────
create or replace function public.admin_entity(p_kind text, p_id uuid) returns jsonb
  language plpgsql stable security invoker set search_path = ''
  as $$
declare v jsonb;
begin
  if not public.is_admin() then raise exception 'not allowed' using errcode = '42501'; end if;
  perform public.check_kind(p_kind);
  if p_kind = 'artist' then
    select jsonb_build_object('id', id, 'name', name, 'slug', slug, 'discogs_id', discogs_artist_id,
           'aliases', coalesce((select jsonb_agg(x.name order by lower(x.name)) from public.artist_aliases x where x.artist_id = a.id), '[]'))
      into v from public.artists a where id = p_id;
  elsif p_kind = 'label' then
    select jsonb_build_object('id', id, 'name', name, 'slug', slug, 'discogs_id', discogs_label_id,
           'aliases', coalesce((select jsonb_agg(x.name order by lower(x.name)) from public.label_aliases x where x.label_id = b.id), '[]'))
      into v from public.labels b where id = p_id;
  elsif p_kind = 'genre' then
    select jsonb_build_object('id', id, 'name', name, 'slug', slug) into v from public.genres where id = p_id;
  else
    select jsonb_build_object('id', id, 'name', name, 'slug', slug) into v from public.tags where id = p_id;
  end if;
  if v is null then raise exception 'not found' using errcode = 'P0002'; end if;
  return v || jsonb_build_object('listing_ids', coalesce((
    select jsonb_agg(l.id order by l.created_at desc) from public.listings l
     where l.release_id in (select e.release_id from public.entity_links() e where e.kind = p_kind and e.entity_id = p_id)), '[]'));
end
$$;
