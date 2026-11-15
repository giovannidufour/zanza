-- 0021 checkout (2026-11-15): Stripe Checkout with a hold on the copies (_context/backend.md → Checkout con hold).
-- Called ONLY by the Edge Functions create-checkout and stripe-webhook, with the service role: never by the browser.
-- · checkout_hold(ids, token, minutes): holds every copy that is an available sale copy (or whose hold expired), all or
--   nothing. The hold carries a token in stripe_session_id until the Stripe session exists.
-- · checkout_attach(token, session): swaps the token for the Stripe session id.
-- · checkout_release(key): a token or a session id → its copies are available again (cancel, expired, Stripe error).
-- · checkout_complete(session, order): the paid session → order + order_items + copies sold. Idempotent (Stripe can
--   send the same event twice). A copy that this session no longer holds (should not happen: the Stripe session ends
--   before the hold) is still put in the order, and the order gets `attention` so Gio refunds it by hand.
-- The site rebuild trigger (0005/0009) ignores holds starting or ending; a sale rebuilds (sold_at changes).

alter table public.orders
  add column customer_name  text,
  add column subtotal_cents int,
  add column payment_intent text,
  add column attention      text;   -- null = fine; otherwise why Gio has to look at it (e.g. a copy sold twice)
comment on column public.orders.attention is 'null = fine; text = why Gio must check this order by hand (double sale → refund)';

-- ── hold ────────────────────────────────────────────────────────────────────
/* returns one row per held copy, with what Stripe and shipping.js need. Nothing held when one copy is not free. */
create function public.checkout_hold(p_ids uuid[], p_token text, p_minutes int default 33)
  returns table (id uuid, slug text, name text, price_cents int, format text, weight_g int, photo_key text)
  language plpgsql security definer set search_path = ''
  as $$
declare
  v_n int;
begin
  if p_token is null or p_token !~ '^hold:' or coalesce(array_length(p_ids, 1), 0) = 0 or p_minutes not between 31 and 60 then
    raise exception 'bad hold request' using errcode = '22023';
  end if;
  perform set_config('app.status_note', 'checkout hold', true);
  update public.listings l set
    status = 'reserved', reserved_until = now() + make_interval(mins => p_minutes), stripe_session_id = p_token
  where l.id = any (p_ids) and l.section = 'sale' and l.price_cents is not null
    and public.effective_status(l.status, l.reserved_until) = 'available';
  get diagnostics v_n = row_count;
  perform set_config('app.status_note', '', true);
  if v_n <> (select count(distinct x) from unnest(p_ids) x) then
    -- all or nothing: undo the partial hold (the caller answers "just sold" and lists what is still free)
    update public.listings l set status = 'available', reserved_until = null, stripe_session_id = null
      where l.stripe_session_id = p_token;
    return;
  end if;
  return query
    select l.id, l.slug,
           coalesce(nullif(trim(l.custom_title), ''),
                    (select public.release_display_name(jsonb_agg(jsonb_build_object('artist', rl.artist, 'title', rl.title) order by rl.position))
                       from public.release_lines rl where rl.release_id = l.release_id)),
           l.price_cents, r.format, l.weight_g, l.photo_keys[1]
      from public.listings l join public.releases r on r.id = l.release_id
     where l.stripe_session_id = p_token
     order by array_position(p_ids, l.id);
end
$$;

create function public.checkout_attach(p_token text, p_session text) returns int
  language sql security definer set search_path = ''
  as $$
    with u as (update public.listings set stripe_session_id = p_session
                where stripe_session_id = p_token and status = 'reserved' returning 1)
    select count(*)::int from u
  $$;

/* a token or a Stripe session id: its copies that are still held become available. Returns how many. */
create function public.checkout_release(p_key text) returns int
  language plpgsql security definer set search_path = ''
  as $$
declare
  v_n int;
begin
  if coalesce(p_key, '') = '' then return 0; end if;
  perform set_config('app.status_note', 'checkout ended', true);
  update public.listings set status = 'available', reserved_until = null, stripe_session_id = null
   where stripe_session_id = p_key and status = 'reserved';
  get diagnostics v_n = row_count;
  perform set_config('app.status_note', '', true);
  return v_n;
