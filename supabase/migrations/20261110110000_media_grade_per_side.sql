-- 0013 media graded per side (Gio, 2026-11-10): side A is required, side B is optional.
-- · listings.condition_media stays side A (existing rows keep their meaning); condition_media_b is side B, null = not graded.
-- · Shop shows "Grading: VG+ / VG", or only side A when B is null. Cover/sleeve grading is unchanged.
-- · admin_save_listing: 0011 + listing.condition_media_b ('' or missing = null). An admin without the field leaves B null.

alter table public.listings
  add column condition_media_b text references public.grades;

-- ── admin_save_listing: 0011 + condition_media_b ─────────────────────────
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
  v_tag_names text[] := '{}';
  v_subs jsonb;
  v_pos text;
  v_ord int := 0;
begin
  if not public.is_admin() then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if jsonb_array_length(v_lines) = 0 or nullif(trim(public.line_artist_text(v_lines->0)), '') is null or nullif(trim(v_lines->0->>'title'), '') is null then
    raise exception 'line 1 needs an artist and a title' using errcode = '22023';
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
    update public.releases set
      discogs_release_id = nullif(r->>'discogs_release_id', '')::int,
      label    = coalesce(nullif(trim(r->>'label_credit'), ''), nullif(trim(r->>'label'), '')),
      label_id = v_label_id,
      cat_no   = nullif(trim(r->>'cat_no'), ''),
      pre_release = coalesce((r->>'pre_release')::boolean, false),
      year     = nullif(r->>'year', '')::smallint,
      country  = nullif(r->>'country', ''),
      format   = r->>'format',
      genre    = coalesce(array(select jsonb_array_elements_text(r->'genre')), '{}'),
      style    = coalesce(array(select jsonb_array_elements_text(r->'style')), '{}')
    where id = v_release_id;
  else
    insert into public.releases (discogs_release_id, label, label_id, cat_no, pre_release, year, country, format, genre, style)
    values (nullif(r->>'discogs_release_id', '')::int, coalesce(nullif(trim(r->>'label_credit'), ''), nullif(trim(r->>'label'), '')), v_label_id, nullif(trim(r->>'cat_no'), ''), coalesce((r->>'pre_release')::boolean, false),
            nullif(r->>'year', '')::smallint, nullif(r->>'country', ''), r->>'format',
            coalesce(array(select jsonb_array_elements_text(r->'genre')), '{}'),
            coalesce(array(select jsonb_array_elements_text(r->'style')), '{}'))
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

  -- subgenres (migration 0011): the chips in order; releases.style keeps their names for the shop.
  -- An admin from before 0011 sends its chips as "tags" with no "subgenres" key: they are subgenres.
  v_subs := case when r ? 'subgenres' then r->'subgenres' when jsonb_typeof(r->'tags') = 'array' then r->'tags' end;
  if jsonb_typeof(v_subs) = 'array' then
    delete from public.release_subgenres where release_id = v_release_id;
    v_ord := 0;
    for v_tag in select * from jsonb_array_elements(v_subs) loop
      v_tag_id := public.resolve_subgenre(nullif(v_tag->>'id', '')::uuid, v_tag->>'name');
      continue when v_tag_id is null or exists (select 1 from public.release_subgenres where release_id = v_release_id and subgenre_id = v_tag_id);
      v_ord := v_ord + 1;
      insert into public.release_subgenres (release_id, subgenre_id, position) values (v_release_id, v_tag_id, v_ord);
    end loop;
    update public.releases set style = coalesce((select array_agg(g.name order by rs.position) from public.release_subgenres rs
                                                  join public.subgenres g on g.id = rs.subgenre_id where rs.release_id = v_release_id), '{}')
     where id = v_release_id;
  end if;

  -- tags (migration 0011): Gio's own labels ("Rare", "Killer version"), never from Discogs; only with the new payload
  if r ? 'subgenres' and jsonb_typeof(r->'tags') = 'array' then
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
  v_ord := 0;
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

  -- listing
  v_name := coalesce(nullif(trim(l->>'custom_title'), ''), public.release_display_name(v_lines));
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
    values (v_slug, v_release_id, l->>'section', v_status, nullif(l->>'price_cents', '')::int, l->>'condition_media',
            nullif(l->>'condition_media_b', ''), coalesce(l->>'sleeve_type', 'original'), nullif(l->>'condition_sleeve', ''),
            nullif(trim(l->>'condition_notes'), ''), nullif(trim(l->>'notes'), ''), nullif(trim(l->>'custom_title'), ''),
            coalesce(array(select jsonb_array_elements_text(l->'photo_keys')), '{}'),
            case when v_status = 'available' then now() end)
    returning id, sku into v_listing_id, v_sku;
  else
    update public.listings set
      section = l->>'section',
      status = case when status in ('reserved', 'sold', 'traded') then status else v_status end,
      price_cents = nullif(l->>'price_cents', '')::int,
      condition_media = l->>'condition_media',
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
