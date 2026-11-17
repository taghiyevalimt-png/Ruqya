// P-05: the old patients are read page by page after the last key (ruqya_hist_patients_page), every one of 2500
// is listed; with a database that lacks the page function the app falls back to the offset pages (all still listed).
const { open, check, AGENT, seed, uuid, bakuToday, R1 } = require("../lib");
function many(n) {
  const db = seed(), now = new Date().toISOString();
  for (let i = 0; i < n; i++) db.appts.push({ id: uuid(), reader_id: R1, date: bakuToday(-100 - (i % 300)), time: "10:00", duration: 60, name: "Köhnə " + i, phone: "055 " + String(1000000 + i), price: 130, share: 0, status: "wait", note: "", settled: false, service: "Ruqya", confirmed: false, place: "ofis", follow: 0, created_by: AGENT, created_at: now, updated_at: now });
  return db;
}
async function run(noPage) {
  const s = await open(AGENT, { db: many(2500) });
  try {
    s.ctl.noPage = noPage;
    const p = s.page; await p.waitForSelector("#tabs:not([hidden])", { timeout: 15000 }); await p.waitForTimeout(3300);
    await p.click('#tabs [data-tab="patients"]'); await p.waitForTimeout(3500);
    for (const n of [0, 999, 1000, 1999, 2000, 2499]) {
      await p.fill("#q", String(1000000 + n)); await p.waitForTimeout(400);
      const names = await p.$$eval("#plist b", (b) => b.map((x) => x.textContent));
      check(names.includes("Köhnə " + n), (noPage ? "offset fallback" : "keyset pages") + ": patient «Köhnə " + n + "» of 2500 found: " + names.slice(0, 3).join(", "));
    }
    const calls = s.ctl.rpc || [];
    if (noPage) check(calls.includes("ruqya_hist_patients"), "without the page function the offset function is used: " + calls.join(","));
    else check(calls.filter((f) => f === "ruqya_hist_patients_page").length === 3 && !calls.includes("ruqya_hist_patients"), "2500 patients = 3 keyset pages, no offset function: " + calls.join(","));
    check(!s.errors.length, "no page errors: " + s.errors.join("; "));
  } finally { await s.close(); }
}
module.exports = async () => { await run(false); await run(true); };
