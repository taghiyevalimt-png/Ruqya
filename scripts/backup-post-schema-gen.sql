-- Writes post-schema.sql, applied right after schema.sql when restoring:
--  1. the exact privileges of the source's tables, sequences, views and functions in schema public;
--  2. the source's realtime publication membership (supabase_realtime), which the app needs for live updates.
-- Why: a new Supabase project (or local stack) has default privileges that give anon / authenticated /
-- service_role access to every new table and function, and a schema dump only adds GRANTs. Restoring a dump
-- therefore ends with wider access than the source (for example table-wide SELECT where the source granted only
-- some columns, or EXECUTE on functions the source closed). acl.sql, applied right after schema.sql, first takes
-- away everything from those roles and PUBLIC, then grants exactly what the source has (table, column, function).
-- Both parts can be applied again without harm.
-- Usage: psql "$SOURCE" -X -q -At -v ON_ERROR_STOP=1 -f scripts/backup-post-schema-gen.sql > post-schema.sql
with rel as (
  select c.oid, c.relname, c.relkind, c.relacl, c.relowner,
         case when c.relkind = 'S' then 'sequence' else 'table' end kw,
         format('%I.%I', n.nspname, c.relname) qn
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind in ('r', 'p', 'v', 'm', 'f', 'S')
), fn as (
  select p.oid, p.proacl, p.proowner, p.prokind,
         format('%I.%I(%s)', n.nspname, p.proname, pg_get_function_identity_arguments(p.oid)) qn
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.prokind in ('f', 'p')
    and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')   -- not extension members
), cols as (
  select r.qn, a.attname, a.attnum, x.grantee, x.privilege_type
  from rel r join pg_attribute a on a.attrelid = r.oid and a.attnum > 0 and not a.attisdropped and a.attacl is not null,
       aclexplode(a.attacl) x
), lines as (
  select 1 o, r.qn k, 0 s, format('revoke all on %s %s from public, anon, authenticated, service_role;', r.kw, r.qn) l from rel r
  union all
  select 1, c.qn, 1, format('revoke all (%I) on table %s from public, anon, authenticated, service_role;', c.attname, c.qn)
  from (select distinct qn, attname from cols) c
  union all
  select 2, r.qn, 0, format('grant %s on %s %s to %s;', string_agg(lower(x.privilege_type), ', ' order by x.privilege_type), r.kw, r.qn,
                            case when x.grantee = 0 then 'public' else quote_ident(pg_get_userbyid(x.grantee)) end)
  from rel r, aclexplode(r.relacl) x where x.grantee <> r.relowner group by r.qn, r.kw, x.grantee
  union all
  select 3, c.qn, c.attnum, format('grant %s (%I) on table %s to %s;', string_agg(lower(c.privilege_type), ', ' order by c.privilege_type), c.attname, c.qn,
                                   case when c.grantee = 0 then 'public' else quote_ident(pg_get_userbyid(c.grantee)) end)
  from cols c group by c.qn, c.attname, c.attnum, c.grantee
  union all
  select 4, f.qn, 0, format('revoke all on %s %s from public, anon, authenticated, service_role;', case f.prokind when 'p' then 'procedure' else 'function' end, f.qn) from fn f
  union all
  select 5, f.qn, 0, format('grant %s on %s %s to %s;', string_agg(lower(x.privilege_type), ', ' order by x.privilege_type),
                            case f.prokind when 'p' then 'procedure' else 'function' end, f.qn,
                            case when x.grantee = 0 then 'public' else quote_ident(pg_get_userbyid(x.grantee)) end)
  from fn f, aclexplode(coalesce(f.proacl, acldefault('f', f.proowner))) x where x.grantee <> f.proowner group by f.qn, f.prokind, x.grantee
  union all
  select 6, '', 0, 'do $$ begin if not exists (select 1 from pg_publication where pubname = ''supabase_realtime'') then create publication supabase_realtime; end if; end $$;'
  where exists (select 1 from pg_publication where pubname = 'supabase_realtime')
  union all
  select 7, format('%I.%I', schemaname, tablename), 0,
         format('do $$ begin if not exists (select 1 from pg_publication_tables where pubname = ''supabase_realtime'' and schemaname = %L and tablename = %L) then alter publication supabase_realtime add table %I.%I; end if; end $$;',
                schemaname, tablename, schemaname, tablename)
  from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public'
)
select l from (select '-- privileges and realtime membership of schema public as in the source; apply after schema.sql' l, 0 o, '' k, 0 s
               union all select l, o, k, s from lines) z
order by o, k, s, l;
