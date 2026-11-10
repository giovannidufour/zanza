-- 0012 attributes (Gio, 2026-11-10, Figma BACKEND → Attributes 2123:2053): the admin lists, edits, merges, splits and
-- deletes artists, labels, subgenres and tags. Decision 0034.
-- · kind = 'artist' | 'label' | 'subgenre' | 'tag'. Records of an entity = listings whose release uses it (archived included).
-- · admin_attributes()            → the four lists with aliases and record counts (one call for the page and its tab counts)
-- · admin_entity(kind, id)        → one entity + the ids of its listings
-- · admin_save_entity(kind, id, payload) → create / edit: name, slug, Discogs id, aliases (artists and labels)
-- · admin_replace_entity(kind, id, targets[]) → "Replace with": moves the records to the targets, then deletes it.
--     One target = merge: its name and aliases become aliases of the target (artists, labels), its Discogs id moves
--     when the target has none. Several targets = split (not labels: a release has one label): no alias is learnt.
--     The printed credits (release_lines.artist, releases.label) never change.
-- · admin_merge_entities(kind, keep, others[]) → the list's Merge: every other one replaced with `keep`
-- · admin_delete_entities(kind, ids[]) → deletes the ones without records, returns the skipped ones
-- · a change that the shop shows (subgenre / tag names and links) marks the site build pending (migration 0005).

-- every link from an entity to a release
create function public.entity_links() returns table (kind text, entity_id uuid, release_id uuid)
  language sql stable set search_path = ''
  as $$
    select 'artist', ra.artist_id, rl.release_id from public.release_line_artists ra join public.release_lines rl on rl.id = ra.line_id
    union all select 'label', r.label_id, r.id from public.releases r where r.label_id is not null
    union all select 'subgenre', rs.subgenre_id, rs.release_id from public.release_subgenres rs
    union all select 'tag', rt.tag_id, rt.release_id from public.release_tags rt
  $$;

create function public.check_kind(p_kind text) returns void
  language plpgsql immutable set search_path = ''
  as $$
begin
  if p_kind is null or p_kind not in ('artist', 'label', 'subgenre', 'tag') then
    raise exception 'unknown kind %', p_kind using errcode = '22023';
  end if;
end
$$;

-- the shop shows subgenre and tag names: mark a rebuild (site_build is not writable by the admin role)
create function public.mark_site_build() returns void
  language plpgsql security definer set search_path = ''
  as $$
begin
  if not public.is_admin() then raise exception 'not allowed' using errcode = '42501'; end if;
  update public.site_build set pending = true, requested_at = now() where id;
end
$$;

-- releases.style mirrors the subgenre names in order (0011)
create function public.sync_style(p_release_ids uuid[]) returns void
  language sql set search_path = ''
  as $$
    update public.releases r set style = coalesce((select array_agg(g.name order by rs.position) from public.release_subgenres rs
                                                   join public.subgenres g on g.id = rs.subgenre_id where rs.release_id = r.id), '{}')
     where r.id = any(p_release_ids)
  $$;

-- ── lists ───────────────────────────────────────────────────────────────────
create function public.admin_attributes() returns jsonb
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
    'subgenres', coalesce((select jsonb_agg(jsonb_build_object('id', g.id, 'name', g.name, 'slug', g.slug,
                 'records', coalesce((select n from recs where kind = 'subgenre' and entity_id = g.id), 0)) order by lower(g.name), g.name)
               from public.subgenres g), '[]'),
    'tags', coalesce((select jsonb_agg(jsonb_build_object('id', t.id, 'name', t.name, 'slug', t.slug,
                 'records', coalesce((select n from recs where kind = 'tag' and entity_id = t.id), 0)) order by lower(t.name), t.name)
               from public.tags t), '[]'))
  into v;
  return v;
end
$$;

create function public.admin_entity(p_kind text, p_id uuid) returns jsonb
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
  elsif p_kind = 'subgenre' then
    select jsonb_build_object('id', id, 'name', name, 'slug', slug) into v from public.subgenres where id = p_id;
  else
    select jsonb_build_object('id', id, 'name', name, 'slug', slug) into v from public.tags where id = p_id;
  end if;
  if v is null then raise exception 'not found' using errcode = 'P0002'; end if;
  return v || jsonb_build_object('listing_ids', coalesce((
    select jsonb_agg(l.id order by l.sku desc) from public.listings l
     where l.release_id in (select e.release_id from public.entity_links() e where e.kind = p_kind and e.entity_id = p_id)), '[]'));
end
$$;

-- ── create / edit ───────────────────────────────────────────────────────────
-- payload: { name, slug, discogs_id, aliases: [text] }. Empty slug = from the name. Returns the id.
create function public.admin_save_entity(p_kind text, p_id uuid, p jsonb) returns uuid
  language plpgsql security invoker set search_path = ''
  as $$
