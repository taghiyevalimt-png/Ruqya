// New texts are translated: draft notice, Excel periods, patient wipe button.
const { open, check, OWNER } = require("../lib");
module.exports = async () => {
  const s = await open(OWNER, { lang: "ru" });
  try {
    const p = s.page;
    await p.waitForSelector("text=Test Pasiyent", { timeout: 15000 }); await p.waitForTimeout(3200);
    await p.click("#fab"); await p.fill("#f-name", "Рус"); await p.click('[data-act="close"]'); await p.waitForTimeout(400);
    const d = await p.textContent(".draftbox");
    check(/Несохранённая запись/.test(d) && /Открыть снова/.test(d), "draft notice in Russian: " + d);
    await p.click('[data-act="draft-drop"]');
    await p.click('#tabs [data-tab="stats"]'); await p.click('[data-act="xls"]');
    const x = await p.textContent("#sheet");
    check(/За какой период/.test(x) && /Этот месяц/.test(x) && !/Bu ay|Hamısı/.test(x), "Excel periods in Russian: " + x);
    await p.click('[data-act="close"]');
    await p.click('#tabs [data-tab="patients"]'); await p.click("#plist >> text=Test Pasiyent"); await p.waitForSelector(".pvisit");
    check(/Удалить данные пациента/.test(await p.textContent("#sheet")), "wipe button in Russian");
    await p.click('[data-act="close"]');
    check(/Отменённые/.test(await p.textContent("#main")), "cancelled section in Russian");
    await p.click('#tabs [data-tab="day"]'); await p.click("#fab");
    const f = await p.textContent("#sheet");
    check(/Место/.test(f) && /Офис/.test(f) && /Онлайн/.test(f) && !/Ünvan|Ofis/.test(f), "place field in Russian: " + f.slice(0, 200));
    check(!s.errors.length, "no page errors: " + s.errors.join("; "));
  } finally { await s.close(); }
};
