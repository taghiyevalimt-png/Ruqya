// Owner 24.11: «even if today is 23 November and the agent first picked 24 November on top and then wrote a new booking,
// it must count as written on the 23rd, today — that is when he really wrote it; especially in «Bu gün»».
// The agent opens tomorrow (and a day next week) in the calendar, writes bookings there; Statistika → «Bu gün»:
// «Kim neçə seans yazıb» and «Yazdı» grow by them today; the sessions of today («Seans») do not.
const { open, check, AGENT, seed, R1, bakuToday, goDay } = require("../lib");
module.exports = async () => {
  const db = seed(); db.appts = [];
  const s = await open(AGENT, { db });
  try {
    const p = s.page; await p.locator("#tabs:not([hidden])").waitFor({ timeout: 15000 }); await p.waitForTimeout(2500);
    const today = async () => {
      await p.click('#tabs [data-tab="stats"]'); await p.click('#top [data-act="st-sec"][data-id="today"]'); await p.waitForTimeout(300);
      return p.evaluate(() => {
        const sess = [...document.querySelectorAll('[data-st^="sess-"] tbody tr')].find((r) => /Nurlana/.test(r.cells[0].textContent));
        const hd = [...document.querySelectorAll('[data-st^="big-"] thead tr.sub th')].map((x) => x.textContent.trim());
        const big = [...document.querySelectorAll('[data-st^="big-"] tbody tr')].find((r) => /Nurlana/.test(r.cells[0].textContent));
        return { sess: sess ? +sess.cells[2].textContent : null, yazdi: big ? +big.cells[hd.indexOf("Yazdı") + 1].textContent : null, seans: +document.querySelector(".todaysum b").textContent };
      });
    };
    const before = await today();
    const write = async (day, name, time) => {
      await p.click('#tabs [data-tab="day"]');
      // pick the day on top first (› day by day; the week strip is gone since 24.11)
      await goDay(p, day); await p.waitForTimeout(250);
      await p.click("#fab"); await p.locator("#f-reader").waitFor();
      check(await p.inputValue("#f-date") === day, "the form starts on the picked day " + day + ": " + await p.inputValue("#f-date"));
      await p.selectOption("#f-reader", R1); await p.fill("#f-name", name); await p.fill("#f-phone", "050 123 45 67"); await p.fill("#f-time", time);
      await p.click('[data-act="save-appt"]'); await p.waitForTimeout(800);
      check(s.db.appts.some((a) => a.name === name && a.date === day), name + " saved for " + day);
    };
    await write(bakuToday(1), "Sabahkı", "12:00");
    await write(bakuToday(8), "Gələn həftə", "13:00");
    const after = await today();
    check(after.sess === before.sess + 2, "«Kim neçə seans yazıb» today: +2 (written today for tomorrow and next week): " + JSON.stringify([before, after]));
    check(after.yazdi === before.yazdi + 2, "«Yazdı» today: +2: " + JSON.stringify([before, after]));
    check(after.seans === before.seans, "today's sessions unchanged (they are on other days): " + JSON.stringify([before, after]));
    // the same after reading everything again from the database (the server's time of writing)
    await p.reload(); await p.locator("#tabs:not([hidden])").waitFor({ timeout: 15000 }); await p.waitForTimeout(2500);
    const again = await today();
    check(again.sess === after.sess && again.yazdi === after.yazdi, "the same after reopening: " + JSON.stringify([after, again]));
    check(!s.errors.length, "no page errors: " + s.errors.join("; "));
  } finally { await s.close(); }
};
