// A copy of the live database structure with made-up data, on the throw-away PostgreSQL of tests/localpg.js.
// Structure: db/schema_live_20261116.sql (schemas public + auth exactly as dumped from Supabase) plus the migrations
// written after that dump (sql/ files listed in AFTER). Data: synthetic only (no real person's data).
// Users: owner (the fixed main admin id), admin2, agentA, agentB, spec (specialist bound to column "Əli"),
// pending (account without a role). Requests are simulated like PostgREST does: SET ROLE authenticated/anon and
// request.jwt.claims with the user id, inside a transaction that is rolled back.
const fs = require("fs"), path = require("path");
const ROOT = path.resolve(__dirname, "..");
const SCHEMA = path.join(ROOT, "db", "schema_live_20261116.sql");
const AFTER = ["2026-11-patients-order.sql"];   // migrations applied on top of the dump, in order (audit 4 fixes)
const U = {
  owner: "bad097d4-5edc-402b-ad59-f633252c35d9", admin2: "a0000000-0000-4000-8000-0000000000a2",
  agentA: "a0000000-0000-4000-8000-0000000000aa", agentB: "a0000000-0000-4000-8000-0000000000ab",
  spec: "a0000000-0000-4000-8000-0000000000c1", pending: "a0000000-0000-4000-8000-0000000000d1",
};
const R = { ali: "b0000000-0000-4000-8000-000000000001", ilkin: "b0000000-0000-4000-8000-000000000002", bos: "b0000000-0000-4000-8000-000000000003" };
const ROLES = ["anon", "authenticated", "service_role", "authenticator", "supabase_admin", "supabase_auth_admin", "supabase_storage_admin",
  "supabase_realtime_admin", "supabase_replication_admin", "supabase_read_only_user", "dashboard_user", "pgbouncer"];

async function build(pg, name, opts = {}) {
  const admin = await pg.conn("postgres");
  await admin.query("drop database if exists " + name);
  await admin.query("create database " + name);
  for (const r of ROLES) await admin.query(`do $$ begin if not exists (select 1 from pg_roles where rolname='${r}') then create role ${r} nologin; end if; end $$`);
  await admin.end();
  const c = await pg.conn(name);
  await c.query("drop schema public cascade; create schema extensions; create extension pgcrypto with schema extensions; create extension \"uuid-ossp\" with schema extensions;");
  await c.query(fs.readFileSync(SCHEMA, "utf8").split("\n").filter((l) => !/^\\/.test(l)).join("\n"));
  await c.query("reset all");   // the dump sets row_security = off etc. for its own session
  for (const f of (opts.after || AFTER)) await c.query(fs.readFileSync(path.join(ROOT, "sql", f), "utf8"));
  await seed(c);
  return c;
}

async function seed(c) {
  await c.query("set session_replication_role = replica");   // seed without audit/limit triggers
  for (const [k, id] of Object.entries(U)) await c.query("insert into auth.users (id, aud, role, email, created_at, updated_at) values ($1,'authenticated','authenticated',$2, now(), now())", [id, k + "@test.invalid"]);
  const staff = [[U.owner, "Owner", "admin"], [U.admin2, "Admin İki", "admin"], [U.agentA, "Agent A", "agent"], [U.agentB, "Agent B", "agent"], [U.spec, "Əli", "specialist"], [U.pending, "Gözləyən", null]];
  for (const [id, n, r] of staff) await c.query("insert into public.staff (id, name, role) values ($1,$2,$3)", [id, n, r]);
  await c.query("insert into public.readers (id, name, price, share, color) values ($1,'Əli',150,50,'#c9a24a'), ($2,'İlkin',150,50,'#4a7fc9'), ($3,'Boş',150,50,'#888888')", [R.ali, R.ilkin, R.bos]);
  await c.query("insert into public.services (id, name) values ('a2000000-0000-4000-8000-000000000001','Ruqya')");
  const ins = "insert into public.appts (id, reader_id, date, time, duration, name, phone, price, share, status, note, created_by) values ($1,$2,current_date+$3::int,$4,90,$5,$6,130,0,$7,'',$8)";
  await c.query(ins, ["c0000000-0000-4000-8000-000000000001", R.ali, 1, "10:00", "Pasiyent B-Əli", "050 000 00 01", "wait", U.agentB]);
  await c.query(ins, ["c0000000-0000-4000-8000-000000000002", R.ilkin, 1, "10:00", "Pasiyent B-İlkin", "050 000 00 02", "wait", U.agentB]);
  await c.query(ins, ["c0000000-0000-4000-8000-000000000003", R.ali, 2, "12:00", "Pasiyent A-Əli", "050 000 00 03", "wait", U.agentA]);
  await c.query(ins, ["c0000000-0000-4000-8000-000000000004", R.ali, -3, "12:00", "Ləğv B", "050 000 00 04", "cancel", U.agentB]);
  await c.query("insert into public.expenses (id, date, title, amount, created_by) values ('e0000000-0000-4000-8000-000000000001', current_date, 'İcarə', 100, $1), ('e0000000-0000-4000-8000-000000000002', current_date, 'Su', 5, $2)", [U.owner, U.agentB]);
  await c.query("insert into public.product_sales (id, date, amount, names, created_by) values ('f0000000-0000-4000-8000-000000000001', current_date, 20, 'Yağ', $1), ('f0000000-0000-4000-8000-000000000002', current_date, 30, 'Bal', $2)", [U.owner, U.agentB]);
  await c.query("insert into public.breaks (id, title, start_time, end_time) values ('d0000000-0000-4000-8000-000000000001','Namaz','13:00','13:30')");
  await c.query("insert into public.stat_edits (id, kind, per, period_start, agent_id, col, value, updated_by) values ('a1000000-0000-4000-8000-000000000001','sales','week',current_date,$1::text,'a',5,$1::uuid)", [U.agentB]);
  await c.query("insert into public.audit_log (uid, tbl, op, row_id, old) values ($1,'appts','DELETE','c0000000-0000-4000-8000-000000000099','{\"name\":\"Silinmiş\"}')", [U.agentB]);
  await c.query("set session_replication_role = origin");
}

// run fn(client) as a user (key of U, or "anon"); always rolled back; returns {ok, rows, rowCount, error}
async function as(c, who, sql, params) {
  await c.query("begin");
  try {
    if (who === "anon") { await c.query("set local role anon"); await c.query("select set_config('request.jwt.claims', '{\"role\":\"anon\"}', true)"); }
    else { await c.query("set local role authenticated"); await c.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: U[who], role: "authenticated", aud: "authenticated" })]); }
    const r = await c.query(sql, params);
    return { ok: true, rowCount: r.rowCount, rows: r.rows };
  } catch (e) { return { ok: false, error: e.message, code: e.code }; }
  finally { await c.query("rollback"); }
}
module.exports = { build, as, U, R, SCHEMA };
