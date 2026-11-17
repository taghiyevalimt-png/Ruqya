// B-04: with more than 1000 patients in the older history, every one of them is still listed and found
// (the database answers at most 1000 rows per request, so the app must page through the grouped list).
const { open, check, AGENT, seed, uuid, bakuToday, R1 } = require("../lib");
module.exports = async () => {
  const db = seed(), now = new Date().toISOString();
  for (let i = 0; i < 1500; i++) { const d = bakuToday(-100 - (i % 300)); db.appts.push({ id: uuid(), reader_id: R1, date: d, time: "10:00", duration: 60, name: "Köhnə " + i, phone: "055 " + String(1000000 + i), price: 130, share: 0, status: "wait", note: "", settled: false, service: "Ruqya", confirmed: false, place: "ofis", follow: 0, created_by: AGENT, created_at: d + "T06:00:00Z", updated_at: d + "T06:00:00Z" }); }
  const s = await open(AGENT, { db });
  try {
    const p = s.page; await p.waitForSelector("text=Test Pasiyent"); await p.waitForTimeout(3300);
    await p.click('#tabs [data-tab="patients"]'); await p.waitForTimeout(3000);
    for (const n of [5, 999, 1001, 1499]) {
      await p.fill("#q", String(1000000 + n)); await p.waitForTimeout(400);   // unique phone digits
      const names = await p.$$eval("#plist b", (b) => b.map((x) => x.textContent));
      check(names.includes("Köhnə " + n), "patient «Köhnə " + n + "» found among 1500 old patients: " + names.slice(0, 5).join(", "));
    }
    check(!s.errors.length, "no page errors: " + s.errors.join("; "));
  } finally { await s.close(); }
};
