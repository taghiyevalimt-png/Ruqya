// Owner 18.11: separate sales statistics for the current week and the current month, also before they end
// («Bu həftə», «Bu ay»), next to the finished week and month («Həftəlik», «Aylıq»), which stay as they are.
// A booking written today: counted (Yazdı) in «Bu həftə» and «Bu ay», not in the finished week / month.
// Owner 22.11: the finished ones are called «Keçən həftə» / «Keçən ay»; every period has one merged table.
const { open, check, OWNER, AGENT, seed, uuid, bakuToday, R1 } = require("../lib");
module.exports = async () => {
  const db = seed(), now = new Date().toISOString(); db.appts = [];
  db.appts.push({ id: uuid(), reader_id: R1, date: bakuToday(0), time: "23:00", duration: 60, name: "Bu həftə", phone: "050 101 01 01", price: 150, share: 0, status: "wait", note: "", settled: false, service: "Hicama", confirmed: false, place: "onlayn", follow: 0, created_by: AGENT, created_at: now, updated_at: now });
  const s = await open(OWNER, { db, viewport: { width: 390, height: 844 } });
  try {
    const p = s.page; await p.locator("#tabs:not([hidden])").waitFor({ timeout: 15000 }); await p.waitForTimeout(3300);
    await p.click('#tabs [data-tab="stats"]'); await p.waitForTimeout(300);
    const secs = await p.evaluate(() => [...document.querySelectorAll('#top [data-act="st-sec"]')].map((b) => b.dataset.id + "=" + b.textContent.trim()));
    check(secs.includes("cweek=Bu həftə") && secs.includes("cmonth=Bu ay") && secs.includes("week=Keçən həftə") && secs.includes("month=Keçən ay"), "sections: the current and the finished week and month: " + JSON.stringify(secs));
    const view = async (sec) => { await p.click('#top [data-act="st-sec"][data-id="' + sec + '"]'); await p.waitForTimeout(400);
      return p.evaluate(() => { const t = document.querySelector('[data-st^="big-"]'), lab = document.querySelector("#main .daynav .label");
        const heads = t ? [...t.querySelectorAll("th.v span")].map((x) => x.textContent.trim()) : [];
        const row = t && [...t.querySelectorAll("tbody tr")].find((tr) => tr.children[0].textContent.trim() === "Nurlana");
        const tot = t && t.querySelector("tfoot tr"), hi = heads.indexOf("Hicama");
        return { label: lab ? lab.textContent : "", st: t && t.dataset.st, yazdi: row ? row.children[1 + heads.indexOf("Yazdı")].textContent.trim() : null, hicama: tot && hi >= 0 ? tot.children[1 + hi].textContent.trim() : null, place: heads.includes("Onlayn") }; }); };
    const cw = await view("cweek"), cm = await view("cmonth"), w = await view("week"), m = await view("month");
    check(cw.yazdi === "1" && /bitməyib/.test(cw.label), "«Bu həftə»: today's booking counted, the week is not over: " + JSON.stringify(cw));
    check(cm.yazdi === "1" && /bitməyib/.test(cm.label), "«Bu ay»: counted, the month is not over: " + JSON.stringify(cm));
    check(cw.hicama === "1" && cw.place, "«Bu həftə» has the services and places tables too: " + JSON.stringify(cw));
    check(w.yazdi !== "1" && /bitib/.test(w.label), "«Keçən həftə» stays the finished week: " + JSON.stringify(w));
    check(m.yazdi !== "1", "«Keçən ay» stays the finished month: " + JSON.stringify(m));
    // the chosen section is kept after reopening
    await p.click('#top [data-act="st-sec"][data-id="cweek"]'); await p.reload(); await p.locator("#tabs:not([hidden])").waitFor({ timeout: 15000 }); await p.waitForTimeout(3300);
    await p.click('#tabs [data-tab="stats"]'); await p.waitForTimeout(300);
    check(await p.getAttribute('#top [data-act="st-sec"][data-id="cweek"]', "aria-pressed") === "true", "«Bu həftə» is kept after reopening");
    // Russian labels
    await p.evaluate(() => localStorage.setItem("ruqya.lang", "ru")); await p.reload(); await p.locator("#tabs:not([hidden])").waitFor({ timeout: 15000 }); await p.waitForTimeout(3300);
    await p.click('#tabs [data-tab="stats"]'); await p.waitForTimeout(300);
    const ru = await p.evaluate(() => [...document.querySelectorAll('#top [data-act="st-sec"]')].map((b) => b.textContent.trim()));
    check(ru.includes("Эта неделя") && ru.includes("Этот месяц"), "Russian: «Эта неделя», «Этот месяц»: " + JSON.stringify(ru));
    check(!s.errors.length, "no page errors: " + s.errors.join("; "));
  } finally { await s.close(); }
};
