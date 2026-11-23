-- 24.11.2026: the app no longer asks for a price; new bookings are saved with price 0.
-- The rule «price > 0» on insert refused them (8 bookings on 23.11 after 23:10 Baku). Now: price >= 0.
CREATE OR REPLACE FUNCTION public.ruqya_appt_rules()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
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
  if (tg_op = 'INSERT' or new.service is distinct from old.service)
     and coalesce(new.service, '') not in ('Ruqya','Hicama','Kombo','Masaj','Dr.Günel','Psixoloq') then
    raise exception 'Qayda: xidmet' using errcode = '23514'; end if;
  if tg_op = 'INSERT' or new.price is distinct from old.price then
    -- 23.11 late evening: no price in the booking form any more (owner: «qiymət lazım deyil»); a new booking has price 0
    if new.price is null or new.price < 0 then raise exception 'Qayda: qiymet' using errcode = '23514'; end if;
  end if;
  if tg_op = 'INSERT' or new.time::text is distinct from old.time::text or new.duration is distinct from old.duration then
    d := coalesce(new.duration, 90);
    s := split_part(new.time::text, ':', 1)::int * 60 + split_part(new.time::text, ':', 2)::int;
    if d < 30 or d > 180 then raise exception 'Qayda: muddet' using errcode = '23514'; end if;
    if s < 480 or s + d > 1440 then raise exception 'Qayda: saat' using errcode = '23514'; end if;
  end if;
  return new;
end $function$;
