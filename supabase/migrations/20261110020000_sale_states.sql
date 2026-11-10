-- 0004 sale states (2026-11-10): how a copy moves between draft / available / reserved / sold / traded.
-- · admin_set_status(): the only manual way to change a status, with the allowed transitions below.
--   The Create/Edit form keeps doing draft ⇄ available on save (0003) and never undoes a sale.
-- · effective_status(): a checkout hold whose reserved_until has passed counts as available, so a missed
--   Stripe "expired" webhook can never block a copy. Manual holds have reserved_until = null (until released).
-- · listing_availability: public view (id, slug, section, status) for the live status on the static site.
-- · listing_status_log: every status change, whoever made it (admin, form, future checkout functions).
-- · sold only in the sale section, traded only in the trade section.
--
--   draft ──► available ──► reserved ──► sold (sale) / traded (trade)
--     ▲          │  ▲           │                │
--     └──────────┘  └───────────┴────────────────┘   (unpublish · release · undo a sale or trade)
--   available ──► sold / traded directly (sold elsewhere: fair, Discogs, in person)

alter table public.listings
  add constraint sold_only_for_sale     check (status <> 'sold'   or section = 'sale'),
  add constraint traded_only_for_trade  check (status <> 'traded' or section = 'trade');

-- ── effective status ────────────────────────────────────────────────────────
create function public.effective_status(p_status text, p_reserved_until timestamptz) returns text
  language sql stable set search_path = ''
  as $$ select case when p_status = 'reserved' and p_reserved_until is not null and p_reserved_until <= now()
                    then 'available' else p_status end $$;

-- public, read-only: what site.js needs to update CTAs on static pages. Drafts stay hidden (RLS of listings).
create view public.listing_availability with (security_invoker = true) as
  select id, slug, section, public.effective_status(status, reserved_until) as status
    from public.listings;

-- ── status log ──────────────────────────────────────────────────────────────
create table public.listing_status_log (
  id          bigint generated always as identity primary key,
  listing_id  uuid not null references public.listings on delete cascade,
  from_status text,
  to_status   text not null,
  note        text,
  changed_by  uuid,
  changed_at  timestamptz not null default now()
);
create index listing_status_log_listing on public.listing_status_log (listing_id, changed_at desc);

create function public.log_listing_status() returns trigger
  language plpgsql security definer set search_path = ''
  as $$
begin
  if tg_op = 'INSERT' or new.status is distinct from old.status then
    insert into public.listing_status_log (listing_id, from_status, to_status, note, changed_by)
    values (new.id, case when tg_op = 'UPDATE' then old.status end, new.status,
            nullif(current_setting('app.status_note', true), ''), auth.uid());
  end if;
  return new;
end
$$;
create trigger listings_status_log after insert or update of status on public.listings
  for each row execute function public.log_listing_status();

-- ── manual status change (admin) ────────────────────────────────────────────
/* returns { listing_id, status, reserved_until, sold_at } */
create function public.admin_set_status(p_listing_id uuid, p_status text, p_note text default null,
                                        p_reserved_until timestamptz default null) returns jsonb
  language plpgsql security invoker set search_path = ''
  as $$
declare
  cur public.listings;
  v_from text;
  v_allowed text[];
begin
  if not public.is_admin() then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  select * into cur from public.listings where id = p_listing_id for update;
  if not found then raise exception 'listing not found' using errcode = 'P0002'; end if;

  v_from := public.effective_status(cur.status, cur.reserved_until);
  v_allowed := case v_from
    when 'draft'     then array['available']
    when 'available' then array['draft', 'reserved', case cur.section when 'sale' then 'sold' else 'traded' end]
    when 'reserved'  then array['available', case cur.section when 'sale' then 'sold' else 'traded' end]
    when 'sold'      then array['available']
    when 'traded'    then array['available']
  end;
  if not (p_status = any (v_allowed)) then
    raise exception 'cannot go from % to % (allowed: %)', v_from, p_status, array_to_string(v_allowed, ', ') using errcode = '22023';
  end if;
  -- a live checkout owns the copy until Stripe answers or the hold expires: no manual change in between
  if v_from = 'reserved' and cur.stripe_session_id is not null then
    raise exception 'a checkout is in progress until % (UTC): wait for it to finish or expire', to_char(cur.reserved_until at time zone 'UTC', 'HH24:MI')
      using errcode = '55006';
  end if;
  if p_reserved_until is not null and (p_status <> 'reserved' or p_reserved_until <= now()) then
    raise exception 'reserved_until must be in the future and only with status reserved' using errcode = '22023';
  end if;

  perform set_config('app.status_note', coalesce(trim(p_note), ''), true);
  update public.listings set
    status            = p_status,
    reserved_until    = case when p_status = 'reserved' then p_reserved_until end,
    stripe_session_id = null,
    sold_at           = case when p_status in ('sold', 'traded') then now() end,
    published_at      = case when p_status = 'available' then coalesce(published_at, now()) else published_at end
  where id = p_listing_id
  returning * into cur;
  perform set_config('app.status_note', '', true);

  return jsonb_build_object('listing_id', cur.id, 'status', cur.status, 'reserved_until', cur.reserved_until, 'sold_at', cur.sold_at);
end
$$;

-- ── access ──────────────────────────────────────────────────────────────────
alter table public.listing_status_log enable row level security;
grant select on public.listing_status_log to authenticated;
create policy listing_status_log_admin on public.listing_status_log for select to authenticated using (public.is_admin());
-- no insert/update/delete grants: rows come only from the trigger (security definer)

grant select on public.listing_availability to anon, authenticated;
grant execute on function public.effective_status(text, timestamptz) to anon, authenticated;
revoke execute on function public.admin_set_status(uuid, text, text, timestamptz) from public, anon;
grant execute on function public.admin_set_status(uuid, text, text, timestamptz) to authenticated;
revoke execute on function public.log_listing_status() from public, anon, authenticated;

-- existing copies: one log row each, so every listing has a starting point
insert into public.listing_status_log (listing_id, from_status, to_status, note, changed_at)
  select id, null, status, 'initial (0004)', coalesce(published_at, created_at) from public.listings;
