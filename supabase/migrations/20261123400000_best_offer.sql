-- 0034 best offer (2026-11-23, decision 0158): sale copies with no price; buyers send offers, Gio accepts or declines.
-- · listings.price_mode: 'fixed' (a price, the Bag, first to pay wins) | 'offers' (no price, "Make an offer", never in
--   the Bag). Only for the sale section. sale_needs_price and the publish check accept a price-less offers copy.
-- · offers: one row per offer. unconfirmed (the buyer has not opened the email link yet, deleted after 2 days) →
--   pending (Gio sees it) → accepted (copy Reserved 48 h, payment link) → paid | declined | closed (the copy was sold
--   another way). An accepted offer whose 48 h are over reads 'expired' (admin_offers.state), and the copy is available
--   again by itself (effective_status, reserved_until).
-- · Written only through the functions below: offer_submit / offer_confirm / offer_pay_info / offer_pay_open run in the
--   Edge Function `offer` (service role); admin_offer_decide runs as the admin (Edge Function `offer-decide`).
-- · checkout_claim (0028) learns the offers: a copy reserved for an accepted offer can be bought by that offer's Stripe
--   session, at the offer's amount; when copies are sold, their other open offers are closed and returned (emails).
-- · admin_save_listing: the 0026 version + price_mode.
-- Anti-spam is in the Edge Function (honeypot, proof of work, time trap); here the per-email / per-copy rate limits.

begin;

-- ── price mode ──────────────────────────────────────────────────────────────
alter table public.listings add column price_mode text not null default 'fixed' check (price_mode in ('fixed', 'offers'));
alter table public.listings add constraint offers_only_for_sale check (price_mode = 'fixed' or section = 'sale');
comment on column public.listings.price_mode is 'fixed = price + Bag; offers = no price, buyers make offers (decision 0158)';
alter table public.listings drop constraint sale_needs_price;
alter table public.listings add constraint sale_needs_price
  check (status = 'draft' or section <> 'sale' or price_mode = 'offers' or price_cents is not null);

create or replace function public.listing_publish_check() returns trigger
  language plpgsql security invoker set search_path = ''
  as $$
declare
  v_missing text[] := '{}';
begin
  if new.status = 'draft' then return new; end if;
  if new.condition_media is null then v_missing := v_missing || 'grading of side A'::text; end if;
  if new.section = 'sale' and new.price_mode = 'fixed' and new.price_cents is null then v_missing := v_missing || 'price'::text; end if;
  if not exists (select 1 from public.releases where id = new.release_id and nullif(format, '') is not null) then
    v_missing := v_missing || 'format'::text;
  end if;
  if not exists (select 1 from public.release_lines where release_id = new.release_id and position = 1 and nullif(trim(artist), '') is not null) then
    v_missing := v_missing || 'artist'::text;
  end if;
  if cardinality(v_missing) > 0 then
    raise exception 'incomplete draft: add the % before publishing', array_to_string(v_missing, ', ') using errcode = '23514';
  end if;
  return new;
end
$$;
-- the trigger fires on status only: a live copy switched to offers (no price) must also pass, so it fires on price_mode too
drop trigger listings_publish_check on public.listings;
create trigger listings_publish_check before insert or update of status, price_mode on public.listings
  for each row execute function public.listing_publish_check();