declare
  v_table text := case p_kind when 'artist' then 'artists' when 'label' then 'labels' when 'subgenre' then 'subgenres' when 'tag' then 'tags' end;
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
  -- subgenres and tags: one per name (case-insensitive); artists and labels may share a name (two different people)
  if p_kind in ('subgenre', 'tag') then
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
  elsif p_kind = 'subgenre' then
    perform public.sync_style(array(select release_id from public.release_subgenres where subgenre_id = v_id));
    perform public.mark_site_build();
  else
    perform public.mark_site_build();
  end if;
  return v_id;
end
$$;

-- ── replace with (merge / split) ────────────────────────────────────────────
create function public.admin_replace_entity(p_kind text, p_id uuid, p_targets uuid[]) returns jsonb
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
    if p_kind = 'subgenre' then
      if (select count(*) from public.subgenres where id = any(v_targets)) <> v_n or not exists (select 1 from public.subgenres where id = p_id) then
        raise exception 'subgenre not found' using errcode = 'P0002';
      end if;
      v_releases := array(select release_id from public.release_subgenres where subgenre_id = p_id);
    else
      if (select count(*) from public.tags where id = any(v_targets)) <> v_n or not exists (select 1 from public.tags where id = p_id) then
        raise exception 'tag not found' using errcode = 'P0002';
      end if;
      v_releases := array(select release_id from public.release_tags where tag_id = p_id);
    end if;
    -- each release: the old one becomes the targets at its place, duplicates dropped, positions renumbered
    for v_rel in select unnest(v_releases) as release_id loop
      if p_kind = 'subgenre' then
        select array_agg(subgenre_id order by position) into v_ids from public.release_subgenres where release_id = v_rel.release_id;
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
      if p_kind = 'subgenre' then
        delete from public.release_subgenres where release_id = v_rel.release_id;
        insert into public.release_subgenres (release_id, subgenre_id, position)
        select v_rel.release_id, x, o from unnest(v_new_ids) with ordinality as u(x, o);
      else
        delete from public.release_tags where release_id = v_rel.release_id;
        insert into public.release_tags (release_id, tag_id, position)
        select v_rel.release_id, x, o from unnest(v_new_ids) with ordinality as u(x, o);
      end if;
    end loop;
    if p_kind = 'subgenre' then
      delete from public.subgenres where id = p_id;
      perform public.sync_style(v_releases);
    else
      delete from public.tags where id = p_id;
    end if;
    perform public.mark_site_build();
  end if;

  return jsonb_build_object('records', v_records, 'targets', to_jsonb(v_targets));
end
$$;

-- the list's Merge: keep one, every other one is replaced with it
create function public.admin_merge_entities(p_kind text, p_keep uuid, p_others uuid[]) returns jsonb
  language plpgsql security invoker set search_path = ''
  as $$
declare v_id uuid; v_records int := 0; v_r jsonb;
begin
  if not public.is_admin() then raise exception 'not allowed' using errcode = '42501'; end if;
  if p_keep is null or coalesce(array_length(p_others, 1), 0) = 0 then raise exception 'pick the one to keep and at least one other' using errcode = '22023'; end if;
  for v_id in select distinct x from unnest(p_others) x where x is not null and x <> p_keep loop
    v_r := public.admin_replace_entity(p_kind, v_id, array[p_keep]);
    v_records := v_records + (v_r->>'records')::int;
  end loop;
  return jsonb_build_object('records', v_records);
end
$$;

-- ── delete: only the ones without records ───────────────────────────────────
create function public.admin_delete_entities(p_kind text, p_ids uuid[]) returns jsonb
  language plpgsql security invoker set search_path = ''
  as $$
declare
  v_free uuid[];
  v_skipped jsonb;
  v_table text := case p_kind when 'artist' then 'artists' when 'label' then 'labels' when 'subgenre' then 'subgenres' when 'tag' then 'tags' end;
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

-- ── access: admin only (each function checks is_admin(); anon cannot call them) ──
revoke execute on function public.entity_links(), public.check_kind(text), public.mark_site_build(), public.sync_style(uuid[]),
  public.admin_attributes(), public.admin_entity(text, uuid), public.admin_save_entity(text, uuid, jsonb),
  public.admin_replace_entity(text, uuid, uuid[]), public.admin_merge_entities(text, uuid, uuid[]),
  public.admin_delete_entities(text, uuid[]) from public, anon;
grant execute on function public.entity_links(), public.check_kind(text), public.mark_site_build(), public.sync_style(uuid[]),
  public.admin_attributes(), public.admin_entity(text, uuid), public.admin_save_entity(text, uuid, jsonb),
  public.admin_replace_entity(text, uuid, uuid[]), public.admin_merge_entities(text, uuid, uuid[]),
  public.admin_delete_entities(text, uuid[]) to authenticated;
