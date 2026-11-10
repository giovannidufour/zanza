-- 0010 delete any listing (Gio, 2026-11-10, decision 0025; replaces the "drafts never published only" rule of 0009)
-- A copy can be deleted whatever its status, including published, sold and archived ones. Two exceptions stay,
-- because deleting would break something that is not ours to lose:
-- · ordered: order_items point at it (orders are accounting records: keep them, archive the copy instead)
-- · checkout: a live Stripe checkout holds it (wait for it to finish or expire)
-- Files go to media_trash (purge-media, 7 days); a published copy leaves the shop on the next rebuild (0005 trigger).

create or replace function public.admin_delete_listings(p_ids uuid[]) returns jsonb
  language plpgsql security invoker set search_path = ''
  as $$
declare
  r public.listings;
  v_deleted jsonb := '[]';
  v_skipped jsonb := '[]';
begin
  if not public.is_admin() then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  for r in select * from public.listings where id = any (p_ids) order by sku for update loop
    if exists (select 1 from public.order_items where listing_id = r.id) then
      v_skipped := v_skipped || jsonb_build_object('id', r.id, 'status', r.status, 'reason', 'ordered');
      continue;
    end if;
    if public.effective_status(r.status, r.reserved_until) = 'reserved' and r.stripe_session_id is not null then
      v_skipped := v_skipped || jsonb_build_object('id', r.id, 'status', r.status, 'reason', 'checkout');
      continue;
    end if;
    insert into public.media_trash (key)
      select distinct k from unnest(r.photo_keys) k where k ~ '^(photos|samples)/'
      on conflict (key) do update set trashed_at = now();
    delete from public.listings where id = r.id;
    if not exists (select 1 from public.listings where release_id = r.release_id) then
      delete from public.releases where id = r.release_id;      -- lines, samples (→ trash), tags go with it
    end if;
    v_deleted := v_deleted || to_jsonb(r.id);
  end loop;
  v_skipped := v_skipped || coalesce((select jsonb_agg(jsonb_build_object('id', i, 'status', null, 'reason', 'not_found'))
                                        from unnest(p_ids) i where not exists (select 1 from public.listings where id = i)
                                          and not (to_jsonb(i) <@ v_deleted)), '[]');
  return jsonb_build_object('deleted', v_deleted, 'skipped', v_skipped);
end
$$;
