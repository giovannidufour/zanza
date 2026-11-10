-- 0006 artists and labels as entities (Gio, 2026-11-10): an artist and a label are things with an id
-- (clickable pages later), not strings. The admin suggests existing ones while typing and binds the line /
-- release to the chosen entity.
-- · artists, labels: id, name, slug (future page URL), discogs id (so Fetch Discogs never duplicates).
-- · release_line_artists: the artists of a line, in order, with the join text between them ("&", "feat.").
--   Several artists per line are modelled now; the form sends one per line until a multi-artist field exists.
-- · Spelling variants (Gio, 2026-11-10): the entity has the OFFICIAL name; artist_aliases / label_aliases hold the
--   other spellings. release_lines.artist and releases.label stay and are the CREDIT as printed on this record
--   (Discogs "ANV"); the shop keeps showing them, the entity is the link. A credit that differs from the official
--   name is learnt as an alias on save, so typing it later suggests and binds the same entity.
-- · Binding on save (resolve_artist / resolve_label): explicit id → discogs id → official name or alias
--   (case-insensitive, oldest entity wins) → new entity.

create table public.artists (
  id                uuid primary key default gen_random_uuid(),
  name              text not null check (trim(name) <> ''),
  slug              text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  discogs_artist_id int unique,
  created_at        timestamptz not null default now()
);
create index artists_name on public.artists (lower(name));

create table public.labels (
  id               uuid primary key default gen_random_uuid(),
  name             text not null check (trim(name) <> ''),
  slug             text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  discogs_label_id int unique,
  created_at       timestamptz not null default now()
);
create index labels_name on public.labels (lower(name));

create table public.release_line_artists (
  line_id   uuid not null references public.release_lines on delete cascade,
  position  smallint not null check (position >= 1),
  artist_id uuid not null references public.artists,
  join_text text,                                        -- text after this artist: '&', 'feat.' … (null = last)
  primary key (line_id, position)
);
create index release_line_artists_artist on public.release_line_artists (artist_id);

create table public.artist_aliases (
  artist_id uuid not null references public.artists on delete cascade,
  name      text not null check (trim(name) <> ''),
  primary key (artist_id, name)
);
create index artist_aliases_name on public.artist_aliases (lower(name));
create table public.label_aliases (
  label_id uuid not null references public.labels on delete cascade,
  name     text not null check (trim(name) <> ''),
  primary key (label_id, name)
);
create index label_aliases_name on public.label_aliases (lower(name));

alter table public.releases add column label_id uuid references public.labels;
create index releases_label on public.releases (label_id);

-- ── free slug for a new entity: "name", "name-2", … ────────────────────────
create function public.free_slug(p_table text, p_name text) returns text
  language plpgsql set search_path = ''
  as $$
declare
  v_base text := coalesce(nullif(public.slugify(p_name), ''), p_table);
  v_slug text := v_base;
  v_n int := 1;
  v_taken boolean;
begin
  loop
    execute format('select exists (select 1 from public.%I where slug = $1)', p_table) into v_taken using v_slug;
    exit when not v_taken;
    v_n := v_n + 1;
    v_slug := v_base || '-' || v_n;
  end loop;
  return v_slug;
end
$$;

-- ── resolve or create (used by admin_save_listing; security invoker → RLS applies) ──
create function public.resolve_artist(p_id uuid, p_name text, p_discogs int) returns uuid
  language plpgsql set search_path = ''
  as $$
declare
  v_id uuid;
  v_name text := nullif(trim(p_name), '');
begin
  if p_id is not null then
    select id into v_id from public.artists where id = p_id;
    if v_id is not null then return v_id; end if;
  end if;
  if p_discogs is not null then
    select id into v_id from public.artists where discogs_artist_id = p_discogs;
    if v_id is not null then return v_id; end if;
  end if;
  if v_name is null then return null; end if;
  select e.id into v_id from public.artists e
   where lower(e.name) = lower(v_name) or exists (select 1 from public.artist_aliases a where a.artist_id = e.id and lower(a.name) = lower(v_name))
   order by e.created_at, e.id limit 1;
  if v_id is not null then
    -- learn the discogs id the first time it is known
    update public.artists set discogs_artist_id = p_discogs where id = v_id and discogs_artist_id is null and p_discogs is not null;
    return v_id;
  end if;
  insert into public.artists (name, slug, discogs_artist_id) values (v_name, public.free_slug('artists', v_name), p_discogs)
  returning id into v_id;
  return v_id;
end
$$;

create function public.resolve_label(p_id uuid, p_name text, p_discogs int) returns uuid
  language plpgsql set search_path = ''
  as $$
declare
  v_id uuid;
  v_name text := nullif(trim(p_name), '');
begin
  if p_id is not null then
    select id into v_id from public.labels where id = p_id;
    if v_id is not null then return v_id; end if;
  end if;
  if p_discogs is not null then
    select id into v_id from public.labels where discogs_label_id = p_discogs;
    if v_id is not null then return v_id; end if;
  end if;
  if v_name is null then return null; end if;
  select e.id into v_id from public.labels e
   where lower(e.name) = lower(v_name) or exists (select 1 from public.label_aliases a where a.label_id = e.id and lower(a.name) = lower(v_name))
   order by e.created_at, e.id limit 1;
  if v_id is not null then
    update public.labels set discogs_label_id = p_discogs where id = v_id and discogs_label_id is null and p_discogs is not null;
    return v_id;
  end if;
  insert into public.labels (name, slug, discogs_label_id) values (v_name, public.free_slug('labels', v_name), p_discogs)
  returning id into v_id;
  return v_id;
