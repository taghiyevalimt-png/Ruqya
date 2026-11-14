-- Writes the manifest query (counts and hashes only, never row contents) for the database it runs on.
-- Usage:  psql "$DB" -X -At -v ON_ERROR_STOP=1 -f scripts/backup-manifest-gen.sql > manifest-query.sql
--         psql "$DB" -X -At -F '	' -v ON_ERROR_STOP=1 -f manifest-query.sql > manifest.txt
-- Run the generator on the SOURCE and run the same manifest-query.sql on the source and on the restored copy:
-- the column lists are those of the source, so a restored copy whose platform tables (auth) have extra newer
-- columns is still compared on exactly the source's data, while a missing column is an error.
-- One line per table: <schema.table> TAB <row count> TAB md5(string_agg(row::text, '' order by row::text)).
-- Tables: every ordinary table in public, plus auth.users and auth.identities.
-- For a table whose list is all its columns, row(t.c1, ..., t.cn)::text is exactly t::text.
\set QUIET on
select '\o /dev/null';
select 'set timezone = ''UTC''; set datestyle = ''ISO, MDY''; set intervalstyle = ''postgres''; set extra_float_digits = 1; set bytea_output = ''hex'';';
select '\o';
select format('select %L, count(*), md5(coalesce(string_agg(r, '''' order by r collate "C"), '''')) from (select row(%s)::text r from %I.%I t) s;',
              n.nspname || '.' || c.relname,
              (select string_agg('t.' || quote_ident(a.attname), ', ' order by a.attnum)
                 from pg_attribute a where a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped),
              n.nspname, c.relname)
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where c.relkind in ('r', 'p') and not c.relispartition
  and (n.nspname = 'public' or (n.nspname = 'auth' and c.relname in ('users', 'identities')))
order by n.nspname = 'auth', n.nspname, c.relname;
