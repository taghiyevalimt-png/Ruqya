// A cancelled patient's card has «Yeni qəbul yaz · Zəng · Wp» like any patient card.
const { open, check, AGENT, seed, uuid, bakuToday, R1 } = require("../lib");
module.exports = async () => {
  const db = seed(), now = new Date().toISOString();
  db.appts.push({ id: uuid(), reader_id: R1, date: bakuToday(0), time: "17:00", duration: 90, name: "Nömrəsiz", phone: "Test", price: 130, share: 0, status: "cancel", note: "", settled: false, service: "Ruqya", confirmed: false, place: "ofis", follow: 0, created_by: AGENT, created_at: now, updated_at: now });
  db.appts[0].status = "cancel";
  for (const lang of ["", "ru"]) {
    const s = await open(AGENT, { db, lang });
    try {
      const p = s.page;
      await p.waitForSelector("#tabs:not([hidden])", { timeout: 15000 }); await p.waitForTimeout(3300);
      await p.click('#tabs [data-tab="patients"]'); await p.click('[data-act="p-sec"][data-id="cancel"]');
      await p.click("#plist >> text=Test Pasiyent");
      await p.waitForSelector(".ccontact");   // windows open on the frame after the tap (INP)
      const row = p.locator(".ccontact");
      check((await row.count()) === 1, "contact row in the cancelled card");
      check((await row.locator('a[href^="tel:"]').count()) === 1, "Zəng calls the number");
      check((await row.locator('a[href*="wa.me"]').count()) === 1, "Wp opens WhatsApp");
      check(lang !== "ru" || /Новая запись/.test(await row.textContent()), "Russian label");
      await row.locator('[data-act="repeat"]').click();
      await p.waitForSelector("#f-name");
      check((await p.inputValue("#f-name")) === "Test Pasiyent" && (await p.inputValue("#f-phone")) === "050 111 22 33", "new booking filled with the patient");
      await p.click('[data-act="close"]'); await p.click('[data-act="draft-drop"]').catch(() => {});
      // a number that cannot be dialled: buttons shown greyed out
      await p.click('#tabs [data-tab="patients"]'); await p.click('[data-act="p-sec"][data-id="cancel"]');
      await p.click("#plist >> text=Nömrəsiz"); await p.waitForSelector(".ccontact");
      check((await p.locator(".ccontact button.wa:disabled").count()) === 2, "Zəng and Wp greyed out without a real number");
      check(!s.errors.length, "no page errors: " + s.errors.join("; "));
    } finally { await s.close(); }
  }
};
