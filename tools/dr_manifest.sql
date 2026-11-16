-- Row count and content hash for every table of schema public plus auth.users and auth.identities.
-- One line per table: name | rows | md5 of all rows (each row as jsonb text, sorted, joined with newlines).
-- The same query runs on the live database (dr-export workflow) and on the restored copy (tools/dr_restore.js).
select t.tbl,
       (xpath('/row/c/text()', query_to_xml(format('select count(*) as c from %s', t.tbl), false, true, '')))[1]::text as rows,
       (xpath('/row/h/text()', query_to_xml(format(
          'select md5(coalesce(string_agg(x, chr(10) order by x), %L)) as h from (select to_jsonb(r)::text x from %s r) s', '', t.tbl),
          false, true, '')))[1]::text as hash
  from (select format('%I.%I', n.nspname, c.relname) tbl
          from pg_class c join pg_namespace n on n.oid = c.relnamespace
         where c.relkind = 'r' and (n.nspname = 'public' or (n.nspname = 'auth' and c.relname in ('users','identities')))) t
 order by 1;
