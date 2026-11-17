-- Rollback of 2026-11-least-privilege.sql: gives back the Supabase default rights (anon SELECT/MAINTAIN,
-- authenticated MAINTAIN) on the tables that had them before, and anon EXECUTE on ruqya_min.
do $$ declare t text; begin
  foreach t in array array['appts','breaks','expenses','product_sales','services','staff'] loop
    execute format('grant select, maintain on public.%I to anon', t);
  end loop;
  execute 'grant maintain on public.readers to anon';
  for t in select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind = 'r' and c.relname <> 'audit_log' loop
    execute format('grant maintain on public.%I to authenticated', t);
  end loop;
end $$;
grant execute on function public.ruqya_min(text) to anon;
select 'OK' as result;
