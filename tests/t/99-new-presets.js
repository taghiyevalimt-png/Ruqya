// Owner 18.11: in the new booking window, choosing Masaj → 1 hour, 80 ₼; Hicama → 1 hour, 40 ₼; Kombo → 1 hour,
// 100 ₼; the specialist İlkin → 1 h 30 min, 150 ₼. Everything stays editable. Only for a new booking (changing the
// service of an existing booking does not touch its price or length).
const { open, check, AGENT, seed, uuid, bakuToday, R1, R2 } = require("../lib");
module.exports = async () => {
  const db = seed(), now = new Date().toISOString();
  db.appts = [{ id: uuid(), reader_id: R1, date: bakuToday(1), time: "10:00", duration: 90, name: "Köhnə", phone: "050 9", price: 130, share: 0, status: "wait", note: "", settled: false, service: "Ruqya", confirmed: false, place: "ofis", follow: 0, created_by: AGENT, created_at: now, updated_at: now }];
  const s = await open(AGENT, { db, viewport: { width: 390, height: 844 } });
  try {
    const p = s.page; await p.locator("#tabs:not([hidden])").waitFor({ timeout: 15000 }); await p.waitForTimeout(3300);
    await p.click('#tabs [data-tab="day"]'); await p.click("#fab"); await p.locator("#f-reader").waitFor();
    const vals = () => p.evaluate(() => ({ dur: document.getElementById("f-dur").value, price: document.getElementById("f-price").value }));
    const svc = async (v) => { await p.click('label:has(input[name="f-service"][value="' + v + '"])'); await p.waitForTimeout(150); return vals(); };
    await p.selectOption("#f-reader", R1); await p.waitForTimeout(150);
    let v = await svc("Masaj"); check(v.dur === "60" && v.price === "80", "Masaj: 1 hour, 80: " + JSON.stringify(v));
    v = await svc("Hicama"); check(v.dur === "60" && v.price === "40", "Hicama: 1 hour, 40: " + JSON.stringify(v));
    v = await svc("Kombo"); check(v.dur === "60" && v.price === "100", "Kombo: 1 hour, 100: " + JSON.stringify(v));
    await p.selectOption("#f-reader", R2); await p.waitForTimeout(150);   // İlkin
    v = await vals(); check(v.dur === "90" && v.price === "150", "İlkin: 1 h 30 min, 150: " + JSON.stringify(v));
    // editable: own price and length are saved
    await p.fill("#f-price", "120"); await p.selectOption("#f-dur", "120");
    await p.fill("#f-time", "16:00"); await p.fill("#f-name", "Hazır qiymət"); await p.fill("#f-phone", "050 777 66 55");
    await p.click('[data-act="save-appt"]'); await p.waitForTimeout(600);
    const row = s.db.appts.find((x) => x.name === "Hazır qiymət");
    check(row && row.price === 120 && row.duration === 120 && row.reader_id === R2 && row.service === "Kombo", "what was typed is saved: " + JSON.stringify(row && [row.price, row.duration, row.service]));
    // a new booking opened from İlkin's column starts with 150 ₼
    await p.click('[data-act="view"][data-id="grid"]').catch(() => {}); await p.waitForTimeout(300);
    await p.click('[data-act="goto"][data-d="' + bakuToday(1) + '"]').catch(() => {}); await p.waitForTimeout(400);   // tomorrow: İlkin's column is empty
    await p.evaluate(() => { document.getElementById("cal").scrollTop = 0; });
    const col = await p.evaluate(() => { const c = document.querySelectorAll("#cal .col")[1], r = c.getBoundingClientRect(), hour = parseFloat(getComputedStyle(c).backgroundSize.split(" ")[1]); return { x: r.left + r.width / 2, y: r.top + hour * 1.5 }; });
    await p.mouse.click(col.x, col.y); await p.locator("#f-reader").waitFor({ timeout: 5000 }).catch(() => {});
    if (await p.locator("#f-reader").count()) { const v2 = await vals(); const rd = await p.evaluate(() => document.getElementById("f-reader").value);
      if (rd === R2) check(v2.price === "150" && v2.dur === "90", "opened from İlkin's column: 150 ₼, 1 h 30 min: " + JSON.stringify(v2));
      await p.click('[data-act="close"]').catch(() => {}); await p.waitForTimeout(300); }
    // an existing booking: changing the service leaves price and length
    await p.click('[data-act="view"][data-id="list"]'); await p.waitForTimeout(300);
    await p.click('[data-act="goto"][data-d="' + bakuToday(1) + '"]').catch(() => {}); await p.waitForTimeout(400);
    await p.click('[data-act="edit-appt"] >> nth=0'); await p.locator("#f-reader").waitFor();
    v = await svc("Masaj"); check(v.price === "130" && v.dur === "90", "editing an existing booking: Masaj does not change 130 / 1 h 30 min: " + JSON.stringify(v));
    check(!s.errors.length, "no page errors: " + s.errors.join("; "));
  } finally { await s.close(); }
};