-- ── offers ──────────────────────────────────────────────────────────────────
create table public.offers (
  id                uuid primary key default gen_random_uuid(),
  listing_id        uuid not null references public.listings (id) on delete cascade,
  amount_cents      int not null check (amount_cents > 0 and amount_cents <= 10000000),
  currency          char(3) not null default 'EUR',
  email             text not null check (email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' and length(email) <= 254),
  country           char(2) not null check (country ~ '^[A-Z]{2}$'),
  note              text check (length(note) <= 1000),
  status            text not null default 'unconfirmed'
                    check (status in ('unconfirmed', 'pending', 'accepted', 'declined', 'paid', 'closed')),
  confirm_token     text not null unique,
  pay_token         text unique,
  stripe_session_id text,
  created_at        timestamptz not null default now(),
  confirmed_at      timestamptz,
  decided_at        timestamptz,
  expires_at        timestamptz,                      -- accepted: the end of the 48 h payment window
  paid_at           timestamptz
);
comment on table public.offers is 'Offers on best-offer copies (decision 0158): unconfirmed → pending → accepted → paid | declined | closed';
create index offers_listing on public.offers (listing_id, status);
create index offers_email on public.offers (email, created_at);
create index offers_session on public.offers (stripe_session_id) where stripe_session_id is not null;
alter table public.offers enable row level security;
create policy offers_admin on public.offers for select to authenticated using (public.is_admin());
grant select on public.offers to authenticated;

-- 64 hex characters from two random v4 uuids (244 random bits): the links in the emails
create function public.offer_token() returns text
  language sql volatile set search_path = ''
  as $$ select replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '') $$;

-- the shown name of a copy, as checkout_items
create function public.listing_name(p_listing uuid) returns text
  language sql stable security definer set search_path = ''
  as $$
    select coalesce(nullif(trim(l.custom_title), ''),
                    (select public.release_display_name(jsonb_agg(jsonb_build_object('artist', rl.artist, 'title', rl.title) order by rl.position))
                       from public.release_lines rl where rl.release_id = l.release_id))
      from public.listings l where l.id = p_listing
  $$;

/* the form (Edge Function `offer`, after the anti-bot checks). Returns
   { result: 'ok', token, name, slug } · { result: 'unavailable' } · { result: 'too_many' } */
create function public.offer_submit(p_listing uuid, p_amount int, p_country text, p_email text, p_note text) returns jsonb
  language plpgsql security definer set search_path = ''
  as $$
declare
  v_email text := lower(trim(p_email));
  v_token text := public.offer_token();
  l public.listings;
begin
  delete from public.offers where status = 'unconfirmed' and created_at < now() - interval '2 days';   -- housekeeping
  select * into l from public.listings where id = p_listing;
  if not found or l.section <> 'sale' or l.price_mode <> 'offers'
     or public.effective_status(l.status, l.reserved_until) <> 'available' then
    return jsonb_build_object('result', 'unavailable');
  end if;
  if (select count(*) from public.offers where email = v_email and listing_id = p_listing and created_at > now() - interval '1 day') >= 3
     or (select count(*) from public.offers where email = v_email and created_at > now() - interval '1 day') >= 10
     or (select count(*) from public.offers where listing_id = p_listing and status = 'unconfirmed' and created_at > now() - interval '1 day') >= 30 then
    return jsonb_build_object('result', 'too_many');
  end if;
  insert into public.offers (listing_id, amount_cents, email, country, note, confirm_token)
  values (p_listing, p_amount, v_email, upper(p_country), nullif(left(trim(coalesce(p_note, '')), 1000), ''), v_token);
  return jsonb_build_object('result', 'ok', 'token', v_token, 'name', public.listing_name(p_listing), 'slug', l.slug);
end
$$;

/* the email link. { result: 'confirmed', first, … } (first = false: opened again) · 'expired' (24 h) · 'invalid' */
create function public.offer_confirm(p_token text) returns jsonb
  language plpgsql security definer set search_path = ''
  as $$
declare
  o public.offers;
  v_first boolean := false;
begin
  select * into o from public.offers where confirm_token = p_token for update;
  if not found then return jsonb_build_object('result', 'invalid'); end if;
  if o.status = 'unconfirmed' then
    if o.created_at < now() - interval '24 hours' then return jsonb_build_object('result', 'expired'); end if;
    update public.offers set status = 'pending', confirmed_at = now() where id = o.id returning * into o;
    v_first := true;
  end if;
  return jsonb_build_object('result', 'confirmed', 'first', v_first, 'id', o.id, 'amount_cents', o.amount_cents,
    'email', o.email, 'country', o.country, 'note', o.note,
    'name', public.listing_name(o.listing_id), 'slug', (select slug from public.listings where id = o.listing_id),
    'sku', (select sku from public.listings where id = o.listing_id));
end
$$;

