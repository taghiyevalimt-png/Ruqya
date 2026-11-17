-- Rollback of 2026-11-realtime.sql: takes the app's tables out of the Realtime publication (live updates stop;
-- the app still works and reloads data when it is opened or comes back to the front).
do $$ declare t text; begin
  foreach t in array array['appts','breaks','expenses','product_sales','readers','services','staff','stat_edits'] loop
    if exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
      execute format('alter publication supabase_realtime drop table public.%I', t);
    end if;
  end loop;
end $$;
