// Owner 23.11 (late evening): «Pul statistikasını tamamilə sil, lazım olmadı o. Həmçinin yeni seans yazanda orada
// qiymət yazılmasın, onu sil tamamilə, qiymət lazım deyil».
//  - Statistika has no «Pul» section (also when it was the last one chosen), Excel has no «Pul» sheet;
//  - the booking form has no price field; a new booking is saved without one (price 0 in the database);
//    changing an old booking does not touch its old price;
//  - no «Qiymət yazılmayıb» warnings, no price on the cards, in the booking window, in the patient card, in the copy;
//  - Ayarlar → «Yeni qəbul: müddət» sets only the length.
const { open, check, OWNER, seed, R1, R2, bakuToday, uuid } = require("../lib");
module.exports = async () => {
  const db = seed(), t = bakuToday(), now = new Date().toISOString(), OLD = uuid();
  db.appts.push({ id: OLD, reader_id: R1, date: t, time: "08:00", duration: 30, name: "Köhnə Pasiyent", phone: "0501112233", price: 150, share: 0, status: "wait", note: "", settled: false, service: "Ruqya", confirmed: false, place: "ofis", follow: 0, created_by: OWNER, created_at: now, updated_at: now });
  db.app_settings = [{ id: "presets", value: { price: 111, svc: { Masaj: [45, 70] }, reader: { [R2]: [120, 200] } }, updated_at: now }];
  const s = await open(OWNER, { db, viewport: { width: 390, height: 844 }, init: [() => { try { localStorage.setItem("ruqya.stsec", "money"); } catch (e) {} }, null] });
  try {
    const p = s.page, sent = []; p.on("request", (r) => { if (/\/rest\/v1\/appts/.test(r.url()) && /PATCH|POST/.test(r.method())) sent.push(r.method() + " " + (r.postData() || "")); });
    await p.locator("#tabs:not([hidden])").waitFor({ timeout: 15000 }); await p.waitForTimeout(3000);
    // Statistika
    await p.click('#tabs [data-tab="stats"]'); await p.waitForTimeout(300);
    const secs = await p.evaluate(() => [...document.querySelectorAll('#top [data-act="st-sec"]')].map((b) => b.dataset.id));
    check(!secs.includes("money") && secs.includes("prod"), "no «Pul» section: " + secs);
    { const m = await p.textContent("#main"); check(!(await p.locator('[data-st^="money-"]').count()) && !/Pul statistikası|Qazanc|Pul cədvəl/.test(m), "no money table, even if «Pul» was the last section chosen: " + m.slice(0, 400)); }
    // the booking form
    await p.click('#tabs [data-tab="day"]'); await p.click("#fab"); await p.locator("#f-reader").waitFor();
    check(!(await p.locator("#f-price").count()) && !/Qiymət/.test(await p.textContent("#sheet")), "no price in a new booking");
    await p.selectOption("#f-reader", R2); await p.waitForTimeout(150);
    check(await p.inputValue("#f-dur") === "120", "the length preset still works");
    await p.fill("#f-name", "Yeni Pasiyent"); await p.fill("#f-phone", "0559998877"); await p.fill("#f-time", "12:00");
    await p.click('[data-act="save-appt"]'); await p.waitForTimeout(900);
    const nw = s.db.appts.find((a) => a.name === "Yeni Pasiyent");
    check(nw && +nw.price === 0, "saved without a price: " + JSON.stringify(nw && { price: nw.price }));
    check(!(await p.locator("#f-err:not([hidden])").count()), "no «write the price» error");
    // no warnings, no price on the screen
    const body = await p.evaluate(() => document.body.innerText);
    check(!/Qiymət yazılmayıb|qiyməti yazılmayıb|pul statistikasına/.test(body), "no «price not written» warnings");
    // the old booking: no price shown; changing its name keeps the old price and does not send one
    await p.click(`[data-act="view-appt"][data-id="${OLD}"]`); await p.locator('[data-act="edit-appt"]').waitFor();
    check(!/150|Qiymət/.test(await p.textContent("#sheet")), "the booking window shows no price: " + (await p.textContent("#sheet")).slice(0, 300));
    const before = sent.length;
    if (await p.locator('[data-act="edit-appt"]').count()) {
      await p.click('[data-act="edit-appt"]'); await p.locator("#f-name").waitFor();
      check(!(await p.locator("#f-price").count()), "no price when changing a booking");
      await p.fill("#f-name", "Köhnə Pasiyent 2"); await p.click('[data-act="save-appt"]'); await p.waitForTimeout(900);
      const old = s.db.appts.find((a) => a.id === OLD);
      check(old && old.name === "Köhnə Pasiyent 2" && +old.price === 150, "the old price is kept: " + JSON.stringify(old && { name: old.name, price: old.price }));
      check(sent.length > before && !sent.slice(before).some((b) => /price/.test(b)), "no price sent: " + sent.slice(before).join(" | "));
    } else check(false, "could not open the old booking");
    // Ayarlar → presets: length only
    await p.click('[data-act="close"]').catch(() => {}); await p.waitForTimeout(300);
    await p.click('#tabs [data-tab="readers"]'); await p.click('[data-act="set-sec"][data-id="spec"]').catch(() => {});
    await p.click('[data-act="presets"]'); await p.locator('[data-act="ps-save"]').waitFor();
    check(!(await p.locator('#ps-price, [data-f="p"]').count()) && /Yeni qəbul: müddət/.test(await p.textContent("#sheet")), "the presets window has no prices");
    await p.selectOption('[data-ps="svc"][data-k="Kombo"]', "90"); await p.click('[data-act="ps-save"]'); await p.waitForTimeout(700);
    const v = (s.db.app_settings.find((x) => x.id === "presets") || {}).value;
    check(v && JSON.stringify(v.svc.Kombo) === "[90,null]" && JSON.stringify(v.svc.Masaj) === "[45,null]" && v.price === null, "lengths saved, no prices: " + JSON.stringify(v));
    check(!s.errors.length, "no page errors: " + s.errors.join("; "));
  } finally { await s.close(); }
};
