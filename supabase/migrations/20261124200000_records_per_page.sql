-- 0039 records per page (2026-11-24, Gio: "un numero di limite impostabile tramite admin, settings … iniziamo mettendo
-- un limite di prodotti visibili per pagina a 20"; decision 0179).
-- Every PLP of the shop (For sale, For trade, search, wantlist, collections) shows this many records a page; the
-- pagination under the list goes to the others (packages/pagination, packages/ui Pagination).
-- · shop_settings.records_per_page: read by the shop build (data/products.js → site.perPage) and the admin page
--   Settings (#settings). 1 … 100; a database without the column = 20 (the build's default).
-- · admin_set_records_per_page: the admin's Save; it requests a rebuild of the shop (site_build, migration 0005).

alter table public.shop_settings add column records_per_page smallint not null default 20
  check (records_per_page between 1 and 100);

create function public.admin_set_records_per_page(p_value integer) returns timestamptz
  language plpgsql security definer set search_path = ''
  as $$
declare v_at timestamptz := now();
begin
  if not coalesce(public.is_admin(), false) then raise exception 'not allowed'; end if;
  if p_value is null or p_value < 1 or p_value > 100 then raise exception 'records per page: 1 to 100'; end if;
  update public.shop_settings set records_per_page = p_value, updated_at = v_at
    where id and records_per_page is distinct from p_value;
  if found then
    update public.site_build set pending = true, requested_at = v_at where id;   -- rebuild: every PLP pages again
  end if;
  return v_at;
end
$$;
revoke execute on function public.admin_set_records_per_page(integer) from public, anon;
grant execute on function public.admin_set_records_per_page(integer) to authenticated;
