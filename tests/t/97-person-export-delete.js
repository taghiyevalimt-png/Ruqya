// T-42 (requirement 5): one person's data can be exported and then erased, and a search of every text and JSON
// column of every table finds nothing of them afterwards — on the copy database with made-up data.
// The person has a booking, a changed booking (journal UPDATE) and a deleted booking (journal DELETE).
// PERSON_OUT=<file> writes the export (made-up data only).
const fs = require("fs");
const { start } = require("../localpg"), { build, U, R } = require("../dbcopy"), { check } = require("../lib");
const NAME = "Zərifə Testova", PHONE = "055 777 66 55", KEY = "p557776655", NOTE = "baş ağrısı (test)";
module.exports = async () => {
  const pg = await start(54354); let c;
  try {
    c = await build(pg, "person");
    const owner = async (sql, args) => { await c.query("begin"); await c.query("set local role authenticated"); await c.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: U.owner, role: "authenticated" })]); try { const r = await c.query(sql, args); await c.query("commit"); return r; } catch (e) { await c.query("rollback"); throw e; } };
    const ins = "insert into public.appts (id, reader_id, date, time, duration, name, phone, price, share, status, note, created_by) values ($1,$2,current_date-$3::int,$4,60,$5,$6,130,0,'wait',$7,$8)";
    await owner(ins, ["d0000000-0000-4000-8000-000000000001", R.ali, 30, "11:00", NAME, PHONE, NOTE, U.owner]);
    await owner(ins, ["d0000000-0000-4000-8000-000000000002", R.ilkin, 60, "11:00", NAME, PHONE, "", U.owner]);
    await owner(ins, ["d0000000-0000-4000-8000-000000000003", R.ali, 90, "11:00", NAME, PHONE, "", U.owner]);
    await owner("update public.appts set note = $1 where id = 'd0000000-0000-4000-8000-000000000002'", [NOTE + " 2"]);
    await owner("delete from public.appts where id = 'd0000000-0000-4000-8000-000000000003'");
    // 1. export: every booking of the person and every journal entry about them, as the admin
    const exp = {
      bookings: (await owner("select id, reader_id, date, time, duration, name, phone, price, status, note, place, created_at from public.appts where public.ruqya_pkey(phone, name) = $1 order by date", [KEY])).rows,
      // the journal by booking id: change entries keep only the changed fields (and the name), not the phone
      journal: (await owner(`select id, at, tbl, op, row_id, old, new from public.audit_log where tbl = 'appts' and row_id in (
          select id::text from public.appts where public.ruqya_pkey(phone, name) = $1
          union select row_id from public.audit_log where tbl = 'appts' and op = 'DELETE' and public.ruqya_pkey(old->>'phone', old->>'name') = $1) order by id`, [KEY])).rows,
    };
    check(exp.bookings.length === 2, "export: the person's 2 current bookings: " + exp.bookings.length);
    check(exp.journal.some((j) => j.op === "DELETE") && exp.journal.some((j) => j.op === "UPDATE"), "export: the journal has the deleted and the changed booking: " + exp.journal.map((j) => j.op).join(","));
    if (process.env.PERSON_OUT) fs.writeFileSync(process.env.PERSON_OUT, JSON.stringify({ at: new Date().toISOString(), person: "made-up test person", key: KEY, ...exp }, null, 1));
    // 2. erase
    const n = (await owner("select public.ruqya_anonymize($1) n", [KEY])).rows[0].n;
    check(n === 3, "ruqya_anonymize handled 3 bookings (2 current + 1 deleted): " + n);
    // 3. search everything: every text/varchar/jsonb column of every table in public (as the table owner, no RLS)
    const cols = (await c.query("select table_name, column_name, data_type from information_schema.columns where table_schema = 'public' and data_type in ('text','character varying','jsonb','json') order by 1, 2")).rows;
    const hits = [];
    for (const col of cols) for (const needle of [NAME, "Zərifə", "Testova", "7776655", "777 66 55", "baş ağrısı"]) {
      const r = await c.query(`select count(*)::int n from public.${col.table_name} where ${col.column_name}::text ilike $1`, ["%" + needle + "%"]);
      if (r.rows[0].n) hits.push(col.table_name + "." + col.column_name + " ~ " + needle + " ×" + r.rows[0].n);
    }
    check(cols.length > 20, "searched " + cols.length + " text/JSON columns of " + new Set(cols.map((x) => x.table_name)).size + " tables");
    check(hits.length === 0, "nothing of the person is left anywhere: " + hits.join("; "));
  } finally { if (c) await c.end().catch(() => {}); await pg.stop(); }
};
