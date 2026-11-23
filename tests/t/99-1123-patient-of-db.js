// Owner 23.11 (sql/2026-11-patient-of.sql): every sale says whose patient bought. A specialist's sale is always his own
// patient's (set by the database); an agent names a specialist or NULL («Keçici»), never a non-specialist. A specialist
// reads his own sales and the sales to his patients (not neutral ones, not other specialists'), and cannot change an
// agent's sale; agents and admins read all; earlier specialists' sales become their patients'; rollback works.
const fs = require("fs"), path = require("path");
const { start } = require("../localpg"), { build, as, U } = require("../dbcopy"), { check } = require("../lib");
module.exports = async () => {
  const pg = await start(54383); let c;
  try {
    c = await build(pg, "patientof");
    const P = "a3000000-0000-4000-8000-000000000001", ins = (id, pat) => "insert into public.product_sales (id, date, product_id, qty, price, amount, names" + (pat === undefined ? "" : ", patient_of") + ") values ('" + id + "', current_date, '" + P + "', 1, 3, 3, 'Misvak'" + (pat === undefined ? "" : pat === null ? ", null" : ", '" + pat + "'") + ")";
    const A1 = "f2000000-0000-4000-8000-000000000001", A2 = "f2000000-0000-4000-8000-000000000002", A3 = "f2000000-0000-4000-8000-000000000003", S1 = "f2000000-0000-4000-8000-000000000004";
    let r = await c.query("select count(*)::int n from public.product_sales where patient_of is not null"); check(r.rows[0].n === 0, "the copy's earlier sales: nobody's specialist (agents/owner sold them)");
    // seeded as the server would hold them: agent A sold to Əli's patient (A1) and to a passer-by (A2); Əli sold one (S1)
    await c.query("insert into public.product_sales (id, date, product_id, qty, price, amount, names, created_by, patient_of) values ($1, current_date, $4, 1, 3, 3, 'Misvak', $5, $6), ($2, current_date, $4, 1, 3, 3, 'Misvak', $5, null), ($3, current_date, $4, 1, 3, 3, 'Misvak', $6, null)", [A1, A2, S1, P, U.agentA, U.spec]);
    r = await c.query("select patient_of from public.product_sales where id = $1", [S1]); check(r.rows[0].patient_of === U.spec, "the specialist's sale is his patient's (set by the database): " + r.rows[0].patient_of);
    // as the users (each call is rolled back)
    r = await as(c, "agentA", "with i as (" + ins(A3, U.spec) + " returning patient_of) select patient_of from i"); check(r.ok && r.rows[0].patient_of === U.spec, "an agent names a specialist: " + (r.ok ? r.rows[0].patient_of : r.error));
    r = await as(c, "agentA", "with i as (" + ins(A3, null) + " returning patient_of) select patient_of from i"); check(r.ok && r.rows[0].patient_of === null, "…or «Keçici» (null)");
    r = await as(c, "agentA", ins(A3, U.agentB)); check(!r.ok, "an agent cannot name a non-specialist");
    r = await as(c, "spec", "with i as (" + ins(A3, U.agentA) + " returning patient_of) select patient_of from i"); check(r.ok && r.rows[0].patient_of === U.spec, "the specialist's own sale is his patient's, whatever is sent: " + (r.ok ? r.rows[0].patient_of : r.error));
    r = await as(c, "spec", "select id from public.product_sales where id in ($1,$2,$3) order by id", [A1, A2, S1]);
    check(r.ok && r.rows.map((x) => x.id).join() === [A1, S1].join(), "the specialist reads the sale to his patient and his own, not the neutral one: " + (r.ok ? JSON.stringify(r.rows) : r.error));
    r = await as(c, "spec", "update public.product_sales set amount = 1 where id = $1", [A1]); check(r.ok && r.rowCount === 0, "…and cannot change the agent's sale");
    r = await as(c, "agentB", "select id from public.product_sales where id in ($1,$2)", [A1, A2]); check(r.ok && r.rows.length === 2, "another agent reads all");
    r = await as(c, "agentA", "update public.product_sales set patient_of = null where id = $1", [A1]); check(r.ok && r.rowCount === 1, "the agent can change his choice");
    await c.query("update public.product_sales set patient_of = null where id = $1", [A1]);
    r = await as(c, "spec", "select id from public.product_sales where id = $1", [A1]); check(r.ok && r.rows.length === 0, "made neutral: the specialist no longer sees it");
    r = await as(c, "pending", "select id from public.product_sales"); check(r.ok && r.rows.length === 0, "a person without a role reads nothing");
    r = await as(c, "anon", "select id from public.product_sales"); check(!r.ok, "without sign-in: refused");
    await c.query(fs.readFileSync(path.join(__dirname, "..", "..", "sql", "rollback-2026-11-patient-of.sql"), "utf8"));
    r = await c.query("select count(*)::int n from information_schema.columns where table_name = 'product_sales' and column_name = 'patient_of'"); check(r.rows[0].n === 0, "rollback removes the column");
  } finally { if (c) await c.end().catch(() => {}); await pg.stop(); }
};
