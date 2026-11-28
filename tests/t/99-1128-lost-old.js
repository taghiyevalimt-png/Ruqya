// 28.11 (found in the check): «Pasiyentlər → Qayıtmayanlar» (came 14–90 days ago, booked nothing since) lost every patient
// whose last visit was older than the weeks the app keeps loaded (≈ 45–65 days): those visits come grouped from the
// database. Now the last visit that took place counts there too — with the new «lastok» column and, on a database without
// it, from the group's last day.
const { open, check, OWNER, seed, R1, bakuToday, uuid } = require("../lib");
module.exports = async () => {
  const mk = () => { const db = seed(), b = db.appts[0];
    const add = (off, name, phone, o) => { const at = new Date(Date.now() + Math.min(0, off) * 864e5).toISOString(); db.appts.push(Object.assign({}, b, { id: uuid(), reader_id: R1, date: bakuToday(off), time: "10:00", name, phone, created_at: at, updated_at: at }, o || {})); };   // written on the day of the visit
    db.appts = [];
    add(-80, "Səksən Gün", "0501230001");                          // came 80 days ago: must be in the list
    add(-80, "Gələcəyi Var", "0501230002"); add(3, "Gələcəyi Var", "0501230002");   // has a booking ahead: not
    add(-100, "Yüz Gün", "0501230003");                            // more than 90 days: not
    add(-80, "Ləğv Edən", "0501230004", { status: "cancel" });     // only a cancelled one: not
    add(-20, "İyirmi Gün", "0501230005");                          // a loaded one: in the list, as before
    return db };
  for (const noLastOk of [false, true]) {
    const s = await open(OWNER, { db: mk() });
    try {
      const p = s.page; s.ctl.noLastOk = noLastOk;
      await p.locator("#tabs:not([hidden])").waitFor({ timeout: 15000 }); await p.waitForTimeout(1500);
      await p.click('#tabs [data-tab="patients"]'); await p.waitForTimeout(300);
      await p.click('[data-act="p-sec"][data-id="lost"]'); await p.waitForTimeout(1500);
      const txt = await p.textContent("#plist"), tag = noLastOk ? "older database: " : "";
      check(/Səksən Gün/.test(txt), tag + "a patient who came 80 days ago is in «Qayıtmayanlar»: " + txt.slice(0, 300));
      check(/80/.test(await p.$eval("#plist", (el) => [...el.querySelectorAll(".card")].find((c) => /Səksən Gün/.test(c.textContent)).querySelector(".time").textContent)), tag + "«80 gün»");
      check(/İyirmi Gün/.test(txt) && !/Gələcəyi Var|Yüz Gün|Ləğv Edən/.test(txt), tag + "the others as before: " + txt.slice(0, 300));
      check(!s.errors.length, "no page errors: " + s.errors.join(" | "));
    } finally { await s.close(); }
  }
};
