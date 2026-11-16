// T-18: every query the app sends, on a copy with 1 000 000 bookings (3 years, 20 specialists, 50 staff) and
// 1 000 000 journal rows, run as the user role through RLS: EXPLAIN (ANALYZE, BUFFERS) plan and time.
//   node tests/perf/db-scale.js <outDir> [rows=1000000]
// A query fails the check when its plan reads a big table with a sequential scan, or when it is not limited by a
// date window / paging (LIMIT or range) while the table is big.
const fs = require("fs"), path = require("path");
const { start } = require("../localpg"), { build, U } = require("../dbcopy");
(async () => {
  const outDir = process.argv[2], N = +process.argv[3] || 1000000; fs.mkdirSync(outDir, { recursive: true });
  const pg = await start(54335), c = await build(pg, "scale"), t0 = Date.now(), log = [];
  try {
    await c.query("set session_replication_role = replica");
    await c.query(`insert into public.readers (id, name, price, share) select gen_random_uuid(), 'Mütəxəssis '||g, 150, 50 from generate_series(1,18) g`);
    await c.query(`insert into public.staff (id, name, role) select gen_random_uuid(), 'Agent '||g, 'agent' from generate_series(1,44) g`);
    const t1 = Date.now();
    await c.query(`insert into public.appts (id, reader_id, date, time, duration, name, phone, price, share, status, note, created_by, created_at, place)
      select gen_random_uuid(), r.ids[1 + (g % array_length(r.ids,1))], current_date - 900 + (g % 1095), lpad((8 + (g % 14))::text, 2, '0')||':00', 60,
             'Pasiyent '||(g % 200000), '050 '||lpad((g % 9999999)::text, 7, '0'), 130, 0, case when g % 9 = 0 then 'cancel' else 'wait' end, '',
             s.ids[1 + (g % array_length(s.ids,1))], now() - ((g % 1095)||' days')::interval, 'ofis'
        from generate_series(1, ${N}) g,
             (select array_agg(id) ids from public.readers) r, (select array_agg(id) ids from public.staff where role='agent') s`);
    await c.query(`insert into public.audit_log (uid, tbl, op, row_id, old, new, at) select '${U.agentA}', 'appts', 'UPDATE', gen_random_uuid()::text, '{"note":""}', '{"note":"x"}', now() - ((g % 700)||' days')::interval from generate_series(1, ${N}) g`);
    await c.query(`insert into public.expenses (date, title, amount, created_by) select current_date - (g % 1095), 'X', 5, '${U.agentA}' from generate_series(1, 20000) g`);
    await c.query(`insert into public.product_sales (date, amount, names, created_by) select current_date - (g % 1095), 5, 'Y', '${U.agentA}' from generate_series(1, 20000) g`);
    await c.query("set session_replication_role = origin; analyze;");
    log.push("data generated: " + N + " appts, " + N + " audit_log rows in " + ((Date.now() - t1) / 1000).toFixed(0) + " s");
    const from = "current_date - 45", Q = [
      ["readers", "agent", "select id,name,archived,created_at,color from public.readers order by created_at, id limit 1000"],
      ["appts window (refresh)", "agent", `select * from public.appts where date >= ${from} order by date desc, id limit 1000`],
      ["appts written in window for earlier days", "agent", `select * from public.appts where created_at >= (${from})::timestamptz and date < ${from} order by id limit 1000`],
      ["appts changed since (poll)", "agent", "select * from public.appts where updated_at > now() - interval '3 minutes' order by id limit 1000"],
      ["appts window as specialist (RLS by column)", "spec", `select * from public.appts where date >= ${from} order by date desc, id limit 1000`],
      ["expenses window", "agent", `select * from public.expenses where date >= ${from} order by date desc, id limit 1000`],
      ["product_sales window", "agent", `select * from public.product_sales where date >= ${from} order by date desc, id limit 1000`],
      ["staff", "agent", "select * from public.staff order by id limit 1000"],
      ["breaks", "agent", "select * from public.breaks order by start_time limit 1000"],
      ["stat_edits", "agent", "select * from public.stat_edits order by id limit 1000"],
      ["patients grouped (RPC, 2 years)", "agent", `select * from public.ruqya_hist_patients(${from}, current_date - 731)`],
      ["one patient's old visits (RPC)", "agent", `select * from public.ruqya_hist_visits('p0000000123', ${from}, current_date - 731)`],
      ["Excel one month", "owner", "select id,reader_id,date,time,duration,name,phone,price,status,note,confirmed,created_by,created_at,place from public.appts where date >= current_date - 31 order by date, id limit 1000"],
      ["journal page (admin)", "owner", "select * from public.audit_log order by id desc limit 200"],
      ["journal deleted only (admin)", "owner", "select * from public.audit_log where op = 'DELETE' order by id desc limit 200"],
    ];
    const rows = [];
    for (const [name, who, sql] of Q) {
      await c.query("begin"); await c.query("set local role authenticated"); await c.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: U[who === "agent" ? "agentA" : who], role: "authenticated" })]);
      const r = await c.query("explain (analyze, buffers, format text) " + sql); await c.query("rollback");
      const plan = r.rows.map((x) => x["QUERY PLAN"]).join("\n");
      const ms = +(plan.match(/Execution Time: ([\d.]+) ms/) || [])[1];
      const seqBig = /Seq Scan on (appts|audit_log)\b/.test(plan);
      const paged = /\blimit\b/i.test(sql) || /hist_(patients|visits)/.test(sql);
      const verdict = !seqBig && paged ? "ПРОЙДЕНО" : "НЕ ПРОЙДЕНО" + (seqBig ? " (seq scan on big table)" : "") + (!paged ? " (no paging)" : "");
      rows.push([name, who, ms, verdict]);
      fs.writeFileSync(path.join(outDir, name.replace(/[^a-z0-9]+/gi, "_") + ".plan.txt"), "-- " + who + "\n-- " + sql + "\n" + plan + "\n");
      log.push(verdict + "\t" + ms + " ms\t" + name);
    }
    fs.writeFileSync(path.join(outDir, "summary.txt"), "# DB scale check — " + new Date().toISOString() + " — PostgreSQL 17.11 embedded, " + N + " bookings\n" + log.join("\n") + "\n");
    console.log(log.join("\n"));
    process.exitCode = rows.some((r) => r[3] !== "ПРОЙДЕНО") ? 1 : 0;
  } finally { await c.end().catch(() => {}); await pg.stop(); }
})();
