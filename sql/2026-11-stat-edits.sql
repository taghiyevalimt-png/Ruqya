-- Ruqyatz: sales agents and admins may correct the numbers in the weekly and monthly sales statistics.
-- A correction is stored next to the computed number (which stays untouched) and can be reset. Safe to run more than once.
-- Undo: rollback-2026-11-stat-edits.sql
create table if not exists public.stat_edits(
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('sales')),
  per text not null check (per in ('week','month')),
  period_start date not null check (period_start between '2020-01-01' and '2099-12-31'),
  agent_id text not null check (length(agent_id) between 1 and 64),
  col text not null check (col in ('a','b')),
  value integer not null check (value between 0 and 100000),
  updated_by uuid,
  updated_at timestamptz not null default now(),
  constraint stat_edits_uniq unique (kind, per, period_start, agent_id, col)
);
alter table public.stat_edits enable row level security;

create or replace function public.ruqya_can_stats() returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.ruqya_is_admin() or exists (select 1 from public.staff where id = auth.uid() and role = 'agent'), false) $$;
revoke all on function public.ruqya_can_stats() from public;
revoke execute on function public.ruqya_can_stats() from anon;
grant execute on function public.ruqya_can_stats() to authenticated;

-- who changed it is set by the server
create or replace function public.ruqya_stat_stamp() returns trigger language plpgsql set search_path = public as $$
begin new.updated_by := auth.uid(); new.updated_at := now(); return new; end $$;
revoke all on function public.ruqya_stat_stamp() from public;
drop trigger if exists ruqya_stat_stamp on public.stat_edits;
create trigger ruqya_stat_stamp before insert or update on public.stat_edits for each row execute function public.ruqya_stat_stamp();
drop trigger if exists ruqya_audit on public.stat_edits;
create trigger ruqya_audit after insert or update or delete on public.stat_edits for each row execute function public.ruqya_audit();

drop policy if exists "read stat edits" on public.stat_edits;
drop policy if exists ruqya_stat_edits_write on public.stat_edits;
drop policy if exists ruqya_no_anonymous on public.stat_edits;
create policy "read stat edits" on public.stat_edits for select to authenticated using (true);
create policy ruqya_stat_edits_write on public.stat_edits for all to authenticated
  using ((select public.ruqya_can_stats())) with check ((select public.ruqya_can_stats()));
create policy ruqya_no_anonymous on public.stat_edits as restrictive for all to authenticated
  using (coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false) = false)
  with check (coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false) = false);

revoke all on public.stat_edits from anon;
revoke truncate, trigger, references on public.stat_edits from authenticated;
grant select, insert, update, delete on public.stat_edits to authenticated;

-- other phones see a correction at once
do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'stat_edits') then
    alter publication supabase_realtime add table public.stat_edits;
  end if;
end $$;
