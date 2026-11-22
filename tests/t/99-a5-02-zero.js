// A5-02 (audit 5, К4): in «Ümumi cədvəl» a sales agent (or admin) who wrote nothing in the period showed «·» instead
// of 0 — the reference SQL count says 0. (A specialist's own row still has no sales columns: «·» there is by design.)
const { open, check, OWNER, seed } = require("../lib");
module.exports = async () => {
  const db = seed(); db.appts = [];
  const s = await open(OWNER, { db });
  try {
    const p = s.page; await p.locator("#tabs:not([hidden])").waitFor({ timeout: 15000 }); await p.waitForTimeout(2500);
    await p.click('#tabs [data-tab="stats"]'); await p.click('#top [data-act="st-sec"][data-id="cweek"]'); await p.waitForTimeout(300);
    const rows = await p.evaluate(() => [...document.querySelectorAll('[data-st="big-cweek"] tr')].map((r) => [...r.children].map((c) => c.textContent.trim())));
    const ad = rows.find((r) => r[0] === "Admin");
    check(ad && ad.slice(1).every((x) => x !== "·"), "the admin with nothing written shows 0, not «·»: " + JSON.stringify(ad));
    const sp = rows.find((r) => r[0] === "Əli");
    check(sp && sp[1] === "·", "a specialist's own row keeps «·» in the sales columns (by design): " + JSON.stringify(sp));
    check(!s.errors.length, "no page errors: " + s.errors.join("; "));
  } finally { await s.close(); }
};
