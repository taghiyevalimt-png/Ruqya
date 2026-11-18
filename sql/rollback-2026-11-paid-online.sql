-- Rollback of sql/2026-11-paid-online.sql: «settled» again only for the writer and the admins.
create or replace function public.ruqya_appt_owner() returns trigger
language plpgsql security definer set search_path to 'public' as $function$
declare me uuid := auth.uid();
begin
  if tg_op = 'UPDATE' and coalesce(new.follow, 0) is distinct from coalesce(old.follow, 0)
     and old.status not in ('cancel','noshow') and new.status not in ('cancel','noshow') then
    raise exception 'Xatirlatma yalniz legv olunana' using errcode = '42501';
  end if;
  if me is null or public.ruqya_is_admin() or old.created_by is not distinct from me then
    return case when tg_op = 'DELETE' then old else new end;
  end if;
  if tg_op = 'DELETE' then
    raise exception 'Yalniz yazan ve admin silir' using errcode = '42501';
  end if;
  if (to_jsonb(new) - array['confirmed','follow','updated_at','created_by','created_at'])
     is distinct from (to_jsonb(old) - array['confirmed','follow','updated_at','created_by','created_at']) then
    raise exception 'Yalniz yazan ve admin deyisir' using errcode = '42501';
  end if;
  if new.confirmed is distinct from old.confirmed
     and (old.status in ('cancel','noshow') or old.date < (now() at time zone 'Asia/Baku')::date - 1) then
    raise exception 'Bu qebulu tesdiqlemek olmur' using errcode = '42501';
  end if;
  return new;
end $function$;
select 'OK' as result;
