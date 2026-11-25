// 24.11 (owner): «Bildirişlər» — off by default; a specialist turns on a reminder N minutes before his sessions and/or a
// notice when a session is booked for him. sql/2026-11-notify.sql on the copy database:
//  - off by default; only one's own settings; an agent has no column (linked false);
//  - the sender (ruqya_notify_due) works only with the cron secret, only as service_role; it gives each notice once,
//    only for the specialist's own column, not for his own bookings, not for cancelled ones, in his language;
//    a reminder only inside its window (N minutes before … +15 min), never after the session began;
//  - the Android poll (ruqya_notify_poll) answers with a device token only, with the same rules; a wrong token = gone;
//  - anon/agents cannot read others' settings or subscriptions; the rollback removes everything.
const fs = require("fs"), path = require("path");
const { start } = require("../localpg"), { build, as, U, R, upTo } = require("../dbcopy"), { check } = require("../lib");
module.exports = async () => {
  const pg = await start(54391); let c;
  try {
    c = await build(pg, "notify", { after: upTo("2026-11-notify.sql") });   // later migrations (report) are undone first by their own rollbacks
    const asCommit = async (who, sql, params) => { await c.query("begin"); try { await c.query("set local role authenticated");
      await c.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: U[who], role: "authenticated" })]); const r = await c.query(sql, params); await c.query("commit"); return r.rows; }
      catch (e) { await c.query("rollback"); throw e; } };
    const svc = async (sql, params) => { await c.query("begin"); try { await c.query("set local role service_role"); const r = await c.query(sql, params); await c.query("commit"); return { ok: true, rows: r.rows }; }
      catch (e) { await c.query("rollback"); return { ok: false, error: e.message }; } };
    await c.query("insert into private.notify_cfg (cron_secret, vapid_public, vapid_private) values ('s3cret', 'BPUB', 'PRIV')");
    const spec = (await c.query("select name, role from public.staff where id = $1", [U.spec])).rows[0];
    check(spec && spec.role === "specialist", "the copy has a specialist: " + JSON.stringify(spec));
    // default: off
    let g = (await as(c, "spec", "select public.ruqya_notify_get() g")).rows[0].g;
    check(g.remind_min === null && g.on_new === false && g.linked === true && g.vapid === "BPUB", "off by default, the specialist is linked to his column: " + JSON.stringify(g));
    g = (await as(c, "agentA", "select public.ruqya_notify_get() g")).rows[0].g;
    check(g.linked === false, "an agent has no column of his own");
    // a browser subscription and the settings
    await asCommit("spec", "select public.ruqya_push_sub('https://push.example/abc', $1, 'AAAAAAAAAAAAAAAAAAAAAA', 'test')", ["B" + "A".repeat(86)]);
    await asCommit("spec", "select public.ruqya_notify_set(30, true, 'az')");
    g = (await as(c, "spec", "select public.ruqya_notify_get() g")).rows[0].g;
    check(g.remind_min === 30 && g.on_new === true && +g.subs === 1, "saved: 30 min before, notice on new: " + JSON.stringify(g));
    check(!(await as(c, "spec", "select public.ruqya_notify_set(2, true)")).ok, "less than 5 minutes is refused");
    check((await as(c, "agentA", "select count(*) n from public.push_subs")).rows[0].n === "0", "others' subscriptions are not visible");
    check(!(await as(c, "anon", "select * from public.notify_prefs")).ok, "anon reads nothing");
    check(!(await as(c, "spec", "insert into public.push_subs (endpoint,user_id,p256dh,auth) values ('https://x', '" + U.agentA + "', '" + "B".repeat(87) + "', 'AAAAAAAAAAAAAAAAAAAAAA')")).ok, "no writing into the tables directly");
    // bookings: one by an agent in Əli's column (new), one in another column, one by the specialist himself, one cancelled,
    // one starting in 20 minutes (inside the 30-minute window), one in 3 hours (not yet)
    const now = "now() at time zone 'Asia/Baku'";
    const ins = async (rid, mins, by, st, nm) => c.query(`insert into public.appts (id, reader_id, date, time, duration, name, phone, price, share, status, note, service, place, created_by, created_at)
      values (gen_random_uuid(), $1, (${now} + make_interval(mins => $2))::date, to_char(${now} + make_interval(mins => $2), 'HH24:MI'), 30, $5, '050 111 22 33', 0, 0, $4, '', 'Ruqya', 'ofis', $3, now()) returning id`, [rid, mins, by, st, nm]);
    // the times must stay on the same Baku day and inside 08:00–24:00 for the rules — the session triggers run as owner
    await c.query("alter table public.appts disable trigger user");
    const a1 = (await ins(R.ali, 20, U.agentA, "wait", "Soon Patient")).rows[0].id;
    const a2 = (await ins(R.ali, 180, U.agentA, "wait", "Later Patient")).rows[0].id;
    await ins(R.ilkin, 20, U.agentA, "wait", "Other Column");
    await ins(R.ali, 25, U.spec, "wait", "Own Booking");
    await ins(R.ali, 22, U.agentA, "cancel", "Cancelled");
    await c.query("alter table public.appts enable trigger user");
    check(!(await svc("select public.ruqya_notify_due('wrong') d")).ok, "the sender refuses a wrong secret");
    check(!(await as(c, "spec", "select public.ruqya_notify_due('s3cret')")).ok, "a signed-in user cannot call the sender");
    let d = await svc("select public.ruqya_notify_due('s3cret') d");
    check(d.ok, "the sender answers with the secret: " + (d.error || ""));
    const m = d.ok ? d.rows[0].d.msgs : [];
    const bodies = m.map((x) => x.tag[0] + " " + x.body);
    check(m.length === 4 && m.every((x) => x.endpoint === "https://push.example/abc"), "four notices to his browser (2 new, 2 reminders): " + JSON.stringify(bodies));
    check(bodies.some((b) => /^n Sizə seans yazıldı: \d+ \S+, \d\d:\d\d — Soon Patient$/.test(b)) && bodies.some((b) => /^n .*Later Patient$/.test(b)), "new bookings, in Azerbaijani: " + JSON.stringify(bodies));
    check(bodies.some((b) => /^r 30 dəqiqə sonra seans: \d\d:\d\d — Soon Patient$/.test(b)), "the reminder for the session in 20 minutes: " + JSON.stringify(bodies));
    check(!bodies.some((b) => /Other Column|Cancelled/.test(b)) && !bodies.some((b) => /^n .*Own Booking/.test(b)) && bodies.some((b) => /^r .*Own Booking/.test(b)) && !bodies.some((b) => /^r .*Later/.test(b)),
      "not for another column nor a cancelled one; no «new» for his own booking (but its reminder, yes); no reminder too early");
    check(d.ok && d.rows[0].d.vapid.private === "PRIV", "the sender gets the keys");
    d = await svc("select public.ruqya_notify_due('s3cret') d");
    check(d.ok && d.rows[0].d.msgs.length === 0, "each notice only once");
    // Russian
    await asCommit("spec", "select public.ruqya_notify_set(60, false, 'ru')");
    // the Android poll
    const tok = (await asCommit("spec", "select public.ruqya_notify_device() t"))[0].t;
    let p = (await as(c, "anon", "select public.ruqya_notify_poll($1) p", [tok])).rows[0].p;
    check(p.remind_min === 60 && ["Soon Patient", "Later Patient", "Own Booking"].every((n) => p.upcoming.some((x) => x.text.endsWith(" — " + n))) && !p.upcoming.some((x) => /Other Column|Cancelled/.test(x.text)) && p.upcoming.every((x) => /^Через 1 ч сеанс: \d\d:\d\d — /.test(x.text) && x.at > Date.now()), "Android: his next sessions with their times, in Russian: " + JSON.stringify(p.upcoming));
    check(p.news.length === 0, "Android: no news when «on new» is off");
    p = (await as(c, "anon", "select public.ruqya_notify_poll('00000000-0000-4000-8000-000000000000') p")).rows[0].p;
    check(p.gone === true, "a wrong token gets nothing");
    // the rollback
    await c.query(fs.readFileSync(path.join(__dirname, "..", "..", "sql", "rollback-2026-11-notify.sql"), "utf8"));
    const left = (await c.query("select count(*) n from pg_proc where proname like 'ruqya_notify%' or proname like 'ruqya_push%'")).rows[0].n;
    const tabs = (await c.query("select count(*) n from pg_tables where tablename in ('notify_prefs','push_subs','notify_devices','notify_sent','notify_cfg')")).rows[0].n;
    check(left === "0" && tabs === "0", "the rollback removes the functions and tables: " + left + " " + tabs);
  } finally { if (c) await c.end().catch(() => {}); await pg.stop(); }
};