end
$$;

-- a credit that differs from the official name becomes an alias (no-op otherwise)
create function public.learn_alias(p_kind text, p_id uuid, p_credit text) returns void
  language plpgsql set search_path = ''
  as $$
declare v_credit text := nullif(trim(p_credit), '');
begin
  if p_id is null or v_credit is null then return; end if;
  if p_kind = 'artist' then
    insert into public.artist_aliases (artist_id, name)
    select p_id, v_credit where not exists (select 1 from public.artists where id = p_id and lower(name) = lower(v_credit))
                            and not exists (select 1 from public.artist_aliases where artist_id = p_id and lower(name) = lower(v_credit));
  else
    insert into public.label_aliases (label_id, name)
    select p_id, v_credit where not exists (select 1 from public.labels where id = p_id and lower(name) = lower(v_credit))
                            and not exists (select 1 from public.label_aliases where label_id = p_id and lower(name) = lower(v_credit));
  end if;
end
$$;

-- ── existing data: one entity per distinct name, bound to lines and releases ──
do $$
declare x record;
begin
  for x in select min(trim(artist)) as name from public.release_lines where nullif(trim(artist), '') is not null
           group by lower(trim(artist)) order by 1 loop
    insert into public.artists (name, slug) values (x.name, public.free_slug('artists', x.name));
  end loop;
  for x in select min(trim(label)) as name from public.releases where nullif(trim(label), '') is not null
           group by lower(trim(label)) order by 1 loop
    insert into public.labels (name, slug) values (x.name, public.free_slug('labels', x.name));
  end loop;
end
$$;
insert into public.release_line_artists (line_id, position, artist_id)
  select l.id, 1, a.id from public.release_lines l join public.artists a on lower(a.name) = lower(trim(l.artist));
update public.releases r set label_id = b.id from public.labels b where lower(b.name) = lower(trim(r.label));

-- ── admin_save_listing: same payload as 0003, plus the entity ids ──────────
/* added to the 0003 payload (all optional):
   release: "label" = OFFICIAL label name, "label_credit" = as printed (empty = same), "label_id", "label_discogs_id"
   lines[]: "artist" = OFFICIAL artist name, "artist_credit" = as printed (empty = same), "artist_id", "artist_discogs_id"
   Stored text (shown by the shop) = the credit; the entity is created when the name is new, the credit learnt as alias. */
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
  select v_release_id, ord, coalesce(nullif(trim(x->>'artist_credit'), ''), nullif(trim(x->>'artist'), '')), trim(x->>'title')
    from jsonb_array_elements(v_lines) with ordinality as t(x, ord)
  on conflict (release_id, position) do update set artist = excluded.artist, title = excluded.title;

  -- line artists: one entity per line with an artist (empty artist = same as line 1, no row)
  delete from public.release_line_artists where line_id in (select id from public.release_lines where release_id = v_release_id);
  v_ord := 0;
  for v_line in select * from jsonb_array_elements(v_lines) loop
    v_ord := v_ord + 1;
    v_artist_id := public.resolve_artist(nullif(v_line->>'artist_id', '')::uuid, v_line->>'artist', nullif(v_line->>'artist_discogs_id', '')::int);
    perform public.learn_alias('artist', v_artist_id, coalesce(nullif(trim(v_line->>'artist_credit'), ''), v_line->>'artist'));
    if v_artist_id is not null then
      insert into public.release_line_artists (line_id, position, artist_id)
      select id, 1, v_artist_id from public.release_lines where release_id = v_release_id and position = v_ord;
    end if;
  end loop;

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

-- ── access: public read (future artist / label pages), admin write ─────────
alter table public.artists enable row level security;
alter table public.labels enable row level security;
alter table public.release_line_artists enable row level security;
alter table public.artist_aliases enable row level security;
alter table public.label_aliases enable row level security;
grant select on public.artists, public.labels, public.release_line_artists, public.artist_aliases, public.label_aliases to anon, authenticated;
grant insert, update, delete on public.artists, public.labels, public.release_line_artists, public.artist_aliases, public.label_aliases to authenticated;
create policy artist_aliases_read  on public.artist_aliases for select using (true);
create policy artist_aliases_admin on public.artist_aliases for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy label_aliases_read   on public.label_aliases for select using (true);
create policy label_aliases_admin  on public.label_aliases for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy artists_read  on public.artists for select using (true);
create policy artists_admin on public.artists for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy labels_read   on public.labels for select using (true);
create policy labels_admin  on public.labels for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy release_line_artists_read  on public.release_line_artists for select using (true);
create policy release_line_artists_admin on public.release_line_artists for all to authenticated using (public.is_admin()) with check (public.is_admin());
revoke execute on function public.resolve_artist(uuid, text, int), public.resolve_label(uuid, text, int), public.free_slug(text, text),
  public.learn_alias(text, uuid, text) from public, anon;
grant execute on function public.resolve_artist(uuid, text, int), public.resolve_label(uuid, text, int), public.free_slug(text, text),
  public.learn_alias(text, uuid, text) to authenticated;
