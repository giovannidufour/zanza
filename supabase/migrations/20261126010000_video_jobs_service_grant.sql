-- 0043 video jobs: the service role may read and update them (2026-11-26; decision 0195). The project gives
-- service_role no table rights by default, so render-video could not find the job the workflow asked for (404).
grant select, update on public.video_jobs to service_role;
