// Reference access matrix: table × operation × role. 1 = allowed, 0 = refused. Each cell is one concrete request
// on the copy (tests/dbcopy.js); the target rows belong to someone else (agentB), unless the operation itself is
// "create my own row". Roles: anon (no sign-in), pending (account without role), spec (specialist of column Əli),
// agentA (sales agent), admin2 (admin), owner (main admin).
const ROLES = ["anon", "pending", "spec", "agentA", "admin2", "owner"];
const A1 = "'c0000000-0000-4000-8000-000000000001'";   // agentB's booking in column Əli
const M = {
  appts: {
    SELECT: ["select id from public.appts where id=" + A1, [0, 0, 1, 1, 1, 1]],
    INSERT: ["insert into public.appts (reader_id,date,time,duration,name,phone,price,share,status,note,place) values ('b0000000-0000-4000-8000-000000000001', current_date+5,'15:00',90,'Yeni','050 111 22 33',130,0,'wait','','ofis')", [0, 0, 1, 1, 1, 1]],
    UPDATE: ["update public.appts set price=200 where id=" + A1, [0, 0, 0, 0, 1, 1]],
    DELETE: ["delete from public.appts where id=" + A1, [0, 0, 0, 0, 1, 1]],
  },
  readers: {
    SELECT: ["select id, name from public.readers where id='b0000000-0000-4000-8000-000000000001'", [0, 1, 1, 1, 1, 1]],
    INSERT: ["insert into public.readers (name) values ('Yeni Mütəxəssis')", [0, 0, 0, 0, 1, 1]],
    UPDATE: ["update public.readers set archived=true where id='b0000000-0000-4000-8000-000000000003'", [0, 0, 0, 0, 1, 1]],
    DELETE: ["delete from public.readers where id='b0000000-0000-4000-8000-000000000003'", [0, 0, 0, 0, 1, 1]],
  },
  staff: {
    SELECT: ["select id from public.staff where id='a0000000-0000-4000-8000-0000000000ab'", [0, 0, 1, 1, 1, 1]],
    INSERT: ["insert into public.staff (id, name) values ('a0000000-0000-4000-8000-0000000000ee','Yad adam')", [0, 0, 0, 0, 0, 0]],
    UPDATE: ["update public.staff set name='Agent B2' where id='a0000000-0000-4000-8000-0000000000ab'", [0, 0, 0, 0, 1, 1]],
    DELETE: ["delete from public.staff where id='a0000000-0000-4000-8000-0000000000ab'", [0, 0, 0, 0, 0, 0]],
  },
  breaks: {
    SELECT: ["select id from public.breaks", [0, 0, 1, 1, 1, 1]],
    INSERT: ["insert into public.breaks (title, start_time, end_time) values ('Yemək','15:00','15:30')", [0, 0, 0, 1, 1, 1]],
    UPDATE: ["update public.breaks set title='Namaz 2' where id='d0000000-0000-4000-8000-000000000001'", [0, 0, 0, 1, 1, 1]],
    DELETE: ["delete from public.breaks where id='d0000000-0000-4000-8000-000000000001'", [0, 0, 0, 1, 1, 1]],
  },
  expenses: {
    SELECT: ["select id from public.expenses where id='e0000000-0000-4000-8000-000000000002'", [0, 0, 0, 0, 1, 1]],
    INSERT: ["insert into public.expenses (date, title, amount) values (current_date,'Çay',3)", [0, 0, 0, 1, 1, 1]],
    UPDATE: ["update public.expenses set amount=9 where id='e0000000-0000-4000-8000-000000000002'", [0, 0, 0, 0, 1, 1]],
    DELETE: ["delete from public.expenses where id='e0000000-0000-4000-8000-000000000002'", [0, 0, 0, 0, 1, 1]],
  },
  product_sales: {
    // owner 22.11: agents and admins see every sale, a specialist sells too and sees only his own (audit 6: matrix
    // brought up to that decision — it still had the earlier «admins only see sales, specialists do not sell»)
    SELECT: ["select id from public.product_sales where id='f0000000-0000-4000-8000-000000000002'", [0, 0, 0, 1, 1, 1]],
    INSERT: ["insert into public.product_sales (date, amount, names) values (current_date, 15, 'Su')", [0, 0, 1, 1, 1, 1]],
    UPDATE: ["update public.product_sales set amount=99 where id='f0000000-0000-4000-8000-000000000002'", [0, 0, 0, 0, 1, 1]],
    DELETE: ["delete from public.product_sales where id='f0000000-0000-4000-8000-000000000002'", [0, 0, 0, 0, 1, 1]],
  },
  stat_edits: {
    SELECT: ["select id from public.stat_edits where id='a1000000-0000-4000-8000-000000000001'", [0, 0, 0, 0, 1, 1]],
    INSERT: ["insert into public.stat_edits (kind, per, period_start, agent_id, col, value) values ('sales','week',current_date+7,(select auth.uid())::text,'a',3)", [0, 0, 0, 1, 1, 1]],
    UPDATE: ["update public.stat_edits set value=8 where id='a1000000-0000-4000-8000-000000000001'", [0, 0, 0, 0, 1, 1]],
    DELETE: ["delete from public.stat_edits where id='a1000000-0000-4000-8000-000000000001'", [0, 0, 0, 0, 1, 1]],
  },
  services: {
    SELECT: ["select id from public.services", [0, 1, 1, 1, 1, 1]],
    INSERT: ["insert into public.services (name) values ('Yeni')", [0, 0, 0, 0, 0, 1]],
    UPDATE: ["update public.services set name='Ruqya 2' where id='a2000000-0000-4000-8000-000000000001'", [0, 0, 0, 0, 0, 1]],
    DELETE: ["delete from public.services where id='a2000000-0000-4000-8000-000000000001'", [0, 0, 0, 0, 0, 1]],
  },
  products: {
    SELECT: ["select id from public.products where id='a3000000-0000-4000-8000-000000000001'", [0, 0, 1, 1, 1, 1]],
    INSERT: ["insert into public.products (name, price) values ('Yeni məhsul', 5)", [0, 0, 0, 0, 1, 1]],
    UPDATE: ["update public.products set price=4 where id='a3000000-0000-4000-8000-000000000001'", [0, 0, 0, 0, 1, 1]],
    DELETE: ["delete from public.products where id='a3000000-0000-4000-8000-000000000001'", [0, 0, 0, 0, 1, 1]],
  },
  product_shares: {   // agentB's share: another agent and a specialist do not see it
    SELECT: ["select pct from public.product_shares where staff_id='a0000000-0000-4000-8000-0000000000ab'", [0, 0, 0, 0, 1, 1]],
    INSERT: ["insert into public.product_shares (product_id, staff_id, pct) values ('a3000000-0000-4000-8000-000000000001',(select auth.uid()),50)", [0, 0, 0, 0, 1, 1]],
    UPDATE: ["update public.product_shares set pct=90 where staff_id='a0000000-0000-4000-8000-0000000000ab'", [0, 0, 0, 0, 1, 1]],
    DELETE: ["delete from public.product_shares where staff_id='a0000000-0000-4000-8000-0000000000ab'", [0, 0, 0, 0, 1, 1]],
  },
  service_shares: {
    SELECT: ["select pct from public.service_shares where reader_id='b0000000-0000-4000-8000-000000000001'", [0, 0, 0, 0, 1, 1]],
    INSERT: ["insert into public.service_shares (reader_id, service, pct) values ('b0000000-0000-4000-8000-000000000001','Hicama',90)", [0, 0, 0, 0, 1, 1]],
    UPDATE: ["update public.service_shares set pct=90 where reader_id='b0000000-0000-4000-8000-000000000001'", [0, 0, 0, 0, 1, 1]],
    DELETE: ["delete from public.service_shares where reader_id='b0000000-0000-4000-8000-000000000001'", [0, 0, 0, 0, 1, 1]],
  },
  audit_log: {
    SELECT: ["select id from public.audit_log where op='DELETE'", [0, 0, 0, 0, 1, 1]],
    INSERT: ["insert into public.audit_log (tbl, op, row_id) values ('appts','DELETE','x')", [0, 0, 0, 0, 0, 0]],
    UPDATE: ["update public.audit_log set row_id='y' where op='DELETE'", [0, 0, 0, 0, 0, 0]],
    DELETE: ["delete from public.audit_log where op='DELETE'", [0, 0, 0, 0, 0, 0]],
  },
};
module.exports = { ROLES, M };