-- ── admin ───────────────────────────────────────────────────────────────────
-- the Offers page: confirmed offers with their state and record (state 'expired' = accepted, 48 h over, not paid)
create view public.admin_offers with (security_invoker = true) as
  select o.id, o.listing_id, o.amount_cents, o.currency, o.email, o.country, o.note, o.created_at, o.confirmed_at,
         o.decided_at, o.expires_at, o.paid_at, o.status,
         case when o.status = 'accepted' and o.expires_at <= now() then 'expired' else o.status end as state,
         l.sku, l.slug, l.photo_keys[1] as photo_key, public.effective_status(l.status, l.reserved_until) as listing_status,
         public.listing_name(l.id) as name,
         (select ord.id from public.orders ord where ord.stripe_session_id = o.stripe_session_id and o.status = 'paid') as order_id
    from public.offers o join public.listings l on l.id = o.listing_id
   where o.status <> 'unconfirmed';
grant select on public.admin_offers to authenticated;

/* Accept or decline a pending offer (admin only). Accept: the copy goes Reserved for 48 h and the offer gets its payment
   link; only an available offers copy, so one accepted offer per copy at a time. Returns what the email needs. */
create function public.admin_offer_decide(p_offer uuid, p_accept boolean) returns jsonb
  language plpgsql security definer set search_path = ''
  as $$
declare
  o public.offers;
  l public.listings;
  v_until timestamptz := now() + interval '48 hours';
begin
  if not public.is_admin() then raise exception 'not allowed' using errcode = '42501'; end if;
  select * into o from public.offers where id = p_offer for update;
  if not found then raise exception 'offer not found' using errcode = 'P0002'; end if;
  if o.status <> 'pending' then raise exception 'this offer is % already', o.status using errcode = '22023'; end if;

  if not p_accept then
    update public.offers set status = 'declined', decided_at = now() where id = o.id;
  else
    select * into l from public.listings where id = o.listing_id for update;
    if public.effective_status(l.status, l.reserved_until) <> 'available' then
      raise exception 'the record is % now: it can take an offer only while it is live', public.effective_status(l.status, l.reserved_until)
        using errcode = '22023';
    end if;
    perform set_config('app.status_note', 'offer accepted: ' || to_char(o.amount_cents / 100.0, 'FM999990.00') || ' €', true);
    update public.listings set status = 'reserved', reserved_until = v_until, stripe_session_id = null where id = l.id;
    perform set_config('app.status_note', '', true);
    update public.offers set status = 'accepted', decided_at = now(), expires_at = v_until, pay_token = public.offer_token()
     where id = o.id returning * into o;
  end if;
  return jsonb_build_object('status', case when p_accept then 'accepted' else 'declined' end, 'email', o.email,
    'amount_cents', o.amount_cents, 'country', o.country, 'expires_at', o.expires_at, 'pay_token', o.pay_token,
    'name', public.listing_name(o.listing_id), 'slug', (select slug from public.listings where id = o.listing_id));
end
$$;

-- ── payment of an accepted offer ────────────────────────────────────────────
/* the pay page: { state: 'ready' | 'expired' | 'paid' | 'closed' | 'invalid', … } */
create function public.offer_pay_info(p_token text) returns jsonb
  language plpgsql stable security definer set search_path = ''
  as $$
declare
  o public.offers;
  l public.listings;
  v_state text;
begin
  select * into o from public.offers where pay_token = p_token;
  if not found then return jsonb_build_object('state', 'invalid'); end if;
  select * into l from public.listings where id = o.listing_id;
  v_state := case
    when o.status = 'paid' then 'paid'
    when o.status <> 'accepted' or l.status = 'sold' then 'closed'
    when o.expires_at <= now() or l.status <> 'reserved' or l.reserved_until is distinct from o.expires_at then 'expired'
    else 'ready' end;
  return jsonb_build_object('state', v_state, 'offer_id', o.id, 'listing_id', l.id, 'slug', l.slug,
    'name', public.listing_name(l.id), 'amount_cents', o.amount_cents, 'country', o.country, 'expires_at', o.expires_at,
    'format', (select format from public.releases where id = l.release_id), 'weight_g', l.weight_g, 'photo_key', l.photo_keys[1],
    'session', o.stripe_session_id);
