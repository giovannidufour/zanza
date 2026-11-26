-- 0044 video jobs: how far the render is (2026-11-26, Gio: "can I see the progress?"; decision 0195).
-- The workflow sends ffmpeg's position through render-video every 3 s; the admin shows "Making video… N%".
alter table public.video_jobs add column progress smallint not null default 0 check (progress between 0 and 100);
