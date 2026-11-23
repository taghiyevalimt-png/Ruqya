-- Undo 2026-11-presets.sql: the app goes back to its built-in prices and lengths (it reads this table softly).
do $$ begin
  if exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'app_settings') then
    alter publication supabase_realtime drop table public.app_settings;
  end if;
end $$;
drop table if exists public.app_settings;
select 'OK' as result;
