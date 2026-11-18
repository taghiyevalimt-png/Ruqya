// Owner 18.11 notes: an «import» button for the patients' list — everybody at once or one patient — that puts only
// names and phone numbers into the phone's contacts, on Android and on iPhone.
//  - Android app (bridge window.RuqyaApp.importContacts): the list [[name, phone], …] goes to the app, which adds
//    the contacts itself (checked on the emulators: android/test-widget.sh, contacts-*.txt);
//  - iPhone / other browsers: a contacts file (.vcf) with the same names and numbers.
// One person per number (the same number twice is one contact), patients without a number are left out.
const fs = require("fs");
const { open, check, AGENT, seed, uuid, bakuToday, R1 } = require("../lib");
module.exports = async () => {
  const db = seed(), now = new Date().toISOString();
  db.appts = [];
  const mk = (name, phone, off) => db.appts.push({ id: uuid(), reader_id: R1, date: bakuToday(off), time: "10:00", duration: 60, name, phone, price: 130, share: 0, status: "wait", note: "", settled: false, service: "Ruqya", confirmed: false, place: "ofis", follow: 0, created_by: AGENT, created_at: now, updated_at: now });
  mk("Leyla Məmmədova", "+994 55 111 22 33", -3); mk("Leyla", "055 111 22 33", -1); mk("Orxan; Əliyev", "050 222 33 44", -2); mk("Nömrəsiz", "", -2);
  const flow = async (native) => {
    const s = await open(AGENT, { viewport: { width: 390, height: 844 } , db: JSON.parse(JSON.stringify(db)) });
    try {
      const p = s.page;
      if (native) { await p.addInitScript(() => { window.__c = []; window.RuqyaApp = { importContacts: (j) => { window.__c.push(j); return true; }, setWidgetData: () => {}, version: () => 3 }; }); await p.reload(); }
      await p.locator("#tabs:not([hidden])").waitFor({ timeout: 15000 }); await p.waitForTimeout(3300);
      await p.click('#tabs [data-tab="patients"]'); await p.waitForTimeout(500);
      const btn = p.locator('[data-act="contacts-all"]');
      check(await btn.count() === 1, (native ? "app" : "browser") + ": the button over the patients' list is there");
      check(/\(2\)/.test(await btn.textContent()), "it counts 2 people (one per number, without the one with no number): " + await btn.textContent());
      await btn.click(); check(/bir də basın/.test(await btn.textContent()), "the first tap asks to confirm");
      await p.waitForTimeout(700);
      if (native) {
        await btn.click(); await p.waitForTimeout(300);
        const sent = await p.evaluate(() => window.__c.map((j) => JSON.parse(j)));
        check(sent.length === 1 && sent[0].length === 2, "the app gets one list of 2 contacts: " + JSON.stringify(sent));
        const names = sent[0].map((r) => r[0] + " / " + r[1]).sort();
        check(JSON.stringify(names) === JSON.stringify(["Leyla / 055 111 22 33", "Orxan; Əliyev / 050 222 33 44"]), "only names and numbers, the latest name of a number: " + JSON.stringify(names));
        await p.evaluate(() => window.ruqyaContactsDone(2, 0, "")); await p.waitForTimeout(200);
        check(/Kontaktlara əlavə edildi: 2/.test(await p.textContent("body")), "the result is shown");
        // one patient from his card
        await p.click('[data-act="patient"] >> nth=0'); await p.locator('#sheet [data-act="contact-one"]').waitFor();
        await p.click('#sheet [data-act="contact-one"]'); await p.waitForTimeout(300);
        const one = await p.evaluate(() => JSON.parse(window.__c[window.__c.length - 1]));
        check(one.length === 1 && one[0][1], "a patient's card adds that one patient: " + JSON.stringify(one));
        await p.evaluate(() => window.ruqyaContactsDone(0, 0, "denied")); await p.waitForTimeout(200);
        check(/icazə verilmədi/.test(await p.textContent("body")), "a refused permission is explained");
      } else {
        const [dl] = await Promise.all([p.waitForEvent("download", { timeout: 10000 }), btn.click()]);
        const vcf = fs.readFileSync(await dl.path(), "utf8");
        check(dl.suggestedFilename().endsWith(".vcf"), "a contacts file (.vcf): " + dl.suggestedFilename());
        check((vcf.match(/BEGIN:VCARD/g) || []).length === 2 && /FN:Orxan\\; Əliyev/.test(vcf) && /TEL;TYPE=CELL:055 111 22 33/.test(vcf) && !/Nömrəsiz/.test(vcf), "2 cards with names and numbers: " + vcf.replace(/\r\n/g, " | "));
      }
      check(!s.errors.length, "no page errors: " + s.errors.join("; "));
    } finally { await s.close(); }
  };
  await flow(true);
  await flow(false);
};
