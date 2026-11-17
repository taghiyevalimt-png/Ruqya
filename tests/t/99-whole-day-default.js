// Owner 18.11: «Bütün gün» is the default for everybody (also for phones that chose another size before); anyone can
// then pick another size in Ayarlar → Görünüş, and that choice is kept.
const { open, check, AGENT } = require("../lib");
module.exports = async () => {
  const s = await open(AGENT, { viewport: { width: 390, height: 844 } });
  try {
    const p = s.page;
    // a phone that chose «Standart» with the old version (only "ruqya.hour" saved, never «Bütün gün»)
    await p.evaluate(() => { localStorage.removeItem("ruqya.fit"); localStorage.setItem("ruqya.hour", "75"); }); await p.reload();
    await p.locator("#tabs:not([hidden])").waitFor({ timeout: 15000 }); await p.waitForTimeout(3300);
    await p.click('#tabs [data-tab="day"]'); await p.click('[data-act="view"][data-id="grid"]').catch(() => {}); await p.waitForTimeout(400);
    check(await p.evaluate(() => document.getElementById("cal").classList.contains("fit")), "by default the calendar is «Bütün gün»");
    await p.click('#tabs [data-tab="readers"]'); await p.click('#top [data-act="set-sec"][data-id="view"]'); await p.waitForTimeout(300);
    check(await p.getAttribute('[data-act="hourh"][data-id="fit"]', "aria-pressed") === "true", "Ayarlar shows «Bütün gün» as chosen");
    await p.click('[data-act="hourh"][data-id="75"]'); await p.waitForTimeout(200);
    await p.reload(); await p.locator("#tabs:not([hidden])").waitFor({ timeout: 15000 }); await p.waitForTimeout(3300);
    await p.click('#tabs [data-tab="day"]'); await p.waitForTimeout(400);
    check(await p.evaluate(() => !document.getElementById("cal").classList.contains("fit")), "after choosing «Standart» it stays Standart after reopening");
    await p.click('#tabs [data-tab="readers"]'); await p.click('#top [data-act="set-sec"][data-id="view"]'); await p.waitForTimeout(300);
    check(await p.getAttribute('[data-act="hourh"][data-id="75"]', "aria-pressed") === "true", "Ayarlar shows «Standart» as chosen");
    check(!s.errors.length, "no page errors: " + s.errors.join("; "));
  } finally { await s.close(); }
};
