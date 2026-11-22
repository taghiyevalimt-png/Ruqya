// P-04: a patient's old visits come through the index helper, the rows still through the caller's rights (RLS):
// the visit of a patient of column İlkin is seen by an agent and the owner, not by the specialist of column Əli
// (the attack side, no access for anonymous / role-less accounts, is X-28…X-32 in tests/attacks.js).
const fs = require("fs"), path = require("path"), { start } = require("../localpg"), { build, as } = require("../dbcopy"), { check } = require("../lib");
module.exports = async () => {
  const pg = await start(54352); let c;
  try {
    c = await build(pg, "visits");
    const q = "select id from public.ruqya_hist_visits(public.ruqya_pkey('050 000 00 02', 'Pasiyent B-İlkin'), current_date + 5, current_date - 700)";
    for (const [who, want] of [["agentA", 1], ["owner", 1], ["spec", 0], ["pending", 0]]) {
      const r = await as(c, who, q);
      check(r.ok && r.rowCount === want, who + " sees " + want + " visit(s) of the İlkin patient: " + (r.ok ? r.rowCount : r.error));
    }
    const dropped = await c.query("select to_regprocedure('public.ruqya_hist_patients(date,date)') f");
    check(!dropped.rows[0].f, "the old whole-list function is gone");
    const p = await as(c, "agentA", "select k, n from public.ruqya_hist_patients_page(current_date + 5, current_date - 700, '', 1000)");
    check(p.ok && p.rowCount >= 3, "page function lists the copy's patients for an agent: " + (p.ok ? p.rowCount : p.error));
    // owner 17.11: a cancelled booking marked «Satış edildi» (follow 3) counts as successful in the history functions
    await c.query("update public.appts set status = 'cancel', follow = 3 where id = 'c0000000-0000-4000-8000-000000000002'");
    const sp = await as(c, "agentA", "select n, cancel from public.ruqya_hist_patients_page(current_date + 5, current_date - 700, '', 1000) where k = public.ruqya_pkey('050 000 00 02', 'Pasiyent B-İlkin')");
    check(sp.ok && sp.rowCount === 1 && sp.rows[0].n === 1 && sp.rows[0].cancel === 0, "sold booking: counted as a visit, not as cancelled: " + JSON.stringify(sp.rows));
    const sv = await as(c, "agentA", "select status from public.ruqya_hist_visits(public.ruqya_pkey('050 000 00 02', 'Pasiyent B-İlkin'), current_date + 5, current_date - 700)");
    check(sv.ok && sv.rows[0] && sv.rows[0].status === "wait", "sold booking: visit status shown as successful: " + JSON.stringify(sv.rows));
    await c.query("update public.appts set status = 'wait', follow = 0 where id = 'c0000000-0000-4000-8000-000000000002'");
    // rollback and again: the rollback file puts the old visits function back, the migration can run twice
    const sql = (f) => fs.readFileSync(path.join(__dirname, "..", "..", "sql", f), "utf8");
    await c.query(sql("rollback-2026-11-patients-scale.sql"));
    const gone = await c.query("select to_regprocedure('public.ruqya_hist_patients_page(date,date,text,integer)') f, to_regclass('public.appts_pkey_date') i, to_regnamespace('private') s");
    check(!gone.rows[0].f && !gone.rows[0].i && !gone.rows[0].s, "rollback removes the page function, the index and the empty schema: " + JSON.stringify(gone.rows[0]));
    const old = await as(c, "agentA", "select k from public.ruqya_hist_patients(current_date + 5, current_date - 700)");
    check(old.ok && old.rowCount >= 3, "after the rollback the old grouped list is back: " + (old.ok ? old.rowCount : old.error));
    const back = await as(c, "agentA", q); check(back.ok && back.rowCount === 1, "after the rollback the old visits function still answers: " + (back.ok ? back.rowCount : back.error));
    await c.query(sql("2026-11-patients-scale.sql")); await c.query(sql("2026-11-patients-scale.sql"));
    const again = await as(c, "spec", q); check(again.ok && again.rowCount === 0, "migration applied twice again, specialist still sees 0: " + (again.ok ? again.rowCount : again.error));
  } finally { if (c) await c.end().catch(() => {}); await pg.stop(); }
};
