// 24.11 (Nurlana's screenshot «Yadda saxlanmadı: yazılan məlumat düzgün deyil»): since 23.11 the app saves a new booking
// with price 0 (no price field), but the database rule still wanted price > 0 and refused every new booking
// (8 on 23.11 after 23:10). sql/2026-11-no-price.sql: price 0 is allowed, a negative one still is not; the other rules
// stay; the rollback restores «> 0». The test sends exactly what the app sends.
const fs = require("fs"), path = require("path");
const { start } = require("../localpg"), { build, as, U, R } = require("../dbcopy"), { check } = require("../lib");
module.exports = async () => {
  const pg = await start(54384); let c;
  try {
    c = await build(pg, "noprice");
    const ins = (price, extra) => "insert into public.appts (id, reader_id, date, time, duration, name, phone, price, share, status, note, service, place) values (gen_random_uuid(), '" + R.ali + "', current_date + 30, '10:00', 90, 'Natiq', '055 409 16 97', " + price + ", 0, 'wait', '', " + (extra || "'Ruqya', 'ofis'") + ")";
    let r = await as(c, "agentA", ins(0)); check(r.ok, "an agent's new booking without a price is saved: " + (r.ok ? "" : r.error));
    r = await as(c, "spec", ins(0)); check(r.ok, "a specialist's too: " + (r.ok ? "" : r.error));
    r = await as(c, "agentA", ins(-5)); check(!r.ok, "a negative price is still refused");
    r = await as(c, "agentA", ins(0, "'Yoxdur', 'ofis'")); check(!r.ok, "the other rules stay (service)");
    await c.query(fs.readFileSync(path.join(__dirname, "..", "..", "sql", "rollback-2026-11-no-price.sql"), "utf8"));
    r = await as(c, "agentA", ins(0)); check(!r.ok, "after the rollback price 0 is refused again (as before 24.11)");
  } finally { if (c) await c.end().catch(() => {}); await pg.stop(); }
};
