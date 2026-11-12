-- 0016 back in stock (2026-11-12): "Notify me" on a reserved copy.
-- A copy is reserved while someone is in Stripe Checkout (max 30 min) or held by hand. A visitor can leave an email
-- and gets ONE email if the copy is available again. The address is deleted once the email is sent, or as soon as the
-- copy is sold / traded / leaves the shop (cascade on delete, trigger on status).
-- · request_back_in_stock(): the only way in (anon). Accepted only while the copy is reserved; at most 100 per copy.
-- · back_in_stock: no public read, admin read only (it holds email addresses).
-- · a pg_cron job, every minute, calls the Edge Function notify-back-in-stock ONLY when some request is due
--   (its copy counts as available: released by hand, Stripe "expired", or a hold whose reserved_until has passed).
--   The function sends the emails (Resend) and deletes the rows.
-- · the function URL and its shared secret live in Supabase Vault, never in the repo. Set them once in the SQL editor:
--     select vault.create_secret('https://<project>.supabase.co/functions/v1/notify-back-in-stock', 'notify_back_in_stock_url');
--     select vault.create_secret('<random string, same as the function secret NOTIFY_SECRET>', 'notify_back_in_stock_secret');
--   No secrets = nothing is called; requests wait (nothing breaks).

create table public.back_in_stock (
  id          bigint generated always as identity primary key,
  listing_id  uuid not null references public.listings on delete cascade,
  email       text not null check (length(email) <= 254 and email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  created_at  timestamptz not null default now(),
  sent_at     timestamptz,                    -- set by the function just before it deletes the row (null = waiting)
  last_error  text
);
create unique index back_in_stock_once on public.back_in_stock (listing_id, lower(email));

alter table public.back_in_stock enable row level security;
grant select on public.back_in_stock to authenticated;
create policy back_in_stock_admin on public.back_in_stock for select to authenticated using (public.is_admin());
-- no insert/update/delete grants: rows come only from request_back_in_stock() and the function (service role)

-- ── the visitor's request ───────────────────────────────────────────────────
/* returns 'ok' (saved, or already there), 'available' (no need: add it to the bag), 'unavailable' (sold, gone, or full) */
create function public.request_back_in_stock(p_listing_id uuid, p_email text) returns text
  language plpgsql security definer set search_path = ''
  as $$
declare
  cur public.listings;
  v_email text := lower(trim(coalesce(p_email, '')));
begin
  if length(v_email) > 254 or v_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'invalid email' using errcode = '22023';
  end if;
  select * into cur from public.listings where id = p_listing_id;
  if not found or cur.status in ('draft', 'archived') then return 'unavailable'; end if;
  case public.effective_status(cur.status, cur.reserved_until)
    when 'available' then return 'available';
    when 'reserved'  then null;
    else return 'unavailable';
  end case;
  if (select count(*) from public.back_in_stock where listing_id = p_listing_id) >= 100 then return 'unavailable'; end if;
  insert into public.back_in_stock (listing_id, email) values (p_listing_id, v_email)
    on conflict (listing_id, lower(email)) do nothing;
  return 'ok';
end
$$;
revoke execute on function public.request_back_in_stock(uuid, text) from public;
grant execute on function public.request_back_in_stock(uuid, text) to anon, authenticated;

-- ── sold / traded / unpublished: nobody will be notified, the addresses go ──
create function public.drop_back_in_stock() returns trigger
  language plpgsql security definer set search_path = ''
  as $$
begin
  if new.status in ('sold', 'traded', 'draft', 'archived') then
    delete from public.back_in_stock where listing_id = new.id;
  end if;
  return null;
end
$$;
create trigger listings_back_in_stock after update of status on public.listings
  for each row execute function public.drop_back_in_stock();
revoke execute on function public.drop_back_in_stock() from public, anon, authenticated;

-- ── the cron job: call the function only when a request is due ──────────────
create function public.send_back_in_stock() returns void
  language plpgsql security definer set search_path = ''
  as $$
declare
  v_url text;
  v_secret text;
begin
  if not exists (
    select 1 from public.back_in_stock b join public.listings l on l.id = b.listing_id
     where b.sent_at is null and public.effective_status(l.status, l.reserved_until) = 'available'
  ) then return; end if;
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'notify_back_in_stock_url';
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'notify_back_in_stock_secret';
  if v_url is null or v_secret is null then return; end if;
  perform net.http_post(url := v_url, body := '{}'::jsonb,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-notify-secret', v_secret));
end
$$;
revoke execute on function public.send_back_in_stock() from public, anon, authenticated;

select cron.schedule('back-in-stock', '* * * * *', 'select public.send_back_in_stock()');

-- ── live status: tell a checkout hold from a manual one ─────────────────────
-- the shop explains them differently ("someone is checking out, back within 30 minutes" vs "on hold for someone").
-- Manual holds have reserved_until = null (0004). The time itself stays private.
create or replace view public.listing_availability with (security_invoker = true) as
  select id, slug, section, public.effective_status(status, reserved_until) as status,
         (public.effective_status(status, reserved_until) = 'reserved' and reserved_until is not null) as checkout_hold
    from public.listings;
