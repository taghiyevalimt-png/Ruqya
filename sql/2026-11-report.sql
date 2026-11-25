-- Mərkəz (24.11, owner — wave 3): «Axşam hesabatı» — at 22:00 Baku time an admin who turned it on gets a notice with the
-- day: written («Yazdı»: by the day the booking was written, cancelled ones too, not the specialists' own — as «Bu gün»
-- in Statistika), sessions of the day not cancelled, cancelled («Ləğv» / «Gəlmədi») by the day of the session, and the
-- products sold that day (pieces, money). Off by default (notify_prefs.report). Delivered like the other notices: Web
-- Push (Edge Function «notify» every minute, ruqya_notify_due) and the Android app's poll (ruqya_notify_poll).
-- Safe to run again. Undo: rollback-2026-11-report.sql (the functions as in 2026-11-notify.sql, the column dropped).
alter table public.notify_prefs add column if not exists report boolean not null default false;

-- «now» of the report (a function, so the test database can put the clock at 22:00)
create or replace function private.ruqya_now() returns timestamptz language sql stable set search_path to '' as $$ select now() $$;
revoke all on function private.ruqya_now() from public, anon, authenticated;

create or replace function private.ruqya_admin_id(uid uuid)
 returns boolean language sql stable security definer set search_path to ''
as $$ select coalesce(uid = 'bad097d4-5edc-402b-ad59-f633252c35d9'::uuid or exists (select 1 from public.staff s where s.id = uid and s.role = 'admin'), false) $$;
revoke all on function private.ruqya_admin_id(uuid) from public, anon, authenticated;

create or replace function private.ruqya_day_report(lang text, d date)
 returns text language plpgsql stable security definer set search_path to ''
as $$
declare w int; n int; x int; q int; m numeric; ms text;
begin
  select count(*) into w from public.appts a
   where (a.created_at at time zone 'Asia/Baku')::date = d and a.date >= d
     and not exists (select 1 from public.staff s where s.id = a.created_by and s.role = 'specialist');
  select count(*) filter (where a.status not in ('cancel','noshow') or (a.status = 'cancel' and coalesce(a.follow, 0) >= 3)),
         count(*) filter (where a.status = 'noshow' or (a.status = 'cancel' and coalesce(a.follow, 0) < 3))
    into n, x from public.appts a where a.date = d;
  select coalesce(sum(coalesce(ps.qty, 1)), 0), coalesce(sum(ps.amount), 0) into q, m from public.product_sales ps where ps.date = d;
  ms := case when round(m, 2) = trunc(m) then trunc(m)::text else rtrim(round(m, 2)::text, '0') end;
  if lang = 'ru' then
    return 'Отчёт за ' || extract(day from d)::int || ' ' || (array['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'])[extract(month from d)::int]
      || ': записано ' || w || ', сеансов ' || n || ', отмен ' || x || ', продажи ' || q || ' шт. — ' || ms || ' ₼';
  end if;
  return extract(day from d)::int || ' ' || (array['yanvar','fevral','mart','aprel','may','iyun','iyul','avqust','sentyabr','oktyabr','noyabr','dekabr'])[extract(month from d)::int]
    || ' hesabatı: yazıldı ' || w || ', seans ' || n || ', ləğv ' || x || ', satış ' || q || ' ədəd — ' || ms || ' ₼';
end $$;
revoke all on function private.ruqya_day_report(text, date) from public, anon, authenticated;

-- an admin turns the evening report on or off for himself
create or replace function public.ruqya_notify_report(p_on boolean, p_lang text default 'az')
 returns void language plpgsql security definer set search_path to ''
as $$
begin
  if auth.uid() is null or not private.ruqya_admin_id(auth.uid()) then raise exception 'Yalniz admin' using errcode = '42501'; end if;
  insert into public.notify_prefs as p (user_id, report, lang, updated_at)
  values (auth.uid(), coalesce(p_on, false), case when p_lang = 'ru' then 'ru' else 'az' end, now())
  on conflict (user_id) do update set report = excluded.report, lang = excluded.lang, updated_at = now();
end $$;

create or replace function public.ruqya_notify_get()
 returns jsonb language sql stable security definer set search_path to ''
as $$
  select jsonb_build_object(
    'remind_min', p.remind_min, 'on_new', coalesce(p.on_new, false), 'report', coalesce(p.report, false),
    'admin', private.ruqya_admin_id(auth.uid()),
    'linked', exists (select 1 from private.ruqya_readers_of(auth.uid())),
    'vapid', (select c.vapid_public from private.notify_cfg c where c.id = 1),
    'subs', (select count(*) from public.push_subs s where s.user_id = auth.uid()))
  from (select 1) x left join public.notify_prefs p on p.user_id = auth.uid()
$$;

create or replace function public.ruqya_notify_poll(p_token uuid)
 returns jsonb language plpgsql security definer set search_path to ''
