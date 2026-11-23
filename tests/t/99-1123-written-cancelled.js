// Owner 23.11: «Yazdı» counts every booking written in the period, also the ones cancelled later («если она написала
// 31, из них 11 отменённые, в Yazdı должно быть 31, а не 20»). The same in «Kim neçə seans yazıb», in «Bu gün» and in
// Excel. «Ləğv» and «Uğurlu» are unchanged. Synthetic data only.
const { open, check, OWNER, AGENT, R1, seed, bakuToday, uuid } = require("../lib");
module.exports = async () => {
  const db = seed(), t = bakuToday(), now = new Date().toISOString();
  const bk = (time, status) => ({ id: uuid(), reader_id: R1, date: t, time, duration: 60, name: "P " + time, phone: "050 1" + time.replace(":", ""), price: 100, share: 0, status, note: "", settled: false, service: "Ruqya", confirmed: false, place: "ofis", follow: 0, created_by: AGENT, created_at: now, updated_at: now });
  db.appts = [bk("20:00", "wait"), bk("21:00", "wait"), bk("22:00", "cancel"), bk("23:00", "cancel")];
  const s = await open(OWNER, { db });
  try {
    const p = s.page; await p.locator("#tabs:not([hidden])").waitFor({ timeout: 15000 }); await p.waitForTimeout(2500);
    await p.click('#tabs [data-tab="stats"]');
    // the agent's row of a table: the cells under the given column titles
    const cells = (sel, cols) => p.evaluate(([q, cs]) => {
      const tb = [...document.querySelectorAll(q + " table")].find((x) => cs.every((c) => [...x.querySelectorAll("thead th")].some((h) => h.textContent.trim() === c)));
      if (!tb) return null;
      const hr = [...tb.querySelectorAll("thead tr")], last = hr[hr.length - 1], lead = hr.length > 1 ? 1 : 0;
      const idx = cs.map((c) => [...last.querySelectorAll("th")].findIndex((h) => h.textContent.trim() === c) + lead);
      const tr = [...tb.querySelectorAll("tbody tr")].find((r) => /Nurlana/.test(r.textContent));
      return tr ? idx.map((i) => tr.children[i] && tr.children[i].textContent.trim()) : null;
    }, [sel, cols]);
    for (const per of ["today", "cweek", "cmonth"]) {
      await p.click('#top [data-act="st-sec"][data-id="' + per + '"]'); await p.waitForTimeout(250);
      const ses = await p.evaluate(() => { const tr = [...document.querySelectorAll('[data-st^="sess-"] tbody tr')].find((r) => /Nurlana/.test(r.textContent)); return tr ? tr.lastElementChild.textContent.trim() : null; });
      check(ses === "4", per + ": «Kim neçə seans yazıb» counts the 2 cancelled too (4): " + ses);
      if (per !== "today") {
        const v = await cells("#main", ["Yazdı", "Ləğv"]);
        check(v && v[0] === "4" && v[1] === "2", per + ": Yazdı 4 (2 of them cancelled), Ləğv 2: " + JSON.stringify(v));
      }
    }
    check(!s.errors.length, "no page errors: " + s.errors.join("; "));
  } finally { await s.close(); }
};
