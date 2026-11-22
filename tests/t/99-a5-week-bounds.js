// Audit 5, mutation check M5-11 survived: no test pinned the week to Friday–Thursday (Baku time). Fixed dates, so the
// week and month boundaries are exact: Thursday 23:59 and Friday 00:00 in Baku, a year change and 29 February.
const { open, check, OWNER, seed } = require("../lib");
const cases = [
  ["2026-11-22T08:00:00Z", "20 noyabr – 26 noyabr 2026"],   // Sunday
  ["2026-11-26T19:59:00Z", "20 noyabr – 26 noyabr 2026"],   // Thursday 23:59 in Baku
  ["2026-11-26T20:00:00Z", "27 noyabr – 3 dekabr 2026"],    // Friday 00:00 in Baku
  ["2027-01-01T06:00:00Z", "1 yanvar – 7 yanvar 2027"],     // Friday, new year
  ["2028-02-29T06:00:00Z", "25 fevral – 2 mart 2028"],      // 29 February (Tuesday)
];
module.exports = async () => {
  for (const [clock, want] of cases) {
    const s = await open(OWNER, { db: seed(), clock });
    try {
      const p = s.page; await p.locator("#tabs:not([hidden])").waitFor({ timeout: 15000 }); await p.waitForTimeout(1500);
      await p.click('#tabs [data-tab="stats"]'); await p.click('#top [data-act="st-sec"][data-id="cweek"]'); await p.waitForTimeout(300);
      const t = (await p.textContent("#main")).replace(/\s+/g, " ");
      check(t.indexOf(want) >= 0, clock + ": «Bu həftə» is " + want + ": " + t.slice(0, 90));
      check(!s.errors.length, "no page errors: " + s.errors.join("; "));
    } finally { await s.close(); }
  }
};
