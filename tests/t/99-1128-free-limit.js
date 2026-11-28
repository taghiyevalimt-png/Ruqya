// 28.11 (found in the check): «Ən yaxın boş vaxtlar» in the booking window offered times on a day the specialist's daily
// limit (Ayarlar → Qiymətlər) was already full; the save then asked «yenə də yazmaq üçün bir də basın». Now such days are skipped.
const { open, check, OWNER, seed, R1, R2, bakuToday, uuid } = require("../lib");
module.exports = async () => {
  const db = seed(), b = db.appts[0], now = new Date().toISOString();
  db.app_settings = [{ id: "presets", value: { svc: {}, reader: {}, limit: { [R1]: 1 } }, updated_at: now }];
  db.appts = [1, 2].map((o) => Object.assign({}, b, { id: uuid(), reader_id: R1, date: bakuToday(o), time: "21:00", created_at: now, updated_at: now }));
  const s = await open(OWNER, { db });
  try {
    const p = s.page; await p.locator("#tabs:not([hidden])").waitFor({ timeout: 15000 }); await p.waitForTimeout(1500);
    await p.click("#fab"); await p.locator("#f-name").waitFor();
    await p.selectOption("#f-reader", R1); await p.click('[data-act="free-find"]'); await p.waitForTimeout(300);
    const days = await p.$$eval('#f-free [data-act="free-pick"]', (xs) => xs.map((x) => x.dataset.d));
    check(days.length >= 3 && !days.includes(bakuToday(1)) && !days.includes(bakuToday(2)), "no free time on the full days (+1, +2): " + days);
    await p.selectOption("#f-reader", R2); await p.waitForTimeout(300);
    const d2 = await p.$$eval('#f-free [data-act="free-pick"]', (xs) => xs.map((x) => x.dataset.d));
    check(d2.includes(bakuToday(1)), "a specialist without a limit still gets tomorrow: " + d2);
    check(!s.errors.length, "no page errors: " + s.errors.join(" | "));
  } finally { await s.close(); }
};
