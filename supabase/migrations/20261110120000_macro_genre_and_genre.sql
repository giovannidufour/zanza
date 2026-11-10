-- 0014 genre → macro genre, subgenre → genre (Gio, 2026-11-10). Decision 0046.
-- The Discogs genre (almost always Reggae, never shown) becomes the "macro genre"; the Discogs style (Roots,
-- Dancehall…), until now "subgenre", becomes the shop's "genre". Only names change: same rows, ids, slugs,
-- positions, grants and policies.
-- Order matters (name collision): releases.genre → macro_genre first, then releases.style → genres and
-- subgenres → genres. Run it as one transaction (begin/commit in the SQL editor).
-- · releases.genre (text[]) → releases.macro_genre   (the admin keeps one value, picked from the Discogs genres)
-- · releases.style (text[]) → releases.genres        (mirror of the genre names in order, read by the shop)
-- · subgenres → genres · release_subgenres(subgenre_id) → release_genres(genre_id) · resolve_subgenre → resolve_genre
-- · sync_style → sync_genres · attributes kind 'subgenre' → 'genre', list key "genres"
-- · admin_save_listing: release.macro_genre: [] and release.genres: [{ id, name }]; release.style is no longer read
--   (releases.genres is always rebuilt from the chips). An admin from before 0014 still saves: its "genre" and
--   "subgenres" keys are read when the new ones are missing.

-- ── 1. macro genre (frees the name "genre") ────────────────────────────────
alter table public.releases rename column genre to macro_genre;

-- ── 2. genre = the old subgenre ────────────────────────────────────────────
alter table public.releases rename column style to genres;
alter table public.subgenres rename to genres;
alter index public.subgenres_name rename to genres_name;
alter index public.subgenres_pkey rename to genres_pkey;
alter index public.subgenres_slug_key rename to genres_slug_key;
alter table public.genres rename constraint subgenres_name_check to genres_name_check;
alter table public.genres rename constraint subgenres_slug_check to genres_slug_check;
alter table public.release_subgenres rename to release_genres;
alter table public.release_genres rename column subgenre_id to genre_id;
alter index public.release_subgenres_pkey rename to release_genres_pkey;
alter index public.release_subgenres_subgenre rename to release_genres_genre;
alter table public.release_genres rename constraint release_subgenres_release_id_fkey to release_genres_release_id_fkey;
alter table public.release_genres rename constraint release_subgenres_subgenre_id_fkey to release_genres_genre_id_fkey;
alter table public.release_genres rename constraint release_subgenres_position_check to release_genres_position_check;
alter policy subgenres_read          on public.genres rename to genres_read;
alter policy subgenres_admin         on public.genres rename to genres_admin;
alter policy release_subgenres_read  on public.release_genres rename to release_genres_read;
alter policy release_subgenres_admin on public.release_genres rename to release_genres_admin;

-- ── 3. functions that named the old tables, column or kind ─────────────────
drop function public.resolve_subgenre(uuid, text);
create function public.resolve_genre(p_id uuid, p_name text) returns uuid
  language plpgsql set search_path = ''
  as $$
declare
  v_id uuid;
  v_name text := nullif(trim(p_name), '');
begin
  if p_id is not null then
    select id into v_id from public.genres where id = p_id;
    if v_id is not null then return v_id; end if;
  end if;
  if v_name is null then return null; end if;
  select id into v_id from public.genres where lower(name) = lower(v_name);
  if v_id is not null then return v_id; end if;
  insert into public.genres (name, slug) values (v_name, public.free_slug('genres', v_name)) returning id into v_id;
  return v_id;
end
$$;

-- releases.genres mirrors the genre names in order (0011)
drop function public.sync_style(uuid[]);
create function public.sync_genres(p_release_ids uuid[]) returns void
  language sql set search_path = ''
  as $$
    update public.releases r set genres = coalesce((select array_agg(g.name order by rg.position) from public.release_genres rg
                                                    join public.genres g on g.id = rg.genre_id where rg.release_id = r.id), '{}')
     where r.id = any(p_release_ids)
  $$;

