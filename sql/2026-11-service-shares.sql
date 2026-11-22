-- Mərkəz (owner 22.11): a specialist's percent of each service («İlkin: Ruqya 50%, Hicama 30%»). «Pul» in Statistika
-- shows what each service earned and what stays with the specialist and with the centre. Admins only (like «Pul»).
-- Safe to run again. Undo: rollback-2026-11-service-shares.sql
create table if not exists public.service_shares(
  reader_id uuid not null references public.readers(id) on delete cascade,
  service text not null check (char_length(service) between 1 and 100),
  pct numeric not null check (pct > 0 and pct <= 100),
  updated_at timestamptz not null default now(),
  primary key (reader_id, service)
);
alter table public.service_shares enable row level security;
drop trigger if exists ruqya_zthrottle on public.service_shares;
create trigger ruqya_zthrottle after insert or update or delete on public.service_shares for each row execute function public.ruqya_throttle();
drop policy if exists ruqya_sshares_admin on public.service_shares;
drop policy if exists ruqya_no_anonymous on public.service_shares;
create policy ruqya_sshares_admin on public.service_shares for all to authenticated
  using ((select public.ruqya_is_admin())) with check ((select public.ruqya_is_admin()));
create policy ruqya_no_anonymous on public.service_shares as restrictive for all to authenticated
  using (coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false) = false)
  with check (coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false) = false);
revoke all on public.service_shares from anon;
revoke truncate, trigger, references on public.service_shares from authenticated;
grant select, insert, update, delete on public.service_shares to authenticated;
do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'service_shares') then
    alter publication supabase_realtime add table public.service_shares;
  end if;
end $$;
select 'OK' as result;
