// Owner 22.11: «whichever specialist is picked in the app — only his sessions in the app and in the widget».
// The calendar already showed only the picked specialists; the Android widget showed everybody. Now the widget gets
// the same choice: picking Əli leaves only Əli's sessions in the widget data, «Hamısı» brings everybody back.
const { open, check, OWNER, seed, R1, R2, bakuToday, uuid } = require("../lib");
module.exports = async () => {
  const db = seed(), t = bakuToday(), now = new Date().toISOString();
  db.appts = [
    { id: uuid(), reader_id: R1, date: t, time: "10:00", duration: 90, name: "Əlinin pasiyenti", phone: "0501112233", price: 130, share: 0, status: "wait", note: "", settled: false, service: "Ruqya", confirmed: false, place: "ofis", follow: 0, created_by: OWNER, created_at: now, updated_at: now },
    { id: uuid(), reader_id: R2, date: t, time: "12:00", duration: 90, name: "İlkinin pasiyenti", phone: "0502223344", price: 130, share: 0, status: "wait", note: "", settled: false, service: "Ruqya", confirmed: false, place: "ofis", follow: 0, created_by: OWNER, created_at: now, updated_at: now },
  ];
  const s = await open(OWNER, { db, viewport: { width: 412, height: 860 } });
  try {
    const p = s.page;
    await p.addInitScript(() => { window.__w = []; window.RuqyaApp = { setWidgetData: (j) => window.__w.push(j), version: () => "test" }; });
    await p.reload(); await p.locator("#tabs:not([hidden])").waitFor({ timeout: 15000 }); await p.waitForTimeout(3300);
    const names = () => p.evaluate((d) => { const j = window.__w[window.__w.length - 1]; const o = j ? JSON.parse(j) : {}; return ((o.d || {})[d] || []).map((x) => x[0]); }, t);
    await p.waitForFunction(() => window.__w.length > 0, null, { timeout: 8000 });
    check((await names()).length === 2, "nobody picked: both sessions in the widget: " + (await names()));
    await p.click('.cal-foot [data-act="filter"][data-id="' + R1 + '"]'); await p.waitForTimeout(2200);
    const n1 = await names();
    check(n1.length === 1 && n1[0] === "Əlinin pasiyenti", "Əli picked: only his session in the widget: " + n1);
    check(await p.locator("#cal .ev").count() === 1, "and only his in the calendar");
    await p.click('[data-act="view"][data-id="list"]'); await p.waitForTimeout(300);
    check(await p.locator('#spbar [data-act="filter"][data-id="all"]').count() === 1, "the list has «Hamısı»");
    await p.click('#spbar [data-act="filter"][data-id="all"]'); await p.waitForTimeout(2200);
    check((await names()).length === 2, "«Hamısı»: both again: " + (await names()));
    check(!s.errors.length, "no page errors: " + s.errors.join("; "));
  } finally { await s.close(); }
};
