-- Follow-up marks on cancelled bookings («Ləğv olunanlar»): 1 first reminder, 2 second reminder, 3 sold.
-- appts.follow (0-3, empty = 0). Anyone who sees a cancelled booking may set it (agents call the patients),
-- like the «Təsdiq aldı» tick; everything else of someone else's booking still only its writer and admins change.
-- The mark can only be set on a cancelled booking. Safe to run again. Rollback: sql/rollback-2026-11-follow.sql

alter table public.appts add column if not exists follow smallint default 0;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'ruqya_appts_follow') then
    alter table public.appts add constraint ruqya_appts_follow check (follow is null or follow between 0 and 3);
  end if;
end $$;

create or replace function public.ruqya_appt_owner() returns trigger
language plpgsql security definer set search_path = public as $$
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
end $$;
revoke all on function public.ruqya_appt_owner() from public, anon, authenticated;
select 'OK' as result;
