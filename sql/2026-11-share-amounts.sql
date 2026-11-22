-- Mərkəz (owner 22.11): what stays with the specialist / seller may be a fixed amount instead of a percent:
-- per piece of a product (product_shares.amt) or per successful session of a service (service_shares.amt).
-- Exactly one of pct / amt is set. Safe to run again. Undo: rollback-2026-11-share-amounts.sql
do $$ declare t text; c text; begin
  foreach t in array array['product_shares','service_shares'] loop
    execute format('alter table public.%I add column if not exists amt numeric', t);
    execute format('alter table public.%I alter column pct drop not null', t);
    for c in select conname from pg_constraint where conrelid = format('public.%I', t)::regclass and contype = 'c' and pg_get_constraintdef(oid) like '%pct%' loop
      execute format('alter table public.%I drop constraint %I', t, c);
    end loop;
    execute format('alter table public.%I add constraint %I check ((pct is null) <> (amt is null) and (pct is null or (pct > 0 and pct <= 100)) and (amt is null or (amt > 0 and amt <= 1000000)))', t, t || '_rule');
  end loop;
end $$;
select 'OK' as result;
