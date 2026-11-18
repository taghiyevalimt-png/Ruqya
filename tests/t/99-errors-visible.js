// Stability audit S-01: an error nobody caught (in a tap handler, a timer, a promise) passed silently — the user saw
// nothing, the owner could not see it. Now: a short message for the user, and the error is kept in this phone's error
// list (last 30), shown to an admin in Ayarlar → Hesab. A failure while drawing the screen shows a message with
// «Yenilə» instead of a blank or wrong screen.
const { open, check, OWNER } = require("../lib");
module.exports = async () => {
  const s = await open(OWNER, { viewport: { width: 390, height: 844 } });
  try {
    const p = s.page; await p.locator("#tabs:not([hidden])").waitFor({ timeout: 15000 }); await p.waitForTimeout(3300);
    await p.evaluate(() => { setTimeout(() => { throw new Error("test-uncaught-1"); }, 0); });
    await p.waitForTimeout(600);
    const msg1 = await p.evaluate(() => document.body.innerText.includes("Xəta baş verdi"));
    check(msg1, "an uncaught error shows a message to the user");
    await p.evaluate(() => { Promise.reject(new Error("test-rejection-2")); });
    await p.waitForTimeout(600);
    const log = await p.evaluate(() => { try { return JSON.parse(localStorage.getItem("ruqya.errlog") || "[]"); } catch (e) { return null; } });
    check(Array.isArray(log) && log.some((x) => /test-uncaught-1/.test(x.m)) && log.some((x) => /test-rejection-2/.test(x.m)), "both errors are kept in the error list: " + JSON.stringify(log && log.map((x) => x.m)));
    check(log.every((x) => x.t && x.v), "each entry has the time and the app version");
    await p.click('#tabs [data-tab="readers"]'); await p.click('#top [data-act="set-sec"][data-id="acc"]'); await p.waitForTimeout(300);
    const txt = await p.textContent("#main");
    check(/Xəta jurnalı/.test(txt) && /test-uncaught-1/.test(txt), "the admin sees the error list in Ayarlar → Hesab");
    // the app keeps working
    await p.click('#tabs [data-tab="day"]'); await p.waitForTimeout(300);
    check(await p.evaluate(() => document.querySelectorAll("#cal .col").length > 0), "the calendar still works after the errors");
  } finally { await s.close(); }
};
