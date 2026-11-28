// 28.11 (found in the check): the WhatsApp reminder to the patient («Təsdiq») called every specialist «bəy» — Ruhanə,
// Təranə and Dr. Günel too — and in Russian named every session «рукья» (massage, hijama…). Now a woman gets «xanım»,
// a job title («Psixoloq») no «bəy», the kind of session is named in both languages.
const { open, check, OWNER, seed, R1, R2, bakuToday, uuid } = require("../lib");
module.exports = async () => {
  const R3 = uuid(), R4 = uuid(), R5 = uuid(), now = new Date().toISOString();
  const mk = () => { const db = seed(), b = db.appts[0];
    db.readers[0].name = "Loğman"; db.readers[1].name = "Ruhanə";
    db.readers.push({ id: R3, name: "Dr. Günel", archived: false, created_at: "2026-11-03T00:00:00Z", color: null }, { id: R4, name: "Psixoloq", archived: false, created_at: "2026-11-04T00:00:00Z", color: null }, { id: R5, name: "Təranə", archived: false, created_at: "2026-11-05T00:00:00Z", color: null });
    const add = (rid, time, name, service) => db.appts.push(Object.assign({}, b, { id: uuid(), reader_id: rid, date: bakuToday(1), time, name, service, phone: "050 111 22 " + time.slice(0, 2), created_at: now, updated_at: now }));
    db.appts = []; add(R1, "10:00", "P1", "Ruqya"); add(R2, "11:00", "P2", "Masaj"); add(R3, "12:00", "P3", "Dr.Günel"); add(R4, "13:00", "P4", "Ruqya"); add(R5, "14:00", "P5", "Hicama");
    return db };
  const texts = async (lang) => {
    const s = await open(OWNER, { db: mk(), lang, init: [() => { try { localStorage.setItem("ruqya.view", "list") } catch (e) {} }] });
    try {
      const p = s.page; await p.locator("#tabs:not([hidden])").waitFor({ timeout: 15000 }); await p.waitForTimeout(1500);
      await p.click('#top [data-act="shift"][data-n="1"]'); await p.waitForTimeout(500);
      const t = await p.$$eval('#main a[href*="wa.me"][href*="text="]', (xs) => xs.map((x) => decodeURIComponent(new URL(x.href).searchParams.get("text") || "")));
      check(!s.errors.length, "no page errors: " + s.errors.join(" | "));
      return t;
    } finally { await s.close(); }
  };
  const az = await texts(""), j = JSON.stringify(az);
  check(az.length === 5, "five reminders: " + j);
  const has = (re) => az.some((x) => re.test(x));
  check(has(/Loğman bəyin ruqya seansına/), "a man: «Loğman bəyin ruqya seansına»: " + j);
  check(has(/Ruhanə xanımın masaj seansına/) && !has(/Ruhanə bəyin/), "a woman: «Ruhanə xanımın masaj seansına»: " + j);
  check(has(/Təranə xanımın hicama seansına/), "«Təranə xanımın»: " + j);
  check(has(/Dr\. Günel xanımın seansına/) && !has(/dr\.günel/), "«Dr. Günel xanımın seansına» (the service is her name, not repeated): " + j);
  check(has(/psixoloqun ruqya seansına/) && !has(/Psixoloq bəyin/), "a job title has no «bəy»: " + j);
  check(az.every((x) => /^Salam, hər vaxtınız xeyir!\nSiz sabah /.test(x) && /yazılmısız\.\nZəhmət olmasa gələcəyinizi təsdiqləyin\.$/.test(x)), "the clinic's own wording stays: " + j);
  const ru = await texts("ru"), jr = JSON.stringify(ru);
  check(ru.some((x) => /на сеанс массажа к Ruhanə/.test(x)) && ru.some((x) => /на сеанс хиджамы к Təranə/.test(x)) && ru.some((x) => /на сеанс рукьи к Loğman/.test(x)), "Russian names the kind of session: " + jr);
  check(!ru.some((x) => /рукьи к Ruhanə|к Psixoloq/.test(x)), "no «рукьи» for massage, no «к Psixoloq»: " + jr);
};
