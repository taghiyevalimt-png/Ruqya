-- Undo 2026-11-share-amounts.sql: fixed amounts are removed (those rules are deleted), percents stay.
do $$ declare t text; begin
  foreach t in array array['product_shares','service_shares'] loop
    execute format('delete from public.%I where pct is null', t);
    execute format('alter table public.%I drop constraint if exists %I', t, t || '_rule');
    execute format('alter table public.%I drop column if exists amt', t);
    execute format('alter table public.%I alter column pct set not null', t);
    execute format('alter table public.%I add constraint %I check (pct > 0 and pct <= 100)', t, t || '_pct_check');
  end loop;
end $$;
select 'OK' as result;
