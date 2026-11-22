-- Undo 2026-11-service-shares.sql: the specialists' service percents are forgotten.
do $$ begin
  if exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'service_shares') then
    alter publication supabase_realtime drop table public.service_shares;
  end if;
end $$;
drop table if exists public.service_shares;
select 'OK' as result;
