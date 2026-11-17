// Form order (patient fields under specialist), no "Tutulub"/"vacib" hints; follow-up marks on cancelled bookings.
const { open, check, AGENT, OWNER, R1 } = require("../lib");
module.exports = async () => {
  const s = await open(AGENT);
  try {
    const p = s.page;
    await p.waitForSelector("text=Test Pasiyent", { timeout: 15000 }); await p.waitForTimeout(3200);
    await p.click("#fab"); await p.waitForSelector("#f-reader");
    const order = await p.$$eval("#sheet input, #sheet select", (els) => els.map((e) => e.id || e.name).filter(Boolean));
    const want = ["f-reader", "f-dur", "f-name", "f-phone", "f-price", "f-note", "f-place", "f-date", "f-time", "f-service"];   // owner 17.11: the service is the last field
    check(JSON.stringify(order.filter((x, i, a) => a.indexOf(x) === i)) === JSON.stringify(want), "form order: " + order.join(","));
    await p.selectOption("#f-reader", R1);
    const txt = await p.textContent("#sheet");
    check(!/Tutulub/.test(txt) && !/vacib sahələr/.test(txt), "no busy-times line and no «vacib sahələr»");
    await p.click('[data-act="save-appt"]'); await p.waitForTimeout(200);
    check(/vacib/.test(await p.textContent("#f-err")), "empty required field still warns");
    await p.click('[data-act="close"]'); await p.click('[data-act="draft-drop"]').catch(() => {});
    // cancel the booking, then mark it from the cancelled list
    await p.click("#cal >> text=Test Pasiyent");
    await p.click('[data-act="cancel-appt"]'); await p.waitForTimeout(700); await p.click('[data-act="cancel-appt"]'); await p.waitForTimeout(150);
    // the calendar shows it cancelled at once (black), not only after the next refresh from the server
    const cls = await p.$eval("#cal .ev >> text=Test Pasiyent", (e) => (e.closest(".ev") || e).className).catch(() => "");
    check(/\bcancel\b/.test(cls), "cancelled booking is black on the calendar at once: " + cls);
    await p.waitForTimeout(650);
    await p.click('#tabs [data-tab="patients"]'); await p.click('[data-act="p-sec"][data-id="cancel"]');
    await p.click("#plist >> text=Test Pasiyent");
    await p.waitForSelector(".folbtns");   // windows open on the frame after the tap (INP)
    check((await p.locator('[data-act="follow"]').count()) === 3, "three follow-up buttons");
    const lbl = await p.textContent(".folbtns");
    check(/Birinci xatırlatma/.test(lbl) && /İkinci xatırlatma/.test(lbl) && /Satış edildi/.test(lbl), "button names: " + lbl);
    const marks = async () => ((await p.textContent("#plist")).match(/✅/g) || []).length;
    for (const [n, want] of [[1, 1], [2, 2], [3, 3], [3, 2]]) {
      await p.click('[data-act="follow"][data-n="' + n + '"]'); await p.waitForTimeout(500);
      check(s.db.appts[0].follow === want, "follow " + want + " saved after pressing " + n);
    }
    await p.click('[data-act="close"]'); await p.waitForTimeout(300);
    check((await marks()) === 2, "list shows ✅✅ without opening: " + (await marks()));
    check(!s.errors.length, "no page errors: " + s.errors.join("; "));
  } finally { await s.close(); }
};
