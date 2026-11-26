-- 0042 video jobs (2026-11-26, Gio; decision 0195). Record videos rendered on a server, so the admin can be closed
-- while they are made (Gio: "even with the browser closed"). The admin asks render-video for a video; the function
-- writes a row here and starts the GitHub Actions workflow render-video.yml (ffmpeg), which uploads videos/<uuid>.mp4
-- to R2 and marks the row done. The admin shows the latest job for the same audio + photos with a Download button.
-- · audio_keys / image_keys: one pair = the video of a sample (0180), two = the A+B video (0191), in play order.
--   A video belongs to those files, not to a sample row (sample rows are rewritten on every save of the listing).
-- · listing_id: null for a listing not saved yet; a deleted listing takes its jobs with it.
-- · no email (Gio 2026-11-26): the result is only in the admin.
begin;

create table public.video_jobs (
  id          uuid primary key default gen_random_uuid(),
  listing_id  uuid references public.listings on delete cascade,
  audio_keys  text[] not null check (cardinality(audio_keys) between 1 and 2),
  image_keys  text[] not null,
  name        text not null check (name ~ '^[A-Za-z0-9._-]+\.mp4$'),
  status      text not null default 'queued' check (status in ('queued', 'rendering', 'done', 'failed')),
  video_key   text check (video_key ~ '^videos/[0-9a-f-]+\.mp4$'),
  error       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint video_jobs_pairs check (cardinality(image_keys) = cardinality(audio_keys)),
  constraint video_jobs_done check (status <> 'done' or video_key is not null)
);
create index video_jobs_listing on public.video_jobs (listing_id, created_at desc);

-- admins only; the worker writes through render-video with the service role
alter table public.video_jobs enable row level security;
grant select, insert, update, delete on public.video_jobs to authenticated;
create policy video_jobs_admin on public.video_jobs for all to authenticated using (public.is_admin()) with check (public.is_admin());

create function public.video_jobs_touch() returns trigger
  language plpgsql set search_path = ''
  as $$
begin
  new.updated_at := now();
  return new;
end $$;
create trigger video_jobs_touch before update on public.video_jobs for each row execute function public.video_jobs_touch();

commit;