as $$
declare dv public.notify_devices; p public.notify_prefs; since timestamptz; up jsonb := '[]'; nw jsonb := '[]'; bd date := (private.ruqya_now() at time zone 'Asia/Baku')::date; rid uuid;
begin
  select * into dv from public.notify_devices where token = p_token;
  if not found then return jsonb_build_object('gone', true); end if;
  select * into p from public.notify_prefs where user_id = dv.user_id;
  if found and p.remind_min is not null then
    select coalesce(jsonb_agg(jsonb_build_object('id', a.id, 'at', (extract(epoch from private.ruqya_appt_at(a.date, a.time)) * 1000)::bigint,
        'text', private.ruqya_notify_text('r', p.lang, a.date, a.time, a.name, p.remind_min)) order by a.date, a.time), '[]')
      into up from public.appts a
     where a.reader_id in (select private.ruqya_readers_of(dv.user_id)) and a.status <> 'cancel'
       and a.date between (now() at time zone 'Asia/Baku')::date and (now() at time zone 'Asia/Baku')::date + 2
       and private.ruqya_appt_at(a.date, a.time) > now();
  end if;
  if found and p.on_new then
    since := greatest(coalesce(dv.last_poll, now() - interval '20 minutes'), coalesce(p.new_since, now()), now() - interval '1 day');
    select coalesce(jsonb_agg(jsonb_build_object('id', a.id, 'text', private.ruqya_notify_text('n', p.lang, a.date, a.time, a.name, 0)) order by a.created_at), '[]')
      into nw from public.appts a
     where a.reader_id in (select private.ruqya_readers_of(dv.user_id)) and a.status <> 'cancel'
       and a.created_at > since and a.created_by is distinct from dv.user_id
       and a.date >= (now() at time zone 'Asia/Baku')::date;
  end if;
  -- 24.11 wave 3: the evening report (admins who turned it on), from 22:00 Baku time, once per day on this user's phones
  if found and p.report and private.ruqya_admin_id(dv.user_id) and (private.ruqya_now() at time zone 'Asia/Baku')::time >= time '22:00' then
    rid := md5('report:' || bd::text)::uuid;
    insert into private.notify_sent (user_id, appt_id, kind) values (dv.user_id, rid, 'D') on conflict do nothing;
    if found then nw := nw || jsonb_build_array(jsonb_build_object('id', rid, 'text', private.ruqya_day_report(p.lang, bd))); end if;
  end if;
  update public.notify_devices set last_poll = now() where token = p_token;
  return jsonb_build_object('remind_min', p.remind_min, 'on_new', coalesce(p.on_new, false) or coalesce(p.report, false), 'upcoming', up, 'news', nw);   -- on_new keeps the app polling for the report
end $$;

create or replace function public.ruqya_notify_due(p_secret text)
 returns jsonb language plpgsql security definer set search_path to ''
as $$
declare c private.notify_cfg; msgs jsonb;
begin
  select * into c from private.notify_cfg where id = 1;
  if c.cron_secret is null or p_secret is distinct from c.cron_secret then raise exception 'denied' using errcode = '42501'; end if;
  delete from private.notify_sent where at < now() - interval '14 days';
  with prefs as (
    select p.* from public.notify_prefs p
     where (p.remind_min is not null or p.on_new or p.report) and exists (select 1 from public.push_subs s where s.user_id = p.user_id)
  ), due as (
    select p.user_id, a.id appt_id, 'n'::"char" kind, private.ruqya_notify_text('n', p.lang, a.date, a.time, a.name, 0) body
      from prefs p join public.appts a on a.reader_id in (select private.ruqya_readers_of(p.user_id))
     where p.on_new and a.status <> 'cancel' and a.created_by is distinct from p.user_id
       and a.created_at > greatest(p.new_since, now() - interval '1 hour')
       and a.date >= (now() at time zone 'Asia/Baku')::date
    union all
    select p.user_id, a.id, 'r'::"char", private.ruqya_notify_text('r', p.lang, a.date, a.time, a.name, p.remind_min)
      from prefs p join public.appts a on a.reader_id in (select private.ruqya_readers_of(p.user_id))
     where p.remind_min is not null and a.status <> 'cancel'
       and a.date between (now() at time zone 'Asia/Baku')::date and (now() at time zone 'Asia/Baku')::date + 2
       and now() >= private.ruqya_appt_at(a.date, a.time) - make_interval(mins => p.remind_min)
       and now() <  least(private.ruqya_appt_at(a.date, a.time), private.ruqya_appt_at(a.date, a.time) - make_interval(mins => p.remind_min) + interval '15 minutes')
    union all
    -- 24.11 wave 3: the evening report at 22:00 Baku time (admins who turned it on), once a day
    select p.user_id, md5('report:' || ((private.ruqya_now() at time zone 'Asia/Baku')::date)::text)::uuid, 'd'::"char",
           private.ruqya_day_report(p.lang, (private.ruqya_now() at time zone 'Asia/Baku')::date)
      from prefs p
     where p.report and private.ruqya_admin_id(p.user_id)
       and (private.ruqya_now() at time zone 'Asia/Baku')::time >= time '22:00' and (private.ruqya_now() at time zone 'Asia/Baku')::time < time '22:30'
  ), claimed as (
    insert into private.notify_sent (user_id, appt_id, kind) select user_id, appt_id, kind from due
    on conflict do nothing returning user_id, appt_id, kind
  )
  select coalesce(jsonb_agg(jsonb_build_object('endpoint', s.endpoint, 'p256dh', s.p256dh, 'auth', s.auth,
           'title', 'Mərkəz', 'body', d.body, 'tag', d.kind::text || ':' || d.appt_id::text)), '[]')
    into msgs
    from claimed k join due d on d.user_id = k.user_id and d.appt_id = k.appt_id and d.kind = k.kind
    join public.push_subs s on s.user_id = k.user_id;
  return jsonb_build_object('vapid', jsonb_build_object('public', c.vapid_public, 'private', c.vapid_private, 'subject', c.vapid_subject), 'msgs', msgs);
end $$;

revoke all on function public.ruqya_notify_report(boolean, text) from public, anon, authenticated;
grant execute on function public.ruqya_notify_report(boolean, text) to authenticated;
revoke all on function public.ruqya_notify_get(), public.ruqya_notify_poll(uuid), public.ruqya_notify_due(text) from public, anon, authenticated;
grant execute on function public.ruqya_notify_get() to authenticated;
grant execute on function public.ruqya_notify_poll(uuid) to anon, authenticated;
grant execute on function public.ruqya_notify_due(text) to service_role;
select 'OK' as result;
