// No time buttons in the booking form; a taken time is still refused with the red message under the form.
const { open, check, AGENT, R1 } = require("../lib");
module.exports = async () => {
  const s = await open(AGENT);
  try {
    const p = s.page;
    await p.waitForSelector("text=Test Pasiyent", { timeout: 15000 }); await p.waitForTimeout(3200);
    await p.click("#fab"); await p.waitForSelector("#f-reader");
    await p.selectOption("#f-reader", R1);
    check((await p.locator("#sheet .slot, #f-slots, #f-busy").count()) === 0, "no time buttons and no busy line");
    await p.fill("#f-time", "10:30"); await p.fill("#f-name", "Üst-üstə"); await p.fill("#f-phone", "050 999 00 11");
    await p.click('[data-act="save-appt"]'); await p.waitForTimeout(300);
    const err = await p.textContent("#f-err");
    check(/məşğuldur/.test(err) && /Test Pasiyent/.test(err), "taken time refused with the red message: " + err);
    check(await p.isVisible("#f-err"), "message visible");
    check(!s.db.appts.some((a) => a.name === "Üst-üstə"), "not saved");
    await p.fill("#f-time", "14:00");
    await p.click('[data-act="save-appt"]'); await p.waitForTimeout(900);
    check(s.db.appts.some((a) => a.name === "Üst-üstə" && a.time === "14:00"), "free time saved");
    check(!s.errors.length, "no page errors: " + s.errors.join("; "));
  } finally { await s.close(); }
};