end
$$;

-- ── paid ────────────────────────────────────────────────────────────────────
/* p_order: { listing_ids: [uuid], email, customer_name, shipping_address {}, shipping_country, shipping_cents,
              subtotal_cents, total_cents, currency, payment_intent }
   returns { order_id, created (false = already recorded), attention, items: [{ listing_id, slug, name, price_cents }] } */
create function public.checkout_complete(p_session text, p_order jsonb) returns jsonb
  language plpgsql security definer set search_path = ''
  as $$
declare
  v_order uuid;
  v_ids uuid[];
  v_lost text[];
  v_attention text;
  v_items jsonb;
begin
  select id into v_order from public.orders where stripe_session_id = p_session;
  if v_order is not null then
    return jsonb_build_object('order_id', v_order, 'created', false);
  end if;
  select array_agg(x::uuid) into v_ids from jsonb_array_elements_text(p_order->'listing_ids') x;
  if coalesce(array_length(v_ids, 1), 0) = 0 then
    raise exception 'no listings in the order' using errcode = '22023';
  end if;

  -- copies of this session that someone else got in the meantime (hold expired before payment, or sold by hand)
  select array_agg(l.slug) into v_lost from public.listings l
   where l.id = any (v_ids) and not (l.stripe_session_id is not distinct from p_session and l.status = 'reserved');
  if v_lost is not null then
    v_attention := 'Not held by this checkout any more, check and refund if sold twice: ' || array_to_string(v_lost, ', ');
  end if;

  insert into public.orders (stripe_session_id, email, customer_name, shipping_address, shipping_country, shipping_cents,
                             subtotal_cents, total_cents, currency, payment_intent, attention)
  values (p_session, p_order->>'email', nullif(p_order->>'customer_name', ''), coalesce(p_order->'shipping_address', '{}'),
          upper(p_order->>'shipping_country'), (p_order->>'shipping_cents')::int, (p_order->>'subtotal_cents')::int,
          (p_order->>'total_cents')::int, upper(p_order->>'currency'), nullif(p_order->>'payment_intent', ''), v_attention)
  returning id into v_order;

  insert into public.order_items (order_id, listing_id, price_cents)
    select v_order, l.id, l.price_cents from public.listings l where l.id = any (v_ids);

  perform set_config('app.status_note', 'paid on Stripe', true);
  update public.listings set status = 'sold', sold_at = now(), reserved_until = null, stripe_session_id = null
   where id = any (v_ids) and stripe_session_id is not distinct from p_session and status = 'reserved';
  perform set_config('app.status_note', '', true);

  select jsonb_agg(jsonb_build_object(
           'listing_id', l.id, 'slug', l.slug, 'price_cents', oi.price_cents,
           'name', coalesce(nullif(trim(l.custom_title), ''),
                            (select public.release_display_name(jsonb_agg(jsonb_build_object('artist', rl.artist, 'title', rl.title) order by rl.position))
                               from public.release_lines rl where rl.release_id = l.release_id)))
         order by array_position(v_ids, l.id))
    into v_items
    from public.order_items oi join public.listings l on l.id = oi.listing_id
   where oi.order_id = v_order;

  return jsonb_build_object('order_id', v_order, 'created', true, 'attention', v_attention, 'items', v_items);
end
$$;

-- ── access: service role only (the Edge Functions) ──────────────────────────
revoke execute on function public.checkout_hold(uuid[], text, int)   from public, anon, authenticated;
revoke execute on function public.checkout_attach(text, text)        from public, anon, authenticated;
revoke execute on function public.checkout_release(text)             from public, anon, authenticated;
revoke execute on function public.checkout_complete(text, jsonb)     from public, anon, authenticated;
grant  execute on function public.checkout_hold(uuid[], text, int)   to service_role;
grant  execute on function public.checkout_attach(text, text)        to service_role;
grant  execute on function public.checkout_release(text)             to service_role;
grant  execute on function public.checkout_complete(text, jsonb)     to service_role;
