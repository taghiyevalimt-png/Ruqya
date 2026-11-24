-- Rollback of sql/2026-11-notify.sql (notifications). Stops the every-minute job first, if it exists.
do $$ begin
  if exists (select 1 from pg_namespace where nspname = 'cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'ruqya-notify';
  end if;
end $$;
drop function if exists public.ruqya_notify_get(), public.ruqya_notify_set(integer, boolean, text), public.ruqya_push_sub(text, text, text, text),
  public.ruqya_push_unsub(text), public.ruqya_notify_device(), public.ruqya_notify_poll(uuid), public.ruqya_notify_due(text),
  public.ruqya_push_gone(text, text[]), private.ruqya_readers_of(uuid), private.ruqya_appt_at(date, text),
  private.ruqya_notify_text("char", text, date, text, text, integer);
drop table if exists public.notify_prefs, public.push_subs, public.notify_devices, private.notify_sent, private.notify_cfg;
