-- Ruqyatz, audit 2026-11-13: tighter table rights. Safe to run more than once. Changes no data.
-- 1) Visitors who are not signed in (anon) may not change anything, even in theory. Reading stays allowed
--    because every table's row rules already return nothing to them (the weekly keep-alive check uses it).
-- 2) Nobody using the app may TRUNCATE (empty a table in one go: row rules do not apply to it),
--    create triggers on, or reference the tables. The app never does any of this.
-- 3) The same for tables created later.
-- 4) The services rule asks for the user's id once per query instead of once per row.
revoke insert, update, delete, truncate, trigger, references on all tables in schema public from anon;
revoke truncate, trigger, references on all tables in schema public from authenticated;
alter default privileges in schema public revoke insert, update, delete, truncate, trigger, references on tables from anon;
alter default privileges in schema public revoke truncate, trigger, references on tables from authenticated;
drop policy if exists "owner services" on public.services;
create policy "owner services" on public.services for all to authenticated
  using ((select auth.uid()) = 'bad097d4-5edc-402b-ad59-f633252c35d9'::uuid)
  with check ((select auth.uid()) = 'bad097d4-5edc-402b-ad59-f633252c35d9'::uuid);
