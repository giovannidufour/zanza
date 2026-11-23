-- 0030 release credits (2026-11-23, decision 0146): the people Discogs credits on a release (Producer, Mixed By,
-- Arranged By, Written-By, the band …), kept so the shop search finds a record by its producer ("Dodd", "Coxsone").
-- Not shown in the shop for now (Gio: maybe later, as links like the artists).
-- · release_credits: one row per Discogs credit (release "extraartists" and track-level ones), in Discogs order.
--   artist_id = the same `artists` entities as the performers (Lee Perry, King Tubby produce AND perform): a future
--   producer link is the existing ?artist= filter. role = the Discogs role as written ("Producer", "Mixed By",
--   "Producer [Dub]"). credit = the name as printed on this release (Discogs ANV), null when it is the official name.
--   tracks = the Discogs positions it refers to ("A", "B1, B2"), null = the whole release.
-- · ALL roles are stored (Gio 2026-11-23); the shop decides which ones are searchable (now: producers only).
-- · Spelling variants: the printed credit and the Discogs name variations of the person ("C.S. Dodd", "Coxsone")
--   are learnt as artist aliases, so the search and the admin's artist suggestions find the same entity.
-- · releases.credits_fetched_at: when the credits were last read from Discogs (null = never: the backfill does it).
-- · admin_set_release_credits(release, credits): replaces the credits of a release. Called after admin_save_listing
--   when the admin has fresh Discogs data (Fetch Discogs, Memo/Bulk/Scanner drafts) and by the release-credits backfill.
-- · Attributes: entity_links counts credits too; admin_replace_entity moves an artist's credits to the first target.

create table public.release_credits (
  release_id uuid not null references public.releases on delete cascade,
  position   smallint not null check (position >= 1),
  artist_id  uuid not null references public.artists,
  role       text not null check (trim(role) <> ''),
  credit     text,
  tracks     text,
  primary key (release_id, position)
);
create index release_credits_artist on public.release_credits (artist_id);

alter table public.releases add column credits_fetched_at timestamptz;

alter table public.release_credits enable row level security;
grant select on public.release_credits to anon, authenticated;
grant insert, update, delete on public.release_credits to authenticated;
create policy release_credits_read  on public.release_credits for select using (true);
create policy release_credits_admin on public.release_credits for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- p_credits: [{ name, credit, discogs_id, role, tracks, variations: [text] }]
create function public.admin_set_release_credits(p_release_id uuid, p_credits jsonb) returns int
  language plpgsql security invoker set search_path = ''
  as $$
declare
  c jsonb;
  v text;
  v_artist_id uuid;
  v_pos int := 0;
begin
  if not public.is_admin() then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if not exists (select 1 from public.releases where id = p_release_id) then
    raise exception 'release not found' using errcode = 'P0002';
  end if;
  delete from public.release_credits where release_id = p_release_id;
  for c in select * from jsonb_array_elements(case when jsonb_typeof(p_credits) = 'array' then p_credits else '[]'::jsonb end) loop
    continue when nullif(trim(c->>'name'), '') is null or nullif(trim(c->>'role'), '') is null;
    v_artist_id := public.resolve_artist(null, c->>'name', nullif(c->>'discogs_id', '')::int);
    continue when v_artist_id is null;
    -- every spelling is learnt, also from a credit dropped as a duplicate below
    perform public.learn_alias('artist', v_artist_id, c->>'credit');
    if jsonb_typeof(c->'variations') = 'array' then
      for v in select * from jsonb_array_elements_text(c->'variations') loop
        perform public.learn_alias('artist', v_artist_id, v);
      end loop;
    end if;
    -- same person, same role, same tracks twice (Discogs lists some credits on the release and on the track)
    continue when exists (select 1 from public.release_credits where release_id = p_release_id and artist_id = v_artist_id
                            and lower(role) = lower(trim(c->>'role')) and coalesce(tracks, '') = coalesce(nullif(trim(c->>'tracks'), ''), ''));
    v_pos := v_pos + 1;
    insert into public.release_credits (release_id, position, artist_id, role, credit, tracks)
    values (p_release_id, v_pos, v_artist_id, trim(c->>'role'),
            case when lower(nullif(trim(c->>'credit'), '')) <> lower(trim(c->>'name')) then trim(c->>'credit') end,
            nullif(trim(c->>'tracks'), ''));
  end loop;
  update public.releases set credits_fetched_at = now() where id = p_release_id;
  return v_pos;
end
$$;
grant execute on function public.admin_set_release_credits(uuid, jsonb) to authenticated;

-- ── Attributes (0012/0014): a credited person counts as a link of the artist ─────────────────────────────────────
-- entity_links: + the credits, so the Attributes page counts the records an artist produced and Delete keeps an artist
-- that is still credited. admin_replace_entity: the 0014 version (20261110120000) + the credits move to the first target.
create or replace function public.entity_links() returns table (kind text, entity_id uuid, release_id uuid)
  language sql stable set search_path = ''
  as $$
    select 'artist', ra.artist_id, rl.release_id from public.release_line_artists ra join public.release_lines rl on rl.id = ra.line_id
    union all select 'artist', rc.artist_id, rc.release_id from public.release_credits rc
    union all select 'label', r.label_id, r.id from public.releases r where r.label_id is not null
    union all select 'genre', rs.genre_id, rs.release_id from public.release_genres rs
    union all select 'tag', rt.tag_id, rt.release_id from public.release_tags rt
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
    -- 0030: the Discogs credits go to the first target (a credit names one person), duplicates dropped
    update public.release_credits c set artist_id = v_targets[1]
     where c.artist_id = p_id
       and not exists (select 1 from public.release_credits d where d.release_id = c.release_id and d.artist_id = v_targets[1]
                         and lower(d.role) = lower(c.role) and coalesce(d.tracks, '') = coalesce(c.tracks, ''));
    delete from public.release_credits where artist_id = p_id;
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

notify pgrst, 'reload schema';
