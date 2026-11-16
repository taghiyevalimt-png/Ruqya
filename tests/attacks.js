// Requests that try to get around the app (direct database requests with a normal account). Each entry:
// [id, description, who, sql, check(result, client) -> true when the attack FAILED (the data is safe)].
const B = "'c0000000-0000-4000-8000-000000000001'", BI = "'c0000000-0000-4000-8000-000000000002'", CAN = "'c0000000-0000-4000-8000-000000000004'";
const AGENTB = "'a0000000-0000-4000-8000-0000000000ab'", ALI = "'b0000000-0000-4000-8000-000000000001'", ILKIN = "'b0000000-0000-4000-8000-000000000002'";
const denied = (r) => !r.ok || r.rowCount === 0;
const ATTACKS = [
  ["X-01", "agent writes a booking in another agent's name (created_by)", "agentA",
    `insert into public.appts (reader_id,date,time,duration,name,phone,price,share,status,note,created_by) values (${ALI},current_date+6,'16:00',90,'Saxta','050 111 22 33',130,0,'wait','',${AGENTB}) returning created_by`,
    (r) => !r.ok || r.rows[0].created_by !== "a0000000-0000-4000-8000-0000000000ab"],
  ["X-02", "agent moves another agent's booking to himself (created_by)", "agentA", `update public.appts set created_by='a0000000-0000-4000-8000-0000000000aa' where id=${B} returning created_by`,
    (r) => !r.ok || r.rowCount === 0 || r.rows[0].created_by === "a0000000-0000-4000-8000-0000000000ab"],   // the writer stays agentB
  ["X-03", "specialist reads another specialist's sessions", "spec", `select id from public.appts where id=${BI}`, denied],
  ["X-04", "specialist reads all sessions (enumeration)", "spec", `select reader_id from public.appts`, (r) => r.ok && r.rows.every((x) => x.reader_id === "b0000000-0000-4000-8000-000000000001")],
  ["X-05", "specialist writes into another specialist's column", "spec", `insert into public.appts (reader_id,date,time,duration,name,phone,price,share,status,note) values (${ILKIN},current_date+6,'16:00',90,'X','050 111 22 33',130,0,'wait','')`, (r) => !r.ok],
  ["X-06", "agent makes himself admin", "agentA", `update public.staff set role='admin' where id='a0000000-0000-4000-8000-0000000000aa'`, (r) => !r.ok || r.rowCount === 0],
  ["X-07", "account without role gives itself a role", "pending", `update public.staff set role='agent' where id='a0000000-0000-4000-8000-0000000000d1'`, (r) => !r.ok || r.rowCount === 0],
  ["X-08", "account without role reads the bookings", "pending", `select id from public.appts`, (r) => r.ok && r.rowCount === 0],
  ["X-09", "agent reads specialists' price and share", "agentA", `select price, share from public.readers`, (r) => !r.ok],
  ["X-10", "agent restores a deleted booking from the journal", "agentA", `select public.ruqya_restore((select max(id) from public.audit_log))`, (r) => !r.ok],
  ["X-11", "agent wipes a patient's data", "agentA", `select public.ruqya_anonymize('p000000001')`, (r) => !r.ok],
  ["X-12", "agent changes a specialist's colour", "agentA", `select public.ruqya_set_color(${ALI},'#000000')`, (r) => !r.ok],
  ["X-13", "anonymous calls a database function", "anon", `select public.ruqya_sees_all()`, (r) => !r.ok],
  ["X-14", "anonymous reads bookings", "anon", `select id from public.appts`, (r) => !r.ok || r.rowCount === 0],
  ["X-15", "agent records a statistics number for another agent", "agentA", `insert into public.stat_edits (kind,per,period_start,agent_id,col,value) values ('sales','week',current_date+14,'a0000000-0000-4000-8000-0000000000ab','a',99)`, (r) => !r.ok],
  ["X-16", "agent lists other agents' expenses (enumeration)", "agentA", `select created_by from public.expenses`, (r) => r.ok && r.rows.every((x) => x.created_by === "a0000000-0000-4000-8000-0000000000aa")],
  ["X-17", "agent reads the change journal", "agentA", `select id from public.audit_log`, (r) => r.ok && r.rowCount === 0],
  ["X-18", "admin edits the change journal", "admin2", `update public.audit_log set old=null`, (r) => !r.ok || r.rowCount === 0],
  ["X-19", "owner deletes the change journal", "owner", `delete from public.audit_log`, (r) => !r.ok || r.rowCount === 0],
  ["X-20", "agent confirms a cancelled booking", "agentA", `update public.appts set confirmed=true where id=${CAN}`, (r) => !r.ok],
  ["X-21", "agent changes the price of another agent's booking", "agentA", `update public.appts set price=1 where id=${B}`, (r) => !r.ok || r.rowCount === 0],
  ["X-22", "specialist changes his own name to another specialist's (takes over a column)", "spec", `update public.staff set name='İlkin' where id='a0000000-0000-4000-8000-0000000000c1'`, (r) => !r.ok || r.rowCount === 0],
  ["X-23", "agent sets follow-up on an active booking", "agentA", `update public.appts set follow=3 where id=${B}`, (r) => !r.ok],
  ["X-24", "huge text into a booking note (storage abuse)", "agentA", `insert into public.appts (reader_id,date,time,duration,name,phone,price,share,status,note) values (${ALI},current_date+7,'09:00',90,'X','050 111 22 33',130,0,'wait',repeat('x',100000))`, (r) => !r.ok],
  ["X-25", "SQL injection text is stored as text, not run", "agentA", `insert into public.appts (reader_id,date,time,duration,name,phone,price,share,status,note) values (${ALI},current_date+7,'11:00',90,'x''); drop table public.appts; --','050 111 22 33',130,0,'wait','') returning name`, (r) => r.ok && /drop table/.test(r.rows[0].name)],
  ["X-26", "agent deletes his own staff row (hides his history)", "agentA", `delete from public.staff where id='a0000000-0000-4000-8000-0000000000aa'`, (r) => !r.ok || r.rowCount === 0],
  ["X-27", "more than 300 changes in an hour by one agent are refused", "agentA",
    `do $$ begin for i in 1..305 loop update public.appts set note='n'||i where id='c0000000-0000-4000-8000-000000000003'; end loop; end $$`, (r) => !r.ok && /cox deyisiklik/i.test(r.error)],
];
module.exports = { ATTACKS };
