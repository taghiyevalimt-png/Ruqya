-- Ruqyatz: sales agents may add and delete breaks (prayer, meal) too, like admins. Safe to run more than once.
-- Specialists still only see them. Undo: rollback-2026-11-breaks-agents.sql.
create or replace function public.ruqya_can_breaks() returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.ruqya_is_admin() or exists (select 1 from public.staff where id = auth.uid() and role = 'agent'), false) $$;
revoke all on function public.ruqya_can_breaks() from public;
grant execute on function public.ruqya_can_breaks() to authenticated;
drop policy if exists ruqya_breaks_admin on public.breaks;
drop policy if exists ruqya_breaks_staff on public.breaks;
create policy ruqya_breaks_staff on public.breaks for all to authenticated
  using ((select public.ruqya_can_breaks())) with check ((select public.ruqya_can_breaks()));
