// T-19: 50 staff working at the same time, on the copy database (embedded PostgreSQL 17, the live structure, 66 000
// made-up bookings ≈ 3 years of the centre). Each user, as role authenticated through RLS, repeats what the app does:
// the visible window, the changes poll, the patient list page, a patient's visits, and now and then a booking
// written and cancelled. Reports latency median / p95 / max per query and the error share.
//   node tests/perf/load50.js <out.json> [users=50] [seconds=120] [pause ms between rounds = 200]
// The default pause (200 ms) is a strict profile: every user repeats the 4 reads about once a second, ~200 requests/s
// in all. A pause of 3000 ms is closer to a person at work (one round every few seconds); both are reported.
// Criterion of the plan: errors 0 %, p95 of every read ≤ 500 ms. (The network and PostgREST of the real service are
// not part of this measurement — it covers the database under concurrent load.)
const fs = require("fs"), path = require("path");
const { start } = require("../localpg"), { build, U, R } = require("../dbcopy");
const pgmod = require("pg");
(async () => {
  const out = process.argv[2], users = +process.argv[3] || 50, secs = +process.argv[4] || 120, pause = process.argv[5] != null ? +process.argv[5] : 200;
  const pg = await start(54336), c = await build(pg, "load");
  await c.query("set session_replication_role = replica");
  await c.query(`insert into public.appts (id, reader_id, date, time, duration, name, phone, price, share, status, note, created_by, created_at, place)
    select gen_random_uuid(), (array['${R.ali}','${R.ilkin}','${R.bos}']::uuid[])[1 + (g / 1095) % 3], current_date - 900 + (g % 1095),
           to_char(time '07:03' + make_interval(mins => (g / 3285)), 'HH24:MI'), 60, 'Pasiyent ' || (g % 9000), '050 ' || lpad((g % 9000)::text, 7, '0'),
           130, 0, case when g % 9 = 0 then 'cancel' else 'wait' end, '', '${U.agentA}', now() - ((g % 1095) || ' days')::interval, 'ofis'
      from generate_series(1, 66000) g`);
  await c.query("set session_replication_role = origin; analyze"); await c.end();
  const Q = {
    window: "select * from public.appts where date >= current_date - 45 order by date desc, id limit 1000",
    poll: "select * from public.appts where updated_at > now() - interval '3 minutes' order by id limit 1000",
    patients: "select * from public.ruqya_hist_patients_page(current_date - 45, current_date - 731, '', 1000)",
    visits: "select * from public.ruqya_hist_visits('p500000123', current_date - 45, current_date - 731)",
  };
  const lat = {}, errs = {}, codes = {}; let ops = 0;
  const t0 = Date.now(), until = t0 + secs * 1000;
  const who = [U.agentA, U.agentB, U.owner, U.admin2, U.spec];
  await Promise.all(Array.from({ length: users }, async (_, u) => {
    const cl = new pgmod.Client({ host: "127.0.0.1", port: 54336, user: "postgres", database: "load" }); cl.on("error", () => {}); await cl.connect();
    const sub = who[u % who.length];
    const run = async (k, sql, args) => {
      const s = Date.now();
      try { await cl.query("begin"); await cl.query("set local role authenticated"); await cl.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub, role: "authenticated" })]); await cl.query(sql, args); await cl.query(k === "write" ? "commit" : "rollback"); }
      catch (e) { await cl.query("rollback").catch(() => {}); const ck = k + " " + e.code + " " + String(e.message).slice(0, 40); codes[ck] = (codes[ck] || 0) + 1;
        if (!(k === "write" && /23P01|23505|Bu saat|cox deyisiklik/i.test(e.code + " " + e.message))) { errs[k] = (errs[k] || 0) + 1; } }
      (lat[k] = lat[k] || []).push(Date.now() - s); ops++;
    };
    let i = 0;
    while (Date.now() < until) {
      for (const k of ["window", "poll", "patients", "visits"]) await run(k, Q[k]);
      if (i++ % 5 === 0 && sub !== U.spec) {
        const id = "e" + String(u).padStart(3, "0") + "0000-0000-4000-8000-" + String(i).padStart(12, "0");
        await run("write", "insert into public.appts (id, reader_id, date, time, duration, name, phone, price, share, status, note, created_by) values ($1, $2, current_date + 30 + $3::int, $4, 30, 'Yük testi', '050 000 00 00', 130, 0, 'wait', '', $5)", [id, R.ali, u, String(8 + (i % 14)).padStart(2, "0") + ":" + String((i * 7) % 60).padStart(2, "0"), sub]);
      }
      await new Promise((r) => setTimeout(r, pause));
    }
    await cl.end();
  }));
  await pg.stop();
  const st = (a) => { a.sort((x, y) => x - y); return { n: a.length, median: a[Math.floor(a.length / 2)], p95: a[Math.floor(a.length * 0.95)], max: a[a.length - 1] }; };
  const res = { at: new Date().toISOString(), users, seconds: secs, pauseMs: pause, ops, errorCodes: codes, perQuery: Object.fromEntries(Object.entries(lat).map(([k, a]) => [k, { ...st(a), errors: errs[k] || 0 }])) };
  const errTotal = Object.values(errs).reduce((a, b) => a + b, 0);
  const slow = Object.entries(res.perQuery).filter(([k, v]) => k !== "write" && v.p95 > 500).map(([k]) => k);
  res.verdict = !errTotal && !slow.length ? "ПРОЙДЕНО" : "НЕ ПРОЙДЕНО" + (errTotal ? " (errors " + errTotal + ")" : "") + (slow.length ? " (p95 > 500 ms: " + slow.join(",") + ")" : "");
  fs.mkdirSync(path.dirname(out), { recursive: true }); fs.writeFileSync(out, JSON.stringify(res, null, 1));
  console.log("error codes: " + JSON.stringify(codes));
  console.log(users + " users, " + secs + " s, pause " + pause + " ms, " + ops + " requests; " + Object.entries(res.perQuery).map(([k, v]) => k + " median " + v.median + " p95 " + v.p95 + " max " + v.max + " ms, errors " + v.errors).join("; ") + " — " + res.verdict);
  process.exit(errTotal || slow.length ? 1 : 0);
})();
