-- 0003 admin save (Create listing form, 2026-11-10):
-- · admin_save_listing(payload): creates or updates release + lines + listing + samples in ONE transaction,
--   so a half-saved listing can never exist. Called by the admin with the user's session (security invoker:
--   RLS still applies, and the function refuses anyone who is not in public.admins).
-- · sleeve grade: Figma "Create listing" grades generic sleeves too (Cover/sleeve = Generic, NM) →
--   a grade is allowed for original AND generic sleeves, never for "none".

alter table public.listings drop constraint sleeve_grade_only_for_original;
alter table public.listings add constraint sleeve_grade_needs_sleeve check (sleeve_type <> 'none' or condition_sleeve is null);

-- "Artist - Title 1 / Title 2" or "Artist 1 - Title 1 / Artist 2 - Title 2" (same rule as the storefront, products.js nameOf)
create function public.release_display_name(p_lines jsonb) returns text
  language sql immutable set search_path = ''
  as $$
    select case
      when bool_or(nullif(trim(l->>'artist'), '') is not null and ord > 1)
        then string_agg(coalesce(nullif(trim(l->>'artist'), ''), trim(p_lines->0->>'artist')) || ' - ' || trim(l->>'title'), ' / ' order by ord)
      else trim(p_lines->0->>'artist') || ' - ' || string_agg(trim(l->>'title'), ' / ' order by ord)
    end
    from jsonb_array_elements(p_lines) with ordinality as t(l, ord)
  $$;

create function public.slugify(p text) returns text
  language sql immutable set search_path = ''
  as $$ select trim(both '-' from regexp_replace(lower(coalesce(p, '')), '[^a-z0-9]+', '-', 'g')) $$;

/* payload:
   { "listing_id": uuid|null,                       -- null = new listing
     "release": { "discogs_release_id", "label", "cat_no", "year", "country", "format", "genre": [], "style": [] },
     "lines":   [ { "artist", "title" } ],          -- in order: line 1 = side A; artist empty = same as line 1
     "listing": { "section", "status": "draft"|"available", "price_cents", "condition_media", "sleeve_type",
                  "condition_sleeve", "condition_notes", "notes", "custom_title", "photo_keys": [] },
     "samples": [ { "line": 1|null, "audio_key", "title" } ] }   -- in player order; line null = additional
   returns { listing_id, release_id, sku, slug, status } */
create function public.admin_save_listing(payload jsonb) returns jsonb
  language plpgsql security invoker set search_path = ''
  as $$
declare
  v_listing_id uuid := nullif(payload->>'listing_id', '')::uuid;
  v_release_id uuid;
  r jsonb := payload->'release';
  l jsonb := payload->'listing';
  v_lines jsonb := coalesce(payload->'lines', '[]');
  v_status text := coalesce(l->>'status', 'draft');
  v_name text;
  v_slug text;
  v_base text;
  v_n int := 1;
  v_sku int;
  s jsonb;
  v_line_id uuid;
  v_pos text;
  v_ord int := 0;
begin
  if not public.is_admin() then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if jsonb_array_length(v_lines) = 0 or nullif(trim(v_lines->0->>'artist'), '') is null or nullif(trim(v_lines->0->>'title'), '') is null then
    raise exception 'line 1 needs an artist and a title' using errcode = '22023';
  end if;
  if v_status not in ('draft', 'available') then
    raise exception 'status must be draft or available' using errcode = '22023';
  end if;

  -- release
  if v_listing_id is not null then
    select release_id into v_release_id from public.listings where id = v_listing_id;
    if v_release_id is null then raise exception 'listing not found' using errcode = 'P0002'; end if;
    update public.releases set
      discogs_release_id = nullif(r->>'discogs_release_id', '')::int,
      label   = nullif(trim(r->>'label'), ''),
      cat_no  = nullif(trim(r->>'cat_no'), ''),
      year    = nullif(r->>'year', '')::smallint,
      country = nullif(r->>'country', ''),
      format  = r->>'format',
      genre   = coalesce(array(select jsonb_array_elements_text(r->'genre')), '{}'),
      style   = coalesce(array(select jsonb_array_elements_text(r->'style')), '{}')
    where id = v_release_id;
  else
    insert into public.releases (discogs_release_id, label, cat_no, year, country, format, genre, style)
    values (nullif(r->>'discogs_release_id', '')::int, nullif(trim(r->>'label'), ''), nullif(trim(r->>'cat_no'), ''),
            nullif(r->>'year', '')::smallint, nullif(r->>'country', ''), r->>'format',
            coalesce(array(select jsonb_array_elements_text(r->'genre')), '{}'),
            coalesce(array(select jsonb_array_elements_text(r->'style')), '{}'))
    returning id into v_release_id;
  end if;

  -- lines: upsert by position, drop the extra ones
  delete from public.release_lines where release_id = v_release_id and position > jsonb_array_length(v_lines);
  insert into public.release_lines (release_id, position, artist, title)
  select v_release_id, ord, nullif(trim(x->>'artist'), ''), trim(x->>'title')
    from jsonb_array_elements(v_lines) with ordinality as t(x, ord)
  on conflict (release_id, position) do update set artist = excluded.artist, title = excluded.title;

  -- samples: replaced as a whole (keys stay in storage), positions A, B… per line, X1, X2… for additional
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
    -- keep (release_id, track_position) unique: A, A2, A3… · X1, X2…
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
    insert into public.listings (slug, release_id, section, status, price_cents, condition_media, sleeve_type, condition_sleeve,
                                 condition_notes, notes, custom_title, photo_keys, published_at)
    values (v_slug, v_release_id, l->>'section', v_status, nullif(l->>'price_cents', '')::int, l->>'condition_media',
            coalesce(l->>'sleeve_type', 'original'), nullif(l->>'condition_sleeve', ''),
            nullif(trim(l->>'condition_notes'), ''), nullif(trim(l->>'notes'), ''), nullif(trim(l->>'custom_title'), ''),
            coalesce(array(select jsonb_array_elements_text(l->'photo_keys')), '{}'),
            case when v_status = 'available' then now() end)
    returning id, sku into v_listing_id, v_sku;
  else
    update public.listings set
      section = l->>'section',
      status = case when status in ('reserved', 'sold', 'traded') then status else v_status end,   -- never undo a sale from the form
      price_cents = nullif(l->>'price_cents', '')::int,
      condition_media = l->>'condition_media',
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

revoke execute on function public.admin_save_listing(jsonb) from public, anon;
grant execute on function public.admin_save_listing(jsonb) to authenticated;
grant execute on function public.release_display_name(jsonb), public.slugify(text) to anon, authenticated;
