// Owner 18.11 (sql/2026-11-paid-online.sql): the «Ödəniş edib» mark (appts.settled) can be set and taken back by anybody
// who sees the session, like «Təsdiqləyib»; other fields of someone else's booking stay closed; rollback.
const fs = require("fs"), path = require("path");
const { start } = require("../localpg"), { build, as } = require("../dbcopy"), { check } = require("../lib");
module.exports = async () => {
  const pg = await start(54373); let c;
  try {
    c = await build(pg, "paidonline", { after: ["2026-11-patients-order.sql", "2026-11-least-privilege.sql", "2026-11-patients-scale.sql", "2026-11-service.sql", "2026-11-owner-notes.sql", "2026-11-my-contacts.sql"] });
    const id = "'c0000000-0000-4000-8000-000000000001'";   // agentB's booking in column Əli
    let r = await as(c, "agentA", "update public.appts set settled = true where id = " + id);
    check(!r.ok, "before: another agent cannot set the mark: " + (r.ok ? "allowed" : r.code));
    await c.query(fs.readFileSync(path.join(__dirname, "..", "..", "sql", "2026-11-paid-online.sql"), "utf8"));
    r = await as(c, "agentA", "update public.appts set settled = true where id = " + id); check(r.ok && r.rowCount === 1, "another agent sets «Ödəniş edib»: " + (r.ok ? r.rowCount : r.error));
    r = await as(c, "spec", "update public.appts set settled = true where id = " + id); check(r.ok && r.rowCount === 1, "the specialist of the column sets it: " + (r.ok ? r.rowCount : r.error));
    r = await as(c, "agentA", "update public.appts set settled = true, price = 1 where id = " + id); check(!r.ok && r.code === "42501", "together with the price: refused: " + (r.ok ? "allowed" : r.code));
    r = await as(c, "agentA", "update public.appts set price = 1 where id = " + id); check(!r.ok, "someone else's price stays closed");
    r = await as(c, "agentB", "update public.appts set settled = true, price = 200 where id = " + id); check(r.ok && r.rowCount === 1, "the writer changes everything as before");
    r = await as(c, "pending", "update public.appts set settled = true where id = " + id); check(!r.ok || r.rowCount === 0, "a person without a role changes nothing");
    await c.query(fs.readFileSync(path.join(__dirname, "..", "..", "sql", "rollback-2026-11-paid-online.sql"), "utf8"));
    r = await as(c, "agentA", "update public.appts set settled = true where id = " + id); check(!r.ok, "after the rollback: closed again");
  } finally { if (c) await c.end().catch(() => {}); await pg.stop(); }
};