end
$$;

/* a Stripe session was created for this offer: remember it (the previous one is expired by the function) */
create function public.offer_pay_open(p_token text, p_session text) returns boolean
  language plpgsql security definer set search_path = ''
  as $$
declare
  o public.offers;
begin
  update public.offers set stripe_session_id = p_session
   where pay_token = p_token and status = 'accepted' and expires_at > now()
  returning * into o;
  if not found then return false; end if;
  perform public.checkout_open(p_session, array[o.listing_id]);
  return true;
end
$$;

-- ── checkout_claim (0028) with offers ───────────────────────────────────────
create or replace function public.checkout_claim(p_session text, p_order jsonb) returns jsonb
  language plpgsql security definer set search_path = ''
  as $$
declare
  v_order uuid;
  v_ids uuid[];
  v_lost text[];
  v_items jsonb;
  v_closed jsonb;
begin
  select id into v_order from public.orders where stripe_session_id = p_session;
  if v_order is not null then
    return jsonb_build_object('result', 'paid', 'order_id', v_order, 'created', false);
  end if;
  select lost into v_lost from public.checkout_sessions where session_id = p_session and status = 'lost';
  if found then return jsonb_build_object('result', 'lost', 'lost', to_jsonb(coalesce(v_lost, '{}'))); end if;

  select array_agg(distinct x::uuid) into v_ids from jsonb_array_elements_text(p_order->'listing_ids') x;
  if coalesce(array_length(v_ids, 1), 0) = 0 then
    raise exception 'no listings in the order' using errcode = '22023';
  end if;

  -- lock the copies (two sessions completing at once are serialized here), then all or nothing.
  -- Counts as available: a copy held by THIS session (a hold made before 0028), and a copy reserved for an accepted
  -- offer whose Stripe session is this one (0034).
  perform 1 from public.listings where id = any (v_ids) order by id for update;
  select array_agg(l.slug order by l.slug) into v_lost from public.listings l
   where l.id = any (v_ids)
     and not (public.effective_status(l.status, l.reserved_until) = 'available'
              or (l.status = 'reserved' and l.stripe_session_id = p_session)
              or (l.status = 'reserved' and exists (select 1 from public.offers o
                    where o.listing_id = l.id and o.stripe_session_id = p_session and o.status = 'accepted')));
  if (select count(*) from public.listings where id = any (v_ids)) <> array_length(v_ids, 1) then
    v_lost := coalesce(v_lost, '{}') || '(deleted)'::text;
  end if;
  if v_lost is not null then
    insert into public.checkout_sessions (session_id, status, lost, ended_at) values (p_session, 'lost', v_lost, now())
      on conflict (session_id) do update set status = 'lost', lost = excluded.lost, ended_at = now();
    return jsonb_build_object('result', 'lost', 'lost', to_jsonb(v_lost));
  end if;

  insert into public.orders (stripe_session_id, email, customer_name, shipping_address, shipping_country, shipping_cents,
                             subtotal_cents, total_cents, currency, payment_intent)
  values (p_session, p_order->>'email', nullif(p_order->>'customer_name', ''), coalesce(p_order->'shipping_address', '{}'),
          upper(p_order->>'shipping_country'), (p_order->>'shipping_cents')::int, (p_order->>'subtotal_cents')::int,
          (p_order->>'total_cents')::int, upper(p_order->>'currency'), nullif(p_order->>'payment_intent', ''))
  returning id into v_order;
  -- the price paid: the copy's price, or the accepted offer's amount (0034)
  insert into public.order_items (order_id, listing_id, price_cents)
    select v_order, l.id, coalesce((select o.amount_cents from public.offers o
                                     where o.listing_id = l.id and o.stripe_session_id = p_session and o.status = 'accepted'),
                                   l.price_cents)
      from public.listings l where l.id = any (v_ids);

  update public.offers set status = 'paid', paid_at = now()
   where stripe_session_id = p_session and status = 'accepted' and listing_id = any (v_ids);
  -- the other open offers of the copies just sold are closed; the webhook tells those buyers
  with closed as (
    update public.offers set status = 'closed', decided_at = now()
     where listing_id = any (v_ids) and status in ('pending', 'accepted')
    returning email, amount_cents, listing_id)
  select jsonb_agg(jsonb_build_object('email', c.email, 'amount_cents', c.amount_cents, 'name', public.listing_name(c.listing_id)))
    into v_closed from closed c;
  delete from public.offers where listing_id = any (v_ids) and status = 'unconfirmed';

  perform set_config('app.status_note', 'paid on Stripe', true);
  update public.listings set status = 'sold', sold_at = now(), reserved_until = null, stripe_session_id = null
   where id = any (v_ids);
  perform set_config('app.status_note', '', true);

  insert into public.checkout_sessions (session_id, status, ended_at) values (p_session, 'paid', now())
    on conflict (session_id) do update set status = 'paid', ended_at = now();

  select jsonb_agg(jsonb_build_object(
           'listing_id', l.id, 'slug', l.slug, 'price_cents', oi.price_cents,
           'name', public.listing_name(l.id))
         order by array_position(v_ids, l.id))
    into v_items
    from public.order_items oi join public.listings l on l.id = oi.listing_id
   where oi.order_id = v_order;

  return jsonb_build_object('result', 'paid', 'order_id', v_order, 'created', true, 'items', v_items,
                            'closed_offers', coalesce(v_closed, '[]'));
