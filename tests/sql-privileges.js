// S-04: on a copy of the live structure (+ migrations in tests/dbcopy.js AFTER): anon has no right on any table and
// cannot call ruqya_min; authenticated has no MAINTAIN. Then the rollback gives the old rights back.
const { start } = require("./localpg"), { build } = require("./dbcopy");
module.exports = async () => {
  const pg = await start(54336); let c;
  try {
    c = await build(pg, "priv");
    // MAINTAIN exists from PostgreSQL 17 (the live version); on an older test server only SELECT is checked here
    const v17 = +(await c.query("show server_version_num")).rows[0].server_version_num >= 170000;
    if (!v17) console.log("    sql-privileges: server < 17, MAINTAIN not checked (НЕ ПРОВЕРЕНО here)");
    const mnt = (who) => v17 ? "has_table_privilege('" + who + "', c.oid, 'MAINTAIN')" : "false";
    const r = await c.query(`select c.relname,
        has_table_privilege('anon', c.oid, 'SELECT') a_sel, ${mnt("anon")} a_mnt,
        ${mnt("authenticated")} u_mnt
      from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind = 'r'`);
    const bad = r.rows.filter((x) => x.a_sel || x.a_mnt || x.u_mnt).map((x) => x.relname + (x.a_sel ? " anon:SELECT" : "") + (x.a_mnt ? " anon:MAINTAIN" : "") + (x.u_mnt ? " authenticated:MAINTAIN" : ""));
    const fn = (await c.query("select has_function_privilege('anon', 'public.ruqya_min(text)', 'EXECUTE') x")).rows[0].x;
    if (bad.length || fn) throw new Error("too many rights: " + bad.join(", ") + (fn ? " anon:EXECUTE ruqya_min" : ""));
    // the rollback gives the previous rights back
    let rb = require("fs").readFileSync(require("path").join(__dirname, "..", "sql", "rollback-2026-11-least-privilege.sql"), "utf8");
    if (!v17) rb = rb.replace("grant select, maintain on", "grant select on").replace("execute 'grant maintain on public.readers to anon';", "").replace("'grant maintain on public.%I to authenticated'", "'select 1 where %L is not null'");
    await c.query(rb);
    const back = (await c.query("select has_table_privilege('anon','public.appts','SELECT') a, has_function_privilege('anon','public.ruqya_min(text)','EXECUTE') f")).rows[0];
    if (!back.a || !back.f) throw new Error("rollback did not restore the rights");
  } finally { if (c) await c.end().catch(() => {}); await pg.stop(); }
};
