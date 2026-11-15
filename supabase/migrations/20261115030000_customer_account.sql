-- 0022 customer account (2026-11-15, Gio: "account light con codice OTP", decision 0101; _context/backend.md → Account cliente).
-- A customer signs in on the shop with email + 6-digit code (Supabase Auth email OTP) and sees the orders bought with
-- that email, guest orders included. No password, no profile, no address book: the account is the verified email.
-- · order_items.snapshot: the record as it was bought (name, label, format, grades, cover, samples), filled by a
--   BEFORE INSERT trigger, so checkout_complete (0021) stays as it is and a copy edited or put back on sale later
--   does not change a past order. Existing rows are backfilled from their listing.
-- · orders.shipped_at: set when status becomes 'shipped', cleared when it goes back to 'paid' (the admin Orders page
--   only flips status, decision 0100).
-- · customer_orders(): the signed-in customer's orders, matched by lower(email) of the CONFIRMED auth email. Never
--   returns stripe_session_id, payment_intent or attention (internal).
-- · delete_my_account(): deletes the signed-in auth user (not an admin). Orders stay (no FK to auth.users).
-- · hook_before_user_created(): Auth hook "Before User Created" (enable it in Authentication → Hooks). Only an email
--   with at least one order can get an account; everyone else is refused, so there are no empty accounts. Admins
--   already exist; a NEW admin user needs the hook switched off while it is created.

-- ── order snapshot ──────────────────────────────────────────────────────────
alter table public.order_items add column snapshot jsonb;
comment on column public.order_items.snapshot is 'the record as bought: name, slug, label, pre_release, format, country, grades, cover_key, samples (trigger order_items_snapshot)';

/* the snapshot of one listing, in the shape the shop's account page reads (scripts/account.js) */
create function public.listing_snapshot(p_listing uuid) returns jsonb
  language sql stable security definer set search_path = ''
  as $$
    select jsonb_build_object(
      'name', coalesce(nullif(trim(l.custom_title), ''),
                       (select public.release_display_name(jsonb_agg(jsonb_build_object('artist', rl.artist, 'title', rl.title) order by rl.position))
                          from public.release_lines rl where rl.release_id = l.release_id)),
      'slug', l.slug,
      'section', l.section,
      'label', r.label,
      'pre_release', r.pre_release,
      'format', r.format,
      'country', r.country,
      'condition_media', l.condition_media,
      'condition_media_b', l.condition_media_b,
      'sleeve_type', l.sleeve_type,
      'condition_sleeve', l.condition_sleeve,
      'condition_notes', l.condition_notes,
      'cover_key', l.photo_keys[1],
      'samples', coalesce((select jsonb_agg(jsonb_build_object('title', s.title, 'audio_key', s.audio_key) order by s.sort, s.track_position)
                            from public.samples s where s.release_id = l.release_id), '[]'))
    from public.listings l join public.releases r on r.id = l.release_id
    where l.id = p_listing
  $$;
revoke execute on function public.listing_snapshot(uuid) from public, anon, authenticated;

create function public.order_items_snapshot() returns trigger
  language plpgsql security definer set search_path = ''
  as $$
begin
  if new.snapshot is null then new.snapshot := public.listing_snapshot(new.listing_id); end if;
  return new;
end
$$;
revoke execute on function public.order_items_snapshot() from public, anon, authenticated;
create trigger order_items_snapshot before insert on public.order_items
  for each row execute function public.order_items_snapshot();

update public.order_items set snapshot = public.listing_snapshot(listing_id) where snapshot is null;

-- ── shipped_at ──────────────────────────────────────────────────────────────
alter table public.orders add column shipped_at timestamptz;

create function public.orders_shipped_at() returns trigger
  language plpgsql set search_path = ''
  as $$
begin
  if new.status = 'shipped' and (tg_op = 'INSERT' or old.status is distinct from 'shipped') then
    new.shipped_at := coalesce(new.shipped_at, now());
  elsif new.status <> 'shipped' and new.status <> 'refunded' then
    new.shipped_at := null;   -- back to paid (or cancelled): not shipped. A refund keeps the date if it had shipped
  end if;
  return new;
end
$$;
create trigger orders_shipped_at before insert or update of status on public.orders
  for each row execute function public.orders_shipped_at();

-- ── the customer's orders ───────────────────────────────────────────────────
/* returns { email, orders: [{ id, ref, created_at, status, shipped_at, tracking_number, currency, subtotal_cents,
   shipping_cents, total_cents, shipping_country, customer_name, shipping_address, items: [{ listing_id, price_cents,
   snapshot }] }] }, newest first. null when nobody is signed in or the email is not confirmed. */
create function public.customer_orders() returns jsonb
  language plpgsql stable security definer set search_path = ''
  as $$
declare
  v_email text;
begin
  select u.email into v_email from auth.users u where u.id = auth.uid() and u.email_confirmed_at is not null;
  if v_email is null then return null; end if;
  return jsonb_build_object('email', v_email, 'orders', coalesce((
    select jsonb_agg(jsonb_build_object(
             'id', o.id,
             'ref', upper(left(o.id::text, 8)),   -- the order reference of the emails and the admin (decision 0100)
             'created_at', o.created_at,
             'status', o.status,
             'shipped_at', o.shipped_at,
             'tracking_number', o.tracking_number,
             'currency', o.currency,
             'subtotal_cents', o.subtotal_cents,
             'shipping_cents', o.shipping_cents,
             'total_cents', o.total_cents,
             'shipping_country', o.shipping_country,
             'customer_name', o.customer_name,
             'shipping_address', o.shipping_address,
             'items', (select coalesce(jsonb_agg(jsonb_build_object('listing_id', oi.listing_id, 'price_cents', oi.price_cents,
                                                                    'snapshot', oi.snapshot) order by oi.snapshot->>'name'), '[]')
                         from public.order_items oi where oi.order_id = o.id))
           order by o.created_at desc)
      from public.orders o where lower(o.email) = lower(v_email)), '[]'));
end
$$;
revoke execute on function public.customer_orders() from public, anon;
grant execute on function public.customer_orders() to authenticated;

-- ── delete my account ───────────────────────────────────────────────────────
create function public.delete_my_account() returns void
  language plpgsql security definer set search_path = ''
  as $$
begin
  if auth.uid() is null then raise exception 'not signed in' using errcode = '42501'; end if;
  if public.is_admin() then raise exception 'an admin account is not deleted from the shop' using errcode = '42501'; end if;
  delete from auth.users where id = auth.uid();
end
$$;
revoke execute on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

-- ── Auth hook: Before User Created ──────────────────────────────────────────
create function public.hook_before_user_created(event jsonb) returns jsonb
  language plpgsql stable security definer set search_path = ''
  as $$
begin
  if exists (select 1 from public.orders o where lower(o.email) = lower(event->'user'->>'email')) then
    return '{}'::jsonb;
  end if;
  return jsonb_build_object('error', jsonb_build_object('http_code', 403, 'message', 'No orders for this email.'));
end
$$;
revoke execute on function public.hook_before_user_created(jsonb) from public, anon, authenticated;
grant execute on function public.hook_before_user_created(jsonb) to supabase_auth_admin;
