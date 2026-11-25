// 24.11 wave 3 — «Axşam hesabatı» (sql/2026-11-report.sql) on the copy database, the clock put at 21:59 / 22:05 Baku:
//  off by default; only an admin can turn it on (an agent is refused); the text counts like «Bu gün» (written that day
//  for that day or later, cancelled too, not the specialists' own; sessions not cancelled; cancelled; products);
//  sent once at 22:00 (Web Push via ruqya_notify_due), not at 21:59; the Android poll gets it once too and keeps
//  polling when only the report is on; ruqya_notify_get tells «admin» and «report»; the rollback restores it all.
const fs = require("fs"), path = require("path");
const { start } = require("../localpg"), { build, as, U, R } = require("../dbcopy"), { check } = require("../lib");
module.exports = async () => {
  const pg = await start(54394); let c;
  try {
    c = await build(pg, "report");
    const clock = (hm) => c.query(`create or replace function private.ruqya_now() returns timestamptz language sql stable set search_path to '' as $$ select ((now() at time zone 'Asia/Baku')::date + time '${hm}') at time zone 'Asia/Baku' $$`);
    const commit = async (who, sql, params) => { await c.query("begin"); try { await c.query("set local role authenticated");
      await c.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: U[who], role: "authenticated" })]); const r = await c.query(sql, params); await c.query("commit"); return { ok: true, rows: r.rows }; }
      catch (e) { await c.query("rollback"); return { ok: false, error: e.message }; } };
    const svc = async (sql) => { await c.query("begin"); try { await c.query("set local role service_role"); const r = await c.query(sql); await c.query("commit"); return r.rows; } catch (e) { await c.query("rollback"); throw e; } };
    await c.query("insert into private.notify_cfg (cron_secret, vapid_public, vapid_private) values ('s3cret', 'BPUB', 'PRIV')");
    // today's data (Baku): written today by agents: 2 for today (one cancelled later), 1 for tomorrow; one by the specialist
    await c.query("set session_replication_role = replica");
    const bd = "(now() at time zone 'Asia/Baku')::date";
    const ins = `insert into public.appts (id, reader_id, date, time, duration, name, phone, price, share, status, note, created_by, created_at) values (gen_random_uuid(), $1, ${bd} + $2::int, $5, 60, 'P', '050 000 11 22', 0, 0, $3, '', $4, now())`;
    await c.query("delete from public.appts"); await c.query("delete from public.product_sales");
    await c.query(ins, [R.ali, 0, "wait", U.agentA, "09:00"]); await c.query(ins, [R.ali, 0, "cancel", U.agentA, "11:00"]); await c.query(ins, [R.ilkin, 1, "wait", U.agentB, "12:00"]);
    await c.query(ins, [R.ali, 0, "wait", U.spec, "14:00"]);
    await c.query(`insert into public.product_sales (id, date, amount, qty, names, created_by) values (gen_random_uuid(), ${bd}, 12.5, 2, 'Yağ', $1), (gen_random_uuid(), ${bd}, 30, 1, 'Bal', $1)`, [U.agentB]);
    await c.query("set session_replication_role = origin");
    const txt = (await c.query(`select private.ruqya_day_report('az', ${bd}) t, private.ruqya_day_report('ru', ${bd}) r`)).rows[0];
    check(/hesabatı: yazıldı 3, seans 2, ləğv 1, satış 3 ədəd — 42\.5 ₼$/.test(txt.t), "the text (az): " + txt.t);
    check(/^Отчёт за \d+ \S+: записано 3, сеансов 2, отмен 1, продажи 3 шт\. — 42\.5 ₼$/.test(txt.r), "the text (ru): " + txt.r);
    // settings
    let g = (await as(c, "owner", "select public.ruqya_notify_get() g")).rows[0].g;
    check(g.report === false && g.admin === true, "off by default; the owner is an admin: " + JSON.stringify(g));
    check((await as(c, "agentA", "select public.ruqya_notify_get() g")).rows[0].g.admin === false, "an agent is not");
    const ag = await commit("agentA", "select public.ruqya_notify_report(true, 'az')");
    check(!ag.ok && /admin/i.test(ag.error), "an agent cannot turn it on: " + JSON.stringify(ag));
    check((await commit("owner", "select public.ruqya_notify_report(true, 'az')")).ok, "the owner turns it on");
    await commit("owner", "select public.ruqya_push_sub('https://push.example/own', $1, 'AAAAAAAAAAAAAAAAAAAAAA', 'test')", ["B" + "A".repeat(86)]);
    g = (await as(c, "owner", "select public.ruqya_notify_get() g")).rows[0].g;
    check(g.report === true, "saved: " + JSON.stringify(g));
    // Web Push sender
    await clock("21:59");
    let d = (await svc("select public.ruqya_notify_due('s3cret') d"))[0].d;
    check(!d.msgs.length, "not before 22:00: " + JSON.stringify(d.msgs));
    await clock("22:05");
    d = (await svc("select public.ruqya_notify_due('s3cret') d"))[0].d;
    check(d.msgs.length === 1 && d.msgs[0].endpoint === "https://push.example/own" && /yazıldı 3/.test(d.msgs[0].body) && /^d:/.test(d.msgs[0].tag), "at 22:05 the report goes: " + JSON.stringify(d.msgs));
    d = (await svc("select public.ruqya_notify_due('s3cret') d"))[0].d;
    check(!d.msgs.length, "only once a day");
    // Android poll
    const tok = (await commit("owner", "select public.ruqya_notify_device() t")).rows[0].t;
    await clock("21:30");
    let pl = (await c.query("select public.ruqya_notify_poll($1) p", [tok])).rows[0].p;
    check(pl.on_new === true && !pl.news.length, "the app keeps polling with only the report on, nothing before 22:00: " + JSON.stringify(pl));
    await clock("22:40");
    pl = (await c.query("select public.ruqya_notify_poll($1) p", [tok])).rows[0].p;
    check(pl.news.length === 1 && /yazıldı 3/.test(pl.news[0].text), "the app gets the report: " + JSON.stringify(pl.news));
    pl = (await c.query("select public.ruqya_notify_poll($1) p", [tok])).rows[0].p;
    check(!pl.news.length, "once");
    // an agent with report=true written directly gets nothing
    await c.query("insert into public.notify_prefs (user_id, report) values ($1, true) on conflict (user_id) do update set report = true", [U.agentB]);
    await commit("agentB", "select public.ruqya_push_sub('https://push.example/agb', $1, 'AAAAAAAAAAAAAAAAAAAAAA', 'test')", ["B" + "A".repeat(86)]);
    await c.query("delete from private.notify_sent");
    d = (await svc("select public.ruqya_notify_due('s3cret') d"))[0].d;
    check(d.msgs.every((m) => m.endpoint !== "https://push.example/agb"), "a non-admin never gets the report");
    // rights
    const rt = (await c.query("select has_function_privilege('anon','public.ruqya_notify_report(boolean,text)','execute') a, has_function_privilege('authenticated','private.ruqya_day_report(text,date)','execute') b")).rows[0];
    check(!rt.a && !rt.b, "anon cannot set it; nobody calls the text function directly: " + JSON.stringify(rt));
    // rollback
    await c.query(fs.readFileSync(path.join(__dirname, "..", "..", "sql", "rollback-2026-11-report.sql"), "utf8"));
    const col = (await c.query("select count(*)::int n from information_schema.columns where table_name = 'notify_prefs' and column_name = 'report'")).rows[0].n;
    const fn = (await c.query("select count(*)::int n from pg_proc where proname in ('ruqya_notify_report','ruqya_day_report','ruqya_admin_id')")).rows[0].n;
    g = (await as(c, "owner", "select public.ruqya_notify_get() g")).rows[0].g;
    check(col === 0 && fn === 0 && !("report" in g), "the rollback restores 2026-11-notify.sql: " + JSON.stringify([col, fn, g]));
  } finally { if (c) await c.end().catch(() => {}); await pg.stop(); }
};
