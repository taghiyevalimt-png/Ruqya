// 2026-11-17 requests: cancelled list + black blocks + stats column, place field, product edit, column tap, phone text.
const { open, check, AGENT, R1, R2, uuid, bakuToday } = require("../lib");
async function ready(p) { await p.waitForSelector("text=Test Pasiyent", { timeout: 15000 }); await p.waitForTimeout(3200); }
module.exports = async () => {
  const s = await open(AGENT);
  try {
    const p = s.page; await ready(p);
    // 1. cancel instead of delete
    await p.click("#cal >> text=Test Pasiyent");
    await p.click('[data-act="cancel-appt"]');
    check(s.db.appts[0].status === "wait", "first press only asks");
    await p.waitForTimeout(700);
    await p.click('[data-act="cancel-appt"]');
    await p.waitForTimeout(900);
    check(s.db.appts.length === 1 && s.db.appts[0].status === "cancel", "booking kept as cancelled, not deleted");
    const bg = await p.$eval("#cal .ev.cancel", (e) => getComputedStyle(e).backgroundColor);
    check(bg === "rgb(0, 0, 0)", "cancelled block is black: " + bg);
    // another patient can take that time
    await p.click("#fab");
    await p.selectOption("#f-reader", R1);
    check((await p.inputValue("#f-dur")) === "90", "1 h 30 min by default");
    await p.fill("#f-time", "10:00"); await p.fill("#f-name", "Yeni"); await p.fill("#f-phone", "yalnız WhatsApp +7 912 345");
    check(await p.isChecked('input[name="f-place"][value="ofis"]'), "Ofis chosen by default");
    await p.click('label.segb:has(input[value="onlayn"])');
    await p.click('[data-act="save-appt"]'); await p.waitForTimeout(900);
    const nw = s.db.appts.find((a) => a.name === "Yeni");
    check(nw && nw.time === "10:00" && nw.place === "onlayn" && nw.phone === "yalnız WhatsApp +7 912 345", "same slot booked, place and free-text phone saved: " + JSON.stringify(nw));
    // cancelled list in Pasiyentlər
    await p.click('#tabs [data-tab="patients"]');
    await p.click('[data-act="p-sec"][data-id="cancel"]');
    check(/Test Pasiyent/.test(await p.textContent("#plist")), "cancelled patient listed under Ləğv olunanlar");
    check(!/Yeni/.test(await p.textContent("#plist")), "active booking not in the cancelled list");
    // statistics: «Ləğv» column, not counted as written
    await p.click('#tabs [data-tab="stats"]');
    await p.click('#top [data-act="st-sec"][data-id="day"]').catch(() => {});
    const st = await p.textContent("#main");
    check(/Ləğv/.test(st), "Ləğv column in statistics");
    // 5. tap on İlkin's column
    await p.click('#tabs [data-tab="day"]'); await p.waitForTimeout(300);
    const col = await p.$('#cal .col[data-id="' + R2 + '"]');
    const bx = await col.boundingBox();
    await col.scrollIntoViewIfNeeded(); await p.evaluate(() => { const c = document.getElementById("cal"); c.scrollTop = 400; }); const b2 = await col.boundingBox(); await p.mouse.click(b2.x + b2.width / 2, Math.max(b2.y, 0) + 420);
    await p.waitForSelector("#f-reader");
    check((await p.inputValue("#f-reader")) === R2, "tapped specialist is chosen");
    check((await p.inputValue("#f-dur")) === "90", "1 h 30 min after a tap too");
    await p.click('[data-act="close"]'); await p.click('[data-act="draft-drop"]').catch(() => {});
    // 4. product sale can be changed
    await p.click('#tabs [data-tab="cash"]');
    await p.click('[data-act="new-prod"]'); await p.fill("#pr-names", "Zeytun yağı"); await p.fill("#pr-amount", "20");
    await p.click('[data-act="save-prod"]'); await p.waitForTimeout(800);
    await p.click('[data-act="edit-prod"]');
    check((await p.inputValue("#pr-amount")) === "20" && /Zeytun/.test(await p.inputValue("#pr-names")), "form opens with the sale");
    await p.fill("#pr-amount", "25"); await p.fill("#pr-names", "Zeytun yağı\nQara çörək otu");
    await p.click('[data-act="save-prod"]'); await p.waitForTimeout(800);
    const pr = s.db.product_sales[0];
    check(pr.amount === 25 && /Qara/.test(pr.names), "sale changed in the database: " + JSON.stringify(pr));
    check(!s.errors.length, "no page errors: " + s.errors.join("; "));
  } finally { await s.close(); }
};
