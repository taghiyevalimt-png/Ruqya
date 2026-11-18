// Owner 18.11: in adding to the phone's contacts a sales agent works only with the patients he wrote himself:
// a patient's card offers «Telefon kontaktlarına əlavə et» only to the agent who wrote that patient, and
// «Hamısını …» adds only the patients the agent who presses it wrote. An admin still adds everybody.
const { open, check, OWNER, AGENT, seed, uuid, bakuToday, R1 } = require("../lib");
module.exports = async () => {
  const A2 = uuid(), db = seed(), now = new Date().toISOString();
  db.appts = [];
  db.staff.push({ id: A2, name: "Asiya", role: "agent", want: null, created_at: now, hide_stats: false });
  const mk = (name, phone, by, off) => db.appts.push({ id: uuid(), reader_id: R1, date: bakuToday(off), time: "10:00", duration: 60, name, phone, price: 130, share: 0, status: "wait", note: "", settled: false, service: "Ruqya", confirmed: false, place: "ofis", follow: 0, created_by: by, created_at: now, updated_at: now });
  mk("Nurlananın Pasiyenti", "050 111 11 11", AGENT, -1); mk("Ortaq Pasiyent", "050 222 22 22", AGENT, -5); mk("Ortaq Pasiyent", "050 222 22 22", A2, -2);
  mk("Asiyanın Pasiyenti", "050 333 33 33", A2, -1);
  // older than the loaded weeks: they come as a summary without the author — the agent's own come from the database
  mk("Köhnə Nurlana", "050 444 44 44", AGENT, -120); mk("Köhnə Asiya", "050 555 55 55", A2, -120);
  const run = async (who, label, wantAll, wantCards) => {
    const s = await open(who, { viewport: { width: 390, height: 844 }, db: JSON.parse(JSON.stringify(db)) });
    try {
      const p = s.page;
      await p.addInitScript(() => { window.__c = []; window.RuqyaApp = { importContacts: (j) => { window.__c.push(j); return true; }, setWidgetData: () => {}, version: () => 3 }; });
      await p.reload(); await p.locator("#tabs:not([hidden])").waitFor({ timeout: 15000 }); await p.waitForTimeout(3300);
      await p.click('#tabs [data-tab="patients"]'); await p.waitForTimeout(500);
      const btn = p.locator('[data-act="contacts-all"]');
      await btn.click(); await p.waitForTimeout(700); await btn.click(); await p.waitForTimeout(300);
      const all = await p.evaluate(() => (window.__c[0] ? JSON.parse(window.__c[0]) : []).map((r) => r[0]).sort());
      check(JSON.stringify(all) === JSON.stringify(wantAll), label + ": «Hamısını» adds " + JSON.stringify(wantAll) + ": " + JSON.stringify(all));
      for (const [name, has] of wantCards) {
        await p.click('[data-act="patient"]:has-text("' + name + '")'); await p.locator("#sheet h2").waitFor();
        check((await p.locator('#sheet [data-act="contact-one"]').count() === 1) === has, label + ": card of «" + name + "» " + (has ? "has" : "has no") + " «Telefon kontaktlarına əlavə et»");
        await p.click('[data-act="close"]'); await p.waitForTimeout(300);
      }
      check(!s.errors.length, label + ": no page errors: " + s.errors.join("; "));
    } finally { await s.close(); }
  };
  await run(AGENT, "agent Nurlana", ["Köhnə Nurlana", "Nurlananın Pasiyenti", "Ortaq Pasiyent"], [["Nurlananın Pasiyenti", true], ["Ortaq Pasiyent", true], ["Asiyanın Pasiyenti", false], ["Köhnə Nurlana", true], ["Köhnə Asiya", false]]);
  await run(OWNER, "admin", ["Asiyanın Pasiyenti", "Köhnə Asiya", "Köhnə Nurlana", "Nurlananın Pasiyenti", "Ortaq Pasiyent"], [["Asiyanın Pasiyenti", true], ["Nurlananın Pasiyenti", true]]);
};
