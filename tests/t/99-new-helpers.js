// Owner 22.11 (new functions after the analysis of the live data): Pasiyentlər → «Təsdiq» — today's and tomorrow's
// bookings still to be confirmed, with the WhatsApp message and «Təsdiq aldı»; «Qayıtmayanlar» — came 14–90 days ago
// and booked nothing since; the booking window finds the nearest free times.
const { open, check, OWNER, AGENT, seed, R1, R2, bakuToday, uuid } = require("../lib");
module.exports = async () => {
  const db = seed(), now = new Date().toISOString();
  const mk = (off, name, phone, o) => Object.assign({ id: uuid(), reader_id: R1, date: bakuToday(off), time: "21:00", duration: 90, name, phone, price: 130, share: 0, status: "wait", note: "", settled: false, service: "Ruqya", confirmed: false, place: "ofis", follow: 0, created_by: AGENT, created_at: now, updated_at: now }, o || {});
  db.appts = [mk(1, "Sabahkı", "0501110001"), mk(1, "Təsdiqli", "0501110002", { confirmed: true }), mk(-30, "Köhnə pasiyent", "0501110003", { time: "10:00" }), mk(-30, "Qayıdan", "0501110004", { time: "12:00" }), mk(5, "Qayıdan", "0501110004", { time: "12:00" })];
  const s = await open(OWNER, { db });
  try {
    const p = s.page; await p.locator("#tabs:not([hidden])").waitFor({ timeout: 15000 }); await p.waitForTimeout(3000);
    await p.click('#tabs [data-tab="patients"]'); await p.waitForTimeout(300);
    check(/1/.test(await p.textContent('[data-act="p-sec"][data-id="conf"]')), "the «Təsdiq» chip shows how many are waiting");
    await p.click('[data-act="p-sec"][data-id="conf"]'); await p.waitForTimeout(300);
    let txt = await p.textContent("#plist");
    check(txt.indexOf("Sabahkı") >= 0 && txt.indexOf("Sabahkı") < txt.indexOf("Təsdiqli"), "the unconfirmed first, the confirmed below: " + txt.slice(0, 200));
    check(await p.locator('#plist a[href*="wa.me"][href*="text="]').count() >= 2, "a ready WhatsApp message per booking");
    await p.locator('#plist [data-act="conf"]').first().click(); await p.waitForTimeout(400);
    check(s.db.appts.find((a) => a.name === "Sabahkı").confirmed === true, "«Təsdiq aldı» saves the confirmation");
    await p.click('[data-act="p-sec"][data-id="lost"]'); await p.waitForTimeout(300);
    txt = await p.textContent("#plist");
    check(/Köhnə pasiyent/.test(txt) && !/Qayıdan/.test(txt), "«Qayıtmayanlar»: the one with nothing ahead only: " + txt.slice(0, 200));
    check(await p.locator('#plist [data-act="repeat"]').count() === 1, "a new booking straight from the list");
    // free times
    await p.click('#tabs [data-tab="day"]'); await p.click("#fab"); await p.locator("#f-name").waitFor();
    await p.selectOption("#f-reader", R2); await p.click('[data-act="free-find"]'); await p.waitForTimeout(200);
    const n = await p.locator('#f-free [data-act="free-pick"]').count();
    check(n >= 3, "free times are offered: " + n);
    const first = p.locator('#f-free [data-act="free-pick"]').first(), d = await first.getAttribute("data-d"), t = await first.getAttribute("data-t");
    await first.click();
    check(await p.inputValue("#f-date") === d && await p.inputValue("#f-time") === t, "a tap fills date and time");
    check(!s.errors.length, "no page errors: " + s.errors.join("; "));
  } finally { await s.close(); }
};
