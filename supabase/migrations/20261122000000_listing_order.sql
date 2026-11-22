-- 0029 listing order (2026-11-22, decision 0129): Gio decides the order records appear in the shop, by drag & drop in
-- the admin Listings page. One global order for every listing (lower sort_order = first); each admin tab (Live, Drafts,
-- Sold, Archived) and each shop list shows it filtered, so a sold copy keeps its place among the available ones.
-- · sort_order is numeric: a move puts the copy halfway between its new visible neighbours, nothing else is renumbered
-- · a new listing goes on top; a draft that is published goes on top again (Gio 2026-11-22: "In cima a Live")
-- · moving a public copy changes the listing row, so the shop rebuilds (trigger listings_site_build, 0005); a draft does not
begin;

alter table public.listings add column sort_order numeric;

-- today's shop order (byListingOrder in apps/storefront/data/products.js): newest published first, then newest created
update public.listings l set sort_order = o.n
  from (select id, row_number() over (order by published_at desc nulls last, created_at desc, slug) as n
          from public.listings) o
 where o.id = l.id;

alter table public.listings alter column sort_order set not null;
create index listings_sort_order on public.listings (sort_order);

-- ── on top: a new listing, and a draft when it is published ──────────────────
create function public.listing_on_top() returns trigger
  language plpgsql security definer set search_path = ''
  as $$
begin
  if tg_op = 'INSERT' then
    if new.sort_order is null then
      new.sort_order := coalesce((select min(sort_order) from public.listings), 1) - 1;
    end if;
  elsif old.status = 'draft' and new.status <> 'draft' and new.status <> 'archived' then
    new.sort_order := coalesce((select min(sort_order) from public.listings where id <> new.id), 1) - 1;
  end if;
  return new;
end
$$;
create trigger listings_on_top before insert or update of status on public.listings
  for each row execute function public.listing_on_top();
revoke execute on function public.listing_on_top() from public, anon, authenticated;

-- ── a move: p_id goes between p_after (the row now above it) and p_before (the row now below it) ──
-- Either may be null (top or bottom of the visible list). Returns the new sort_order.
create function public.admin_move_listing(p_id uuid, p_after uuid, p_before uuid) returns numeric
  language plpgsql security invoker set search_path = ''
  as $$
declare
  v_above numeric;
  v_below numeric;
  v_new numeric;
begin
  if not public.is_admin() then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if p_after is not null then select sort_order into v_above from public.listings where id = p_after; end if;
  if p_before is not null then select sort_order into v_below from public.listings where id = p_before; end if;
  v_new := case
    when v_above is not null and v_below is not null then (v_above + v_below) / 2
    when v_above is not null then v_above + 1
    when v_below is not null then v_below - 1
    else null end;
  if v_new is null then
    raise exception 'no neighbour to move next to' using errcode = '22023';
  end if;
  -- the neighbours are too close to split (many moves into the same gap): renumber everything 1, 2, 3… and retry once
  if v_new = v_above or v_new = v_below then
    update public.listings l set sort_order = o.n
      from (select id, row_number() over (order by sort_order, id) as n from public.listings) o where o.id = l.id;
    select sort_order into v_above from public.listings where id = p_after;
    select sort_order into v_below from public.listings where id = p_before;
    v_new := coalesce((v_above + v_below) / 2, v_above + 1, v_below - 1);
  end if;
  update public.listings set sort_order = v_new where id = p_id;
  if not found then
    raise exception 'listing not found' using errcode = 'P0002';
  end if;
  return v_new;
end
$$;
revoke execute on function public.admin_move_listing(uuid, uuid, uuid) from public, anon;
grant execute on function public.admin_move_listing(uuid, uuid, uuid) to authenticated;

commit;
