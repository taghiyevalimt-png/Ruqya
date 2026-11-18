-- Stability audit 2 (18.11): the errors of every phone in one place. Each signed-in person writes only his own
-- errors (message, short stack, app version, screen, browser), at most 100 an hour; only admins read and delete them.
-- No patient data is written by the app (only the error text). Safe to run again.
-- Rollback: sql/rollback-2026-11-app-errors.sql
create table if not exists public.app_errors (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  uid uuid default auth.uid(),
  v text check (v is null or length(v) <= 40),
  m text not null check (length(m) between 1 and 400),
  s text check (s is null or length(s) <= 600),
  tab text check (tab is null or length(tab) <= 20),
  ua text check (ua is null or length(ua) <= 200)
);
create index if not exists app_errors_at on public.app_errors (at desc);
alter table public.app_errors enable row level security;
revoke all on public.app_errors from public, anon, authenticated;
grant select, insert, delete on public.app_errors to authenticated;

-- at most 100 errors an hour from one person (a phone in a loop cannot fill the table)
create or replace function public.ruqya_err_ok() returns boolean
language sql stable security definer set search_path = public as $$
  select (select count(*) from public.app_errors where uid = auth.uid() and at > now() - interval '1 hour') < 100 $$;
revoke all on function public.ruqya_err_ok() from public, anon;
grant execute on function public.ruqya_err_ok() to authenticated;

drop policy if exists ruqya_err_insert on public.app_errors;
create policy ruqya_err_insert on public.app_errors for insert to authenticated
  with check (uid = auth.uid() and coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false) = false and (select public.ruqya_err_ok()));
drop policy if exists ruqya_err_admin_read on public.app_errors;
create policy ruqya_err_admin_read on public.app_errors for select to authenticated using ((select public.ruqya_is_admin()));
drop policy if exists ruqya_err_admin_delete on public.app_errors;
create policy ruqya_err_admin_delete on public.app_errors for delete to authenticated using ((select public.ruqya_is_admin()));
select 'OK' as result;
