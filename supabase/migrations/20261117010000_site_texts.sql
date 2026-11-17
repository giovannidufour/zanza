-- 0025 Admin Content + "Show who I am" (2026-11-17, decision 0106).
-- Gio: "I want to manage the site's texts myself" and "for now launch anonymous: one tick hides everything about me".
--
-- · site_texts: the texts Gio edits in the admin (page Content, #content), one row per block (key), its fields in
--   `value` (jsonb). Read by the shop build (data/products.js) with the publishable key; written only by admins through
--   admin_set_text, which also requests a rebuild of the shop (site_build, migration 0005). A missing row = the text in
--   the repo (packages/content/content.js defaults), so the shop works before anything is saved.
-- · shop_settings.identity_enabled: on = the shop shows who Gio is (Profile), off = the Store profile and no trace of him.
--   Trade relies on his identity (Discogs card, the verification password sent to his profiles), so while identity is
--   off trade is off too. To keep every reader of `trade_enabled` right without touching them (the build, RLS, the
--   functions trade-offer and discogs-search), `trade_enabled` becomes the EFFECTIVE value, a generated column
--   (trade_wanted and identity_enabled); what Gio ticks in Settings is now `trade_wanted`. Switching identity on
--   again brings trade back as it was.

-- ── shop_settings ───────────────────────────────────────────────────────────
alter table public.shop_settings rename column trade_enabled to trade_wanted;
alter table public.shop_settings add column identity_enabled boolean not null default true;   -- on = today's shop
alter table public.shop_settings add column trade_enabled boolean generated always as (trade_wanted and identity_enabled) stored;

-- the trade checkbox in Settings: now writes trade_wanted (same name and signature: the admin already calls it)
create or replace function public.admin_set_trade_enabled(p_enabled boolean) returns timestamptz
  language plpgsql security definer set search_path = ''
  as $$
declare v_at timestamptz := now();
begin
  if not coalesce(public.is_admin(), false) then raise exception 'not allowed'; end if;
  update public.shop_settings set trade_wanted = p_enabled, updated_at = v_at
    where id and trade_wanted is distinct from p_enabled;
  if found then
    update public.site_build set pending = true, requested_at = v_at where id;   -- rebuild: pages with or without trade
  end if;
  return v_at;
end
$$;

-- the "Show who I am" checkbox in Settings
create function public.admin_set_identity_enabled(p_enabled boolean) returns timestamptz
  language plpgsql security definer set search_path = ''
  as $$
declare v_at timestamptz := now();
begin
  if not coalesce(public.is_admin(), false) then raise exception 'not allowed'; end if;
  update public.shop_settings set identity_enabled = p_enabled, updated_at = v_at
    where id and identity_enabled is distinct from p_enabled;
  if found then
    update public.site_build set pending = true, requested_at = v_at where id;   -- rebuild: Profile or Store profile
  end if;
  return v_at;
end
$$;
revoke execute on function public.admin_set_identity_enabled(boolean) from public, anon;
grant execute on function public.admin_set_identity_enabled(boolean) to authenticated;

-- ── site_texts ──────────────────────────────────────────────────────────────
create table public.site_texts (
  key         text primary key check (key ~ '^[a-z][a-z_]*(\.[a-z][a-z_]*)?$'),   -- profile, page.shipping, short.contact…
  value       jsonb not null check (jsonb_typeof(value) = 'object'),
  updated_at  timestamptz not null default now()
);
alter table public.site_texts enable row level security;
-- public: these texts are on the public site anyway; only admins write, through the function below
grant select on public.site_texts to anon, authenticated;
create policy site_texts_read on public.site_texts for select using (true);

-- the admin's Save on a Content editor: one block at a time, then a rebuild (the shop is live ~2 minutes later)
create function public.admin_set_text(p_key text, p_value jsonb) returns timestamptz
  language plpgsql security definer set search_path = ''
  as $$
declare v_at timestamptz := now();
begin
  if not coalesce(public.is_admin(), false) then raise exception 'not allowed'; end if;
  insert into public.site_texts (key, value, updated_at) values (p_key, p_value, v_at)
    on conflict (key) do update set value = excluded.value, updated_at = excluded.updated_at
    where public.site_texts.value is distinct from excluded.value;
  if found then
    update public.site_build set pending = true, requested_at = v_at where id;
  end if;
  return v_at;
end
$$;
revoke execute on function public.admin_set_text(text, jsonb) from public, anon;
grant execute on function public.admin_set_text(text, jsonb) to authenticated;