-- attributes (0012): kind 'genre', list key "genres"
create or replace function public.entity_links() returns table (kind text, entity_id uuid, release_id uuid)
  language sql stable set search_path = ''
  as $$
    select 'artist', ra.artist_id, rl.release_id from public.release_line_artists ra join public.release_lines rl on rl.id = ra.line_id
    union all select 'label', r.label_id, r.id from public.releases r where r.label_id is not null
    union all select 'genre', rs.genre_id, rs.release_id from public.release_genres rs
    union all select 'tag', rt.tag_id, rt.release_id from public.release_tags rt
  $$;

create or replace function public.check_kind(p_kind text) returns void
  language plpgsql immutable set search_path = ''
  as $$
begin
  if p_kind is null or p_kind not in ('artist', 'label', 'genre', 'tag') then
    raise exception 'unknown kind %', p_kind using errcode = '22023';
  end if;
end
$$;

create or replace function public.admin_attributes() returns jsonb
  language plpgsql stable security invoker set search_path = ''
  as $$
declare v jsonb;
begin
  if not public.is_admin() then raise exception 'not allowed' using errcode = '42501'; end if;
  with recs as (
    select e.kind, e.entity_id, count(distinct l.id) as n
      from public.entity_links() e join public.listings l on l.release_id = e.release_id
     group by e.kind, e.entity_id
  )
  select jsonb_build_object(
    'artists', coalesce((select jsonb_agg(jsonb_build_object('id', a.id, 'name', a.name, 'slug', a.slug, 'discogs_id', a.discogs_artist_id,
                 'aliases', coalesce((select jsonb_agg(x.name order by lower(x.name)) from public.artist_aliases x where x.artist_id = a.id), '[]'),
                 'records', coalesce((select n from recs where kind = 'artist' and entity_id = a.id), 0)) order by lower(a.name), a.name)
               from public.artists a), '[]'),
    'labels', coalesce((select jsonb_agg(jsonb_build_object('id', b.id, 'name', b.name, 'slug', b.slug, 'discogs_id', b.discogs_label_id,
                 'aliases', coalesce((select jsonb_agg(x.name order by lower(x.name)) from public.label_aliases x where x.label_id = b.id), '[]'),
                 'records', coalesce((select n from recs where kind = 'label' and entity_id = b.id), 0)) order by lower(b.name), b.name)
               from public.labels b), '[]'),
    'genres', coalesce((select jsonb_agg(jsonb_build_object('id', g.id, 'name', g.name, 'slug', g.slug,
                 'records', coalesce((select n from recs where kind = 'genre' and entity_id = g.id), 0)) order by lower(g.name), g.name)
               from public.genres g), '[]'),
    'tags', coalesce((select jsonb_agg(jsonb_build_object('id', t.id, 'name', t.name, 'slug', t.slug,
                 'records', coalesce((select n from recs where kind = 'tag' and entity_id = t.id), 0)) order by lower(t.name), t.name)
               from public.tags t), '[]'))
  into v;
  return v;
end
$$;

create or replace function public.admin_entity(p_kind text, p_id uuid) returns jsonb
  language plpgsql stable security invoker set search_path = ''
  as $$
declare v jsonb;
begin
  if not public.is_admin() then raise exception 'not allowed' using errcode = '42501'; end if;
  perform public.check_kind(p_kind);
  if p_kind = 'artist' then
    select jsonb_build_object('id', id, 'name', name, 'slug', slug, 'discogs_id', discogs_artist_id,
           'aliases', coalesce((select jsonb_agg(x.name order by lower(x.name)) from public.artist_aliases x where x.artist_id = a.id), '[]'))
      into v from public.artists a where id = p_id;
  elsif p_kind = 'label' then
    select jsonb_build_object('id', id, 'name', name, 'slug', slug, 'discogs_id', discogs_label_id,
           'aliases', coalesce((select jsonb_agg(x.name order by lower(x.name)) from public.label_aliases x where x.label_id = b.id), '[]'))
      into v from public.labels b where id = p_id;
  elsif p_kind = 'genre' then
    select jsonb_build_object('id', id, 'name', name, 'slug', slug) into v from public.genres where id = p_id;
  else
    select jsonb_build_object('id', id, 'name', name, 'slug', slug) into v from public.tags where id = p_id;
  end if;
  if v is null then raise exception 'not found' using errcode = 'P0002'; end if;
  return v || jsonb_build_object('listing_ids', coalesce((
    select jsonb_agg(l.id order by l.sku desc) from public.listings l
     where l.release_id in (select e.release_id from public.entity_links() e where e.kind = p_kind and e.entity_id = p_id)), '[]'));
