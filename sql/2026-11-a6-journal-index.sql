-- Audit 6, A6-04: «delete the patient's data» (ruqya_anonymize) looked for the patient's deleted bookings in the change
-- journal by computing the patient key of every deleted booking, and scrubbed the journal rows of those bookings
-- without an index on row_id: on a 10-year copy (3 000 000 journal rows) it took 14.8 s — longer than the 8 s a
-- signed-in request may run on Supabase, so it would have failed. Two partial indexes make both steps index reads.
-- Data is not changed. Safe to run again. Undo: rollback-2026-11-a6-journal-index.sql
create index if not exists audit_log_del_pkey on public.audit_log
  (public.ruqya_pkey(old ->> 'phone', old ->> 'name')) where tbl = 'appts' and op = 'DELETE';
create index if not exists audit_log_appts_row on public.audit_log (row_id) where tbl = 'appts';
select 'OK' as result;
