// A5-12 (audit 5, Г7 «what happens on QuotaExceeded»): the offline copy (ruqya.cache.v1) can fill the phone's
// storage for this site; then the draft of a booking that did not reach the server could not be written and was
// silently lost on reload. Now the copy (it can always be loaded again) gives way to the draft.
const { open, check, AGENT } = require("../lib");
module.exports = async () => {
  const s = await open(AGENT);
  try {
    const p = s.page;
    // storage that is full while the offline copy is in it
    await p.addInitScript(() => { const set = Storage.prototype.setItem; Storage.prototype.setItem = function (k, v) {
      if (k !== "ruqya.cache.v1" && this.getItem("ruqya.cache.v1") !== null && String(v).length > 50) { const e = new Error("quota"); e.name = "QuotaExceededError"; throw e; }
      return set.call(this, k, v); }; });
    await p.reload(); await p.waitForSelector("text=Test Pasiyent", { timeout: 15000 }); await p.waitForTimeout(3200);
    await p.evaluate(() => localStorage.setItem("ruqya.cache.v1", "{}"));   // stands for a big copy
    await p.click("#fab"); await p.waitForSelector("#f-reader"); await p.selectOption("#f-reader", { index: 1 });
    await p.fill("#f-time", "14:00"); await p.fill("#f-name", "Dolu Yaddaş"); await p.fill("#f-phone", "050 222 33 45");
    s.ctl.failWrite = "net"; await p.click('[data-act="save-appt"]'); await p.waitForTimeout(1500);
    const d = await p.evaluate(() => localStorage.getItem("ruqya.draft.v1"));
    check(d && /Dolu Yaddaş/.test(d), "the draft is kept on the phone although the storage was full: " + (d || "").slice(0, 80));
    check(!s.errors.length, "no page errors: " + s.errors.join("; "));
  } finally { await s.close(); }
};
