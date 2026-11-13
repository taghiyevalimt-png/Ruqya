-- Undo 2026-11-breaks-agents.sql: only admins change breaks again.
drop policy if exists ruqya_breaks_staff on public.breaks;
drop policy if exists ruqya_breaks_admin on public.breaks;
create policy ruqya_breaks_admin on public.breaks for all to authenticated using ((select public.ruqya_is_admin())) with check ((select public.ruqya_is_admin()));
drop function if exists public.ruqya_can_breaks();
