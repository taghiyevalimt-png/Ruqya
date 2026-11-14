-- Mərkəz, 2026-11-14: only admins change the colours of the specialists. Safe to run more than once.
-- Undo: copy only the ruqya_set_color block from 2026-11-stability.sql and run it (colours for everyone with a role).
create or replace function public.ruqya_set_color(rid uuid, c text) returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.ruqya_is_admin() then raise exception 'Rengi admin deyisir' using errcode = '42501'; end if;
  if c is not null and c !~ '^#[0-9a-fA-F]{6}$' then raise exception 'Reng duzgun deyil' using errcode = '23514'; end if;
  update public.readers set color = c where id = rid and color is distinct from c;
end $$;
revoke all on function public.ruqya_set_color(uuid,text) from public, anon;
grant execute on function public.ruqya_set_color(uuid,text) to authenticated;
select 'OK' as result;
