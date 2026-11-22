// A6-02 (audit 6, live app_errors 19–20.11): the only 3 errors in the journal are « A network error occurred.»
// (Safari's text for a request cut by the network; two of them sent in one batch, same second — not a duplicate
// send). The phone also showed «Xəta baş verdi. Səhifəni yeniləyin…» for it. A lost connection is expected on a
// phone: it must not look like a program error to the staff member, and must not fill the admin's error journal,
// where real errors would drown. Real errors are still shown and sent.
const { open, check, OWNER } = require("../lib");
module.exports = async () => {
  const s = await open(OWNER);
  try {
    const p = s.page; await p.locator("#tabs:not([hidden])").waitFor({ timeout: 15000 }); await p.waitForTimeout(3000);
    const before = (s.db.app_errors || []).length;
    for (const m of [" A network error occurred.", "Failed to fetch", "Load failed", "NetworkError when attempting to fetch resource."])
      await p.evaluate((m) => { setTimeout(() => { Promise.reject(new TypeError(m)); }, 0); }, m);
    await p.waitForTimeout(4500);
    const t1 = await p.evaluate(() => document.body.innerText);
    check(!/Xəta baş verdi/.test(t1), "a cut connection is not shown as a program error");
    check((s.db.app_errors || []).length === before, "nothing sent to the admin's error journal: " + JSON.stringify((s.db.app_errors || []).map((x) => x.m)));
    // a real error is still shown and sent
    await p.evaluate(() => { setTimeout(() => { Promise.reject(new Error("real fault (test)")); }, 0); });
    await p.waitForTimeout(4500);
    check(/Xəta baş verdi/.test(await p.evaluate(() => document.body.innerText)), "a real error is still shown");
    check((s.db.app_errors || []).some((x) => /real fault/.test(x.m)), "and sent to the journal");
  } finally { await s.close(); }
};
