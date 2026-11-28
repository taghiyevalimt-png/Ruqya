// Owner 28.11: «Yuxarıdakı təqvim və siyahı simvollarının sağında bir dənə simvol olmalıdır, telefon simvolu ilə, "onlayn"
// simvolu, ora toxunanda ancaq onlayn seansların siyahısı çıxacaq».
const { open, check, OWNER, seed, R1, R2, bakuToday, uuid, goDay } = require("../lib");
module.exports = async () => {
  const db = seed(), base = db.appts[0], now = new Date().toISOString(), t = bakuToday();
  const add = (o) => db.appts.push(Object.assign({}, base, { id: uuid(), created_at: now, updated_at: now, date: t }, o));
  db.appts = [];
  add({ reader_id: R1, time: "10:00", name: "Ofisdə Pasiyent", place: "ofis" });
  add({ reader_id: R1, time: "12:00", name: "Onlayn Bir", place: "onlayn" });
  add({ reader_id: R2, time: "15:00", name: "Onlayn İki", place: "onlayn" });
  add({ reader_id: R2, time: "17:00", name: "Ünvanda", place: "unvan" });
  db.breaks = [{ id: uuid(), title: "Namaz", start_time: "13:00", end_time: "13:30", reader_id: null, days: null, date: null, created_at: now }];
  const s = await open(OWNER, { db });
  try {
    const p = s.page; await p.locator("#tabs:not([hidden])").waitFor({ timeout: 15000 }); await p.waitForTimeout(1200);
    const bs = await p.$$eval("#top .vsw2 button", (xs) => xs.map((x) => ({ id: x.dataset.id, x: x.getBoundingClientRect().left, svg: !!x.querySelector("svg"), lab: x.getAttribute("aria-label") })));
    check(bs.length === 3 && bs[2].id === "online" && bs[2].x > bs[1].x && bs[1].id === "list" && bs[2].svg && /Onlayn/.test(bs[2].lab), "a third (online) symbol right of Təqvim / Siyahı: " + JSON.stringify(bs));
    await p.click('#top [data-act="view"][data-id="online"]'); await p.waitForTimeout(500);
    const names = await p.$$eval("#main .card .who b", (xs) => xs.map((x) => x.textContent.trim()));
    check(names.length === 2 && names.every((n) => /Onlayn/.test(n)), "only the online sessions: " + JSON.stringify(names));
    check(!(await p.locator("#main .brkrow").count()), "breaks are not in the online list");
    check(await p.locator('#top [data-act="view"][data-id="online"][aria-pressed="true"]').count() === 1, "the online symbol is pressed");
    check(/Yalnız onlayn seanslar/.test(await p.textContent("#main")), "the list says it shows online sessions only");
    check(await p.locator('#main [data-act="paid"]').count() === 2, "«Ödəniş edib» on each online session");
    // a day without online sessions
    await goDay(p, bakuToday(1));
    check(/Bu tarixdə onlayn seans yoxdur/.test(await p.textContent("#main")), "empty day: «Bu tarixdə onlayn seans yoxdur.»");
    // back to the calendar; after a restart the phone does not open in the online list
    await p.click('#top [data-act="view"][data-id="grid"]'); await p.waitForTimeout(300);
    check(await p.locator("#cal").count() === 1, "Təqvim works again");
    await p.click('#top [data-act="view"][data-id="online"]'); await p.waitForTimeout(300);
    await p.reload(); await p.locator("#tabs:not([hidden])").waitFor({ timeout: 15000 }); await p.waitForTimeout(1200);
    check(await p.locator('#top [data-act="view"][data-id="online"][aria-pressed="true"]').count() === 0, "the online list is not remembered after a restart");
    check(!s.errors.length, "no page errors: " + s.errors.join(" | "));
  } finally { await s.close(); }
};
