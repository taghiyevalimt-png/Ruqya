// Owner 25.11: «на старых сеансах в карточке пациента не должно быть кнопок «Dəyiş» и «Ləğv et» — могут случайно нажать».
// A past session in the patient card has no buttons (only «Köhnə qəbul — yalnız baxmaq olar.»); a coming one keeps them.
const { open, check, OWNER, seed, R1, bakuToday, uuid } = require("../lib");
module.exports = async () => {
  const db = seed(), base = db.appts[0], add = (date, time, st) => { const a = Object.assign({}, base, { id: uuid(), date, time, status: st || "wait" }); db.appts.push(a); return a; };
  const d = (n) => bakuToday(n);
  db.appts = [];
  const past = add(d(-3), "10:00"), pastC = add(d(-2), "11:00", "cancel"), next = add(d(2), "12:00");
  const s = await open(OWNER, { db, viewport: { width: 390, height: 844 } });
  try {
    const p = s.page; await p.locator("#tabs:not([hidden])").waitFor({ timeout: 15000 }); await p.waitForTimeout(1500);
    await p.click('#tabs [data-tab="patients"]'); await p.waitForTimeout(800);
    await p.click('[data-act="patient"]'); await p.waitForSelector("#sheet .pvisit");
    const v = await p.$$eval("#sheet .pvisit", (xs) => xs.map((x) => ({ t: x.querySelector(".pv-top b").textContent, acts: [...x.querySelectorAll("[data-act]")].map((b) => b.dataset.act + ":" + b.dataset.id), txt: x.textContent })));
    const of = (a) => v.find((x) => x.acts.some((k) => k.endsWith(a.id))) || v.find((x) => x.t.indexOf(a.time) >= 0);
    check(v.length === 3, "three visits: " + JSON.stringify(v));
    for (const a of [past, pastC]) { const x = of(a); check(x && !x.acts.length && /Köhnə qəbul/.test(x.txt), "a past session has no buttons: " + JSON.stringify(x)); }
    const n = of(next); check(n && n.acts.includes("edit-appt:" + next.id) && n.acts.includes("cancel-appt:" + next.id), "a coming session keeps «Dəyiş» and «Ləğv et»: " + JSON.stringify(n));
    check(!s.errors.length, "no page errors: " + s.errors.join(" | "));
  } finally { await s.close(); }
};
