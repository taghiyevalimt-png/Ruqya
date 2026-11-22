// A5-05 (audit 5, general audit — silent errors): a change the server did not apply (the row was deleted on another
// phone, or row-level security does not let this user change it) came back without an error but with 0 rows, and the
// app showed it as saved. Now the app asks for the touched row back; none = a clear message and the list is reloaded.
const { open, check, OWNER, AGENT, seed, R1, bakuToday, uuid } = require("../lib");
module.exports = async () => {
  const db = seed(), now = new Date().toISOString();
  const mk = (name, phone) => ({ id: uuid(), reader_id: R1, date: bakuToday(1), time: "21:00", duration: 90, name, phone, price: 130, share: 0, status: "wait", note: "", settled: false, service: "Ruqya", confirmed: false, place: "ofis", follow: 0, created_by: AGENT, created_at: now, updated_at: now });
  db.appts = [mk("Silinən Sınaq", "0501110001"), mk("Qalan Sınaq", "0501110002")];
  const s = await open(OWNER, { db });
  try {
    const p = s.page; await p.locator("#tabs:not([hidden])").waitFor({ timeout: 15000 }); await p.waitForTimeout(3000);
    await p.click('#tabs [data-tab="patients"]'); await p.waitForTimeout(300);
    await p.click('[data-act="p-sec"][data-id="conf"]'); await p.waitForTimeout(300);
    // deleted on another phone; this phone has not heard about it yet
    s.db.appts = s.db.appts.filter((a) => a.name !== "Silinən Sınaq");
    await p.locator('#plist [data-act="conf"]').first().click(); await p.waitForTimeout(1500);
    const fl = await p.evaluate(() => document.body.innerText);
    check(/saxlanmadı/.test(fl), "the user is told the change was not applied: «" + fl.slice(0, 160) + "»");
    check(!/Silinən Sınaq/.test(await p.textContent("#main")), "the list was reloaded: the deleted booking is gone");
    // a change that does apply says nothing
    await p.locator('#plist [data-act="conf"]').first().click(); await p.waitForTimeout(800);
    check(s.db.appts.find((a) => a.name === "Qalan Sınaq").confirmed === true, "a normal change is saved");
    check(!s.errors.length, "no page errors: " + s.errors.join("; "));
  } finally { await s.close(); }
};
