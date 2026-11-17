-- 0026 Incomplete drafts for Bulk create (2026-11-17, decision 0107).
-- Gio: "drop many photos and samples, the admin groups them per record and creates the drafts"; drafts may be born
-- without grading, format, price and even without an artist (a record not found on Discogs keeps its file-name prefix
-- as custom title). Everything the shop needs is now checked when a listing leaves draft, not when it is saved.
--
-- · listings.condition_media nullable; check: only a draft may lack it. sale_needs_price: only a draft may lack it.
-- · releases.format nullable; release_lines.first_line_has_artist dropped.
-- · trigger listings_publish_check: a listing that is not a draft needs grading of side A, the price (sale),
--   the format and the artist of line 1. It covers admin_save_listing (Publish) and admin_set_status (bulk publish).
-- · admin_save_listing: the 0024 version (20261115050000) where line 1 needs only a title, empty format and grading
--   are stored as null, and a draft never published takes a new slug from its name on each save (its first name
--   is often a placeholder). create or replace keeps its grants.

alter table public.listings alter column condition_media drop not null;
alter table public.listings add constraint draft_or_graded check (status = 'draft' or condition_media is not null);
alter table public.listings drop constraint sale_needs_price;
alter table public.listings add constraint sale_needs_price check (status = 'draft' or section <> 'sale' or price_cents is not null);
alter table public.releases alter column format drop not null;
alter table public.release_lines drop constraint first_line_has_artist;

create or replace function public.listing_publish_check() returns trigger
  language plpgsql security invoker set search_path = ''
  as $$
declare
  v_missing text[] := '{}';
begin
  if new.status = 'draft' then return new; end if;
  if new.condition_media is null then v_missing := v_missing || 'grading of side A'::text; end if;
  if new.section = 'sale' and new.price_cents is null then v_missing := v_missing || 'price'::text; end if;
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
create trigger listings_publish_check before insert or update of status on public.listings
  for each row execute function public.listing_publish_check();

create or replace function public.admin_save_listing(payload jsonb) returns jsonb
  language plpgsql security invoker set search_path = ''
  as $$
declare
  v_listing_id uuid := nullif(payload->>'listing_id', '')::uuid;
  v_release_id uuid;
  r jsonb := payload->'release';
  l jsonb := payload->'listing';
  v_lines jsonb := coalesce(payload->'lines', '[]');
  v_status text := coalesce(l->>'status', 'draft');
  v_label_id uuid;
  v_name text;
  v_slug text;
  v_base text;
  v_n int := 1;
  v_sku int;
  s jsonb;
  v_line jsonb;
  v_line_id uuid;
  v_artist_id uuid;
  v_artists jsonb;
  v_a jsonb;
  v_apos int;
  v_tag jsonb;
  v_tag_id uuid;
  v_genres jsonb;
  v_pos text;
  v_ord int := 0;
  v_reused boolean := false;   -- a new copy of a release already in the database (0024)
