// Owner 18.11: in the new booking window, choosing Masaj, Hicama or Kombo → 1 hour; the specialist İlkin → 1 h 30 min.
// It stays editable. Only for a new booking (changing the service of an existing booking does not touch its length).
// Since 23.11 (late evening) there is no price in the form at all (99-1123-no-price.js).
const { open, check, AGENT, seed, uuid, bakuToday, R1, R2, goDay } = require("../lib");
module.exports = async () => {
  const db = seed(), now = new Date().toISOString();
  db.appts = [{ id: uuid(), reader_id: R1, date: bakuToday(1), time: "10:00", duration: 90, name: "Köhnə", phone: "050 9", price: 130, share: 0, status: "wait", note: "", settled: false, service: "Ruqya", confirmed: false, place: "ofis", follow: 0, created_by: AGENT, created_at: now, updated_at: now }];
  const s = await open(AGENT, { db, viewport: { width: 390, height: 844 } });
  try {
    const p = s.page; await p.locator("#tabs:not([hidden])").waitFor({ timeout: 15000 }); await p.waitForTimeout(3300);
    await p.click('#tabs [data-tab="day"]'); await p.click("#fab"); await p.locator("#f-reader").waitFor();
    const vals = () => p.evaluate(() => ({ dur: document.getElementById("f-dur").value, price: document.getElementById("f-price") ? "shown" : "" }));
    const svc = async (v) => { await p.click('label:has(input[name="f-service"][value="' + v + '"])'); await p.waitForTimeout(150); return vals(); };
    await p.selectOption("#f-reader", R1); await p.waitForTimeout(150);
    let v = await svc("Masaj"); check(v.dur === "60" && v.price === "", "Masaj: 1 hour: " + JSON.stringify(v));
    v = await svc("Hicama"); check(v.dur === "60", "Hicama: 1 hour: " + JSON.stringify(v));
    v = await svc("Kombo"); check(v.dur === "60", "Kombo: 1 hour: " + JSON.stringify(v));
    await p.selectOption("#f-reader", R2); await p.waitForTimeout(150);   // İlkin
    v = await vals(); check(v.dur === "90", "İlkin: 1 h 30 min: " + JSON.stringify(v));
    // editable: own length is saved
    await p.selectOption("#f-dur", "120");
    await p.fill("#f-time", "16:00"); await p.fill("#f-name", "Hazır qiymət"); await p.fill("#f-phone", "050 777 66 55");
    await p.click('[data-act="save-appt"]'); await p.waitForTimeout(600);
    const row = s.db.appts.find((x) => x.name === "Hazır qiymət");
    check(row && row.price === 0 && row.duration === 120 && row.reader_id === R2 && row.service === "Kombo", "what was typed is saved: " + JSON.stringify(row && [row.price, row.duration, row.service]));
    // a new booking opened from İlkin's column starts with 150 ₼
    await p.click('[data-act="view"][data-id="grid"]').catch(() => {}); await p.waitForTimeout(300);
    await goDay(p, bakuToday(1)); await p.waitForTimeout(400);   // tomorrow: İlkin's column is empty
    await p.evaluate(() => { document.getElementById("cal").scrollTop = 0; });
    const col = await p.evaluate(() => { const c = document.querySelectorAll("#cal .col")[1], r = c.getBoundingClientRect(), hour = parseFloat(getComputedStyle(c).backgroundSize.split(" ")[1]); return { x: r.left + r.width / 2, y: r.top + hour * 1.5 }; });
    await p.mouse.click(col.x, col.y); await p.locator("#f-reader").waitFor({ timeout: 5000 }).catch(() => {});
    if (await p.locator("#f-reader").count()) { const v2 = await vals(); const rd = await p.evaluate(() => document.getElementById("f-reader").value);
      if (rd === R2) check(v2.dur === "90", "opened from İlkin's column: 1 h 30 min: " + JSON.stringify(v2));
      await p.click('[data-act="close"]').catch(() => {}); await p.waitForTimeout(300); }
    // an existing booking: changing the service leaves price and length
    await p.click('[data-act="view"][data-id="list"]'); await p.waitForTimeout(300);
    // tomorrow (T6-01); since 24.11 by ‹ › (no week strip)
    await goDay(p, bakuToday(1));
    await p.waitForTimeout(400);
    // audit 6 (T6-01): the seeded booking by its id, with every specialist shown — since 22.11 the list follows the
    // specialist chosen in the calendar, so «the first in the list» was the new İlkin booking (120/120 = its own values)
    await p.click('[data-act="filter"][data-id="all"]').catch(() => {}); await p.waitForTimeout(300);
    await p.click('[data-act="edit-appt"][data-id="' + db.appts[0].id + '"]'); await p.locator("#f-reader").waitFor();
    v = await svc("Masaj"); check(v.dur === "90", "editing an existing booking: Masaj does not change 1 h 30 min: " + JSON.stringify(v));
    check(!s.errors.length, "no page errors: " + s.errors.join("; "));
  } finally { await s.close(); }
};