end
$$;

create or replace function public.admin_save_entity(p_kind text, p_id uuid, p jsonb) returns uuid
  language plpgsql security invoker set search_path = ''
  as $$
declare
  v_table text := case p_kind when 'artist' then 'artists' when 'label' then 'labels' when 'genre' then 'genres' when 'tag' then 'tags' end;
  v_name text := nullif(trim(p->>'name'), '');
  v_slug text := nullif(public.slugify(p->>'slug'), '');
  v_discogs int := nullif(trim(p->>'discogs_id'), '')::int;
  v_id uuid := p_id;
  v_taken boolean;
  v_alias text;
begin
  if not public.is_admin() then raise exception 'not allowed' using errcode = '42501'; end if;
  perform public.check_kind(p_kind);
  if v_name is null then raise exception 'name: enter a name' using errcode = '22023'; end if;
  -- genres and tags: one per name (case-insensitive); artists and labels may share a name (two different people)
  if p_kind in ('genre', 'tag') then
    execute format('select exists (select 1 from public.%I where lower(name) = lower($1) and id is distinct from $2)', v_table)
      into v_taken using v_name, v_id;
    if v_taken then raise exception 'name: another % already has this name', p_kind using errcode = '23505'; end if;
  end if;
  if v_slug is not null then
    execute format('select exists (select 1 from public.%I where slug = $1 and id is distinct from $2)', v_table) into v_taken using v_slug, v_id;
    if v_taken then raise exception 'slug: another % already has this slug', p_kind using errcode = '23505'; end if;
  end if;
  if v_discogs is not null then
    if p_kind = 'artist' then select exists (select 1 from public.artists where discogs_artist_id = v_discogs and id is distinct from v_id) into v_taken;
    elsif p_kind = 'label' then select exists (select 1 from public.labels where discogs_label_id = v_discogs and id is distinct from v_id) into v_taken;
    end if;
    if v_taken then raise exception 'discogs_id: another % already has this Discogs ID', p_kind using errcode = '23505'; end if;
  end if;

  if v_id is null then
    v_slug := coalesce(v_slug, public.free_slug(v_table, v_name));
    execute format('insert into public.%I (name, slug) values ($1, $2) returning id', v_table) into v_id using v_name, v_slug;
  else
    if v_slug is null then
      execute format('select slug from public.%I where id = $1', v_table) into v_slug using v_id;
    end if;
    execute format('update public.%I set name = $1, slug = $2 where id = $3', v_table) using v_name, v_slug, v_id;
    if not found then raise exception 'not found' using errcode = 'P0002'; end if;
  end if;

  if p_kind = 'artist' then
    update public.artists set discogs_artist_id = v_discogs where id = v_id;
    delete from public.artist_aliases where artist_id = v_id;
    for v_alias in select distinct on (lower(trim(x))) trim(x) from jsonb_array_elements_text(coalesce(p->'aliases', '[]')) x
                    where nullif(trim(x), '') is not null and lower(trim(x)) <> lower(v_name) loop
      insert into public.artist_aliases (artist_id, name) values (v_id, v_alias);
    end loop;
  elsif p_kind = 'label' then
    update public.labels set discogs_label_id = v_discogs where id = v_id;
    delete from public.label_aliases where label_id = v_id;
    for v_alias in select distinct on (lower(trim(x))) trim(x) from jsonb_array_elements_text(coalesce(p->'aliases', '[]')) x
                    where nullif(trim(x), '') is not null and lower(trim(x)) <> lower(v_name) loop
      insert into public.label_aliases (label_id, name) values (v_id, v_alias);
    end loop;
  elsif p_kind = 'genre' then
    perform public.sync_genres(array(select release_id from public.release_genres where genre_id = v_id));
    perform public.mark_site_build();
  else
    perform public.mark_site_build();
  end if;
  return v_id;
end
$$;

create or replace function public.admin_replace_entity(p_kind text, p_id uuid, p_targets uuid[]) returns jsonb
  language plpgsql security invoker set search_path = ''
  as $$
declare
  v_targets uuid[];
  v_n int;
  v_records int;
  v_line record;
  v_rel record;
  v_ids uuid[];
  v_joins text[];
  v_new_ids uuid[];
  v_new_joins text[];
  v_i int;
  v_j int;
  v_name text;
  v_discogs int;
  v_releases uuid[];
