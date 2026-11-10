-- 0009 archive, delete and bulk actions (2026-11-10, Figma BACKEND → Listings, decision in design/decisions/0024)
-- · archived: a published copy taken off the shop for good, history and orders kept. It is read-only: the form and
--   admin_set_status cannot move it; only admin_bulk_status('restore') brings it back, to the status it had (archived_from).
-- · admin_bulk_status(ids, action): publish | unpublish | archive | restore on many copies in one transaction.
--   Each copy moves only if the transition is allowed; the others come back in "skipped" with their status.
-- · admin_delete_listings(ids): hard delete, only drafts never published and never ordered. Their files go to media_trash.
-- · media_trash: storage keys that may no longer be used (deleted copies, photos removed in the form, replaced samples).
--   The Edge Function purge-media deletes them from R2 after 7 days, and only if nothing references them any more.

-- ── archived status ─────────────────────────────────────────────────────────
alter table public.listings drop constraint listings_status_check;
alter table public.listings add constraint listings_status_check
  check (status in ('draft', 'available', 'reserved', 'sold', 'traded', 'archived'));
alter table public.listings add column archived_from text
  check (archived_from in ('draft', 'available', 'reserved', 'sold', 'traded'));
alter table public.listings add constraint archived_from_only_when_archived
  check ((status = 'archived') = (archived_from is not null));

-- the shop never sees drafts nor archived copies (listing_availability follows, it is security_invoker)
drop policy listings_read on public.listings;
create policy listings_read on public.listings for select using (status not in ('draft', 'archived') or public.is_admin());

-- 0005: a copy is public when it is neither a draft nor archived
create or replace function public.request_site_build() returns trigger
  language plpgsql security definer set search_path = ''
  as $$
declare
  was_public boolean := tg_op <> 'INSERT' and old.status not in ('draft', 'archived');
  is_public  boolean := tg_op <> 'DELETE' and new.status not in ('draft', 'archived');
begin
  if not (was_public or is_public) then return null; end if;          -- never public: the shop never saw it
  if tg_op = 'UPDATE'
     and old.status in ('available', 'reserved') and new.status in ('available', 'reserved')
     and (old.stripe_session_id is not null or new.stripe_session_id is not null)
     and (to_jsonb(old) - array['status', 'reserved_until', 'stripe_session_id'])
       = (to_jsonb(new) - array['status', 'reserved_until', 'stripe_session_id']) then
    return null;                                                       -- a checkout hold starting or ending
  end if;
  update public.site_build set pending = true, requested_at = now() where id;
  return null;
end
$$;

-- only admin_bulk_status may move a copy into or out of archived (it sets app.archive_change for its own updates)
create function public.guard_archived() returns trigger
  language plpgsql set search_path = ''
  as $$
begin
  if (old.status = 'archived') <> (new.status = 'archived')
     and coalesce(current_setting('app.archive_change', true), '') <> 'on' then
    if old.status = 'archived' then
      raise exception 'this listing is archived: restore it from the listings page first' using errcode = '55000';
    end if;
    raise exception 'archive listings from the listings page' using errcode = '55000';
  end if;
  return new;
end
$$;
create trigger listings_guard_archived before update of status on public.listings
  for each row execute function public.guard_archived();
revoke execute on function public.guard_archived() from public, anon, authenticated;

-- ── media trash ─────────────────────────────────────────────────────────────
create table public.media_trash (
  key        text primary key,                 -- photos/<uuid>.webp, samples/<uuid>.mp3 (never absolute URLs)
  trashed_at timestamptz not null default now()
);
alter table public.media_trash enable row level security;
grant select, insert, update, delete on public.media_trash to authenticated;
create policy media_trash_admin on public.media_trash for all to authenticated using (public.is_admin()) with check (public.is_admin());

create function public.trash_media(p_keys text[]) returns void
  language sql security definer set search_path = ''
  as $$
    insert into public.media_trash (key)
      select distinct k from unnest(p_keys) k where k ~ '^(photos|samples)/'
      on conflict (key) do update set trashed_at = now()
  $$;
revoke execute on function public.trash_media(text[]) from public, anon, authenticated;

-- photos removed from a copy, samples removed or replaced: candidates for the trash (purge re-checks references)
create function public.trash_removed_media() returns trigger
  language plpgsql security definer set search_path = ''
  as $$
begin
  if tg_table_name = 'listings' then
    perform public.trash_media(array(select unnest(old.photo_keys) except select unnest(new.photo_keys)));
  else
    perform public.trash_media(array[old.audio_key]);
  end if;
  return null;
end
$$;
create trigger listings_trash_photos after update of photo_keys on public.listings
  for each row execute function public.trash_removed_media();
create trigger samples_trash_audio after delete on public.samples
  for each row execute function public.trash_removed_media();
