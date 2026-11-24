-- 0036 delete order (2026-11-24, decision 0169, Gio: "vorrei poter eliminare gli ordini dall'admin").
-- Admin → Order → "Delete order" removes an order (mostly Stripe test-mode orders). The confirm dialog asks what
-- happens to its records:
-- · p_restock = true:  every record of the order that is still 'sold' goes back to 'available' (on sale again, the
--   shop rebuilds by itself). A record that moved on since (set available by hand, archived …) is left as it is.
-- · p_restock = false: the records stay sold (e.g. a real order handled outside the shop).
-- Nothing happens on Stripe: the payment stays there (refund it in Stripe if needed). The checkout_sessions row
-- stays 'paid' (bookkeeping). order_items go with the order (on delete cascade).
-- Security definer + is_admin(): no delete grant on orders / order_items for anyone.

create function public.admin_delete_order(p_order uuid, p_restock boolean) returns jsonb
  language plpgsql security definer set search_path = ''
  as $$
declare
  v_ids uuid[];
  v_restocked int := 0;
begin
  if not public.is_admin() then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  perform 1 from public.orders where id = p_order for update;
  if not found then raise exception 'order not found' using errcode = 'P0002'; end if;

  select coalesce(array_agg(listing_id), '{}') into v_ids from public.order_items where order_id = p_order;

  if p_restock then
    perform set_config('app.status_note', 'order deleted', true);
    update public.listings set status = 'available', sold_at = null, reserved_until = null, stripe_session_id = null
     where id = any (v_ids) and status = 'sold';
    get diagnostics v_restocked = row_count;
    perform set_config('app.status_note', '', true);
  end if;

  delete from public.orders where id = p_order;

  return jsonb_build_object('order_id', p_order, 'records', coalesce(array_length(v_ids, 1), 0), 'restocked', v_restocked);
end
$$;

revoke execute on function public.admin_delete_order(uuid, boolean) from public, anon;
grant execute on function public.admin_delete_order(uuid, boolean) to authenticated;
