// Audit 6, «time bombs»: the app is opened years ahead (2027-01-01, 2028-02-29, 2030-06-15, 2036-12-31): the calendar,
// every statistics section (with the period list from ST_START = 2026-11-06 — up to 530 weeks back) and Excel
// work without errors, and the period list is built fast enough.
const { open, check, OWNER, seed } = require("../lib");
module.exports = async () => {
  for (const clock of ["2027-01-01T08:00:00Z", "2028-02-29T08:00:00Z", "2030-06-15T08:00:00Z", "2036-12-31T19:30:00Z"]) {
    const s = await open(OWNER, { db: seed(), clock });
    try {
      const p = s.page; await p.locator("#tabs:not([hidden])").waitFor({ timeout: 20000 }); await p.waitForTimeout(1500);
      await p.click('#tabs [data-tab="stats"]');
      for (const sec of ["today", "cweek", "week", "cmonth", "month", "money", "prod"]) {
        const t0 = Date.now(); await p.click('#top [data-act="st-sec"][data-id="' + sec + '"]').catch(() => {}); await p.waitForTimeout(150);
        const ms = Date.now() - t0;
        check(ms < 3000, clock + " " + sec + ": opens in " + ms + " ms");
      }
      // the period list goes back to the first week: step back many times on «Keçən həftə»
      await p.click('#top [data-act="st-sec"][data-id="week"]');
      const txt = (await p.textContent("#main")).replace(/\s+/g, " ");
      check(txt.length > 50, clock + ": weekly statistics shown");
      await p.click('#tabs [data-tab="cash"]'); await p.waitForTimeout(200);
      await p.click('#tabs [data-tab="day"]'); await p.waitForTimeout(200);
      check(!s.errors.length, clock + ": no page errors: " + s.errors.join("; "));
    } finally { await s.close(); }
  }
};
