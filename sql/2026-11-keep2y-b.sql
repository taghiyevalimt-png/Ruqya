-- Mərkəz, 2026-11-14: the journal keeps at least 2 full years (also across 29 February); a deleted specialist column can be restored
-- (then its breaks can be restored too). Safe to run more than once.
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
    delete from public.audit_log where id in (select id from public.audit_log where at < now() - interval '2 years 1 day' order by id limit 2000);
  end if;
  return null;
end $$;
revoke all on function public.ruqya_audit() from public, anon, authenticated;
create or replace function public.ruqya_restore(aid bigint) returns text
language plpgsql security definer set search_path = public as $$
declare a public.audit_log; rec jsonb; ex boolean; iu uuid; iat timestamptz;
begin
  if not public.ruqya_is_admin() then raise exception 'Yalniz admin berpa edir' using errcode = '42501'; end if;
  select * into a from public.audit_log where id = aid;
  if a.id is null or a.op <> 'DELETE' or a.old is null then raise exception 'Berpa ucun qeyd yoxdur' using errcode = '22023'; end if;
  if a.tbl not in ('appts','expenses','product_sales','breaks','stat_edits','readers') then
    raise exception 'Bunu berpa etmek olmur' using errcode = '22023'; end if;
  rec := jsonb_build_object('id', a.row_id, 'created_at', now(), 'updated_at', now(), 'confirmed', false, 'settled', false,
           'share', 0, 'duration', 90, 'status', 'wait', 'note', '', 'phone', '', 'service', 'Ruqya') || a.old;
  -- rows deleted while the journal kept only part of them: the writer and time come from the journal's INSERT line
  if not (a.old ? 'created_by') then
    select uid, at into iu, iat from public.audit_log where tbl = a.tbl and row_id = a.row_id and op = 'INSERT' order by id limit 1;
    rec := rec || jsonb_strip_nulls(jsonb_build_object('created_by', iu, 'created_at', iat));
  end if;
  execute format('select exists(select 1 from public.%I where id::text = $1)', a.tbl) into ex using a.row_id;
  if ex then raise exception 'Artiq berpa olunub' using errcode = '23505'; end if;
  execute format('insert into public.%I select * from jsonb_populate_record(null::public.%I, $1)', a.tbl, a.tbl) using rec;
  return 'ok';
end $$;
revoke all on function public.ruqya_restore(bigint) from public, anon;
grant execute on function public.ruqya_restore(bigint) to authenticated;
select 'OK' as result;
