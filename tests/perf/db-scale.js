// T-18: every query the app sends, on a copy with 1 000 000 bookings (3 years, 20 specialists, 50 staff) and
// 1 000 000 journal rows, run as the user role through RLS: EXPLAIN (ANALYZE, BUFFERS) plan and time.
//   node tests/perf/db-scale.js <outDir> [rows=1000000]
// A query fails the check when its plan — including the plans of statements inside functions (RPC), captured with
// auto_explain — reads a big table with a sequential scan, has no LIMIT anywhere (no paging), or reads more than
// 50 000 rows of a big table (5 % of it: rows a node returned plus rows its filter threw away): then the index does
// not narrow the search. Nested statements faster than 20 ms are not captured (they cannot read much).
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
      -- every (specialist, day, time) once (the table allows one booking per slot): day = g mod 1095, specialist and
      -- time from the rest; times 08:05, 08:15 ... (never :00/:30, so no clash with the copy's own sample bookings)
      select gen_random_uuid(), r.ids[1 + ((g / 1095) % array_length(r.ids,1))], current_date - 900 + (g % 1095),
             to_char(time '08:05' + make_interval(mins => 10 * ((g / 1095) / array_length(r.ids,1))), 'HH24:MI'), 60,
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
      ["patients page 1 (RPC, keyset)", "agent", `select * from public.ruqya_hist_patients_page(${from}, current_date - 731, '', 1000)`],
      ["patients page in the middle (RPC, keyset)", "agent", `select * from public.ruqya_hist_patients_page(${from}, current_date - 731, 'p0000500000', 1000)`],
      ["patients page as specialist (RPC, keyset, RLS)", "spec", `select * from public.ruqya_hist_patients_page(${from}, current_date - 731, '', 1000)`],
      // a real patient of the generated data: phone "050 0000500" (g = 500, day 500 of 1095: inside the two-year window) → key p500000500 (R2-4: the key used
      // before could not exist, so the query found nothing)
      ["one patient's old visits (RPC)", "agent", `select * from public.ruqya_hist_visits('p500000500', ${from}, current_date - 731)`],
      ["one patient's old visits as specialist (RPC, RLS)", "spec", `select * from public.ruqya_hist_visits('p500000500', ${from}, current_date - 731)`],
      ["Excel one month", "owner", "select id,reader_id,date,time,duration,name,phone,price,status,note,confirmed,created_by,created_at,place from public.appts where date >= current_date - 31 order by date, id limit 1000"],
      ["journal page (admin)", "owner", "select * from public.audit_log order by id desc limit 200"],
      ["journal deleted only (admin)", "owner", "select * from public.audit_log where op = 'DELETE' order by id desc limit 200"],
    ];
    // the visits query must find the generated patient (otherwise it measures nothing)
    const pv = await c.query("select count(*)::int n from public.appts where public.ruqya_pkey(phone, name) = 'p500000500' and date >= current_date - 731 and date < current_date - 45");
    log.push("patient p500000500 has " + pv.rows[0].n + " visit(s) in the window");
    const rows = [];
    const notes = []; c.on("notice", (m) => notes.push(String(m.message)));
    await c.query("load 'auto_explain'");
    await c.query("set auto_explain.log_min_duration = 20; set auto_explain.log_analyze = on; set auto_explain.log_buffers = on; set auto_explain.log_nested_statements = on; set client_min_messages = log");
    for (const [name, who, sql] of Q) {
      notes.length = 0;
      await c.query("begin"); await c.query("set local role authenticated"); await c.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: U[who === "agent" ? "agentA" : who], role: "authenticated" })]);
      const r = await c.query("explain (analyze, buffers, format text) " + sql); await c.query("rollback");
      const nested = notes.filter((m) => /Query Text:/.test(m) && !/explain \(analyze/i.test(m)).join("\n---- nested statement (auto_explain) ----\n");
      const plan = r.rows.map((x) => x["QUERY PLAN"]).join("\n") + (nested ? "\n---- nested statement (auto_explain) ----\n" + nested : "");
      const ms = +(plan.match(/Execution Time: ([\d.]+) ms/) || [])[1];
      const seqBig = /Seq Scan on (appts|audit_log)\b/.test(plan);
      // paging: a Limit node in the plan; for a function whose inner statement was too fast to be captured
      // (< 20 ms), the LIMIT of its body (pg_get_functiondef) counts
      let paged = /\bLimit\b/.test(plan);
      const fs1 = !paged && !nested && plan.match(/Function Scan on (\w+)/);
      if (fs1) { const d = await c.query("select string_agg(pg_get_functiondef(p.oid), ' ') d from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = $1", [fs1[1]]); paged = /\blimit\s+\d+/i.test(d.rows[0].d || ""); }
      // rows a node on a big table produced or threw away: "... on appts ... rows=N loops=L" plus "Rows Removed by Filter: M"
      let readBig = 0; const lines = plan.split("\n");
      lines.forEach((l, i) => {
        if (!/ on (appts|audit_log)\b/.test(l)) return;
        const m = l.match(/actual time=[\d.]+\.\.[\d.]+ rows=(\d+) loops=(\d+)/); let n = m ? +m[1] * +m[2] : 0;
        for (let j = i + 1; j < Math.min(i + 8, lines.length) && !/^\s*->\s/.test(lines[j]); j++) { const k = lines[j].match(/Rows Removed by (?:Filter|Index Recheck): (\d+)/); if (k) n += +k[1]; }
        readBig = Math.max(readBig, n);
      });
      const tooMany = readBig > 50000;
      const verdict = !seqBig && paged && !tooMany ? "ПРОЙДЕНО" : "НЕ ПРОЙДЕНО" + (seqBig ? " (seq scan on big table)" : "") + (!paged ? " (no LIMIT anywhere)" : "") + (tooMany ? " (reads " + readBig + " rows of a big table)" : "");
      rows.push([name, who, ms, verdict]);
      fs.writeFileSync(path.join(outDir, name.replace(/[^a-z0-9]+/gi, "_") + ".plan.txt"), "-- " + who + "\n-- " + sql + "\n" + plan + "\n");
      log.push(verdict + "\t" + ms + " ms\t" + name + "\tmax rows read on a big table: " + readBig);
    }
    fs.writeFileSync(path.join(outDir, "summary.txt"), "# DB scale check — " + new Date().toISOString() + " — PostgreSQL 17.11 embedded, " + N + " bookings\n" + log.join("\n") + "\n");
    console.log(log.join("\n"));
    process.exitCode = rows.some((r) => r[3] !== "ПРОЙДЕНО") ? 1 : 0;
  } finally { await c.end().catch(() => {}); await pg.stop(); }
})();
