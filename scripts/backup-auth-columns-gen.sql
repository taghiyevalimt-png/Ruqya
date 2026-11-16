-- Writes one statement per column of the source's auth tables that adds the column if the restore target lacks it.
-- The sign-in tables (schema auth) come from the restore stack's own sign-in service; when the hosted service is
-- newer (Supabase upgrades it on its own schedule), its tables have columns the older stack does not, and the data
-- copy cannot be loaded (B-16, 2026-11-16: auth.one_time_tokens.link_token_hash). Columns are added without
-- constraints, only so the data fits; columns the target already has are skipped (no owner rights needed then).
-- Structure only, no data.
select format($f$do $d$ begin if to_regclass('auth.%1$I') is not null and not exists (select 1 from pg_attribute where attrelid = 'auth.%1$I'::regclass and attname = %3$L and not attisdropped) then alter table auth.%1$I add column %2$I %4$s; raise warning 'restore target lacked column auth.%%.%%; added', %5$L, %3$L; end if; end $d$;$f$,
  c.relname, a.attname, a.attname, format_type(a.atttypid, a.atttypmod), c.relname)
from pg_attribute a join pg_class c on c.oid = a.attrelid join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'auth' and c.relkind in ('r', 'p') and a.attnum > 0 and not a.attisdropped
order by c.relname, a.attnum;
