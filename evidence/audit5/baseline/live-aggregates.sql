with k as (select ruqya_pkey(phone,name) pk, lower(btrim(name)) nm from appts)
select json_build_object('appts',(select count(*) from appts),'pkeys',(select count(distinct pk) from k),'pkey_name_pairs',(select count(distinct (pk,nm)) from k),
 'pkeys_with_several_names',(select count(*) from (select pk from k group by pk having count(distinct nm)>1) x),
 'short_phone_rows',(select count(*) from appts where length(regexp_replace(coalesce(phone,''),'\D','','g'))<7),
 'sales',(select count(*) from product_sales),'sales_date_after_entry',(select count(*) from product_sales where date > (created_at at time zone 'Asia/Baku')::date),
 'sales_shift_days',(select json_agg(d order by d) from (select date - (created_at at time zone 'Asia/Baku')::date d from product_sales where date <> (created_at at time zone 'Asia/Baku')::date) x),
 'sales_no_names',(select count(*) from product_sales where coalesce(btrim(names),'')=''),
 'audit_ops',(select json_object_agg(tbl||':'||op,c) from (select tbl,op,count(*) c from audit_log group by 1,2) x),
 'appts_bad_reader',(select count(*) from appts a where not exists (select 1 from readers r where r.id=a.reader_id)),
 'appts_same_slot',(select count(*) from (select reader_id,date,time from appts where status<>'cancel' group by 1,2,3 having count(*)>1) x),
 'errors_recent',(select json_agg(m) from (select m from app_errors order by at desc limit 10) x));
