-- Rollback of 2026-11-follow.sql: removes the follow-up marks and restores the earlier owner rule.
create or replace function public.ruqya_appt_owner() returns trigger
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid();
begin
  if me is null or public.ruqya_is_admin() or old.created_by is not distinct from me then
    return case when tg_op = 'DELETE' then old else new end;
  end if;
  if tg_op = 'DELETE' then
    raise exception 'Yalniz yazan ve admin silir' using errcode = '42501';
  end if;
  if (to_jsonb(new) - array['confirmed','updated_at','created_by','created_at'])
     is distinct from (to_jsonb(old) - array['confirmed','updated_at','created_by','created_at']) then
    raise exception 'Yalniz yazan ve admin deyisir' using errcode = '42501';
  end if;
  if new.confirmed is distinct from old.confirmed
     and (old.status in ('cancel','noshow') or old.date < (now() at time zone 'Asia/Baku')::date - 1) then
    raise exception 'Bu qebulu tesdiqlemek olmur' using errcode = '42501';
  end if;
  return new;
end $$;
revoke all on function public.ruqya_appt_owner() from public, anon, authenticated;
alter table public.appts drop constraint if exists ruqya_appts_follow;
alter table public.appts drop column if exists follow;
select 'OK' as result;
