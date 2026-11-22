// Owner 17.11: six services in the booking form (last field, like «Yer»), Ruqya chosen by default and changeable;
// saved, shown in the booking card, editable, and every service listed in statistics with its count.
const { open, check, AGENT, R1, bakuToday, seed, uuid } = require("../lib");
module.exports = async () => {
  const db = seed(), now = new Date().toISOString();
  db.appts.push({ id: uuid(), reader_id: R1, date: bakuToday(0), time: "19:00", duration: 60, name: "Köhnə Xidmət", phone: "050 1", price: 130, share: 0, status: "wait", note: "", settled: false, service: "Köhnə növ", confirmed: false, place: "ofis", follow: 0, created_by: AGENT, created_at: now, updated_at: now });
  const s = await open(AGENT, { db });
  try {
    const p = s.page; p.setDefaultTimeout(5000); await p.locator("#cal .ev").first().waitFor({ timeout: 15000 }); await p.waitForTimeout(3300);
    await p.click("#fab"); await p.locator("#f-reader").waitFor();
    const opts = await p.$$eval('input[name="f-service"]', (els) => els.map((e) => e.value + (e.checked ? "*" : "")));
    check(JSON.stringify(opts) === JSON.stringify(["Ruqya*", "Hicama", "Kombo", "Masaj", "Dr.Günel", "Psixoloq"]), "six services, Ruqya chosen: " + opts.join(","));
    const last = await p.$$eval("#sheet input, #sheet select", (els) => els.filter((e) => e.name || e.id).map((e) => e.name || e.id).pop());
    check(last === "f-service", "the service is the last field: " + last);
    await p.selectOption("#f-reader", R1); await p.fill("#f-name", "Xidmət Pasiyent"); await p.fill("#f-phone", "050 999 88 77"); await p.fill("#f-time", "21:00");
    await p.click('label.segb:has(input[name="f-service"][value="Masaj"])');
    await p.click('[data-act="save-appt"]'); await p.waitForTimeout(800);
    const row = () => s.db.appts.find((a) => a.name === "Xidmət Pasiyent");
    check(row() && row().service === "Masaj", "saved with service Masaj: " + (row() && row().service));
    // the card shows it; editing changes it
    await p.click("#cal >> text=Xidmət Pasiyent"); await p.waitForTimeout(400);
    check(/Masaj/.test(await p.textContent("#sheet")), "the booking card shows the service");
    await p.click('[data-act="edit-appt"]').catch(() => {}); await p.locator('input[name="f-service"]').first().waitFor();
    check(await p.isChecked('input[name="f-service"][value="Masaj"]'), "the edit form has Masaj chosen");
    await p.click('label.segb:has(input[name="f-service"][value="Psixoloq"])'); await p.click('[data-act="save-appt"]'); await p.waitForTimeout(800);
    check(row().service === "Psixoloq", "service changed to Psixoloq: " + row().service);
    // an old booking with a service that is none of the six: nothing is chosen, and saving asks for a choice
    await p.click('[data-act="close"]').catch(() => {}); await p.waitForTimeout(300);
    await p.click('[data-act="goto"][data-d="' + bakuToday(0) + '"]').catch(() => {}); await p.waitForTimeout(300);
    await p.click("#cal >> text=Köhnə Xidmət"); await p.waitForTimeout(400); await p.click('[data-act="edit-appt"]'); await p.locator('input[name="f-service"]').first().waitFor();
    check((await p.locator('input[name="f-service"]:checked').count()) === 0, "old unknown service: nothing chosen");
    await p.click('[data-act="save-appt"]'); await p.waitForTimeout(300);
    check(/Xidmət növünü seçmək vacibdir/.test(await p.textContent("#f-err")), "saving without a service asks for it: " + (await p.textContent("#f-err")));
    check(s.db.appts.find((a) => a.name === "Köhnə Xidmət").service === "Köhnə növ", "nothing was saved");
    await p.click('[data-act="close"]'); await p.click('[data-act="draft-drop"]', { timeout: 500 }).catch(() => {});
    // statistics: every service listed
    // owner 22.11: one merged table per period; its service columns are the services written in the period
    await p.click('#tabs [data-tab="stats"]'); await p.click('#top [data-act="st-sec"][data-id="cweek"]'); await p.waitForTimeout(400);
    const st = await p.evaluate(() => { const t = document.querySelector('[data-st^="big-"]'), h = [...t.querySelectorAll("th.v span")].map((x) => x.textContent.trim()), f = [...t.querySelectorAll("tfoot tr")].map((r) => [...r.children].map((c) => c.textContent.trim()));
      const i = h.indexOf("Psixoloq"); return { h, tot: i >= 0 ? f[0][1 + i] : null, ok: i >= 0 ? f[1][i - 4] : null }; });
    check(st.h.includes("Psixoloq") && st.h.includes("Köhnə növ"), "statistics list the services written: " + st.h);
    check(st.tot === "1" && st.ok === "0", "the Psixoloq session is counted (1 session, 0 successful yet): " + JSON.stringify(st));
    check(!s.errors.length, "no page errors: " + s.errors.join("; "));
  } finally { await s.close(); }
};
