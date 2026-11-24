// Owner 22.11: «copied to WhatsApp the statistics look awful — make them look nice there too, like in the app». A
// wide monospaced grid breaks on a phone; «Kopyala» now gives one short block per person, the name in bold.
const { open, check, OWNER, AGENT, seed, R1, bakuToday, uuid } = require("../lib");
module.exports = async () => {
  const db = seed(), now = new Date().toISOString();
  db.appts.push({ id: uuid(), reader_id: R1, date: bakuToday(), time: "08:00", duration: 30, name: "X", phone: "050", price: 130, share: 0, status: "wait", note: "", settled: false, service: "Hicama", confirmed: false, place: "onlayn", follow: 0, created_by: AGENT, created_at: now, updated_at: now });
  const s = await open(OWNER, { db });
  try {
    const p = s.page; await p.context().grantPermissions(["clipboard-read", "clipboard-write"]);
    await p.locator("#tabs:not([hidden])").waitFor({ timeout: 15000 }); await p.waitForTimeout(2500);
    await p.click('#tabs [data-tab="stats"]'); await p.click('#top [data-act="st-sec"][data-id="cweek"]'); await p.waitForTimeout(300);
    await p.click('[data-st="big-cweek"] [data-act="st-copy-t"]'); await p.waitForTimeout(300);
    const t = await p.evaluate(() => navigator.clipboard.readText());
    check(!/```|\|/.test(t), "no wide grid: " + t);
    // owner 23.11 late evening: plain text in every copy — «Nurlana - qəbullar: yazdı 2, …; xidmətlər: Ruqya 1, Hicama 1; …»
    check(/^Bu həftə — Ümumi cədvəl, \d/.test(t) && /^Nurlana - qəbullar: yazdı \d+, uğurlu \d+, ləğv \d+; xidmətlər: Ruqya 1, Hicama 1; yer: /m.test(t) && !/Kombo 0/.test(t), "a line per person, zeros of long groups left out: " + t);
    check(!/[*_▪🔸📊]/u.test(t), "no stars, underscores or emoji");
    await p.click('[data-st="sess-cweek"] [data-act="st-copy-t"]'); await p.waitForTimeout(300);
    const u = await p.evaluate(() => navigator.clipboard.readText());
    check(u.split("\n").some((l) => /^Nurlana - (\S.* \d+, )+cəmi 2 seans$/.test(l)), "the sessions table: one plain line per person, the specialists' full names, then cəmi (24.11 evening): " + u);
    check(!s.errors.length, "no page errors: " + s.errors.join("; "));
  } finally { await s.close(); }
};
