-- 0028 checkout, first to pay wins (2026-11-18, decision 0116; replaces the checkout hold of 0021 / decision 0059).
-- Starting a checkout no longer holds anything: a copy stays available (never "Reserved") while people are on Stripe.
-- Stripe only AUTHORIZES the payment (capture_method = manual). When a session completes, stripe-webhook calls
-- checkout_claim: all or nothing, the copies still available become sold and the order is recorded → the webhook
-- captures the payment. If one copy was sold meanwhile, nothing is sold, the session is recorded as `lost` → the webhook
-- cancels the authorization (the buyer is never charged) and writes to them. Then the other open sessions that share a
-- copy just sold are expired on Stripe (checkout_rivals), so nobody else can pay for it.
-- · checkout_sessions / checkout_session_items: which copies each Stripe session is for (a copy can be in many).
-- · checkout_items(ids): the copies for a new session, only if every one is an available sale copy (no update).
-- · checkout_open(session, ids) · checkout_end(session, status): bookkeeping of the sessions.
-- · checkout_claim(session, order) · checkout_rivals(session) · checkout_result(session) (public: the thanks page).
-- Legacy: checkout_hold/attach/release/complete stay for holds made before this migration (they end within 33 min).
-- Gio counts collisions: checkout_sessions where status = 'lost'.

create table public.checkout_sessions (
  session_id  text primary key,                       -- Stripe cs_…
  status      text not null default 'open' check (status in ('open', 'paid', 'lost', 'expired')),
  lost        text[],                                  -- lost: slugs of the copies someone else got first
  created_at  timestamptz not null default now(),
  ended_at    timestamptz
);
comment on table public.checkout_sessions is 'Stripe Checkout sessions (0028): open → paid | lost (a copy was sold first: authorization cancelled) | expired';
create table public.checkout_session_items (
  session_id  text not null references public.checkout_sessions (session_id) on delete cascade,
  listing_id  uuid not null references public.listings (id) on delete cascade,
  primary key (session_id, listing_id)
);
create index checkout_session_items_listing on public.checkout_session_items (listing_id);
alter table public.checkout_sessions enable row level security;
alter table public.checkout_session_items enable row level security;
-- no policies: only the security definer functions below read or write them

-- ── new session ─────────────────────────────────────────────────────────────
/* one row per copy, with what Stripe and shipping.js need; NO rows unless every id is an available sale copy */
create function public.checkout_items(p_ids uuid[])
  returns table (id uuid, slug text, name text, price_cents int, format text, weight_g int, photo_key text)
  language plpgsql stable security definer set search_path = ''
  as $$
begin
  if coalesce(array_length(p_ids, 1), 0) = 0 then return; end if;
  if (select count(*) from public.listings l
       where l.id = any (p_ids) and l.section = 'sale' and l.price_cents is not null
         and public.effective_status(l.status, l.reserved_until) = 'available')
     <> (select count(distinct x) from unnest(p_ids) x) then
    return;
  end if;
  return query
    select l.id, l.slug,
           coalesce(nullif(trim(l.custom_title), ''),
                    (select public.release_display_name(jsonb_agg(jsonb_build_object('artist', rl.artist, 'title', rl.title) order by rl.position))
                       from public.release_lines rl where rl.release_id = l.release_id)),
           l.price_cents, r.format, l.weight_g, l.photo_keys[1]
      from public.listings l join public.releases r on r.id = l.release_id
     where l.id = any (p_ids)
     order by array_position(p_ids, l.id);
end
$$;

create function public.checkout_open(p_session text, p_ids uuid[]) returns void
  language sql security definer set search_path = ''
  as $$
    insert into public.checkout_sessions (session_id) values (p_session) on conflict do nothing;
    insert into public.checkout_session_items (session_id, listing_id)
      select p_session, x from unnest(p_ids) x on conflict do nothing;
  $$;

/* expired / cancelled on Stripe: bookkeeping only (nothing was held) */
create function public.checkout_end(p_session text, p_status text) returns void
  language sql security definer set search_path = ''
  as $$
    update public.checkout_sessions set status = p_status, ended_at = now()
     where session_id = p_session and status = 'open' and p_status in ('expired');
  $$;

-- ── paid (authorized) ───────────────────────────────────────────────────────
/* p_order as checkout_complete (0021). Returns
   { result: 'paid', order_id, created, items: [...] }  → capture the payment (created = false: already recorded)
   { result: 'lost', lost: [slugs] }                     → cancel the authorization, nothing was sold */