begin
  if not public.is_admin() then raise exception 'not allowed' using errcode = '42501'; end if;
  perform public.check_kind(p_kind);
  select array_agg(t order by o) into v_targets
    from (select distinct on (t) t, o from unnest(p_targets) with ordinality as x(t, o) where t is not null order by t, o) d;
  v_n := coalesce(array_length(v_targets, 1), 0);
  if v_n = 0 then raise exception 'pick at least one %', p_kind using errcode = '22023'; end if;
  if p_id = any(v_targets) then raise exception 'a % cannot replace itself', p_kind using errcode = '22023'; end if;
  if p_kind = 'label' and v_n > 1 then raise exception 'a release has one label: pick one' using errcode = '22023'; end if;

  select count(distinct l.id) into v_records from public.listings l
   where l.release_id in (select e.release_id from public.entity_links() e where e.kind = p_kind and e.entity_id = p_id);

  if p_kind = 'artist' then
    if (select count(*) from public.artists where id = any(v_targets)) <> v_n or not exists (select 1 from public.artists where id = p_id) then
      raise exception 'artist not found' using errcode = 'P0002';
    end if;
    -- each line: the old artist becomes the targets ("A & B"), duplicates dropped, the last keeps the old join text
    for v_line in select distinct line_id from public.release_line_artists where artist_id = p_id loop
      select array_agg(artist_id order by position), array_agg(join_text order by position) into v_ids, v_joins
        from public.release_line_artists where line_id = v_line.line_id;
      v_new_ids := '{}'; v_new_joins := '{}';
      for v_i in 1 .. array_length(v_ids, 1) loop
        if v_ids[v_i] = p_id then
          for v_j in 1 .. v_n loop
            if not (v_targets[v_j] = any(v_new_ids)) then
              v_new_ids := v_new_ids || v_targets[v_j];
              v_new_joins := v_new_joins || (case when v_j < v_n then '&' else v_joins[v_i] end);
            end if;
          end loop;
        elsif not (v_ids[v_i] = any(v_new_ids)) then
          v_new_ids := v_new_ids || v_ids[v_i];
          v_new_joins := v_new_joins || v_joins[v_i];
        end if;
      end loop;
      delete from public.release_line_artists where line_id = v_line.line_id;
      for v_i in 1 .. array_length(v_new_ids, 1) loop
        insert into public.release_line_artists (line_id, position, artist_id, join_text)
        values (v_line.line_id, v_i, v_new_ids[v_i], case when v_i < array_length(v_new_ids, 1) then coalesce(v_new_joins[v_i], '&') end);
      end loop;
    end loop;
    if v_n = 1 then
      select name, discogs_artist_id into v_name, v_discogs from public.artists where id = p_id;
      perform public.learn_alias('artist', v_targets[1], v_name);
      perform public.learn_alias('artist', v_targets[1], x.name) from public.artist_aliases x where x.artist_id = p_id;
      update public.artists set discogs_artist_id = null where id = p_id;
      update public.artists set discogs_artist_id = coalesce(discogs_artist_id, v_discogs) where id = v_targets[1];
    end if;
    delete from public.artists where id = p_id;

  elsif p_kind = 'label' then
    if not exists (select 1 from public.labels where id = v_targets[1]) or not exists (select 1 from public.labels where id = p_id) then
      raise exception 'label not found' using errcode = 'P0002';
    end if;
    update public.releases set label_id = v_targets[1] where label_id = p_id;
    select name, discogs_label_id into v_name, v_discogs from public.labels where id = p_id;
    perform public.learn_alias('label', v_targets[1], v_name);
    perform public.learn_alias('label', v_targets[1], x.name) from public.label_aliases x where x.label_id = p_id;
    update public.labels set discogs_label_id = null where id = p_id;
    update public.labels set discogs_label_id = coalesce(discogs_label_id, v_discogs) where id = v_targets[1];
    delete from public.labels where id = p_id;

  else
    if p_kind = 'genre' then
      if (select count(*) from public.genres where id = any(v_targets)) <> v_n or not exists (select 1 from public.genres where id = p_id) then
        raise exception 'genre not found' using errcode = 'P0002';
      end if;
      v_releases := array(select release_id from public.release_genres where genre_id = p_id);
    else
      if (select count(*) from public.tags where id = any(v_targets)) <> v_n or not exists (select 1 from public.tags where id = p_id) then
        raise exception 'tag not found' using errcode = 'P0002';
      end if;
      v_releases := array(select release_id from public.release_tags where tag_id = p_id);
    end if;
    -- each release: the old one becomes the targets at its place, duplicates dropped, positions renumbered
    for v_rel in select unnest(v_releases) as release_id loop
      if p_kind = 'genre' then
        select array_agg(genre_id order by position) into v_ids from public.release_genres where release_id = v_rel.release_id;
      else
        select array_agg(tag_id order by position) into v_ids from public.release_tags where release_id = v_rel.release_id;
      end if;
      v_new_ids := '{}';
      for v_i in 1 .. array_length(v_ids, 1) loop
        if v_ids[v_i] = p_id then
          for v_j in 1 .. v_n loop
            if not (v_targets[v_j] = any(v_new_ids)) then v_new_ids := v_new_ids || v_targets[v_j]; end if;
          end loop;
        elsif not (v_ids[v_i] = any(v_new_ids)) then
          v_new_ids := v_new_ids || v_ids[v_i];
        end if;
      end loop;
      if p_kind = 'genre' then
        delete from public.release_genres where release_id = v_rel.release_id;
        insert into public.release_genres (release_id, genre_id, position)
        select v_rel.release_id, x, o from unnest(v_new_ids) with ordinality as u(x, o);
      else
        delete from public.release_tags where release_id = v_rel.release_id;
        insert into public.release_tags (release_id, tag_id, position)
        select v_rel.release_id, x, o from unnest(v_new_ids) with ordinality as u(x, o);
      end if;
    end loop;
    if p_kind = 'genre' then
      delete from public.genres where id = p_id;
      perform public.sync_genres(v_releases);
    else
      delete from public.tags where id = p_id;
    end if;
    perform public.mark_site_build();
  end if;

  return jsonb_build_object('records', v_records, 'targets', to_jsonb(v_targets));
