-- Rollback of 2026-11-service.sql: the booking rules as before (no check of the service).
create or replace function public.ruqya_appt_rules() returns trigger
language plpgsql set search_path = public as $$
declare s int; d int;
begin
  if current_user not in ('authenticated', 'anon') then return new; end if;
  if tg_op = 'INSERT' or new.name is distinct from old.name then
    if btrim(coalesce(new.name, '')) = '' then raise exception 'Qayda: ad bos' using errcode = '23514'; end if;
  end if;
  if (tg_op = 'INSERT' or new.phone is distinct from old.phone) and btrim(coalesce(new.phone, '')) = ''
     and new.name is distinct from 'Anonim' then
    raise exception 'Qayda: telefon' using errcode = '23514'; end if;
  if (tg_op = 'INSERT' or new.place is distinct from old.place) and coalesce(new.place, '') not in ('ofis','onlayn','unvan') then
    raise exception 'Qayda: yer' using errcode = '23514'; end if;
  if tg_op = 'INSERT' or new.price is distinct from old.price then
    if new.price is null or new.price <= 0 then raise exception 'Qayda: qiymet' using errcode = '23514'; end if;
  end if;
  if tg_op = 'INSERT' or new.time::text is distinct from old.time::text or new.duration is distinct from old.duration then
    d := coalesce(new.duration, 90);
    s := split_part(new.time::text, ':', 1)::int * 60 + split_part(new.time::text, ':', 2)::int;
    if d < 30 or d > 180 then raise exception 'Qayda: muddet' using errcode = '23514'; end if;
    if s < 480 or s + d > 1440 then raise exception 'Qayda: saat' using errcode = '23514'; end if;
  end if;
  return new;
end $$;

select 'OK' as result;
