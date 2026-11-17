-- B-17: live updates (other phones see a change at once) need the app's tables in the Supabase Realtime
-- publication. The live project has them (set once in the dashboard), but the schema dump in db/ does not carry
-- publication membership, so a database built from this repository would have no live updates.
-- Safe to run again; creates the publication only where it does not exist (plain PostgreSQL), as Supabase does.
do $$ begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then create publication supabase_realtime; end if;
end $$;
do $$ declare t text; begin
  foreach t in array array['appts','breaks','expenses','product_sales','readers','services','staff','stat_edits'] loop
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
