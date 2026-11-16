// S-04: on a copy of the live structure (+ migrations in tests/dbcopy.js AFTER): anon has no right on any table and
// cannot call ruqya_min; authenticated has no MAINTAIN. Then the rollback gives the old rights back.
const { start } = require("./localpg"), { build } = require("./dbcopy");
module.exports = async () => {
  const pg = await start(54336); let c;
  try {
    c = await build(pg, "priv");
    const r = await c.query(`select c.relname,
        has_table_privilege('anon', c.oid, 'SELECT') a_sel, has_table_privilege('anon', c.oid, 'MAINTAIN') a_mnt,
        has_table_privilege('authenticated', c.oid, 'MAINTAIN') u_mnt
      from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind = 'r'`);
    const bad = r.rows.filter((x) => x.a_sel || x.a_mnt || x.u_mnt).map((x) => x.relname + (x.a_sel ? " anon:SELECT" : "") + (x.a_mnt ? " anon:MAINTAIN" : "") + (x.u_mnt ? " authenticated:MAINTAIN" : ""));
    const fn = (await c.query("select has_function_privilege('anon', 'public.ruqya_min(text)', 'EXECUTE') x")).rows[0].x;
    if (bad.length || fn) throw new Error("too many rights: " + bad.join(", ") + (fn ? " anon:EXECUTE ruqya_min" : ""));
    // the rollback gives the previous rights back
    await c.query(require("fs").readFileSync(require("path").join(__dirname, "..", "sql", "rollback-2026-11-least-privilege.sql"), "utf8"));
    const back = (await c.query("select has_table_privilege('anon','public.appts','SELECT') a, has_function_privilege('anon','public.ruqya_min(text)','EXECUTE') f")).rows[0];
    if (!back.a || !back.f) throw new Error("rollback did not restore the rights");
  } finally { if (c) await c.end().catch(() => {}); await pg.stop(); }
};
