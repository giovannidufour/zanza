-- 0035 archive incomplete drafts (2026-11-23, Gio: "se faccio archive di un draft dalla lista draft non funziona").
-- An incomplete draft (bulk create, Memo, Scanner: no grading, price, format or artist yet) could not be archived:
-- archived is not 'draft', so listings_publish_check and the constraints draft_or_graded / sale_needs_price treated
-- the move like a publish and refused it. An archived draft is still a draft (archived_from = 'draft', restore brings
-- it back to Drafts), so the checks now let it through. Nothing else changes.

begin;

alter table public.listings drop constraint draft_or_graded;
alter table public.listings add constraint draft_or_graded
  check (status = 'draft' or coalesce(archived_from, '') = 'draft' or condition_media is not null);
alter table public.listings drop constraint sale_needs_price;
alter table public.listings add constraint sale_needs_price
  check (status = 'draft' or coalesce(archived_from, '') = 'draft' or section <> 'sale' or price_mode = 'offers' or price_cents is not null);

create or replace function public.listing_publish_check() returns trigger
  language plpgsql security invoker set search_path = ''
  as $$
declare
  v_missing text[] := '{}';
begin
  if new.status = 'draft' then return new; end if;
  if new.status = 'archived' and new.archived_from = 'draft' then return new; end if;   -- 0035: an archived draft
  if new.condition_media is null then v_missing := v_missing || 'grading of side A'::text; end if;
  if new.section = 'sale' and new.price_mode = 'fixed' and new.price_cents is null then v_missing := v_missing || 'price'::text; end if;
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

commit;
