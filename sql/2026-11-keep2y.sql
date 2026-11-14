-- SUPERSEDED: already applied in production. Do NOT run again — later files (stability, owner, hardening, keep2y, keep2y-b,
-- colors-admin, limits) replaced parts of it, and re-running would bring old rules back.
-- Mərkəz, 2026-11-14: management order — keep everything 2 years. The only automatic deletion in the database is
-- the change journal (it held 365 days); now it keeps 730 days. Sessions, statistics, Kassa, staff are never deleted automatically.
-- Undo: run this file again with '365 days' instead of '730 days'.
create or replace function public.ruqya_audit() returns trigger
language plpgsql security definer set search_path = public as $$
declare o jsonb; n jsonb; ctx text[]; k text; od jsonb := '{}'; nd jsonb := '{}';
  skip constant text[] := array['updated_at','created_at','created_by','updated_by','id'];
begin
  if tg_op = 'INSERT' then
    insert into public.audit_log (uid, tbl, op, row_id, new) values (auth.uid(), tg_table_name, tg_op, new.id::text, to_jsonb(new) - skip);
  elsif tg_op = 'DELETE' then
    insert into public.audit_log (uid, tbl, op, row_id, old) values (auth.uid(), tg_table_name, tg_op, old.id::text, to_jsonb(old));
  else
    o := to_jsonb(old) - skip; n := to_jsonb(new) - skip;
    if o is distinct from n then
      ctx := case tg_table_name
        when 'appts' then array['name','date']
        when 'expenses' then array['title','amount']
        when 'product_sales' then array['amount','date','names']
        when 'readers' then array['name','archived','color']
        when 'staff' then array['name','role']
        when 'breaks' then array['title','start_time','end_time','reader_id']
        when 'stat_edits' then array['agent_id','col','per','period_start','value']
        else array[]::text[] end;
      for k in select key from jsonb_each(n) loop
        if (o -> k) is distinct from (n -> k) or k = any(ctx) then
          od := od || jsonb_build_object(k, o -> k); nd := nd || jsonb_build_object(k, n -> k);
        end if;
      end loop;
      insert into public.audit_log (uid, tbl, op, row_id, old, new) values (auth.uid(), tg_table_name, tg_op, new.id::text, od, nd);
    end if;
  end if;
  if random() < 0.005 then
    delete from public.audit_log where id in (select id from public.audit_log where at < now() - interval '730 days' order by id limit 2000);
  end if;
  return null;
end $$;
revoke all on function public.ruqya_audit() from public, anon, authenticated;
select 'OK' as result;
