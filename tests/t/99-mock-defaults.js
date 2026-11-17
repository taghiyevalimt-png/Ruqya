// T-03 (stage 8 soak): the made-up database of the tests must behave like the real table. A booking saved from the
// form sends only the fields it fills; the real appts table fills the rest with its defaults (live schema
// 17.11: settled false, service 'Ruqya', duration 90, confirmed false, place 'ofis', follow 0, phone/note ''). Without
// them the app's column checks (select=follow / confirmed / place … limit 1) got 400 «column does not exist» on every
// load after the first saved booking — 180 such answers in the 2-hour soak, which the real service never gives.
const { open, check, AGENT, R2 } = require("../lib");
module.exports = async () => {
  const s = await open(AGENT);
  try {
    const p = s.page, bad = [];
    p.on("response", (r) => { if (r.status() >= 400 && /\/rest\/v1\/appts/.test(r.url())) bad.push(r.request().method() + " " + r.status()); });
    await p.locator("#tabs:not([hidden])").waitFor({ timeout: 15000 }); await p.waitForTimeout(3300);
    await p.click('#tabs [data-tab="day"]'); await p.click("#fab"); await p.locator("#f-reader").first().waitFor({ timeout: 5000 });
    await p.selectOption("#f-reader", R2); await p.fill("#f-time", "09:00"); await p.fill("#f-name", "Defolt Yoxla"); await p.fill("#f-phone", "050 000 00 77");
    await p.click('[data-act="save-appt"]'); await p.waitForTimeout(800);
    const row = s.db.appts.find((a) => a.name === "Defolt Yoxla");
    check(row, "the booking was saved");
    for (const [k, v] of Object.entries({ settled: false, service: "Ruqya", duration: 90, confirmed: false, place: "ofis", follow: 0 }))
      check(row && k in row, "saved row has column " + k + " (real default " + JSON.stringify(v) + ")");
    // the app's own load after the save: its column checks must answer 200
    await p.evaluate(() => document.dispatchEvent(new Event("visibilitychange"))); await p.waitForTimeout(1500);
    check(!bad.length, "no 4xx from appts after the save: " + JSON.stringify(bad));
  } finally { await s.close(); }
};