end
$$;

create or replace function public.admin_delete_entities(p_kind text, p_ids uuid[]) returns jsonb
  language plpgsql security invoker set search_path = ''
  as $$
declare
  v_free uuid[];
  v_skipped jsonb;
  v_table text := case p_kind when 'artist' then 'artists' when 'label' then 'labels' when 'genre' then 'genres' when 'tag' then 'tags' end;
begin
  if not public.is_admin() then raise exception 'not allowed' using errcode = '42501'; end if;
  perform public.check_kind(p_kind);
  v_free := array(select x from unnest(p_ids) x
                   where not exists (select 1 from public.entity_links() e where e.kind = p_kind and e.entity_id = x));
  select coalesce(jsonb_agg(jsonb_build_object('id', x, 'records', (select count(distinct l.id) from public.listings l
            where l.release_id in (select e.release_id from public.entity_links() e where e.kind = p_kind and e.entity_id = x)))), '[]')
    into v_skipped from unnest(p_ids) x where not (x = any(v_free));
  execute format('delete from public.%I where id = any($1)', v_table) using v_free;
  return jsonb_build_object('deleted', to_jsonb(v_free), 'skipped', v_skipped);
end
$$;

-- ── admin_save_listing: 0013 with macro_genre and genres ───────────────────
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
      macro_genre = coalesce(array(select jsonb_array_elements_text(coalesce(r->'macro_genre', r->'genre'))), '{}')
    where id = v_release_id;
  else
    insert into public.releases (discogs_release_id, label, label_id, cat_no, pre_release, year, country, format, macro_genre)
    values (nullif(r->>'discogs_release_id', '')::int, coalesce(nullif(trim(r->>'label_credit'), ''), nullif(trim(r->>'label'), '')), v_label_id, nullif(trim(r->>'cat_no'), ''), coalesce((r->>'pre_release')::boolean, false),
            nullif(r->>'year', '')::smallint, nullif(r->>'country', ''), r->>'format',
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

-- ── access (renamed tables and indexes keep their grants and policies) ─────
revoke execute on function public.resolve_genre(uuid, text), public.sync_genres(uuid[]) from public, anon;
grant execute on function public.resolve_genre(uuid, text), public.sync_genres(uuid[]) to authenticated;

-- PostgREST: pick up the new names now
notify pgrst, 'reload schema';
