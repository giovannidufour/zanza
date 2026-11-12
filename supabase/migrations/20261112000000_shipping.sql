-- 0015 shipping (2026-11-12, decision 0057, Figma BACKEND → Shipping): the shipping estimate in the bag and the rate
-- create-checkout will pass to Stripe. One config document, not four tables: ~4 formats, 2–3 packages, 3 zones and
-- ~10 rates, always edited and read whole (admin page Shipping, shop build, create-checkout). The rules live in ONE
-- place, packages/shipping/shipping.js (estimate + validate), used by all three.
-- Applied on store-staging 2026-11-12 (Gio: "merge e applica la migrazione").

create table public.shipping_settings (
  id          boolean primary key default true check (id),   -- one row
  config      jsonb not null,
  updated_at  timestamptz not null default now(),
  constraint shipping_config_shape check (coalesce(
    jsonb_typeof(config -> 'formats') = 'array' and jsonb_typeof(config -> 'packages') = 'array' and
    jsonb_typeof(config -> 'zones') = 'array' and jsonb_typeof(config -> 'rates') = 'array', false))
);
alter table public.shipping_settings enable row level security;
-- rates are public (the shop shows them); only admins write, through admin_save_shipping
grant select on public.shipping_settings to anon, authenticated;
create policy shipping_settings_read on public.shipping_settings for select using (true);

-- starting point (example values, Gio corrects them): format weights, two mailers with a maximum of records per format, the zones of stack.md (EU + UK/CH/US). NO rates: Gio copies the prices
-- from the carriers' lists; until then the bag keeps "Calculated at checkout" (shipping.js → not-configured).
insert into public.shipping_settings (id, config) values (true, $${
  "formats": [
    { "format": "7\"", "weight_g": 45 },
    { "format": "10\"", "weight_g": 110 },
    { "format": "12\"", "weight_g": 180 },
    { "format": "LP", "weight_g": 230 }
  ],
  "packages": [
    { "id": "small", "name": "Small mailer", "weight_g": 40, "max": { "7\"": 10 } },
    { "id": "large", "name": "Large mailer", "weight_g": 250, "max": { "7\"": 20, "10\"": 8, "12\"": 5, "LP": 5 } }
  ],
  "zones": [
    { "id": "de", "name": "Germany", "countries": ["DE"] },
    { "id": "eu", "name": "EU", "countries": ["AT","BE","BG","HR","CY","CZ","DK","EE","FI","FR","GR","HU","IE","IT","LV","LT","LU","MT","NL","PL","PT","RO","SK","SI","ES","SE"] },
    { "id": "world", "name": "World", "countries": ["CH","GB","US"] }
  ],
  "rates": []
}$$::jsonb);

-- save the whole config (admin page Shipping). The admin validates with shipping.js first; this only guards the shape.
-- The bag page carries the config, so a change rebuilds the shop (site_build, migration 0005).
create function public.admin_save_shipping(p_config jsonb) returns timestamptz
  language plpgsql security definer set search_path = ''
  as $$
declare v_at timestamptz := now();
begin
  if not coalesce(public.is_admin(), false) then raise exception 'not allowed'; end if;
  update public.shipping_settings set config = p_config, updated_at = v_at where id;
  update public.site_build set pending = true, requested_at = v_at where id;
  return v_at;
end
$$;
revoke execute on function public.admin_save_shipping(jsonb) from public, anon;
grant execute on function public.admin_save_shipping(jsonb) to authenticated;

-- a listing's own weight (heavy pressing, box set) overrides its format's: listings.weight_g (migration 0001) is already there.
comment on column public.listings.weight_g is 'shipping: grams with sleeve; null = the format weight from shipping_settings';
