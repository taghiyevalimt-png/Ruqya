-- 25.11.2026: the evening report (sql/2026-11-report.sql) never reached a browser — the every-minute job called «notify»
-- only when somebody had reminders or new-booking alerts on; «report» alone did not count. Same job, the report counts too.
-- Rollback: sql/rollback-2026-11-notify-cron2.sql (the job as in sql/2026-11-notify-cron.sql).
do $$ begin
  perform cron.unschedule(jobid) from cron.job where jobname = 'ruqya-notify';
end $$;
select cron.schedule('ruqya-notify', '* * * * *', $job$
  select net.http_post(
    url := 'https://ldkhdeehrrajvgrtieal.supabase.co/functions/v1/notify',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-ruqya-cron', (select cron_secret from private.notify_cfg where id = 1)),
    body := '{}'::jsonb, timeout_milliseconds := 20000)
  where exists (select 1 from public.notify_prefs p join public.push_subs s on s.user_id = p.user_id where p.remind_min is not null or p.on_new or p.report)
    and exists (select 1 from private.notify_cfg where id = 1)
$job$);
