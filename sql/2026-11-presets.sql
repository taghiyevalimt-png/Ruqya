-- Mərkəz (23.11): prices and lengths a NEW booking starts with, kept in the database instead of the app's code.
-- One row, id = 'presets'. value = {"price":130,"svc":{"Masaj":[60,80],…},"reader":{"<reader id>":[90,150]}}
--   price  — the price written in advance in every new booking
--   svc    — service name → [minutes or null, price or null]: put in when that service is picked
--   reader — specialist id → [minutes or null, price or null]: put in when that specialist is picked
-- Everybody with a role reads it; only admins change it (Ayarlar → Qiymətlər). The app falls back to its built-in
-- values while this table is missing or empty, so the order of publishing does not matter.
-- Safe to run again. Undo: rollback-2026-11-presets.sql
create table if not exists public.app_settings(
  id text primary key check (id in ('presets')),
  value jsonb not null check (jsonb_typeof(value) = 'object' and pg_column_size(value) <= 16000),
  updated_at timestamptz not null default now(),
  updated_by uuid default auth.uid()
);
alter table public.app_settings enable row level security;

drop trigger if exists ruqya_audit on public.app_settings;
create trigger ruqya_audit after insert or update or delete on public.app_settings for each row execute function public.ruqya_audit();
drop trigger if exists ruqya_zthrottle on public.app_settings;
create trigger ruqya_zthrottle after insert or update or delete on public.app_settings for each row execute function public.ruqya_throttle();

-- one policy per action (as audit 6), helpers from schema private
drop policy if exists ruqya_app_settings_select on public.app_settings;
create policy ruqya_app_settings_select on public.app_settings for select to authenticated
  using ((select private.ruqya_is_admin()) or (select private.ruqya_has_role()));
drop policy if exists ruqya_app_settings_insert on public.app_settings;
create policy ruqya_app_settings_insert on public.app_settings for insert to authenticated
  with check ((select private.ruqya_is_admin()));
drop policy if exists ruqya_app_settings_update on public.app_settings;
create policy ruqya_app_settings_update on public.app_settings for update to authenticated
  using ((select private.ruqya_is_admin())) with check ((select private.ruqya_is_admin()));
drop policy if exists ruqya_app_settings_delete on public.app_settings;
create policy ruqya_app_settings_delete on public.app_settings for delete to authenticated
  using ((select private.ruqya_is_admin()));
drop policy if exists ruqya_no_anonymous on public.app_settings;
create policy ruqya_no_anonymous on public.app_settings as restrictive for all to authenticated
  using (coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false) = false)
  with check (coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false) = false);

revoke all on public.app_settings from anon, public;
revoke all on public.app_settings from authenticated;
grant select, insert, update, delete on public.app_settings to authenticated;

-- the values the app had in its code until now (İlkin: 90 min, 150 ₼)
insert into public.app_settings(id, value)
select 'presets', jsonb_build_object(
  'price', 130,
  'svc', jsonb_build_object('Masaj', jsonb_build_array(60, 80), 'Hicama', jsonb_build_array(60, 40), 'Kombo', jsonb_build_array(60, 100)),
  'reader', coalesce((select jsonb_object_agg(r.id::text, jsonb_build_array(90, 150)) from public.readers r
                      where lower(replace(btrim(r.name), 'İ', 'i')) = 'ilkin' and not r.archived), '{}'::jsonb))
on conflict (id) do nothing;

do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'app_settings') then
    alter publication supabase_realtime add table public.app_settings;
  end if;
end $$;
select 'OK' as result;
