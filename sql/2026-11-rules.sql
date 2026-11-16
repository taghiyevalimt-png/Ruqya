-- The database holds the same booking rules as the app's form (audit: "the database accepts what the form forbids").
-- Checked only for what is new or changed, so old bookings made under older rules can still be ticked as confirmed
-- or edited in other fields. Server-side functions (restore, anonymize) run as the owner and are not checked here.
-- Rules: patient name not empty; phone 9-15 digits; price above 0; length 30-180 min; within 08:00-24:00.
-- Safe to run again. Rollback: sql/rollback-2026-11-rules.sql

create or replace function public.ruqya_appt_rules() returns trigger
language plpgsql set search_path = public as $$
declare s int; d int; nd int;
begin
  if current_user not in ('authenticated', 'anon') then return new; end if;
  if tg_op = 'INSERT' or new.name is distinct from old.name then
    if btrim(coalesce(new.name, '')) = '' then raise exception 'Qayda: ad bos' using errcode = '23514'; end if;
  end if;
  if tg_op = 'INSERT' or new.phone is distinct from old.phone then
    nd := length(regexp_replace(coalesce(new.phone, ''), '\D', '', 'g'));
    if nd < 9 or nd > 15 then raise exception 'Qayda: telefon' using errcode = '23514'; end if;
  end if;
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
revoke all on function public.ruqya_appt_rules() from public, anon, authenticated;
drop trigger if exists ruqya_appt_rules on public.appts;
create trigger ruqya_appt_rules before insert or update on public.appts for each row execute function public.ruqya_appt_rules();
select 'OK' as result;
