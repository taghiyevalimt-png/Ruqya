// A5-K3: «some patients are not in the list of all patients». Cause found by running: one phone number = one patient,
// so a mother and her son (or two relatives) booked with one number were one patient — only the last name was shown.
// Owner 22.11: a patient is the phone number + the name (the name compared without case, extra spaces and Azerbaijani
// letters: «Məmmədova» = «Memmedova»); without a phone number (fewer than 7 digits) — the name.
const { open, check, OWNER, seed, R1, bakuToday, uuid, AGENT } = require("../lib");
module.exports = async () => {
  const db = seed(), now = new Date().toISOString();
  const mk = (off, name, phone) => ({ id: uuid(), reader_id: R1, date: bakuToday(off), time: "10:00", duration: 60, name, phone, price: 130, share: 0, status: "wait", note: "", settled: false, service: "Ruqya", confirmed: false, place: "ofis", follow: 0, created_by: AGENT, created_at: now, updated_at: now });
  db.appts = [mk(-3, "Aysel Məmmədova", "050 111 22 33"), mk(-1, "Orxan Məmmədov", "+994 50 111 22 33"), mk(1, "aysel  memmedova", "0501112233"),
    mk(-2, "Leyla", ""), mk(-2, "Leyla", "12"), mk(-4, "Nigar", "055 999 88 77")];
  const s = await open(OWNER, { db });
  try {
    const p = s.page; await p.locator("#tabs:not([hidden])").waitFor({ timeout: 15000 }); await p.waitForTimeout(2500);
    await p.click('#tabs [data-tab="patients"]'); await p.waitForTimeout(600);
    const names = await p.evaluate(() => [...document.querySelectorAll('#plist [data-act="patient"] b')].map((b) => b.textContent.replace(/^[^A-Za-zƏəÇçŞşĞğÖöÜüİıА-я]+/, "").trim()));
    check(names.length === 4, "4 patients: Aysel (2 visits, 3 spellings of one number and name), Orxan (same number), Leyla (no number), Nigar: " + JSON.stringify(names));
    check(names.some((n) => /Orxan/.test(n)) && names.some((n) => /Aysel|aysel/.test(n)), "the mother and the son with one number are both in the list");
    check(!s.errors.length, "no page errors: " + s.errors.join("; "));
  } finally { await s.close(); }
};
