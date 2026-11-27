-- 0049 unset grading (Gio, 2026-11-27, decision 0207): side A grading "Unset" in admin Create / Edit listing, so a
-- copy can go live (e.g. on staging) before Gio has graded and priced it, and he can find those copies later.
-- "Unset" is not a grade: it is stored as condition_media = null on a published copy (the admin asks for an explicit
-- choice; a draft with an empty grading stays incomplete there, so bulk Publish still skips it).
-- · draft_or_graded: dropped. A live copy may have no grading.
-- · sale_needs_price: a sale copy at a fixed price may also have no price while its grading is unset. The shop shows
--   no price and no Add to bag; checkout_items already ignores copies without a price.
-- · listing_publish_check: no longer asks for the grading; asks for the price only when the copy is graded.
--   The trigger now also fires on condition_media and price_cents, so grading a live unpriced copy without
--   entering a price is refused with the same readable message.

begin;

alter table public.listings drop constraint draft_or_graded;
alter table public.listings drop constraint sale_needs_price;
alter table public.listings add constraint sale_needs_price
  check (status = 'draft' or coalesce(archived_from, '') = 'draft' or section <> 'sale' or price_mode = 'offers'
         or price_cents is not null or condition_media is null);

create or replace function public.listing_publish_check() returns trigger
  language plpgsql security invoker set search_path = ''
  as $$
declare
  v_missing text[] := '{}';
begin
  if new.status = 'draft' then return new; end if;
  if new.status = 'archived' and new.archived_from = 'draft' then return new; end if;   -- 0035: an archived draft
  -- 0049: no grading = "Unset" (decision 0207); an unset copy may also have no price
  if new.section = 'sale' and new.price_mode = 'fixed' and new.price_cents is null and new.condition_media is not null then
    v_missing := v_missing || 'price'::text;
  end if;
  if not exists (select 1 from public.releases where id = new.release_id and nullif(format, '') is not null) then
    v_missing := v_missing || 'format'::text;
  end if;
  if not exists (select 1 from public.release_lines where release_id = new.release_id and position = 1 and nullif(trim(artist), '') is not null) then
    v_missing := v_missing || 'artist'::text;
  end if;
  if cardinality(v_missing) > 0 then
    raise exception 'incomplete draft: add the % before publishing', array_to_string(v_missing, ', ') using errcode = '23514';
  end if;
  return new;
end
$$;

drop trigger listings_publish_check on public.listings;
create trigger listings_publish_check before insert or update of status, price_mode, condition_media, price_cents on public.listings
  for each row execute function public.listing_publish_check();

commit;
