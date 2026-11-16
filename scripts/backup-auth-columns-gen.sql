-- Writes ALTER TABLE statements that add every column of the source's auth tables if the restore target lacks it.
-- The sign-in tables (schema auth) come from the restore stack's own sign-in service; when the hosted service is
-- newer (Supabase upgrades it on its own schedule), its tables have columns the older stack does not, and the data
-- copy cannot be loaded (B-16, 2026-11-16: auth.one_time_tokens.link_token_hash). Columns are added without
-- constraints, only so the data fits; columns the stack already has are left alone. Structure only, no data.
select format('alter table auth.%I add column if not exists %I %s;', c.relname, a.attname, format_type(a.atttypid, a.atttypmod))
from pg_attribute a join pg_class c on c.oid = a.attrelid join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'auth' and c.relkind in ('r', 'p') and a.attnum > 0 and not a.attisdropped
order by c.relname, a.attnum;
