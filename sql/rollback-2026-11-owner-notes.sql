-- Rollback of sql/2026-11-owner-notes.sql: back to breaks every day for admins and agents only, and no hidden
-- agents. The breaks limited to some days become every-day breaks again (their days and dates are dropped).
drop policy if exists ruqya_breaks_specialist on public.breaks;
alter table public.breaks drop constraint if exists breaks_days_ok;
alter table public.breaks drop constraint if exists breaks_dates_ok;
alter table public.breaks drop column if exists days;
alter table public.breaks drop column if exists date_from;
alter table public.breaks drop column if exists date_to;
create or replace function public.ruqya_staff_guard() returns trigger
language plpgsql security definer set search_path to 'public' as $function$
declare owner uuid := 'bad097d4-5edc-402b-ad59-f633252c35d9'::uuid; adm boolean;
begin
  if new.name is not null and (tg_op = 'INSERT' or new.name is distinct from old.name) then
    new.name := btrim(regexp_replace(normalize(new.name, NFC), '[[:space:]  ᠎ -‏ -  -⁤　﻿]+', ' ', 'g'));
    if new.name = '' then raise exception 'Adi yazin' using errcode = '23514'; end if;
  end if;
  if auth.uid() is null or auth.uid() = owner then return new; end if;
  adm := public.ruqya_is_admin();
  if tg_op = 'UPDATE' then
    if new.id is distinct from old.id then raise exception 'Hesab nomresi deyismir' using errcode = '42501'; end if;
    if old.id = owner and (new.name is distinct from old.name or new.role is distinct from old.role) then
      raise exception 'Esas adminin melumati deyismir' using errcode = '42501'; end if;
  end if;
  if new.name is not null and (tg_op = 'INSERT' or new.name is distinct from old.name
                              or new.role is distinct from old.role or new.want is distinct from old.want)
     and exists (select 1 from public.staff s where s.id <> new.id and lower(btrim(s.name)) = lower(new.name)
                 and not (coalesce(new.role, new.want, '') = 'specialist' and coalesce(s.role, '') = 'specialist')) then
    raise exception 'Bu ad artiq var' using errcode = '23505';
  end if;
  if tg_op = 'INSERT' then
    if not adm then new.role := null; end if;
  else
    if new.role is distinct from old.role then
      if not adm then raise exception 'Rolu admin deyisir' using errcode = '42501';
      elsif old.id = auth.uid() and old.role = 'admin' then new.role := old.role; end if;
    end if;
    if not adm and old.role = 'specialist' and new.name is distinct from old.name then
      raise exception 'Mutexessisin adini admin deyisir' using errcode = '42501'; end if;
  end if;
  return new;
end $function$;
alter table public.staff drop column if exists hide_stats;
select 'OK' as result;