create function public.checkout_claim(p_session text, p_order jsonb) returns jsonb
  language plpgsql security definer set search_path = ''
  as $$
declare
  v_order uuid;
  v_ids uuid[];
  v_lost text[];
  v_items jsonb;
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
  -- A copy held by THIS session (a hold made before 0028) counts as available.
  perform 1 from public.listings where id = any (v_ids) order by id for update;
  select array_agg(l.slug order by l.slug) into v_lost from public.listings l
   where l.id = any (v_ids)
     and not (public.effective_status(l.status, l.reserved_until) = 'available'
              or (l.status = 'reserved' and l.stripe_session_id = p_session));
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
  insert into public.order_items (order_id, listing_id, price_cents)
    select v_order, l.id, l.price_cents from public.listings l where l.id = any (v_ids);

  perform set_config('app.status_note', 'paid on Stripe', true);
  update public.listings set status = 'sold', sold_at = now(), reserved_until = null, stripe_session_id = null
   where id = any (v_ids);
  perform set_config('app.status_note', '', true);

  insert into public.checkout_sessions (session_id, status, ended_at) values (p_session, 'paid', now())
    on conflict (session_id) do update set status = 'paid', ended_at = now();

  select jsonb_agg(jsonb_build_object(
           'listing_id', l.id, 'slug', l.slug, 'price_cents', oi.price_cents,
           'name', coalesce(nullif(trim(l.custom_title), ''),
                            (select public.release_display_name(jsonb_agg(jsonb_build_object('artist', rl.artist, 'title', rl.title) order by rl.position))
                               from public.release_lines rl where rl.release_id = l.release_id)))
         order by array_position(v_ids, l.id))
    into v_items
    from public.order_items oi join public.listings l on l.id = oi.listing_id
   where oi.order_id = v_order;

  return jsonb_build_object('result', 'paid', 'order_id', v_order, 'created', true, 'items', v_items);
end
$$;

/* the other OPEN sessions with a copy of this one: stripe-webhook expires them on Stripe */
create function public.checkout_rivals(p_session text) returns setof text
  language sql stable security definer set search_path = ''
  as $$
    select distinct s.session_id from public.checkout_session_items mine
      join public.checkout_session_items other on other.listing_id = mine.listing_id and other.session_id <> mine.session_id
      join public.checkout_sessions s on s.session_id = other.session_id and s.status = 'open'
     where mine.session_id = p_session;
  $$;

/* the thanks page: 'paid' | 'lost' | 'pending' (webhook not there yet). Only the status, for a cs_ id the buyer has. */
create function public.checkout_result(p_session text) returns text
  language sql stable security definer set search_path = ''
  as $$
    select case
      when exists (select 1 from public.orders where stripe_session_id = p_session) then 'paid'
      when exists (select 1 from public.checkout_sessions where session_id = p_session and status = 'lost') then 'lost'
      else 'pending' end
  $$;

/* the capture failed after the copies were sold (should not happen within 31 min): Gio checks it by hand */
create function public.checkout_attention(p_session text, p_note text) returns void
  language sql security definer set search_path = ''
  as $$ update public.orders set attention = p_note where stripe_session_id = p_session $$;

-- ── access ──────────────────────────────────────────────────────────────────
revoke execute on function public.checkout_items(uuid[])          from public, anon, authenticated;
revoke execute on function public.checkout_open(text, uuid[])     from public, anon, authenticated;
revoke execute on function public.checkout_end(text, text)        from public, anon, authenticated;
revoke execute on function public.checkout_claim(text, jsonb)     from public, anon, authenticated;
revoke execute on function public.checkout_rivals(text)           from public, anon, authenticated;
revoke execute on function public.checkout_attention(text, text)  from public, anon, authenticated;
revoke execute on function public.checkout_result(text)           from public;
grant  execute on function public.checkout_items(uuid[])          to service_role;
grant  execute on function public.checkout_open(text, uuid[])     to service_role;
grant  execute on function public.checkout_end(text, text)        to service_role;
grant  execute on function public.checkout_claim(text, jsonb)     to service_role;
grant  execute on function public.checkout_rivals(text)           to service_role;
grant  execute on function public.checkout_attention(text, text)  to service_role;
grant  execute on function public.checkout_result(text)           to anon, authenticated, service_role;
