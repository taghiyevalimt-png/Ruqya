// Owner 28.11: «Hər mütəxəssis tətbiqdə statistikaya daxil olanda hansı satış agentinin ona neçə pasiyent yazdığını görsün».
// A specialist opens Statistika (also without products): «Bugün» and the four periods; one table «Sizə kim neçə seans yazıb»
// with only his own column: Yazdı by the day written (cancelled too), Ləğv by the session day; another column does not count.
const { open, check, seed, SPEC, AGENT, OWNER, R1, R2, bakuToday, uuid } = require("../lib");
module.exports = async () => {
  const db = seed(), base = db.appts[0], now = new Date().toISOString();
  const add = (o) => db.appts.push(Object.assign({}, base, { id: uuid(), created_at: now, updated_at: now }, o));
  db.appts = []; db.products = [];
  const t = bakuToday(), t1 = bakuToday(1), t5 = bakuToday(5);
  add({ reader_id: R1, date: t1, time: "10:00", created_by: AGENT });
  add({ reader_id: R1, date: t1, time: "11:00", created_by: AGENT, name: "Sabah" });
  add({ reader_id: R1, date: t, time: "13:00", created_by: AGENT, status: "cancel", name: "Ləğv olan" });
  add({ reader_id: R1, date: t5, time: "12:00", created_by: OWNER, name: "Adminin" });
  add({ reader_id: R2, date: t1, time: "12:00", created_by: AGENT, name: "Başqa sütun" });
  add({ reader_id: R2, date: t1, time: "14:00", created_by: AGENT, name: "Başqa sütun 2" });
  const s = await open(SPEC, { db });
  try {
    const p = s.page; await p.locator("#tabs:not([hidden])").waitFor({ timeout: 15000 }); await p.waitForTimeout(1200);
    check(await p.locator('#tabs [data-tab="stats"]').isVisible(), "a specialist sees the Statistika tab (no products in the database)");
    await p.click('#tabs [data-tab="stats"]'); await p.waitForTimeout(600);
    const secs = await p.$$eval('#top [data-act="st-sec"]', (xs) => xs.map((x) => x.dataset.id));
    check(JSON.stringify(secs.slice(0, 5)) === JSON.stringify(["today", "cweek", "week", "cmonth", "month"]), "Bugün and the four periods: " + secs);
    await p.click('#top [data-act="st-sec"][data-id="today"]'); await p.waitForTimeout(400);
    const rows = async () => p.$$eval('[data-st^="spag-"] tbody tr', (xs) => xs.map((x) => [...x.cells].map((c) => c.textContent.trim()).join("|")));
    const foot = async () => p.$eval('[data-st^="spag-"] tfoot tr', (x) => [...x.cells].map((c) => c.textContent.trim()).join("|"));
    check(/Sizə kim neçə seans yazıb/.test(await p.textContent("#main")), "the table title");
    let r = await rows();
    check(r[0] === "Nurlana|3|0|1" && r[1] === "Admin|1|0|0" && r.length === 2, "today: Nurlana wrote 3 (one cancelled), Admin 1, other column not counted: " + JSON.stringify(r));
    check(await foot() === "Cəmi|4|0|1", "total row: " + await foot());
    await p.click('#top [data-act="st-sec"][data-id="cweek"]'); await p.waitForTimeout(400);
    r = await rows(); check(r[0] && r[0].indexOf("Nurlana|3|") === 0, "this week: Nurlana 3: " + JSON.stringify(r));
    check(!/Satış statistikası|Ümumi cədvəl/.test(await p.textContent("#main")), "no agents' sales tables for a specialist");
    check(!s.errors.length, "no page errors: " + s.errors.join(" | "));
  } finally { await s.close(); }
  // Russian
  const s2 = await open(SPEC, { db, lang: "ru" });
  try {
    const p = s2.page; await p.locator("#tabs:not([hidden])").waitFor({ timeout: 15000 }); await p.waitForTimeout(1200);
    await p.click('#tabs [data-tab="stats"]'); await p.waitForTimeout(600);
    check(/Кто сколько сеансов вам записал/.test(await p.textContent("#main")), "Russian title");
    check(!s2.errors.length, "no page errors (ru): " + s2.errors.join(" | "));
  } finally { await s2.close(); }
};
