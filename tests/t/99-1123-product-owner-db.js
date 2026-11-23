// Owner 23.11 (sql/2026-11-product-owner.sql): a specialist with a share in a product reads every sale of that product,
// whoever sold it — but cannot change or delete another person's sale; a specialist without a share reads nothing of it;
// agents and admins as before; rollback restores «own sales only» for specialists.
const fs = require("fs"), path = require("path");
const { start } = require("../localpg"), { build, as, U } = require("../dbcopy"), { check } = require("../lib");
module.exports = async () => {
  const pg = await start(54382); let c;
  try {
    c = await build(pg, "prodowner");
    const P1 = "a3000000-0000-4000-8000-000000000002", P2 = "a3000000-0000-4000-8000-000000000003", S1 = "f1000000-0000-4000-8000-000000000001", S2 = "f1000000-0000-4000-8000-000000000002";
    await c.query("set session_replication_role = replica");
    await c.query("insert into public.products (id, name, price) values ($1,'Əli yağı',25), ($2,'Başqa',10)", [P1, P2]);
    await c.query("insert into public.product_shares (product_id, staff_id, amt) values ($1,$2,18)", [P1, U.spec]);
    await c.query("insert into public.product_sales (id, date, product_id, qty, price, amount, names, created_by) values ($1, current_date, $2, 2, 25, 50, 'Əli yağı', $4), ($3, current_date, $5, 1, 10, 10, 'Başqa', $4)", [S1, P1, S2, U.agentA, P2]);
    await c.query("set session_replication_role = origin");
    let r = await as(c, "spec", "select id from public.product_sales where id in ($1,$2)", [S1, S2]);
    check(r.ok && r.rows.length === 1 && r.rows[0].id === S1, "the specialist reads the agent's sale of HIS product, not the other one: " + (r.ok ? JSON.stringify(r.rows) : r.error));
    r = await as(c, "spec", "update public.product_sales set amount = 1 where id = $1", [S1]); check(r.ok && r.rowCount === 0, "…but cannot change it");
    r = await as(c, "spec", "delete from public.product_sales where id = $1", [S1]); check(r.ok && r.rowCount === 0, "…nor delete it");
    r = await as(c, "agentB", "select id from public.product_sales where id = $1", [S1]); check(r.ok && r.rows.length === 1, "another agent sees all sales as before");
    r = await as(c, "agentA", "update public.product_sales set amount = 50 where id = $1", [S1]); check(r.ok && r.rowCount === 1, "the seller still changes his sale");
    r = await as(c, "pending", "select id from public.product_sales"); check(r.ok && r.rows.length === 0, "a person without a role reads nothing");
    r = await as(c, "anon", "select id from public.product_sales"); check(!r.ok, "without sign-in: refused");
    await c.query("delete from public.product_shares where product_id = $1", [P1]);
    r = await as(c, "spec", "select id from public.product_sales where id = $1", [S1]); check(r.ok && r.rows.length === 0, "a removed share gives no access");
    await c.query("insert into public.product_shares (product_id, staff_id, amt) values ($1,$2,18)", [P1, U.spec]);
    await c.query(fs.readFileSync(path.join(__dirname, "..", "..", "sql", "rollback-2026-11-product-owner.sql"), "utf8"));
    r = await as(c, "spec", "select id from public.product_sales where id = $1", [S1]); check(r.ok && r.rows.length === 0, "after the rollback: own sales only");
  } finally { if (c) await c.end().catch(() => {}); await pg.stop(); }
};
