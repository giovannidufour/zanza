-- 0005 site rebuild (2026-11-10): the static shop on Cloudflare Pages rebuilds itself when the catalogue changes.
-- · a trigger on listings marks "the shop is out of date" when a public copy changes (or a copy becomes / stops being public)
-- · a pg_cron job, every minute, calls the Pages deploy hook ONCE for all the changes of that minute (debounce:
--   saving 5 listings in a row = 1 build, not 5; free plan = 1 build at a time, 500 per month)
-- · checkout holds (available ⇄ reserved by Stripe) do NOT rebuild: the live status on the page handles them
-- · the hook URL is a secret: it lives in Supabase Vault (name 'pages_deploy_hook'), never in the repo.
--   Set it once in the SQL editor:  select vault.create_secret('<deploy hook URL>', 'pages_deploy_hook');
--   No secret = nothing is called (the request stays pending, nothing breaks).

create extension if not exists pg_net;
create extension if not exists pg_cron;

-- one row: when a build was requested, when the hook was last called and what it answered
create table public.site_build (
  id            boolean primary key default true check (id),
  pending       boolean not null default false,          -- a change the shop has not been rebuilt for
  requested_at  timestamptz,
  sent_at       timestamptz,
  last_request  bigint,                                  -- net.http_post request id (see net._http_response)
  last_error    text
);
insert into public.site_build (id) values (true);
alter table public.site_build enable row level security;
grant select on public.site_build to authenticated;
create policy site_build_admin on public.site_build for select to authenticated using (public.is_admin());

-- ── what counts as a change for the shop ────────────────────────────────────
create function public.request_site_build() returns trigger
  language plpgsql security definer set search_path = ''
  as $$
declare
  was_public boolean := tg_op <> 'INSERT' and old.status <> 'draft';
  is_public  boolean := tg_op <> 'DELETE' and new.status <> 'draft';
begin
  if not (was_public or is_public) then return null; end if;          -- drafts only: the shop never saw them
  if tg_op = 'UPDATE'
     and old.status in ('available', 'reserved') and new.status in ('available', 'reserved')
     and (old.stripe_session_id is not null or new.stripe_session_id is not null)
     and (to_jsonb(old) - array['status', 'reserved_until', 'stripe_session_id'])
       = (to_jsonb(new) - array['status', 'reserved_until', 'stripe_session_id']) then
    return null;                                                       -- a checkout hold starting or ending
  end if;
  update public.site_build set pending = true, requested_at = now() where id;
  return null;
end
$$;
create trigger listings_site_build after insert or update or delete on public.listings
  for each row execute function public.request_site_build();
revoke execute on function public.request_site_build() from public, anon, authenticated;

-- ── the cron job: call the deploy hook if something changed since the last call ──
create function public.send_site_build() returns void
  language plpgsql security definer set search_path = ''
  as $$
declare
  b public.site_build;
  v_url text;
  v_id bigint;
begin
  select * into b from public.site_build where id for update;
  if not b.pending then return; end if;
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'pages_deploy_hook';
  if v_url is null then
    update public.site_build set last_error = 'no pages_deploy_hook secret in Vault' where id;
    return;
  end if;
  select net.http_post(url := v_url, body := '{}'::jsonb) into v_id;
  update public.site_build set pending = false, sent_at = now(), last_request = v_id, last_error = null where id;
end
$$;
revoke execute on function public.send_site_build() from public, anon, authenticated;

select cron.schedule('site-build', '* * * * *', 'select public.send_site_build()');
