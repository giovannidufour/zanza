-- 0037 Drop Memo (2026-11-24, decision 0171): the admin Memo page is gone, a draft is the reminder now.
-- The table was empty when this ran (checked first). The guard refuses to drop it if a row came back meanwhile.
do $$
begin
  if exists (select 1 from public.memos) then
    raise exception 'public.memos still has rows: turn them into drafts first';
  end if;
end $$;

drop table public.memos;
