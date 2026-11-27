-- 0045 listing original_keys (Gio, 2026-11-27): the "Full" record photos of a copy (admin → Take photo; later the
-- Scanner's originals too) are kept online with the SKU but not shown in the shop. They can feed the record videos.
-- Keys live in R2 under originals/<uuid>.<ext>. The shop build never reads this column.
-- Removed or deleted originals go to media_trash like photos (purge-media, 7 days, only if nothing references them).

alter table public.listings add column original_keys text[] not null default '{}';

-- trash: originals/ keys are allowed too
create or replace function public.trash_media(p_keys text[]) returns void
  language sql security definer set search_path = ''
  as $$
    insert into public.media_trash (key)
      select distinct k from unnest(p_keys) k where k ~ '^(photos|samples|originals)/'
      on conflict (key) do update set trashed_at = now()
  $$;
revoke execute on function public.trash_media(text[]) from public, anon, authenticated;

-- originals removed from a copy, or the copy deleted: candidates for the trash
create function public.trash_removed_originals() returns trigger
  language plpgsql security definer set search_path = ''
  as $$
begin
  if tg_op = 'DELETE' then
    perform public.trash_media(old.original_keys);
  else
    perform public.trash_media(array(select unnest(old.original_keys) except select unnest(new.original_keys)));
  end if;
  return null;
end
$$;
create trigger listings_trash_originals after update of original_keys or delete on public.listings
  for each row execute function public.trash_removed_originals();
revoke execute on function public.trash_removed_originals() from public, anon, authenticated;

-- purge: a key still referenced as an original stays
create or replace function public.admin_media_to_purge(p_limit int default 100) returns text[]
  language plpgsql security invoker set search_path = ''
  as $$
declare
  v_keys text[];
begin
  if not public.is_admin() then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  delete from public.media_trash t
   where exists (select 1 from public.listings l where t.key = any (l.photo_keys) or t.key = any (l.original_keys))
      or exists (select 1 from public.samples s where s.audio_key = t.key);
  select coalesce(array_agg(key), '{}') into v_keys from (
    select key from public.media_trash where trashed_at < now() - interval '7 days' order by trashed_at limit p_limit) k;
  return v_keys;
end
$$;
