-- Ruqyatz: a colour for each specialist, chosen by any employee.
-- Safe to run more than once. Deletes nothing.

alter table public.readers add column if not exists color text;

-- Employees may change only the colour, nothing else about a specialist.
create or replace function public.ruqya_set_color(rid uuid, c text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then
    raise exception 'Daxil olmayib' using errcode = '42501';
  end if;
  if c is not null and c !~ '^#[0-9a-fA-F]{6}$' then
    raise exception 'Reng duzgun deyil' using errcode = '23514';
  end if;
  update public.readers set color = c where id = rid;
end $$;

revoke execute on function public.ruqya_set_color(uuid, text) from public, anon;
grant execute on function public.ruqya_set_color(uuid, text) to authenticated;

select 'Hazirdir' as netice;
