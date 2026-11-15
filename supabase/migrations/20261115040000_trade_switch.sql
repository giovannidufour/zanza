-- 0023 trade switch (2026-11-15, Gio: "if I switch it off, trade no longer appears anywhere, in any form"; decision 0102).
-- One setting, the single source of truth for every place that shows or accepts trade:
-- · shop_settings.trade_enabled: one row, read by the shop build (data/products.js), the trade-offer and
--   discogs-search functions, and the admin page Settings (#settings)
-- · off = the public API stops returning trade listings (listings_read below; listing_availability follows, it is
--   security_invoker): the build gets none, a cached offer page finds no listing, the functions refuse
-- · admin_set_trade_enabled: the admin's Save; it requests a rebuild of the shop (site_build, migration 0005), so the
--   static pages with or without trade are live about 2 minutes later
-- · trade listings are NOT touched: status, notes, photos stay; switching trade on again brings them back as they were

create table public.shop_settings (
  id             boolean primary key default true check (id),   -- one row
  trade_enabled  boolean not null default true,                   -- on = today's shop, nothing changes until Gio switches it off
  updated_at     timestamptz not null default now()
);
insert into public.shop_settings (id) values (true);
alter table public.shop_settings enable row level security;
-- public: the shop build and the functions read it with the publishable key; only admins write, through the function below
grant select on public.shop_settings to anon, authenticated;
create policy shop_settings_read on public.shop_settings for select using (true);

-- for policies and functions: true while trade is on (a missing row counts as on, as before this migration)
create function public.trade_enabled() returns boolean
  language sql stable security definer set search_path = ''
  as $$ select coalesce((select trade_enabled from public.shop_settings where id), true) $$;
grant execute on function public.trade_enabled() to anon, authenticated;

-- the shop never sees drafts nor archived copies (0010), and no trade copy while trade is off. Admins see everything.
drop policy listings_read on public.listings;
create policy listings_read on public.listings for select
  using ((status not in ('draft', 'archived') and (section <> 'trade' or public.trade_enabled())) or public.is_admin());

-- the admin's Save on the page Settings
create function public.admin_set_trade_enabled(p_enabled boolean) returns timestamptz
  language plpgsql security definer set search_path = ''
  as $$
declare v_at timestamptz := now();
begin
  if not coalesce(public.is_admin(), false) then raise exception 'not allowed'; end if;
  update public.shop_settings set trade_enabled = p_enabled, updated_at = v_at
    where id and trade_enabled is distinct from p_enabled;
  if found then
    update public.site_build set pending = true, requested_at = v_at where id;   -- rebuild: pages with or without trade
  end if;
  return v_at;
end
$$;
revoke execute on function public.admin_set_trade_enabled(boolean) from public, anon;
grant execute on function public.admin_set_trade_enabled(boolean) to authenticated;
