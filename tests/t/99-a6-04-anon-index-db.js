// A6-04 (audit 6, 10-year copy): «delete the patient's data» (ruqya_anonymize) read the whole change journal twice —
// 8.6 s with 3 000 000 journal rows, over the 8 s a signed-in request may run on Supabase. With the indexes of
// sql/2026-11-a6-journal-index.sql both look-ups are index reads (0.2 s on the same copy, evidence/audit6/S1).
// Here: the planner must be able to use them (sequential scans switched off to ask), and anonymising still works.
const { start } = require("../localpg"), { build, as } = require("../dbcopy"), { check } = require("../lib");
module.exports = async () => {
  const pg = await start(54361); let c;
  try {
    c = await build(pg, "anonidx");
    await c.query("set enable_seqscan = off");
    const plan = async (sql) => (await c.query("explain " + sql)).rows.map((r) => r["QUERY PLAN"]).join(" | ");
    const p1 = await plan("select row_id from public.audit_log where tbl = 'appts' and op = 'DELETE' and public.ruqya_pkey(old->>'phone', old->>'name') = 'p500000001|x'");
    check(/audit_log_del_pkey/.test(p1), "the deleted bookings of a patient are found by index: " + p1);
    const p2 = await plan("update public.audit_log set old = old where tbl = 'appts' and row_id = any(array['a','b'])");
    check(/audit_log_appts_row/.test(p2), "the journal rows of the patient's bookings are found by index: " + p2);
    await c.query("set enable_seqscan = on");
    const k = (await c.query("select public.ruqya_pkey(phone, name) k from public.appts where id = 'c0000000-0000-4000-8000-000000000001'")).rows[0].k;
    const r = await as(c, "owner", "select public.ruqya_anonymize($1) n", [k]);
    check(r.ok && r.rows[0].n >= 1, "anonymising still works: " + JSON.stringify(r));
  } finally { if (c) await c.end().catch(() => {}); await pg.stop(); }
};
