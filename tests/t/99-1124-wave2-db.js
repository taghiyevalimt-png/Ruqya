// 24.11 wave 2 — sql/2026-11-wave2.sql on the copy database:
//  ruqya_patient_marks: VIP = at least 5 visits not cancelled up to today; only rows the caller may read count
//  (a specialist sees his own column only); «mine» = a booking written by the caller; anon gets nothing.
//  ruqya_merge_patients: admins only; only keys of one number; gives every booking of those keys the chosen name;
//  bad names/keys refused. The rollback removes both functions.
const fs = require("fs"), path = require("path");
const { start } = require("../localpg"), { build, as, U, R } = require("../dbcopy"), { check } = require("../lib");
module.exports = async () => {
  const pg = await start(54393); let c;
  try {
    c = await build(pg, "wave2");
    await c.query("set session_replication_role = replica");
    const ins = "insert into public.appts (id, reader_id, date, time, duration, name, phone, price, share, status, note, created_by) values (gen_random_uuid(),$1,current_date+$2::int,'10:00',90,$3,$4,0,0,$5,'',$6)";
    // VIP: 3 visits with Əli, 2 with İlkin (owner sees 5; the specialist Əli only 3)
    for (const [r, d] of [[R.ali, -30], [R.ali, -20], [R.ali, -10], [R.ilkin, -5], [R.ilkin, -1]]) await c.query(ins, [r, d, "Vip Xanım", "055 555 55 55", "wait", U.agentA]);
    // 4 visits + 1 cancelled + 1 ahead: not VIP
    for (const [d, st] of [[-9, "wait"], [-8, "wait"], [-7, "wait"], [-6, "wait"], [-4, "cancel"], [3, "wait"]]) await c.query(ins, [R.ali, d, "Az Gələn", "055 444 44 44", st, U.agentA]);
    // a duplicate: the same number, the name written twice differently
    await c.query(ins, [R.ali, -2, "Aysel", "050 777 77 77", "wait", U.agentB]);
    await c.query(ins, [R.ali, 4, "Aysel Məmmədova", "+994 50 777 77 77", "wait", U.agentB]);
    await c.query("set session_replication_role = origin");
    const key = async (p, n) => (await c.query("select public.ruqya_pkey($1,$2) k", [p, n])).rows[0].k;
    const kVip = await key("055 555 55 55", "Vip Xanım"), kAz = await key("055 444 44 44", "Az Gələn");
    const marks = async (who) => { const r = await as(c, who, "select k, vip, mine from public.ruqya_patient_marks(5)"); check(r.ok, who + ": " + r.error); return r.rows; };
    let m = await marks("owner");
    check(m.some((x) => x.k === kVip && x.vip), "5 visits → VIP: " + JSON.stringify(m));
    check(!m.some((x) => x.k === kAz && x.vip), "4 visits + a cancelled one + one ahead → not VIP");
    check(!m.some((x) => x.mine), "the owner wrote none of them");
    m = await marks("spec");
    check(!m.some((x) => x.k === kVip && x.vip), "the specialist sees only his 3 → not VIP for him: " + JSON.stringify(m));
    m = await marks("agentB");
    const kB = await key("050 000 00 01", "Pasiyent B-Əli");
    check(m.some((x) => x.k === kB && x.mine && !x.vip), "agent B: his own patients marked «mine»: " + JSON.stringify(m));
    m = await marks("agentA");
    check(m.some((x) => x.k === kVip && x.vip && x.mine), "agent A: VIP and his");
    const an = await as(c, "anon", "select * from public.ruqya_patient_marks(5)");
    check(!an.ok, "anon cannot call it: " + JSON.stringify(an));
    // merge
    const arr = (...a) => "{" + a.map((x) => '"' + x + '"').join(",") + "}";
    const k1 = await key("050 777 77 77", "Aysel"), k2 = await key("+994 50 777 77 77", "Aysel Məmmədova");
    let r = await as(c, "agentB", "select public.ruqya_merge_patients($1, 'Aysel Məmmədova') n", [arr(k1, k2)]);
    check(!r.ok && /admin/i.test(r.error), "an agent cannot merge: " + JSON.stringify(r));
    r = await as(c, "owner", "select public.ruqya_merge_patients($1, 'X') n", [arr(k1, kVip)]);
    check(!r.ok && /eyni nomre/i.test(r.error), "keys of two numbers are refused: " + JSON.stringify(r));
    r = await as(c, "owner", "select public.ruqya_merge_patients($1, '   ') n", [arr(k1, k2)]);
    check(!r.ok, "an empty name is refused");
    await c.query("begin"); await c.query("set local role authenticated");
    await c.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: U.owner, role: "authenticated" })]);
    const n = (await c.query("select public.ruqya_merge_patients($1, ' Aysel  Məmmədova ') n", [arr(k1, k2)])).rows[0].n;
    await c.query("commit");
    const names = (await c.query("select distinct name from public.appts where phone in ('050 777 77 77','+994 50 777 77 77')")).rows.map((x) => x.name);
    check(n === 1 && names.length === 1 && names[0] === "Aysel Məmmədova", "merged: one name for both, 1 row changed: " + JSON.stringify([n, names]));
    const au = (await c.query("select count(*)::int n from public.audit_log where tbl = 'appts' and op = 'UPDATE'")).rows[0].n;
    check(au >= 1, "the change is in the audit log");
    // rights: only authenticated may execute
    const g = (await c.query("select has_function_privilege('anon', 'public.ruqya_merge_patients(text[], text)', 'execute') a, has_function_privilege('authenticated', 'public.ruqya_merge_patients(text[], text)', 'execute') b")).rows[0];
    check(!g.a && g.b, "execute: authenticated only: " + JSON.stringify(g));
    // rollback
    await c.query(fs.readFileSync(path.join(__dirname, "..", "..", "sql", "rollback-2026-11-wave2.sql"), "utf8"));
    const left = (await c.query("select count(*)::int n from pg_proc where proname in ('ruqya_patient_marks','ruqya_merge_patients')")).rows[0].n;
    check(left === 0, "the rollback removes both functions");
  } finally { if (c) await c.end(); await pg.stop(); }
};
