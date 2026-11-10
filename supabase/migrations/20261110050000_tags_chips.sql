-- 0007 tags as entities, several artists per line (Gio, 2026-11-10). The admin's Artist, Label and Tags fields
-- are chip fields (Figma: `input` with chips on, decision 0020): each chip is an entity, clickable later
-- (tags open PLP filters).
-- · tags: id, name, slug (future filter URL). release_tags: the tags of a release, in order.
--   releases.style stays and is kept equal to the tag names, so the shop is unchanged.
-- · admin_save_listing: lines[].artists = [{ id, name, discogs_id }] (several chips, joined "&");
--   release.tags = [{ id, name }]. The 0006 payload (one "artist" per line, release.style) still works.

create table public.tags (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (trim(name) <> ''),
  slug       text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  created_at timestamptz not null default now()
);
create unique index tags_name on public.tags (lower(name));

create table public.release_tags (
  release_id uuid not null references public.releases on delete cascade,
  tag_id     uuid not null references public.tags,
  position   smallint not null check (position >= 1),
  primary key (release_id, tag_id)
);
create index release_tags_tag on public.release_tags (tag_id);

-- existing data: one tag per distinct style, bound in the stored order
do $$
declare x record;
begin
  for x in select min(trim(s)) as name from public.releases, unnest(style) as s where nullif(trim(s), '') is not null
           group by lower(trim(s)) order by 1 loop
    insert into public.tags (name, slug) values (x.name, public.free_slug('tags', x.name));
  end loop;
end
$$;
insert into public.release_tags (release_id, tag_id, position)
  select r.id, t.id, min(u.ord) from public.releases r, unnest(r.style) with ordinality as u(s, ord)
    join public.tags t on lower(t.name) = lower(trim(u.s))
   group by r.id, t.id;

create function public.resolve_tag(p_id uuid, p_name text) returns uuid
  language plpgsql set search_path = ''
  as $$
declare
  v_id uuid;
  v_name text := nullif(trim(p_name), '');
begin
  if p_id is not null then
    select id into v_id from public.tags where id = p_id;
    if v_id is not null then return v_id; end if;
  end if;
  if v_name is null then return null; end if;
  select id into v_id from public.tags where lower(name) = lower(v_name);
  if v_id is not null then return v_id; end if;
  insert into public.tags (name, slug) values (v_name, public.free_slug('tags', v_name)) returning id into v_id;
  return v_id;
end
$$;

-- the artist text of a payload line: its chips joined "&", or the old single "artist"
create function public.line_artist_text(p_line jsonb) returns text
  language sql immutable set search_path = ''
  as $$
  select case when jsonb_typeof(p_line->'artists') = 'array'
              then (select string_agg(trim(a->>'name'), ' & ' order by o) from jsonb_array_elements(p_line->'artists') with ordinality as t(a, o)
                     where nullif(trim(a->>'name'), '') is not null)
              else p_line->>'artist' end
$$;

-- ── admin_save_listing: 0006 + chips (several artists per line, tags) ──────
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
      year     = nullif(r->>'year', '')::smallint,
      country  = nullif(r->>'country', ''),
      format   = r->>'format',
      genre    = coalesce(array(select jsonb_array_elements_text(r->'genre')), '{}'),
      style    = coalesce(array(select jsonb_array_elements_text(r->'style')), '{}')
    where id = v_release_id;
  else
    insert into public.releases (discogs_release_id, label, label_id, cat_no, year, country, format, genre, style)
    values (nullif(r->>'discogs_release_id', '')::int, coalesce(nullif(trim(r->>'label_credit'), ''), nullif(trim(r->>'label'), '')), v_label_id, nullif(trim(r->>'cat_no'), ''),
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

  -- tags: the chips in order (migration 0007); releases.style keeps their names for the shop
  if jsonb_typeof(r->'tags') = 'array' then
    delete from public.release_tags where release_id = v_release_id;
    v_ord := 0;
    for v_tag in select * from jsonb_array_elements(r->'tags') loop
      v_tag_id := public.resolve_tag(nullif(v_tag->>'id', '')::uuid, v_tag->>'name');
      continue when v_tag_id is null or exists (select 1 from public.release_tags where release_id = v_release_id and tag_id = v_tag_id);
      v_ord := v_ord + 1;
      insert into public.release_tags (release_id, tag_id, position) values (v_release_id, v_tag_id, v_ord);
    end loop;
    update public.releases set style = coalesce((select array_agg(t.name order by rt.position) from public.release_tags rt
                                                  join public.tags t on t.id = rt.tag_id where rt.release_id = v_release_id), '{}')
     where id = v_release_id;
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
      status = case when status in ('reserved', 'sold', 'traded') then status else v_status end,
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


-- ── access: public read (future tag filters), admin write ─────────────────
alter table public.tags enable row level security;
alter table public.release_tags enable row level security;
grant select on public.tags, public.release_tags to anon, authenticated;
grant insert, update, delete on public.tags, public.release_tags to authenticated;
create policy tags_read          on public.tags for select using (true);
create policy tags_admin         on public.tags for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy release_tags_read  on public.release_tags for select using (true);
create policy release_tags_admin on public.release_tags for all to authenticated using (public.is_admin()) with check (public.is_admin());
revoke execute on function public.resolve_tag(uuid, text) from public, anon;
grant execute on function public.resolve_tag(uuid, text) to authenticated;
