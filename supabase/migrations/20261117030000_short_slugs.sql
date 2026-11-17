-- 0027: slugs are at most 80 characters, cut at a word (decision 0112).
-- A compilation's display name joins every track: its slug (300+ characters) broke the shop build
-- (ENAMETOOLONG on dist/products/<slug>/). slugify serves listings and entities alike.
begin;

create or replace function public.slugify(p text) returns text
  language sql immutable set search_path = ''
  as $$
    with s as (select trim(both '-' from regexp_replace(lower(coalesce(p, '')), '[^a-z0-9]+', '-', 'g')) as v)
    select case
      when length(v) <= 80 then v
      -- cut at the last hyphen within 80 characters; a single 80+ character word is cut as it is
      else trim(both '-' from coalesce(substring(left(v, 81) from '^(.*)-'), left(v, 80)))
    end
    from s
  $$;

-- existing long slugs (listings, artists, labels, genres, tags): shortened, "-2", "-3"… when taken
do $$
declare
  t text;
  r record;
  v_base text;
  v_slug text;
  v_n int;
  v_taken boolean;
begin
  foreach t in array array['listings', 'artists', 'labels', 'genres', 'tags'] loop
    for r in execute format('select id, slug from public.%I where length(slug) > 80', t) loop
      v_base := public.slugify(r.slug);
      v_slug := v_base;
      v_n := 1;
      loop
        execute format('select exists (select 1 from public.%I where slug = $1 and id <> $2)', t) into v_taken using v_slug, r.id;
        exit when not v_taken;
        v_n := v_n + 1;
        v_slug := v_base || '-' || v_n;
      end loop;
      execute format('update public.%I set slug = $1 where id = $2', t) using v_slug, r.id;
    end loop;
  end loop;
end
$$;

commit;