begin
  if not public.is_admin() then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  -- 0026: a draft needs only the title of line 1; the rest is checked on publish (listings_publish_check)
  if jsonb_array_length(v_lines) = 0 or nullif(trim(v_lines->0->>'title'), '') is null then
    raise exception 'line 1 needs a title' using errcode = '22023';
  end if;
  if v_status not in ('draft', 'available') then
    raise exception 'status must be draft or available' using errcode = '22023';
  end if;

  v_label_id := public.resolve_label(nullif(r->>'label_id', '')::uuid, r->>'label', nullif(r->>'label_discogs_id', '')::int);
  perform public.learn_alias('label', v_label_id, coalesce(nullif(trim(r->>'label_credit'), ''), r->>'label'));   -- any spelling that is not the official name

  -- release
  if v_listing_id is not null then
    select release_id into v_release_id from public.listings where id = v_listing_id;
    if v_release_id is null then raise exception 'listing not found' using errcode = 'P0002'; end if;
  elsif nullif(r->>'discogs_release_id', '') is not null then
    -- 0024: a second copy of the same pressing shares its release (releases.discogs_release_id is unique)
    select id into v_release_id from public.releases where discogs_release_id = (r->>'discogs_release_id')::int;
    v_reused := v_release_id is not null;
  end if;
  if v_release_id is not null then
    update public.releases set
      discogs_release_id = nullif(r->>'discogs_release_id', '')::int,
      label    = coalesce(nullif(trim(r->>'label_credit'), ''), nullif(trim(r->>'label'), '')),
      label_id = v_label_id,
      cat_no   = nullif(trim(r->>'cat_no'), ''),
      pre_release = coalesce((r->>'pre_release')::boolean, false),
      year     = nullif(r->>'year', '')::smallint,
      year_precision = coalesce(nullif(r->>'year_precision', ''), 'year'),
      country  = nullif(r->>'country', ''),
      format   = nullif(r->>'format', ''),
      macro_genre = coalesce(array(select jsonb_array_elements_text(coalesce(r->'macro_genre', r->'genre'))), '{}')
    where id = v_release_id;
  else
    insert into public.releases (discogs_release_id, label, label_id, cat_no, pre_release, year, year_precision, country, format, macro_genre)
    values (nullif(r->>'discogs_release_id', '')::int, coalesce(nullif(trim(r->>'label_credit'), ''), nullif(trim(r->>'label'), '')), v_label_id, nullif(trim(r->>'cat_no'), ''), coalesce((r->>'pre_release')::boolean, false),
            nullif(r->>'year', '')::smallint, coalesce(nullif(r->>'year_precision', ''), 'year'), nullif(r->>'country', ''), nullif(r->>'format', ''),
            coalesce(array(select jsonb_array_elements_text(coalesce(r->'macro_genre', r->'genre'))), '{}'))
    returning id into v_release_id;
  end if;

  -- lines: upsert by position, drop the extra ones
  delete from public.release_lines where release_id = v_release_id and position > jsonb_array_length(v_lines);
  insert into public.release_lines (release_id, position, artist, title)
  select v_release_id, ord, coalesce(nullif(trim(x->>'artist_credit'), ''), nullif(trim(public.line_artist_text(x)), '')), trim(x->>'title')
    from jsonb_array_elements(v_lines) with ordinality as t(x, ord)
  on conflict (release_id, position) do update set artist = excluded.artist, title = excluded.title;

  -- line artists: the chips of each line in order, joined by "&" (empty = same as line 1, no rows).
  -- Old payloads (one "artist" per line) still work: they count as one chip.
  delete from public.release_line_artists where line_id in (select id from public.release_lines where release_id = v_release_id);
  v_ord := 0;
  for v_line in select * from jsonb_array_elements(v_lines) loop
    v_ord := v_ord + 1;
    v_artists := case when jsonb_typeof(v_line->'artists') = 'array' then v_line->'artists'
                      when nullif(trim(v_line->>'artist'), '') is not null
                        then jsonb_build_array(jsonb_build_object('id', v_line->'artist_id', 'name', v_line->'artist', 'discogs_id', v_line->'artist_discogs_id'))
                      else '[]'::jsonb end;
    v_apos := 0;
    for v_a in select * from jsonb_array_elements(v_artists) loop
      v_artist_id := public.resolve_artist(nullif(v_a->>'id', '')::uuid, v_a->>'name', nullif(v_a->>'discogs_id', '')::int);
      continue when v_artist_id is null
        or exists (select 1 from public.release_line_artists ra join public.release_lines rl on rl.id = ra.line_id
                    where rl.release_id = v_release_id and rl.position = v_ord and ra.artist_id = v_artist_id);
      v_apos := v_apos + 1;
      insert into public.release_line_artists (line_id, position, artist_id, join_text)
      select id, v_apos, v_artist_id, case when v_apos < jsonb_array_length(v_artists) then '&' end
        from public.release_lines where release_id = v_release_id and position = v_ord;
      -- a printed spelling is an alias only when the line has one artist (a credit for "A & B" names nobody)
      if jsonb_array_length(v_artists) = 1 then
        perform public.learn_alias('artist', v_artist_id, coalesce(nullif(trim(v_line->>'artist_credit'), ''), v_a->>'name'));
      end if;
    end loop;
  end loop;

  -- genres (0011, renamed in 0014): the chips in order; releases.genres keeps their names for the shop.
  -- "subgenres" is the key of an admin from before 0014 (a tab left open while the new one deploys).
  v_genres := coalesce(r->'genres', r->'subgenres');
  if jsonb_typeof(v_genres) = 'array' then
    delete from public.release_genres where release_id = v_release_id;
    v_ord := 0;
    for v_tag in select * from jsonb_array_elements(v_genres) loop
      v_tag_id := public.resolve_genre(nullif(v_tag->>'id', '')::uuid, v_tag->>'name');
      continue when v_tag_id is null or exists (select 1 from public.release_genres where release_id = v_release_id and genre_id = v_tag_id);
      v_ord := v_ord + 1;
      insert into public.release_genres (release_id, genre_id, position) values (v_release_id, v_tag_id, v_ord);
    end loop;
    perform public.sync_genres(array[v_release_id]);
  end if;

  -- tags (migration 0011): Gio's own labels ("Rare", "Killer version"), never from Discogs
  if jsonb_typeof(v_genres) = 'array' and jsonb_typeof(r->'tags') = 'array' then
    delete from public.release_tags where release_id = v_release_id;
    v_ord := 0;
    for v_tag in select * from jsonb_array_elements(r->'tags') loop
      v_tag_id := public.resolve_tag(nullif(v_tag->>'id', '')::uuid, v_tag->>'name');
      continue when v_tag_id is null or exists (select 1 from public.release_tags where release_id = v_release_id and tag_id = v_tag_id);
      v_ord := v_ord + 1;
      insert into public.release_tags (release_id, tag_id, position) values (v_release_id, v_tag_id, v_ord);
    end loop;
  end if;

  -- samples: replaced as a whole (keys stay in storage), positions A, B… per line, X1, X2… for additional
  -- 0024: a new copy of a release already in the database without samples of its own keeps the release's samples
  v_ord := 0;
  if not (v_reused and jsonb_array_length(coalesce(payload->'samples', '[]')) = 0) then
  delete from public.samples where release_id = v_release_id;
  for s in select * from jsonb_array_elements(coalesce(payload->'samples', '[]')) loop
    v_ord := v_ord + 1;
    if nullif(s->>'line', '') is not null then
      select id into v_line_id from public.release_lines where release_id = v_release_id and position = (s->>'line')::int;
      v_pos := chr(64 + (s->>'line')::int);
    else
      v_line_id := null;
      v_pos := 'X';
    end if;
    select count(*) into v_n from public.samples
     where release_id = v_release_id and (track_position = v_pos or track_position ~ ('^' || v_pos || '[0-9]+$'));
    if v_pos = 'X' or v_n > 0 then
      v_pos := v_pos || (v_n + 1)::text;
    end if;
    insert into public.samples (release_id, line_id, track_position, title, audio_key, sort)
    values (v_release_id, v_line_id, v_pos, nullif(trim(s->>'title'), ''), s->>'audio_key', v_ord);
  end loop;
  end if;

  -- listing
  v_name := coalesce(nullif(trim(l->>'custom_title'), ''), public.release_display_name(v_lines), trim(v_lines->0->>'title'));   -- 0026: no artist yet
  if v_listing_id is null then
    v_base := nullif(public.slugify(v_name), '');
    v_base := coalesce(v_base, 'record');
    v_slug := v_base;
    v_n := 1;
    while exists (select 1 from public.listings where slug = v_slug) loop
      v_n := v_n + 1;
      v_slug := v_base || '-' || v_n;
    end loop;
    insert into public.listings (slug, release_id, section, status, price_cents, condition_media, condition_media_b, sleeve_type,
                                 condition_sleeve, condition_notes, notes, custom_title, photo_keys, published_at)
    values (v_slug, v_release_id, l->>'section', v_status, nullif(l->>'price_cents', '')::int, nullif(l->>'condition_media', ''),
            nullif(l->>'condition_media_b', ''), coalesce(l->>'sleeve_type', 'original'), nullif(l->>'condition_sleeve', ''),
            nullif(trim(l->>'condition_notes'), ''), nullif(trim(l->>'notes'), ''), nullif(trim(l->>'custom_title'), ''),
            coalesce(array(select jsonb_array_elements_text(l->'photo_keys')), '{}'),
            case when v_status = 'available' then now() end)
    returning id, sku into v_listing_id, v_sku;
  else
    -- 0026: a draft never published has no public URL yet: its slug follows the name (a bulk draft is born as "record")
    if exists (select 1 from public.listings where id = v_listing_id and status = 'draft' and published_at is null) then
      v_base := coalesce(nullif(public.slugify(v_name), ''), 'record');
      v_slug := v_base;
      v_n := 1;
      while exists (select 1 from public.listings where slug = v_slug and id <> v_listing_id) loop
        v_n := v_n + 1;
        v_slug := v_base || '-' || v_n;
      end loop;
      update public.listings set slug = v_slug where id = v_listing_id;
    end if;
    update public.listings set
      section = l->>'section',
      status = case when status in ('reserved', 'sold', 'traded') then status else v_status end,
      price_cents = nullif(l->>'price_cents', '')::int,
      condition_media = nullif(l->>'condition_media', ''),
      condition_media_b = nullif(l->>'condition_media_b', ''),
      sleeve_type = coalesce(l->>'sleeve_type', 'original'),
      condition_sleeve = nullif(l->>'condition_sleeve', ''),
      condition_notes = nullif(trim(l->>'condition_notes'), ''),
      notes = nullif(trim(l->>'notes'), ''),
      custom_title = nullif(trim(l->>'custom_title'), ''),
      photo_keys = coalesce(array(select jsonb_array_elements_text(l->'photo_keys')), '{}'),
      published_at = case when v_status = 'available' then coalesce(published_at, now()) else published_at end
    where id = v_listing_id
    returning sku, slug into v_sku, v_slug;
  end if;

  select slug, status into v_slug, v_status from public.listings where id = v_listing_id;
  return jsonb_build_object('listing_id', v_listing_id, 'release_id', v_release_id, 'sku', v_sku, 'slug', v_slug, 'status', v_status);
end
$$;

notify pgrst, 'reload schema';
