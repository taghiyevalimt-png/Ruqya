// Audit 6, Advisors «SECURITY DEFINER function executable by signed-in users» (10 functions): for each of them and
// each role that is not an admin (anon, account without role, specialist, sales agent) — nothing is changed and
// nothing beyond the caller's own yes/no is learned. The three that change data (anonymize, restore, set_color)
// refuse with 42501 «no rights» (not with «no such patient»), and the data is checked unchanged afterwards.
const { start } = require("../localpg"), { build, as, U, R } = require("../dbcopy"), { check } = require("../lib");
module.exports = async () => {
  const pg = await start(54362); let c;
  try {
    c = await build(pg, "definer");
    const key = (await c.query("select public.ruqya_pkey(phone, name) k from public.appts where id = 'c0000000-0000-4000-8000-000000000001'")).rows[0].k;
    const del = (await c.query("select max(id) m from public.audit_log")).rows[0].m;
    const snap = async () => JSON.stringify((await c.query("select (select md5(string_agg(id::text||name||phone||coalesce(note,''), ',' order by id)) from public.appts) a, (select md5(string_agg(id::text||coalesce(color,''), ',' order by id)) from public.readers) r, (select count(*) from public.audit_log) l")).rows[0]);
    const before = await snap();
    const lines = [];
    for (const who of ["anon", "pending", "spec", "agentA"]) {
      // the predicates: only true/false about the caller, no argument to ask about someone else
      for (const f of ["ruqya_is_admin", "ruqya_has_role", "ruqya_sees_all", "ruqya_can_stats", "ruqya_can_breaks", "ruqya_err_ok"]) {
        const r = await as(c, who, "select public." + f + "() x");
        const want = { ruqya_is_admin: false, ruqya_has_role: who === "spec" || who === "agentA", ruqya_sees_all: who === "agentA", ruqya_can_stats: who === "agentA", ruqya_can_breaks: who === "agentA" }[f];
        if (who === "anon") check(!r.ok && r.code === "42501", who + " " + f + ": anonymous may not call it: " + JSON.stringify(r));
        else if (f === "ruqya_err_ok") check(r.ok && typeof r.rows[0].x === "boolean", who + " " + f + ": only yes/no about the caller's own error count");
        else check(r.ok && r.rows[0].x === want, who + " " + f + " = " + want + ": " + JSON.stringify(r.rows || r.error));
        lines.push(who + "\t" + f + "\t" + (r.ok ? JSON.stringify(r.rows[0].x) : "refused " + r.code));
      }
      const mr = await as(c, who, "select array_agg(x) a from public.ruqya_my_readers() x");
      const wantR = who === "spec" ? JSON.stringify([R.ali]) : "null";
      if (who === "anon") check(!mr.ok, "anon: ruqya_my_readers refused");
      else check(mr.ok && JSON.stringify(mr.rows[0].a) === wantR, who + ": ruqya_my_readers gives only the caller's own column(s): " + JSON.stringify(mr.rows || mr.error));
      lines.push(who + "\truqya_my_readers\t" + (mr.ok ? JSON.stringify(mr.rows[0].a) : "refused " + mr.code));
      // the three that change data
      for (const [f, sql, params] of [["ruqya_anonymize", "select public.ruqya_anonymize($1)", [key]], ["ruqya_restore", "select public.ruqya_restore($1)", [del]], ["ruqya_set_color", "select public.ruqya_set_color($1, '#000000')", [R.ali]]]) {
        const r = await as(c, who, sql, params);
        check(!r.ok && r.code === "42501", who + " " + f + ": refused for lack of rights: " + JSON.stringify(r));
        lines.push(who + "\t" + f + "\t" + (r.ok ? "ALLOWED" : "refused " + r.code));
      }
    }
    check(await snap() === before, "appointments, colours and the journal are unchanged after all attempts");
    // an admin can (the functions still do their job)
    const ok = await as(c, "admin2", "select public.ruqya_set_color($1, '#123456') x", [R.ali]);
    check(ok.ok, "an admin can still change a colour: " + JSON.stringify(ok));
    if (process.env.DEFINER_OUT) require("fs").writeFileSync(process.env.DEFINER_OUT, "# SECURITY DEFINER functions × roles on the copy — " + new Date().toISOString() + "\n" + lines.join("\n") + "\n");
  } finally { if (c) await c.end().catch(() => {}); await pg.stop(); }
};
