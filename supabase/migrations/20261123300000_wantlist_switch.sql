-- 0033 wantlist switch (2026-11-23, Gio: "the feature can be switched on and off from the admin"; decision 0152).
-- "Check your wantlist": a visitor connects Discogs and sees which records of the shop are on their wantlist. The
-- wantlist is fetched and matched in the visitor's browser (function discogs-oauth only signs the requests): nothing
-- about it is stored anywhere, so this migration only adds the switch.
-- · shop_settings.wantlist_enabled: read by the shop build (data/products.js), the discogs-oauth function and the
--   admin page Settings (#settings). Off = no /wantlist/ page, no link, and the function refuses every request.
-- · admin_set_wantlist_enabled: the admin's Save; it requests a rebuild of the shop (site_build, migration 0005).

alter table public.shop_settings add column wantlist_enabled boolean not null default true;

create function public.admin_set_wantlist_enabled(p_enabled boolean) returns timestamptz
  language plpgsql security definer set search_path = ''
  as $$
declare v_at timestamptz := now();
begin
  if not coalesce(public.is_admin(), false) then raise exception 'not allowed'; end if;
  update public.shop_settings set wantlist_enabled = p_enabled, updated_at = v_at
    where id and wantlist_enabled is distinct from p_enabled;
  if found then
    update public.site_build set pending = true, requested_at = v_at where id;   -- rebuild: pages with or without /wantlist/
  end if;
  return v_at;
end
$$;
revoke execute on function public.admin_set_wantlist_enabled(boolean) from public, anon;
grant execute on function public.admin_set_wantlist_enabled(boolean) to authenticated;
