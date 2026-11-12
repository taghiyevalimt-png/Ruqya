-- Ruqyatz: any admin (not only the main admin) can give or take back the admin role.
-- The main admin's own role can never be changed. A new user can never make himself admin.
create or replace function public.ruqya_staff_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or auth.uid() = 'bad097d4-5edc-402b-ad59-f633252c35d9'::uuid then
    return new;
  end if;
  if tg_op = 'INSERT' then
    if new.role = 'admin' and not public.ruqya_is_admin() then new.role := 'agent'; end if;
  elsif new.role is distinct from old.role then
    if old.id = 'bad097d4-5edc-402b-ad59-f633252c35d9'::uuid then
      new.role := old.role;
    elsif (new.role = 'admin' or old.role = 'admin') and not public.ruqya_is_admin() then
      new.role := old.role;
    elsif old.id = auth.uid() and old.role = 'admin' then
      new.role := old.role;   -- an admin cannot remove his own admin role by mistake
    end if;
  end if;
  return new;
end $$;
