-- Undo 2026-11-stat-edits.sql: removes the corrections (the statistics go back to the computed numbers).
do $$ begin
  if exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'stat_edits') then
    alter publication supabase_realtime drop table public.stat_edits;
  end if;
end $$;
drop table if exists public.stat_edits;
drop function if exists public.ruqya_stat_stamp();
drop function if exists public.ruqya_can_stats();