end
$$;

-- a copy sold or traded by hand (admin_set_status): its open offers are closed too, without email
create function public.close_offers_on_sale() returns trigger
  language plpgsql security definer set search_path = ''
  as $$
begin
  if new.status in ('sold', 'traded') and old.status is distinct from new.status then
    update public.offers set status = 'closed', decided_at = now() where listing_id = new.id and status in ('pending', 'accepted');
  end if;
  return new;
end
$$;
create trigger listings_close_offers after update of status on public.listings
  for each row execute function public.close_offers_on_sale();

-- ── access ──────────────────────────────────────────────────────────────────
revoke execute on function public.offer_token()                                  from public, anon, authenticated;
revoke execute on function public.listing_name(uuid)                             from public, anon, authenticated;
revoke execute on function public.offer_submit(uuid, int, text, text, text)      from public, anon, authenticated;
revoke execute on function public.offer_confirm(text)                            from public, anon, authenticated;
revoke execute on function public.offer_pay_info(text)                           from public, anon, authenticated;
revoke execute on function public.offer_pay_open(text, text)                     from public, anon, authenticated;
revoke execute on function public.admin_offer_decide(uuid, boolean)              from public, anon;
revoke execute on function public.close_offers_on_sale()                         from public, anon, authenticated;
grant  execute on function public.listing_name(uuid)                             to authenticated, service_role;
grant  execute on function public.offer_token()                                  to service_role;
grant  execute on function public.offer_submit(uuid, int, text, text, text)      to service_role;
grant  execute on function public.offer_confirm(text)                            to service_role;
grant  execute on function public.offer_pay_info(text)                           to service_role;
grant  execute on function public.offer_pay_open(text, text)                     to service_role;
grant  execute on function public.admin_offer_decide(uuid, boolean)              to authenticated;

create or replace function public.admin_save_listing(payload jsonb) returns jsonb
  language plpgsql security invoker set search_path = ''
  as $$
declare
  v_listing_id uuid := nullif(payload->>'listing_id', '')::uuid;
  v_release_id uuid;
  r jsonb := payload->'release';
  l jsonb := payload->'listing';
  v_lines jsonb := coalesce(payload->'lines', '[]');
  v_status text := coalesce(l->>'status', 'draft');
  v_label_id uuid;
  v_name text;
  v_slug text;
  v_base text;
  v_n int := 1;
  v_sku int;
  -- 0034: 'offers' = a sale copy with no price, buyers make offers (decision 0158); only for the sale section
  v_mode text := case when l->>'section' = 'sale' and l->>'price_mode' = 'offers' then 'offers' else 'fixed' end;
  s jsonb;
  v_line jsonb;
  v_line_id uuid;
  v_artist_id uuid;
  v_artists jsonb;
  v_a jsonb;
  v_apos int;
  v_tag jsonb;
  v_tag_id uuid;
  v_genres jsonb;
  v_pos text;
  v_ord int := 0;
  v_reused boolean := false;   -- a new copy of a release already in the database (0024)
