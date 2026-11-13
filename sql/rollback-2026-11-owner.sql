-- Undo of 2026-11-owner.sql: anyone who sees a session may change it again; agents may correct any statistics row.
-- The confirmation column stays (harmless). The journal function of 2026-11-stability.sql may be re-run after this.
drop trigger if exists ruqya_appt_owner on public.appts;
drop function if exists public.ruqya_restore(bigint);
drop policy if exists ruqya_stat_edits_write on public.stat_edits;
create policy ruqya_stat_edits_write on public.stat_edits for all to authenticated
  using ((select public.ruqya_can_stats())) with check ((select public.ruqya_can_stats()));
select 'OK' as result;
