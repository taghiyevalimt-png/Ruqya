// Owner 18.11 (screenshot 16:36 and an example): in «Bütün gün» the specialists' names go to the bottom, under their
// columns, all in the same letter size (like the tabs at the bottom of a calendar app). Checked with 10 specialists
// at 390 and 360 px: no names over the calendar; one row at the bottom of the calendar, each name under its own
// column (also after scrolling sideways), same size; 22:00 stays visible above it; a tap shows that specialist only,
// and the bottom row then offers «Hamısı».
const { open, check, OWNER, seed, uuid } = require("../lib");
module.exports = async () => {
  for (const [w, h] of [[390, 844], [360, 740]]) {
    const db = seed();
    for (const n of ["Logman", "Zeyd", "Rizvan", "Ruhanə", "Aqşin", "Təranə", "Dr. Günel", "Psixoloq"]) db.readers.push({ id: uuid(), name: n, price: 0, share: 0, archived: false, color: null, created_at: "2026-11-05T00:00:00Z" });
    const s = await open(OWNER, { db, viewport: { width: w, height: h } });
    try {
      const p = s.page; await p.locator("#tabs:not([hidden])").waitFor({ timeout: 15000 });
      await p.evaluate(() => localStorage.setItem("ruqya.fit", "1")); await p.reload();   // «Bütün gün» chosen (default «Kiçik» since owner 18.11)
      await p.locator("#tabs:not([hidden])").waitFor({ timeout: 15000 }); await p.waitForTimeout(3300);
      const geo = () => p.evaluate(() => {
        const cal = document.getElementById("cal"), cr = cal.getBoundingClientRect(), foot = cal.querySelector(".cal-foot");
        const cols = [...cal.querySelectorAll(".col")].map((c) => c.getBoundingClientRect());
        const names = foot ? [...foot.querySelectorAll('[data-act="filter"]')].map((b) => { const r = b.getBoundingClientRect(), sp = b.querySelector("span") || b; return { t: b.textContent.trim(), cx: (r.left + r.right) / 2, fs: getComputedStyle(sp).fontSize, cut: sp.scrollWidth > sp.clientWidth + 1 }; }) : [];
        const lab = [...cal.querySelectorAll(".axis span")].find((x) => x.textContent.trim() === "22:00").getBoundingClientRect();
        const fr = foot && foot.getBoundingClientRect();
        return { topNames: cal.querySelectorAll(".cal-head .ch").length, foot: fr && { top: Math.round(fr.top), bottom: Math.round(fr.bottom), h: Math.round(fr.height) }, calBottom: Math.round(cr.bottom), cols: cols.map((c) => [(c.left + c.right) / 2, c.left, c.right]), names, l22: Math.round(lab.bottom), vsw: !!(foot && foot.querySelector('[data-act="view"]')) };
      });
      const g = await geo();
      check(g.topNames === 0, w + ": no specialists' names over the calendar: " + g.topNames);
      check(g.foot && Math.abs(g.foot.bottom - g.calBottom) <= 1, w + ": the names' row is at the bottom of the calendar: " + JSON.stringify([g.foot, g.calBottom]));
      check(g.foot && g.foot.h <= 44, w + ": a small row (" + (g.foot && g.foot.h) + " px)");
      check(g.l22 <= g.foot.top + 1, w + ": 22:00 stays visible above the row: " + g.l22 + " / " + g.foot.top);
      check(g.names.length === 10, w + ": 10 names: " + g.names.length);
      check(new Set(g.names.map((n) => n.fs)).size === 1, w + ": all names in the same letter size: " + [...new Set(g.names.map((n) => n.fs))].join(","));
      check(g.names.every((n, i) => Math.abs(n.cx - g.cols[i][0]) <= 2), w + ": each name under its own column");
      check(g.vsw, w + ": the Təqvim / Siyahı switch is in the row too");
      check(g.names.filter((n, i) => g.cols[i][2] <= 390).every((n) => !n.cut), w + ": the names on screen are not cut: " + JSON.stringify(g.names.filter((n) => n.cut).map((n) => n.t)));
      // sideways: names stay under their columns
      await p.evaluate(() => { const c = document.getElementById("cal"); c.scrollLeft = c.scrollWidth; }); await p.waitForTimeout(200);
      const g2 = await geo();
      check(g2.names.every((n, i) => Math.abs(n.cx - g2.cols[i][0]) <= 2), w + ": after scrolling sideways the names are still under their columns");
      // a tap shows that specialist only; «Hamısı» is then offered at the bottom
      await p.evaluate(() => { document.getElementById("cal").scrollLeft = 0; });
      await p.click('.cal-foot [data-act="filter"] >> text=Əli'); await p.waitForTimeout(500);
      const one = await p.evaluate(() => document.querySelectorAll("#cal .col").length);
      check(one === 1, w + ": a tap on «Əli» shows his column only: " + one);
      check(await p.locator('#spbar:not([hidden]) [data-act="filter"][data-id="all"]').count() === 1, w + ": «Hamısı» is offered at the bottom");
      await p.click('#spbar [data-act="filter"][data-id="all"]'); await p.waitForTimeout(500);
      check(await p.evaluate(() => document.querySelectorAll("#cal .col").length) === 10, w + ": «Hamısı» brings all columns back");
      check(!s.errors.length, w + ": no page errors: " + s.errors.join("; "));
    } finally { await s.close(); }
  }
};
