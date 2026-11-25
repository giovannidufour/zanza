-- 0040 accepted offers in the Bag (2026-11-25, Gio: "se chiedessi all'utente di loggarsi con la stessa mail? così il
-- link non può essere condiviso"; decision 0186, replaces the single-record pay page of 0158).
-- The email link of an accepted offer (/offer/pay/?t=…) no longer opens its own Stripe Checkout: the buyer signs in with
-- the offer's email (the account's email code, 0101) and the record goes in the Bag at the offer price, next to other
-- records, one checkout, one shipping. The copy stays Reserved for the buyer until the 48 h end (0158), so nobody else
-- can buy it meanwhile; "first to pay wins" (0116) is untouched for the other records.
-- · offer_pay_info: also returns the offer's email and listing id (the page sends the code to that email).
-- · customer_offers(): the signed-in buyer's accepted offers (and the ones paid, closed or expired in the last 30 days),
--   matched by the confirmed email as customer_orders (0022). The Bag prices its offer lines from it.
-- · checkout_items(ids, email): as checkout_items(ids) (0028), but a copy Reserved for an accepted, unexpired offer of
--   that email counts too, at the offer's amount, with its offer id. All or nothing, as before.
-- · checkout_open_offers(session, offer ids): remembers the Stripe session on those offers, so checkout_claim (0034)
--   lets that session buy the reserved copies at the offer price (a newer session replaces an older one: the older one
--   can't take the copy any more and is never charged).
-- · hook_before_user_created: an email with an accepted (or paid) offer can get an account too, not only one with an
--   order (0022). Still no empty accounts.

-- ── the email link ──────────────────────────────────────────────────────────
create or replace function public.offer_pay_info(p_token text) returns jsonb
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
  return jsonb_build_object('state', v_state, 'offer_id', o.id, 'listing_id', l.id, 'slug', l.slug, 'email', o.email,
    'name', public.listing_name(l.id), 'amount_cents', o.amount_cents, 'country', o.country, 'expires_at', o.expires_at,
    'format', (select format from public.releases where id = l.release_id), 'weight_g', l.weight_g, 'photo_key', l.photo_keys[1],
    'session', o.stripe_session_id);
end
$$;

-- ── the Bag ─────────────────────────────────────────────────────────────────
/* [{ listing_id, offer_id, amount_cents, expires_at, state: ready | expired | paid | closed }], newest first */
create function public.customer_offers() returns jsonb
  language sql stable security definer set search_path = ''
  as $$
    select coalesce(jsonb_agg(jsonb_build_object(
             'listing_id', o.listing_id, 'offer_id', o.id, 'amount_cents', o.amount_cents, 'expires_at', o.expires_at,
             'state', case
               when o.status = 'paid' then 'paid'
               when o.status <> 'accepted' or l.status = 'sold' then 'closed'
               when o.expires_at <= now() or l.status <> 'reserved' or l.reserved_until is distinct from o.expires_at then 'expired'
               else 'ready' end)
           order by o.decided_at desc), '[]'::jsonb)
      from public.offers o join public.listings l on l.id = o.listing_id
     where lower(o.email) = lower(auth.jwt()->>'email')
       and coalesce((auth.jwt()->>'email_verified')::boolean, true)
       and o.status in ('accepted', 'paid', 'closed')
       and o.decided_at > now() - interval '30 days';
  $$;

-- ── checkout ────────────────────────────────────────────────────────────────
create function public.checkout_items(p_ids uuid[], p_email text)
  returns table (id uuid, slug text, name text, price_cents int, format text, weight_g int, photo_key text, offer_id uuid)
  language plpgsql stable security definer set search_path = ''
  as $$
begin
  if coalesce(array_length(p_ids, 1), 0) = 0 then return; end if;
  return query
    with offer as (
      select distinct on (o.listing_id) o.listing_id, o.id, o.amount_cents
        from public.offers o join public.listings l on l.id = o.listing_id
       where o.listing_id = any (p_ids) and p_email is not null and lower(o.email) = lower(p_email)
         and o.status = 'accepted' and o.expires_at > now()
         and l.status = 'reserved' and l.reserved_until = o.expires_at
       order by o.listing_id, o.decided_at desc),
    rows as (
      select l.id, l.slug, public.listing_name(l.id) as name,
             coalesce(f.amount_cents, l.price_cents) as price_cents, r.format, l.weight_g, l.photo_keys[1] as photo_key,
             f.id as offer_id
        from public.listings l join public.releases r on r.id = l.release_id
        left join offer f on f.listing_id = l.id
       where l.id = any (p_ids) and l.section = 'sale'
         and (f.id is not null
              or (l.price_cents is not null and public.effective_status(l.status, l.reserved_until) = 'available')))
    select x.id, x.slug, x.name, x.price_cents, x.format, x.weight_g, x.photo_key, x.offer_id
      from rows x
     where (select count(*) from rows) = (select count(distinct y) from unnest(p_ids) y)
     order by array_position(p_ids, x.id);
end
$$;

create function public.checkout_open_offers(p_session text, p_offers uuid[]) returns int
  language plpgsql security definer set search_path = ''
  as $$
declare v_count int;
begin
  update public.offers set stripe_session_id = p_session
   where id = any (p_offers) and status = 'accepted' and expires_at > now();
  get diagnostics v_count = row_count;
  return v_count;
end
$$;

-- ── accounts ────────────────────────────────────────────────────────────────
create or replace function public.hook_before_user_created(event jsonb) returns jsonb
  language plpgsql stable security definer set search_path = ''
  as $$
begin
  if exists (select 1 from public.orders o where lower(o.email) = lower(event->'user'->>'email'))
     or exists (select 1 from public.offers o where lower(o.email) = lower(event->'user'->>'email') and o.status in ('accepted', 'paid')) then
    return '{}'::jsonb;
  end if;
  return jsonb_build_object('error', jsonb_build_object('http_code', 403, 'message', 'No orders for this email.'));
end
$$;

revoke execute on function public.customer_offers()                       from public, anon;
revoke execute on function public.checkout_items(uuid[], text)            from public, anon, authenticated;
revoke execute on function public.checkout_open_offers(text, uuid[])      from public, anon, authenticated;
grant  execute on function public.customer_offers()                       to authenticated;
grant  execute on function public.checkout_items(uuid[], text)            to service_role;
grant  execute on function public.checkout_open_offers(text, uuid[])      to service_role;
