// Owner 24.11 (morning): «not one look by day and another in the evening — one; powerful changes, to be amazed».
// Design 3.0 — one look for everybody, always:
//  - the phone's light mode and an old «light» choice change nothing: night and gold everywhere; no theme buttons in Ayarlar;
//  - the bookings head: the weekday small and gold, the date big (the text still «Çərşənbə axşamı, 24 noyabr»);
//  - a round gold + raised in the gap of the tab bar (2 tabs on its left, 3 on its right), not covering the calendar;
//  - gold «hero» cards for the day (Kassa) and the period (Statistika); tinted calendar blocks, cancelled still black;
//  - a weak phone draws no shadows.
const { open, check, OWNER, seed, uuid, bakuToday, R1 } = require("../lib");
module.exports = async () => {
  const db = seed(), now = new Date().toISOString();
  db.appts.push({ id: uuid(), reader_id: R1, date: bakuToday(), time: "12:00", duration: 60, name: "Ləğv olan", phone: "050", price: 0, share: 0, status: "cancel", note: "", settled: false, service: "Ruqya", confirmed: false, place: "ofis", follow: 0, created_by: OWNER, created_at: now, updated_at: now });
  const s = await open(OWNER, { db, viewport: { width: 390, height: 844 }, init: [() => { localStorage.setItem("ruqya.theme", "light"); localStorage.setItem("ruqya.view18", "1"); }, null] });
  try {
    const p = s.page; await p.emulateMedia({ colorScheme: "light" });
    await p.locator("#tabs:not([hidden])").waitFor({ timeout: 15000 }); await p.waitForTimeout(2500);
    await p.click('#tabs [data-tab="day"]'); await p.waitForTimeout(600);
    const m = await p.evaluate(() => {
      const cs = (e) => getComputedStyle(e), r = (e) => e.getBoundingClientRect();
      const fab = document.getElementById("fab"), st = document.querySelector('#tabs [data-tab="stats"]'), cash = document.querySelector('#tabs [data-tab="cash"]'), tabs = document.getElementById("tabs");
      const fr = r(fab), sr = r(st), cr = r(cash), tr = r(tabs), cal = document.getElementById("cal"), foot = cal && cal.querySelector(".cal-foot");
      const ev = [...document.querySelectorAll("#cal .ev")], ok = ev.find((e) => !e.classList.contains("cancel")), cn = ev.find((e) => e.classList.contains("cancel"));
      return { theme: document.documentElement.getAttribute("data-theme"), bg: cs(document.body).backgroundColor,
        wk: (document.querySelector(".daynav .label .wk") || {}).textContent, wkfs: parseFloat(cs(document.querySelector(".daynav .label .wk")).fontSize), dtfs: parseFloat(cs(document.querySelector(".daynav .label .dt")).fontSize), label: document.querySelector(".daynav .label").textContent,
        fab: { w: Math.round(fr.width), round: cs(fab).borderTopLeftRadius === "50%", cx: Math.round(fr.left + fr.width / 2), gapL: Math.round(sr.right), gapR: Math.round(cr.left), riseAbove: Math.round(tr.top - fr.top), clearFoot: !foot || Math.round(fr.top) >= Math.round(r(foot).bottom) - 1 },
        ev: ok && cs(ok).backgroundColor, cancel: cn && cs(cn).backgroundColor };
    });
    check(m.theme === "dark" && m.bg === "rgb(9, 8, 11)", "one look even with the phone in light mode and an old «light» choice: " + JSON.stringify([m.theme, m.bg]));
    check(m.wkfs < 13 && m.dtfs >= 26 && /, /.test(m.label) && m.wk, "the weekday small, the date big: " + JSON.stringify([m.wk, m.wkfs, m.dtfs, m.label]));
    check(m.fab.round && m.fab.w >= 56 && m.fab.cx > m.fab.gapL && m.fab.cx < m.fab.gapR && m.fab.riseAbove > 10 && m.fab.clearFoot, "a round + raised in the gap of the tab bar, clear of the calendar: " + JSON.stringify(m.fab));
    check(/rgba\(.*0\.3\)/.test(m.ev) && m.cancel === "rgb(0, 0, 0)", "tinted blocks, cancelled black: " + JSON.stringify([m.ev, m.cancel]));
    await p.click("#fab"); await p.locator("#f-reader").waitFor(); check(true, "the + opens a new booking");
    await p.click('[data-act="close"]'); await p.waitForTimeout(400); if (await p.locator('[data-act="draft-drop"]').count()) await p.click('[data-act="draft-drop"]');
    for (const [tab, sel] of [["cash", ".herosum"], ["stats", ".pertot"]]) {
      await p.click('#tabs [data-tab="' + tab + '"]'); if (tab === "stats") await p.click('#top [data-act="st-sec"][data-id="cweek"]'); await p.waitForTimeout(400);
      const h = await p.evaluate((q) => { const e = document.querySelector(q); return e ? { img: getComputedStyle(e).backgroundImage, col: getComputedStyle(e.querySelector("b")).color } : null; }, sel);
      check(h && /gradient/.test(h.img) && h.col === "rgb(20, 15, 6)", tab + ": a gold hero card: " + JSON.stringify(h));
      check(await p.evaluate(() => document.getElementById("fab").hidden), tab + ": no + here");
    }
    await p.click('#tabs [data-tab="readers"]'); await p.click('[data-act="set-sec"][data-id="view"]').catch(() => {}); await p.waitForTimeout(300);
    check(!(await p.locator('[data-act="theme"]').count()), "no theme buttons in Ayarlar");
    check(!s.errors.length, "no page errors: " + s.errors.join("; "));
  } finally { await s.close(); }
  const w = await open(OWNER, { db: seed(), init: [() => localStorage.setItem("ruqya.lite", "1"), null] });
  try { const p = w.page; await p.locator("#tabs:not([hidden])").waitFor({ timeout: 15000 }); await p.waitForTimeout(2000);
    check(await p.evaluate(() => [...document.querySelectorAll(".tabs,.wd,.card,.pay")].every((e) => getComputedStyle(e).boxShadow === "none")), "a weak phone draws no shadows");
  } finally { await w.close(); }
};
