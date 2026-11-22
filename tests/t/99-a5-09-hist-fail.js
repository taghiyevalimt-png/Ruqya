// A5-09 (audit 5, Г2 «no list is cut silently»): when the patients older than the loaded window could not be loaded
// (server error), the «loading» note simply disappeared and the list showed only the recent patients, as if complete.
// Now the list says it is incomplete and loads again by itself.
const { open, check, OWNER, AGENT, seed, R1, bakuToday, uuid } = require("../lib");
module.exports = async () => {
  const db = seed(), now = new Date().toISOString();
  const mk = (off, name, phone) => ({ id: uuid(), reader_id: R1, date: bakuToday(off), time: "10:00", duration: 90, name, phone, price: 130, share: 0, status: "wait", note: "", settled: false, service: "Ruqya", confirmed: false, place: "ofis", follow: 0, created_by: AGENT, created_at: now, updated_at: now });
  const old = new Date(Date.now() - 200 * 864e5).toISOString();
  db.appts = [{ ...mk(-200, "Köhnə Sınaq", "0501110009"), created_at: old, updated_at: old }, mk(-2, "Təzə Sınaq", "0501110008")];
  const s = await open(OWNER, { db });
  try {
    const p = s.page; let bad = 0;
    await p.route("**/rest/v1/rpc/ruqya_hist_patients*", (r) => (bad < 1 ? (bad++, r.fulfill({ status: 503, contentType: "application/json", body: '{"message":"Service Unavailable"}' })) : r.fallback()));
    await p.locator("#tabs:not([hidden])").waitFor({ timeout: 15000 }); await p.click('#tabs [data-tab="patients"]'); await p.waitForTimeout(2500);
    const t1 = await p.evaluate(() => document.body.innerText);
    check(bad === 1, "the old patients were asked for and failed once: " + bad);
    check(/Təzə Sınaq/.test(t1) && !/Köhnə Sınaq/.test(t1), "only the recent patient is there during the failure: " + t1.slice(0, 400).replace(/\n/g, " | "));
    check(/natamam/i.test(t1), "the list says it is incomplete: " + t1.slice(0, 300).replace(/\n/g, " | "));
    await p.waitForTimeout(24000);
    const t2 = await p.evaluate(() => document.body.innerText);
    check(/Köhnə Sınaq/.test(t2) && !/natamam/i.test(t2), "loaded again by itself; the note is gone");
    check(!s.errors.length, "no page errors: " + s.errors.join("; "));
  } finally { await s.close(); }
};
