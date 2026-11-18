// F-06 (owner 18.11) made «Bütün gün» the default; the owner's later notes (18.11) changed it: the default is «Kiçik»
// height and «Standart» width (checked in detail in 99-uniform-view). Here: a phone that had «Bütün gün» as the
// default (never chosen by hand, no "ruqya.fit") gets «Kiçik»; «Bütün gün» chosen in Ayarlar is kept after reopening.
const { open, check, AGENT } = require("../lib");
module.exports = async () => {
  const s = await open(AGENT, { viewport: { width: 390, height: 844 } });
  try {
    const p = s.page;
    await p.evaluate(() => { localStorage.removeItem("ruqya.fit"); localStorage.removeItem("ruqya.view18"); localStorage.setItem("ruqya.hour", "75"); }); await p.reload();
    await p.locator("#tabs:not([hidden])").waitFor({ timeout: 15000 }); await p.waitForTimeout(3300);
    await p.click('#tabs [data-tab="day"]'); await p.click('.cal-foot [data-act="view"][data-id="grid"]').catch(() => {}); await p.waitForTimeout(400);
    check(await p.evaluate(() => !document.getElementById("cal").classList.contains("fit")), "by default the calendar is not «Bütün gün»");
    await p.click('#tabs [data-tab="readers"]'); await p.click('#top [data-act="set-sec"][data-id="view"]'); await p.waitForTimeout(300);
    check(await p.getAttribute('[data-act="hourh"][data-id="45"]', "aria-pressed") === "true", "Ayarlar shows «Kiçik» as chosen");
    await p.click('[data-act="hourh"][data-id="fit"]'); await p.waitForTimeout(200);
    await p.reload(); await p.locator("#tabs:not([hidden])").waitFor({ timeout: 15000 }); await p.waitForTimeout(3300);
    await p.click('#tabs [data-tab="day"]'); await p.waitForTimeout(400);
    check(await p.evaluate(() => document.getElementById("cal").classList.contains("fit")), "«Bütün gün» chosen in Ayarlar stays after reopening");
    check(!s.errors.length, "no page errors: " + s.errors.join("; "));
  } finally { await s.close(); }
};
