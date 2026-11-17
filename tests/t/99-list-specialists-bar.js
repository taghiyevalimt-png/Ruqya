// Owner 18.11 (screenshot + screen recording, list view «Siyahı»): the specialists' names over the list are too bulky
// and take an important part of the screen — put them at the bottom, small; and «Hamısı» disappeared when nobody was
// chosen, so the names moved and the list jumped. Now: one small row at the bottom (above «+ Yaz»), scrolled sideways,
// «Hamısı» always first (pressed when everyone is shown); the names never move when one is tapped.
const { open, check, OWNER, seed, uuid } = require("../lib");
module.exports = async () => {
  const db = seed();
  for (const n of ["Logman", "Zeyd", "Rizvan", "Ruhanə", "Aqşin", "Təranə", "Dr. Günel", "Psixoloq", "İlkin 2"]) db.readers.push({ id: uuid(), name: n, price: 0, share: 0, archived: false, color: null, created_at: "2026-11-05T00:00:00Z" });
  const s = await open(OWNER, { db, viewport: { width: 390, height: 844 } });
  try {
    const p = s.page; await p.locator("#tabs:not([hidden])").waitFor({ timeout: 15000 }); await p.waitForTimeout(3300);
    await p.click('#tabs [data-tab="day"]'); await p.click('[data-act="view"][data-id="list"]'); await p.waitForTimeout(400);
    const geo = () => p.evaluate(() => {
      const bar = document.getElementById("spbar"), fab = document.getElementById("fab"), main = document.getElementById("main");
      if (!bar || bar.hidden) return null;
      const br = bar.getBoundingClientRect(), fr = fab.getBoundingClientRect(), mr = main.getBoundingClientRect();
      const btn = [...bar.querySelectorAll("button")].map((b) => ({ t: b.textContent.trim(), on: b.getAttribute("aria-pressed"), x: Math.round(b.getBoundingClientRect().left + bar.scrollLeft), h: Math.round(b.getBoundingClientRect().height), fs: parseFloat(getComputedStyle(b).fontSize) }));
      const topNames = [...main.querySelectorAll('[data-act="filter"]')].length;
      return { top: Math.round(br.top), bottom: Math.round(br.bottom), h: Math.round(br.height), fabTop: Math.round(fr.top), mainBottom: Math.round(mr.bottom), rows: new Set(btn.map((b) => Math.round(b.h))).size, btn, topNames, wraps: bar.scrollHeight > bar.clientHeight + 1 };
    });
    const g0 = await geo();
    check(g0, "the specialists' bar is shown in the list view");
    check(g0.topNames === 0, "no specialists' names over the list any more: " + g0.topNames);
    check(g0.bottom <= g0.fabTop + 1 && g0.top >= g0.mainBottom - 1, "the bar is at the bottom, just above «+ Yaz»: " + JSON.stringify({ top: g0.top, bottom: g0.bottom, fab: g0.fabTop, main: g0.mainBottom }));
    check(g0.h <= 48 && !g0.wraps, "one small row (height " + g0.h + " px)");
    check(g0.btn.every((b) => b.fs <= 13.5), "small letters: " + g0.btn.map((b) => b.fs).join(","));
    check(g0.btn[0].t === "Hamısı" && g0.btn[0].on === "true", "«Hamısı» first and pressed while everyone is shown: " + JSON.stringify(g0.btn[0]));
    check(g0.btn.length === 12, "Hamısı + 11 specialists: " + g0.btn.length);
    // tap a specialist: nothing moves, «Hamısı» stays, the chosen one is pressed
    await p.click('#spbar [data-act="filter"] >> text=Logman'); await p.waitForTimeout(400);
    const g1 = await geo();
    check(g1.btn[0].t === "Hamısı" && g1.btn[0].on === "false", "«Hamısı» stays (not pressed) after choosing one");
    check(JSON.stringify(g1.btn.map((b) => [b.t, b.x])) === JSON.stringify(g0.btn.map((b) => [b.t, b.x])), "no name moved: " + JSON.stringify(g1.btn.map((b) => b.t + "@" + b.x)));
    check(g1.btn.find((b) => b.t === "Logman").on === "true", "Logman is shown as chosen");
    check(g1.top === g0.top, "the bar did not move: " + g0.top + " → " + g1.top);
    await p.click('#spbar [data-act="filter"] >> text=Hamısı'); await p.waitForTimeout(400);
    const g2 = await geo();
    check(g2.btn[0].on === "true" && g2.btn.filter((b) => b.on === "true").length === 1, "«Hamısı» again shows everyone");
    // the calendar view and other tabs have no bottom bar
    await p.click('[data-act="view"][data-id="grid"]'); await p.waitForTimeout(400);
    check(await p.evaluate(() => document.getElementById("spbar").hidden), "no bottom bar in the calendar view");
    await p.click('[data-act="view"][data-id="list"]'); await p.click('#tabs [data-tab="stats"]'); await p.waitForTimeout(300);
    check(await p.evaluate(() => document.getElementById("spbar").hidden), "no bottom bar on Statistika");
    check(!s.errors.length, "no page errors: " + s.errors.join("; "));
  } finally { await s.close(); }
};
