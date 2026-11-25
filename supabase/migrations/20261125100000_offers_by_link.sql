-- 0041 accepted offers in the Bag by their email link, no sign-in (2026-11-25, Gio after testing 0040: "molto macchinoso";
-- decision 0188, replaces the sign-in of 0186).
-- The email link of an accepted offer (/offer/pay/?t=…) only reaches the offer's inbox, so the link itself is the proof:
-- opening it puts the record in the Bag and the Bag keeps the link's token (pay_token, 0034). create-checkout sends the
-- tokens and the server checks them again. Accepted risk: a forwarded link lets someone else pay the agreed price.
-- · checkout_items(ids, tokens): as checkout_items(ids, email) of 0040, but an offer is matched by its pay_token; it
--   also returns the offer's email (Stripe gets it prefilled). checkout_items(ids, email) is dropped.
-- · customer_offers() is dropped (the Bag reads each offer with the function `offer`, action pay-info).
-- · offer_pay_info: no email any more (nothing on the page needs it).
-- · hook_before_user_created: back to 0022 (an account only for an email with an order).
-- checkout_open_offers (0040) stays as it is.

-- ── checkout ────────────────────────────────────────────────────────────────
drop function if exists public.checkout_items(uuid[], text);

create function public.checkout_items(p_ids uuid[], p_tokens text[])
  returns table (id uuid, slug text, name text, price_cents int, format text, weight_g int, photo_key text, offer_id uuid,
                 offer_email text)
  language plpgsql stable security definer set search_path = ''
  as $$
begin
  if coalesce(array_length(p_ids, 1), 0) = 0 then return; end if;
  return query
    with offer as (
      select distinct on (o.listing_id) o.listing_id, o.id, o.amount_cents, o.email
        from public.offers o join public.listings l on l.id = o.listing_id
       where o.listing_id = any (p_ids) and o.pay_token = any (coalesce(p_tokens, '{}'))
         and o.status = 'accepted' and o.expires_at > now()
         and l.status = 'reserved' and l.reserved_until = o.expires_at
       order by o.listing_id, o.decided_at desc),
    picked as (
      select l.id, l.slug, public.listing_name(l.id) as name,
             coalesce(f.amount_cents, l.price_cents) as price_cents, r.format, l.weight_g, l.photo_keys[1] as photo_key,
             f.id as offer_id, f.email as offer_email
        from public.listings l join public.releases r on r.id = l.release_id
        left join offer f on f.listing_id = l.id
       where l.id = any (p_ids) and l.section = 'sale'
         and (f.id is not null
              or (l.price_cents is not null and public.effective_status(l.status, l.reserved_until) = 'available')))
    select x.id, x.slug, x.name, x.price_cents, x.format, x.weight_g, x.photo_key, x.offer_id, x.offer_email
      from picked x
     where (select count(*) from picked) = (select count(distinct y) from unnest(p_ids) y)
     order by array_position(p_ids, x.id);
end
$$;

revoke execute on function public.checkout_items(uuid[], text[]) from public, anon, authenticated;
grant  execute on function public.checkout_items(uuid[], text[]) to service_role;

-- ── the Bag ─────────────────────────────────────────────────────────────────
drop function if exists public.customer_offers();

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
  return jsonb_build_object('state', v_state, 'offer_id', o.id, 'listing_id', l.id, 'slug', l.slug,
    'name', public.listing_name(l.id), 'amount_cents', o.amount_cents, 'country', o.country, 'expires_at', o.expires_at,
    'format', (select format from public.releases where id = l.release_id), 'weight_g', l.weight_g, 'photo_key', l.photo_keys[1],
    'session', o.stripe_session_id);
end
$$;

-- ── accounts (as 0022) ──────────────────────────────────────────────────────
create or replace function public.hook_before_user_created(event jsonb) returns jsonb
  language plpgsql stable security definer set search_path = ''
  as $$
begin
  if exists (select 1 from public.orders o where lower(o.email) = lower(event->'user'->>'email')) then
    return '{}'::jsonb;
  end if;
  return jsonb_build_object('error', jsonb_build_object('http_code', 403, 'message', 'No orders for this email.'));
end
$$;
