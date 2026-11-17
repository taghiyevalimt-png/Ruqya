// DISASTER_RECOVERY.md scenario A (one record deleted by mistake), rehearsed on the copy database: an admin deletes a
// booking, the journal keeps it, ruqya_restore brings it back with the same fields; a second restore is refused,
// an agent may not restore.
const { start } = require("../localpg"), { build, as, U } = require("../dbcopy"), { check } = require("../lib");
const ID = "c0000000-0000-4000-8000-000000000003";
module.exports = async () => {
  const pg = await start(54353); let c;
  try {
    c = await build(pg, "restoreone");
    const cols = "id, reader_id, date, time, duration, name, phone, price, status, note, place, created_by";
    const before = (await c.query(`select ${cols} from public.appts where id = $1`, [ID])).rows[0];
    // the admin's delete, committed (as() rolls back, so the same claims are set by hand here)
    await c.query("begin"); await c.query("set local role authenticated");
    await c.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: U.owner, role: "authenticated" })]);
    const del = await c.query("delete from public.appts where id = $1", [ID]); await c.query("commit");
    check(del.rowCount === 1, "admin deleted the booking");
    const j = (await c.query("select id from public.audit_log where tbl = 'appts' and op = 'DELETE' and row_id = $1 order by id desc limit 1", [ID])).rows[0];
    check(!!j, "the journal keeps the deleted booking");
    const agent = await as(c, "agentA", `select public.ruqya_restore(${j.id})`);
    check(!agent.ok && agent.code === "42501", "an agent may not restore: " + (agent.ok ? "allowed" : agent.code));
    await c.query("begin"); await c.query("set local role authenticated");
    await c.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: U.owner, role: "authenticated" })]);
    const r = await c.query("select public.ruqya_restore($1) r", [j.id]); await c.query("commit");
    check(r.rows[0].r === "ok", "ruqya_restore answers ok");
    const after = (await c.query(`select ${cols} from public.appts where id = $1`, [ID])).rows[0];
    check(JSON.stringify(after) === JSON.stringify(before), "the booking is back with the same fields: " + JSON.stringify(after));
    const twice = await as(c, "owner", `select public.ruqya_restore(${j.id})`);
    check(!twice.ok, "a second restore of the same record is refused");
  } finally { if (c) await c.end().catch(() => {}); await pg.stop(); }
};