begin
  if not public.is_admin() then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  -- 0026: a draft needs only the title of line 1; the rest is checked on publish (listings_publish_check)
  if jsonb_array_length(v_lines) = 0 or nullif(trim(v_lines->0->>'title'), '') is null then
    raise exception 'line 1 needs a title' using errcode = '22023';
  end if;
  if v_status not in ('draft', 'available') then
    raise exception 'status must be draft or available' using errcode = '22023';
  end if;

  v_label_id := public.resolve_label(nullif(r->>'label_id', '')::uuid, r->>'label', nullif(r->>'label_discogs_id', '')::int);
  perform public.learn_alias('label', v_label_id, coalesce(nullif(trim(r->>'label_credit'), ''), r->>'label'));   -- any spelling that is not the official name

  -- release
  if v_listing_id is not null then
    select release_id into v_release_id from public.listings where id = v_listing_id;
    if v_release_id is null then raise exception 'listing not found' using errcode = 'P0002'; end if;
  elsif nullif(r->>'discogs_release_id', '') is not null then
    -- 0024: a second copy of the same pressing shares its release (releases.discogs_release_id is unique)
    select id into v_release_id from public.releases where discogs_release_id = (r->>'discogs_release_id')::int;
    v_reused := v_release_id is not null;
  end if;
  if v_release_id is not null then
    update public.releases set
      discogs_release_id = nullif(r->>'discogs_release_id', '')::int,
      label    = coalesce(nullif(trim(r->>'label_credit'), ''), nullif(trim(r->>'label'), '')),
      label_id = v_label_id,
      cat_no   = nullif(trim(r->>'cat_no'), ''),
      pre_release = coalesce((r->>'pre_release')::boolean, false),
      year     = nullif(r->>'year', '')::smallint,
      year_precision = coalesce(nullif(r->>'year_precision', ''), 'year'),
      country  = nullif(r->>'country', ''),
      format   = nullif(r->>'format', ''),
      macro_genre = coalesce(array(select jsonb_array_elements_text(coalesce(r->'macro_genre', r->'genre'))), '{}')
    where id = v_release_id;
  else
    insert into public.releases (discogs_release_id, label, label_id, cat_no, pre_release, year, year_precision, country, format, macro_genre)
    values (nullif(r->>'discogs_release_id', '')::int, coalesce(nullif(trim(r->>'label_credit'), ''), nullif(trim(r->>'label'), '')), v_label_id, nullif(trim(r->>'cat_no'), ''), coalesce((r->>'pre_release')::boolean, false),
            nullif(r->>'year', '')::smallint, coalesce(nullif(r->>'year_precision', ''), 'year'), nullif(r->>'country', ''), nullif(r->>'format', ''),
            coalesce(array(select jsonb_array_elements_text(coalesce(r->'macro_genre', r->'genre'))), '{}'))
    returning id into v_release_id;
  end if;

  -- lines: upsert by position, drop the extra ones
  delete from public.release_lines where release_id = v_release_id and position > jsonb_array_length(v_lines);
  insert into public.release_lines (release_id, position, artist, title)
  select v_release_id, ord, coalesce(nullif(trim(x->>'artist_credit'), ''), nullif(trim(public.line_artist_text(x)), '')), trim(x->>'title')
    from jsonb_array_elements(v_lines) with ordinality as t(x, ord)
  on conflict (release_id, position) do update set artist = excluded.artist, title = excluded.title;

  -- line artists: the chips of each line in order, joined by "&" (empty = same as line 1, no rows).
  -- Old payloads (one "artist" per line) still work: they count as one chip.
  delete from public.release_line_artists where line_id in (select id from public.release_lines where release_id = v_release_id);
  v_ord := 0;
  for v_line in select * from jsonb_array_elements(v_lines) loop
    v_ord := v_ord + 1;
    v_artists := case when jsonb_typeof(v_line->'artists') = 'array' then v_line->'artists'
                      when nullif(trim(v_line->>'artist'), '') is not null
                        then jsonb_build_array(jsonb_build_object('id', v_line->'artist_id', 'name', v_line->'artist', 'discogs_id', v_line->'artist_discogs_id'))
                      else '[]'::jsonb end;
    v_apos := 0;
    for v_a in select * from jsonb_array_elements(v_artists) loop
      v_artist_id := public.resolve_artist(nullif(v_a->>'id', '')::uuid, v_a->>'name', nullif(v_a->>'discogs_id', '')::int);
      continue when v_artist_id is null
        or exists (select 1 from public.release_line_artists ra join public.release_lines rl on rl.id = ra.line_id
                    where rl.release_id = v_release_id and rl.position = v_ord and ra.artist_id = v_artist_id);
      v_apos := v_apos + 1;
      insert into public.release_line_artists (line_id, position, artist_id, join_text)
      select id, v_apos, v_artist_id, case when v_apos < jsonb_array_length(v_artists) then '&' end
        from public.release_lines where release_id = v_release_id and position = v_ord;
      -- a printed spelling is an alias only when the line has one artist (a credit for "A & B" names nobody)
      if jsonb_array_length(v_artists) = 1 then
        perform public.learn_alias('artist', v_artist_id, coalesce(nullif(trim(v_line->>'artist_credit'), ''), v_a->>'name'));
      end if;
    end loop;
  end loop;

  -- genres (0011, renamed in 0014): the chips in order; releases.genres keeps their names for the shop.
  -- "subgenres" is the key of an admin from before 0014 (a tab left open while the new one deploys).
  v_genres := coalesce(r->'genres', r->'subgenres');
  if jsonb_typeof(v_genres) = 'array' then
    delete from public.release_genres where release_id = v_release_id;
    v_ord := 0;
    for v_tag in select * from jsonb_array_elements(v_genres) loop
      v_tag_id := public.resolve_genre(nullif(v_tag->>'id', '')::uuid, v_tag->>'name');
      continue when v_tag_id is null or exists (select 1 from public.release_genres where release_id = v_release_id and genre_id = v_tag_id);
      v_ord := v_ord + 1;
      insert into public.release_genres (release_id, genre_id, position) values (v_release_id, v_tag_id, v_ord);
    end loop;
    perform public.sync_genres(array[v_release_id]);
  end if;

  -- tags (migration 0011): Gio's own labels ("Rare", "Killer version"), never from Discogs
  if jsonb_typeof(v_genres) = 'array' and jsonb_typeof(r->'tags') = 'array' then
    delete from public.release_tags where release_id = v_release_id;
    v_ord := 0;
    for v_tag in select * from jsonb_array_elements(r->'tags') loop
      v_tag_id := public.resolve_tag(nullif(v_tag->>'id', '')::uuid, v_tag->>'name');
      continue when v_tag_id is null or exists (select 1 from public.release_tags where release_id = v_release_id and tag_id = v_tag_id);
      v_ord := v_ord + 1;
      insert into public.release_tags (release_id, tag_id, position) values (v_release_id, v_tag_id, v_ord);
    end loop;
  end if;

  -- samples: replaced as a whole (keys stay in storage), positions A, B… per line, X1, X2… for additional
  -- 0024: a new copy of a release already in the database without samples of its own keeps the release's samples
  v_ord := 0;
  if not (v_reused and jsonb_array_length(coalesce(payload->'samples', '[]')) = 0) then
  delete from public.samples where release_id = v_release_id;
  for s in select * from jsonb_array_elements(coalesce(payload->'samples', '[]')) loop
    v_ord := v_ord + 1;
    if nullif(s->>'line', '') is not null then
      select id into v_line_id from public.release_lines where release_id = v_release_id and position = (s->>'line')::int;
      v_pos := chr(64 + (s->>'line')::int);
    else
      v_line_id := null;
      v_pos := 'X';
    end if;
    select count(*) into v_n from public.samples
     where release_id = v_release_id and (track_position = v_pos or track_position ~ ('^' || v_pos || '[0-9]+$'));
    if v_pos = 'X' or v_n > 0 then
      v_pos := v_pos || (v_n + 1)::text;
    end if;
    insert into public.samples (release_id, line_id, track_position, title, audio_key, sort)
    values (v_release_id, v_line_id, v_pos, nullif(trim(s->>'title'), ''), s->>'audio_key', v_ord);
  end loop;
  end if;

  -- listing
  v_name := coalesce(nullif(trim(l->>'custom_title'), ''), public.release_display_name(v_lines), trim(v_lines->0->>'title'));   -- 0026: no artist yet
  if v_listing_id is null then
    v_base := nullif(public.slugify(v_name), '');
    v_base := coalesce(v_base, 'record');
    v_slug := v_base;
    v_n := 1;
    while exists (select 1 from public.listings where slug = v_slug) loop
      v_n := v_n + 1;
      v_slug := v_base || '-' || v_n;
    end loop;
    insert into public.listings (slug, release_id, section, status, price_mode, price_cents, condition_media, condition_media_b, sleeve_type,
                                 condition_sleeve, condition_notes, notes, custom_title, photo_keys, published_at)
    values (v_slug, v_release_id, l->>'section', v_status, v_mode,
            case when v_mode = 'offers' then null else nullif(l->>'price_cents', '')::int end, nullif(l->>'condition_media', ''),
            nullif(l->>'condition_media_b', ''), coalesce(l->>'sleeve_type', 'original'), nullif(l->>'condition_sleeve', ''),
            nullif(trim(l->>'condition_notes'), ''), nullif(trim(l->>'notes'), ''), nullif(trim(l->>'custom_title'), ''),
            coalesce(array(select jsonb_array_elements_text(l->'photo_keys')), '{}'),
            case when v_status = 'available' then now() end)
    returning id, sku into v_listing_id, v_sku;
  else
    -- 0026: a draft never published has no public URL yet: its slug follows the name (a bulk draft is born as "record")
    if exists (select 1 from public.listings where id = v_listing_id and status = 'draft' and published_at is null) then
      v_base := coalesce(nullif(public.slugify(v_name), ''), 'record');
      v_slug := v_base;
      v_n := 1;
      while exists (select 1 from public.listings where slug = v_slug and id <> v_listing_id) loop
        v_n := v_n + 1;
        v_slug := v_base || '-' || v_n;
      end loop;
      update public.listings set slug = v_slug where id = v_listing_id;
    end if;
    update public.listings set
      section = l->>'section',
      status = case when status in ('reserved', 'sold', 'traded') then status else v_status end,
      price_mode = v_mode,
      price_cents = case when v_mode = 'offers' then null else nullif(l->>'price_cents', '')::int end,
      condition_media = nullif(l->>'condition_media', ''),
      condition_media_b = nullif(l->>'condition_media_b', ''),
      sleeve_type = coalesce(l->>'sleeve_type', 'original'),
      condition_sleeve = nullif(l->>'condition_sleeve', ''),
      condition_notes = nullif(trim(l->>'condition_notes'), ''),
      notes = nullif(trim(l->>'notes'), ''),
      custom_title = nullif(trim(l->>'custom_title'), ''),
      photo_keys = coalesce(array(select jsonb_array_elements_text(l->'photo_keys')), '{}'),
      published_at = case when v_status = 'available' then coalesce(published_at, now()) else published_at end
    where id = v_listing_id
    returning sku, slug into v_sku, v_slug;
  end if;

  select slug, status into v_slug, v_status from public.listings where id = v_listing_id;
  return jsonb_build_object('listing_id', v_listing_id, 'release_id', v_release_id, 'sku', v_sku, 'slug', v_slug, 'status', v_status);
end
$$;

commit;
