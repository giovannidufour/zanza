-- 0017 Notify me: let the Edge Function notify-back-in-stock (service role) read and clear the queue.
-- This project does not grant table privileges to service_role by default, so the function got
-- "permission denied for table back_in_stock" (first live run, 2026-11-12). Grants only, no schema change.
grant select, update, delete on public.back_in_stock to service_role;
grant select on public.listings, public.releases, public.release_lines to service_role;
