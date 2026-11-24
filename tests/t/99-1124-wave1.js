// Owner 24.11 «Начинай» — wave 1 of the liked ideas:
//  (5)(6) days off for one specialist or the whole centre (Ayarlar → Fasilələr → «İstirahət günləri»): an all-day break
//         from the first to the last day; bookings on those days are refused.
//  (7)    a daily limit per specialist (Ayarlar → «Yeni qəbul: müddət, gündəlik limit»): over it → a warning, a second
//         tap writes anyway.
//  (8)    «Kim boşdur» (🟢 under the calendar): who is free now, who is busy until when; a tap opens a booking.
//  (9)    the same number already booked ahead → a warning, a second tap writes anyway.
//  (10)   «Geri al» for 5 s after a cancel or a delete; a delete reaches the server only after those 5 s, and still
//         goes if the app is closed meanwhile.
const { open, check, OWNER, seed, R1, R2, goDay, bakuToday, uuid } = require("../lib");
module.exports = async () => {
  const db = seed(), now = new Date().toISOString();
  db.app_settings = [{ id: "presets", value: { price: null, svc: {}, reader: { [R2]: [60, null] } }, updated_at: now }];
  // Baku now: a booking of Əli going on right now (for «Kim boşdur»)
  const bn = new Date(Date.now() + 4 * 3600e3), nm = bn.getUTCHours() * 60 + bn.getUTCMinutes();
  const hh = (m) => String(Math.floor(m / 60)).padStart(2, "0") + ":" + String(m % 60).padStart(2, "0");
  const work = nm >= 8 * 60 + 15 && nm < 22 * 60 + 30;
  db.appts = [];
  if (work) db.appts.push({ id: uuid(), reader_id: R1, date: bakuToday(), time: hh(Math.floor((nm - 10) / 5) * 5), duration: 60, name: "İndiki", phone: "055 900 00 01", price: 0, share: 0, status: "wait", note: "", settled: false, service: "Ruqya", confirmed: false, place: "ofis", follow: 0, created_by: OWNER, created_at: now, updated_at: now });
  const s = await open(OWNER, { db, viewport: { width: 390, height: 844 } });
  try {
    const p = s.page;
    await p.locator("#tabs:not([hidden])").waitFor({ timeout: 15000 }); await p.waitForTimeout(3000);
    const d1 = bakuToday(1), d2 = bakuToday(2), d3 = bakuToday(3), d5 = bakuToday(5);
    const sec = async (id) => { await p.click('#tabs [data-tab="readers"]'); await p.click('#top [data-act="set-sec"][data-id="' + id + '"]'); await p.waitForTimeout(250); };
    const err = () => p.evaluate(() => { const e = document.getElementById("f-err"); return e && !e.hidden ? e.textContent : ""; });
    const book = async (rid, day, time, name, phone) => {
      await p.click('#tabs [data-tab="day"]'); await goDay(p, day); await p.waitForTimeout(200);
      await p.click("#fab"); await p.locator("#f-reader").waitFor();
      await p.selectOption("#f-reader", rid); await p.fill("#f-name", name); await p.fill("#f-phone", phone); await p.fill("#f-time", time);
      await p.click('[data-act="save-appt"]'); await p.waitForTimeout(600);
    };
    const saved = (name) => s.db.appts.some((a) => a.name === name);

    // ---- (5) Əli's holiday d1..d3
    await sec("breaks");
    await p.click('[data-act="new-off"]'); await p.locator("#b-until").waitFor();
    await p.fill("#b-title", "Məzuniyyət"); await p.fill("#b-date", d1); await p.fill("#b-until", d3);
    await p.click('[data-act="b-who"][data-id="' + R1 + '"]');
    await p.click('[data-act="save-break"]'); await p.waitForTimeout(600);
    const off = s.db.breaks.find((b) => b.title === "Məzuniyyət");
    check(off && off.reader_id === R1 && off.date_from === d1 && off.date_to === d3 && !off.days && off.start_time.startsWith("00:00") && off.end_time.startsWith("23:59"),
      "saved as an all-day break d1..d3 for Əli: " + JSON.stringify(off));
    await book(R1, d2, "12:00", "Tətildə", "050 700 00 01");
    check(!saved("Tətildə") && /fasilə/i.test(await err()), "a booking on his holiday is refused: " + await err());
    await p.click('[data-act="close"]'); await p.waitForTimeout(300);
    await book(R2, d2, "12:00", "İlkinə", "050 700 00 02");
    check(saved("İlkinə"), "İlkin works that day");
    // ---- (6) the whole centre closed on d5
    await sec("breaks");
    await p.click('[data-act="new-off"]'); await p.locator("#b-until").waitFor();
    await p.fill("#b-title", "Bayram"); await p.fill("#b-date", d5); await p.fill("#b-until", d5);
    check(await p.getAttribute('[data-act="b-who"][data-id=""]', "aria-pressed") === "true", "«Bütün mərkəz» is picked by default");
    await p.click('[data-act="save-break"]'); await p.waitForTimeout(600);
    const hol = s.db.breaks.find((b) => b.title === "Bayram");
    check(hol && !hol.reader_id && hol.date_from === d5 && hol.date_to === d5, "the whole centre, one day: " + JSON.stringify(hol));
    await book(R2, d5, "15:00", "Bayramda", "050 700 00 03");
    check(!saved("Bayramda"), "nobody can be booked on the centre's day off");
    await p.click('[data-act="close"]'); await p.waitForTimeout(300);

    // ---- (7) İlkin: at most 1 session a day
    await sec("spec"); await p.click('[data-act="presets"]'); await p.locator('[data-act="ps-save"]').waitFor();
    await p.selectOption('[data-lim="' + R2 + '"]', "1"); await p.click('[data-act="ps-save"]'); await p.waitForTimeout(600);
    const pv = s.db.app_settings.find((x) => x.id === "presets").value;
    check(pv.limit && pv.limit[R2] === 1 && pv.reader[R2] && pv.reader[R2][0] === 60, "the limit is saved and the lengths stay: " + JSON.stringify(pv));
    await book(R2, d2, "16:00", "Limitdən çox", "050 700 00 04");
    check(!saved("Limitdən çox") && /İlkin/.test(await err()) && /1/.test(await err()), "over the limit: a warning, nothing written: " + await err());
    check(await p.textContent('[data-act="save-appt"]') === "Yenə də yadda saxla", "the button says «Yenə də yadda saxla»");
    await p.waitForTimeout(700); await p.click('[data-act="save-appt"]'); await p.waitForTimeout(600);
    check(saved("Limitdən çox"), "a second tap writes it anyway");

    // ---- (9) the same number already booked ahead (İlkinə, d2)
    await book(R1, bakuToday(7), "11:00", "Təkrar nömrə", "+994 50 700 00 02");
    const e9 = await err();
    check(!saved("Təkrar nömrə") && /artıq qəbul var/.test(e9) && /İlkin/.test(e9) && /12:00/.test(e9), "a warning names the booking already there: " + e9);
    await p.waitForTimeout(700); await p.click('[data-act="save-appt"]'); await p.waitForTimeout(600);
    check(saved("Təkrar nömrə"), "a second tap writes it anyway");

    // ---- (8) «Kim boşdur»
    await p.click('#tabs [data-tab="day"]'); await goDay(p, bakuToday()); await p.waitForTimeout(300);
    await p.click('#cal .cal-foot [data-act="free"]'); await p.locator("#sheet .freel").first().waitFor();
    const fr = await p.evaluate(() => [...document.querySelectorAll("#sheet h3.sec")].map((h) => h.textContent + ": " + [...h.nextElementSibling.querySelectorAll("b")].map((b) => b.textContent).join(",")));
    if (work) {
      check(fr.some((x) => /İndi boşdur/.test(x) && /İlkin/.test(x) && !/Əli/.test(x)) && fr.some((x) => /Məşğuldur/.test(x) && /Əli/.test(x)), "İlkin free, Əli busy: " + JSON.stringify(fr));
      await p.click('#sheet [data-act="free-go"][data-id="' + R2 + '"]'); await p.locator("#f-reader").waitFor();
      check(await p.inputValue("#f-reader") === R2 && await p.inputValue("#f-date") === bakuToday() && /^\d\d:\d[05]$/.test(await p.inputValue("#f-time")), "a tap opens a booking for İlkin now");
    } else check(fr.length > 0, "the sheet lists the specialists: " + JSON.stringify(fr));
    await p.click('[data-act="close"]'); await p.waitForTimeout(300);

    // ---- (10) undo a cancel
    const ul = s.db.appts.find((a) => a.name === "İlkinə");
    await goDay(p, d2); await p.waitForTimeout(300);
    await p.click("#cal >> text=İlkinə"); await p.click('[data-act="cancel-appt"]'); await p.waitForTimeout(700); await p.click('[data-act="cancel-appt"]'); await p.waitForTimeout(600);
    check(ul.status === "cancel" && await p.isVisible("#undo.on"), "cancelled at once, «Geri al» shown");
    await p.click('#undo [data-act="undo"]'); await p.waitForTimeout(700);
    check(ul.status === "wait" && !(await p.isVisible("#undo.on")), "«Geri al» puts it back: " + ul.status);
    // undo a delete: nothing reaches the server
    await p.click("#cal >> text=İlkinə");
    await p.locator('[data-act="del-appt"]').waitFor();
    await p.click('[data-act="del-appt"]'); await p.waitForTimeout(700); await p.click('[data-act="del-appt"]'); await p.waitForTimeout(800);
    check(saved("İlkinə") && !(await p.$("#cal >> text=İlkinə")), "deleted on the screen, still on the server for 5 s");
    await p.click('#undo [data-act="undo"]'); await p.waitForTimeout(5600);
    check(saved("İlkinə") && !!(await p.$("#cal >> text=İlkinə")), "«Geri al»: back, and never deleted on the server");
    // a delete goes after 5 s
    await p.click("#cal >> text=İlkinə");
    await p.locator('[data-act="del-appt"]').waitFor();
    await p.click('[data-act="del-appt"]'); await p.waitForTimeout(700); await p.click('[data-act="del-appt"]'); await p.waitForTimeout(5700);
    check(!saved("İlkinə") && !(await p.isVisible("#undo.on")), "after 5 s the delete reaches the server");
    // the app closed within the 5 s: the delete still goes
    await goDay(p, d2); await p.waitForTimeout(300);
    await p.click("#cal >> text=Limitdən çox");
    await p.locator('[data-act="del-appt"]').waitFor();
    await p.click('[data-act="del-appt"]'); await p.waitForTimeout(700); await p.click('[data-act="del-appt"]'); await p.waitForTimeout(300);
    await p.reload(); await p.locator("#tabs:not([hidden])").waitFor({ timeout: 15000 }); await p.waitForTimeout(2500);
    check(!saved("Limitdən çox"), "closing the app sends the waiting delete");
    check(!s.errors.length, "no page errors: " + s.errors.join(" | "));
  } finally { await s.close(); }
};
