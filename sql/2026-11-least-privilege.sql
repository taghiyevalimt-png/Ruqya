-- S-04: least privilege. Visitors without a sign-in (role anon) get no table rights at all (row security already
-- returned no rows, now the right itself is gone); signed-in users lose MAINTAIN (VACUUM/ANALYZE/LOCK, not needed by
-- the app); the pure helper ruqya_min is no longer callable without a sign-in. The app's own requests are unchanged.
-- Safe to run again. Rollback: sql/rollback-2026-11-least-privilege.sql
do $$ declare t text; begin
  for t in select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind = 'r' loop
    execute format('revoke all on public.%I from anon', t);
    execute format('revoke maintain on public.%I from authenticated', t);
  end loop;
end $$;
alter default privileges in schema public revoke all on tables from anon;
do $$ begin
  if exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'ruqya_min') then
    revoke execute on function public.ruqya_min(text) from public, anon;
    grant execute on function public.ruqya_min(text) to authenticated;
  end if;
end $$;
select 'OK' as result;
