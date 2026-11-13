-- Puts back the table rights exactly as they were before sql/2026-11-audit.sql (only if that file causes a problem).
grant insert, update, delete, truncate, trigger, references on all tables in schema public to anon;
grant truncate, trigger, references on all tables in schema public to authenticated;
revoke truncate, trigger, references on public.audit_log from authenticated;
revoke all on public.audit_log from anon;
alter default privileges in schema public grant insert, update, delete, truncate, trigger, references on tables to anon;
alter default privileges in schema public grant truncate, trigger, references on tables to authenticated;
drop policy if exists "owner services" on public.services;
create policy "owner services" on public.services for all to authenticated
  using (auth.uid() = 'bad097d4-5edc-402b-ad59-f633252c35d9'::uuid)
  with check (auth.uid() = 'bad097d4-5edc-402b-ad59-f633252c35d9'::uuid);