revoke execute on function public.trash_removed_media() from public, anon, authenticated;

-- ── bulk status ─────────────────────────────────────────────────────────────
/* p_action: publish (draft → available) · unpublish (available → draft) · archive (anything but a live checkout → archived)
   · restore (archived → the status it had). Returns { done: [{id, from, to}], skipped: [{id, status}] }. */
create function public.admin_bulk_status(p_ids uuid[], p_action text, p_note text default null) returns jsonb
  language plpgsql security invoker set search_path = ''
  as $$
declare
  r public.listings;
  v_from text;
  v_to text;
  v_done jsonb := '[]';
  v_skipped jsonb := '[]';
begin
  if not public.is_admin() then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if p_action is null or p_action not in ('publish', 'unpublish', 'archive', 'restore') then
    raise exception 'unknown action %', p_action using errcode = '22023';
  end if;

  for r in select * from public.listings where id = any (p_ids) order by sku for update loop
    v_from := public.effective_status(r.status, r.reserved_until);
    v_to := case p_action when 'publish' then 'available' when 'unpublish' then 'draft'
                          when 'archive' then 'archived' else r.archived_from end;
    if (p_action = 'publish'   and v_from <> 'draft')
    or (p_action = 'unpublish' and v_from <> 'available')
    or (p_action = 'archive'   and (v_from = 'archived' or (v_from = 'reserved' and r.stripe_session_id is not null)))
    or (p_action = 'restore'   and v_from <> 'archived') then
      v_skipped := v_skipped || jsonb_build_object('id', r.id, 'status', v_from);
      continue;
    end if;

    if p_action in ('publish', 'unpublish') then
      perform public.admin_set_status(r.id, v_to, p_note);
    else
      perform set_config('app.archive_change', 'on', true);
      perform set_config('app.status_note', coalesce(trim(p_note), ''), true);
      update public.listings set
        status            = v_to,
        archived_from     = case when p_action = 'archive' then v_from end,
        stripe_session_id = null,
        reserved_until    = case when p_action = 'archive' and v_from = 'reserved' then reserved_until end
      where id = r.id;
      perform set_config('app.archive_change', '', true);
      perform set_config('app.status_note', '', true);
    end if;
    v_done := v_done || jsonb_build_object('id', r.id, 'from', v_from, 'to', v_to);
  end loop;

  -- ids that do not exist (deleted meanwhile)
  v_skipped := v_skipped || coalesce((select jsonb_agg(jsonb_build_object('id', i, 'status', null))
                                        from unnest(p_ids) i where not exists (select 1 from public.listings where id = i)), '[]');
  return jsonb_build_object('done', v_done, 'skipped', v_skipped);
end
$$;

-- ── delete ──────────────────────────────────────────────────────────────────
/* only drafts never published and never ordered. The release goes too when no other copy uses it.
   Returns { deleted: [id], skipped: [{id, status, reason}] } (reason: published | ordered | not_found). */
create function public.admin_delete_listings(p_ids uuid[]) returns jsonb
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
    if r.status <> 'draft' or r.published_at is not null then
      v_skipped := v_skipped || jsonb_build_object('id', r.id, 'status', r.status, 'reason', 'published');
      continue;
    end if;
    if exists (select 1 from public.order_items where listing_id = r.id) then
      v_skipped := v_skipped || jsonb_build_object('id', r.id, 'status', r.status, 'reason', 'ordered');
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

-- ── purge support (called by the Edge Function purge-media with the admin's session) ──
/* keys trashed more than 7 days ago that nothing references; referenced keys leave the trash (they are in use again) */
create function public.admin_media_to_purge(p_limit int default 100) returns text[]
  language plpgsql security invoker set search_path = ''
  as $$
declare
  v_keys text[];
begin
  if not public.is_admin() then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  delete from public.media_trash t
   where exists (select 1 from public.listings l where t.key = any (l.photo_keys))
      or exists (select 1 from public.samples s where s.audio_key = t.key);
  select coalesce(array_agg(key), '{}') into v_keys from (
    select key from public.media_trash where trashed_at < now() - interval '7 days' order by trashed_at limit p_limit) k;
  return v_keys;
end
$$;

create function public.admin_media_purged(p_keys text[]) returns void
  language plpgsql security invoker set search_path = ''
  as $$
begin
  if not public.is_admin() then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  delete from public.media_trash where key = any (p_keys);
end
$$;

-- ── access ──────────────────────────────────────────────────────────────────
revoke execute on function public.admin_bulk_status(uuid[], text, text), public.admin_delete_listings(uuid[]),
                           public.admin_media_to_purge(int), public.admin_media_purged(text[]) from public, anon;
grant execute on function public.admin_bulk_status(uuid[], text, text), public.admin_delete_listings(uuid[]),
                          public.admin_media_to_purge(int), public.admin_media_purged(text[]) to authenticated;
