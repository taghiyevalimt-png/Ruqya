// Owner 17.11: one more, smaller block size, so the main screen shows the whole working day 09:00–22:00 and every
// specialist at once, without moving the calendar by hand. Ayarlar → Görünüş → «Blokların hündürlüyü» → «Bütün gün».
// Checked on an iPhone-size screen (390×844) and a small Android (360×740), with 7 specialists, in both languages:
// no scrolling needed (sideways or down) to see 09:00…22:00 of all columns; the other sizes still scroll as before.
const { open, check, OWNER, seed, uuid } = require("../lib");
module.exports = async () => {
  for (const [w, h] of [[390, 844], [360, 740]]) {
    const db = seed();
    while (db.readers.length < 7) db.readers.push({ id: uuid(), name: "Mütəxəssis " + db.readers.length, price: 0, share: 0, archived: false, color: null, created_at: "2026-11-03T00:00:00Z" });
    const s = await open(OWNER, { db, viewport: { width: w, height: h } });
    try {
      const p = s.page; await p.locator("#tabs:not([hidden])").waitFor({ timeout: 15000 }); await p.waitForTimeout(3300);
      await p.click('#tabs [data-tab="readers"]'); await p.click('#top [data-act="set-sec"][data-id="view"]'); await p.waitForTimeout(300);
      const btn = p.locator('[data-act="hourh"][data-id="fit"]');
      check(await btn.count() === 1, w + ": «Bütün gün» is offered among the block heights");
      await btn.click(); await p.waitForTimeout(200);
      check(await btn.getAttribute("aria-pressed") === "true", w + ": «Bütün gün» is shown as chosen");
      await p.click('#tabs [data-tab="day"]'); await p.waitForTimeout(600);
      const m = await p.evaluate(() => {
        // owner 18.11: in «Bütün gün» the names are at the bottom (.cal-foot); 09:00 at the top, 22:00 above the names
        const cal = document.getElementById("cal"), cr = cal.getBoundingClientRect(), ft = cal.querySelector(".cal-foot").getBoundingClientRect(), head = { bottom: cr.top };
        const lab = (t) => { const e = [...cal.querySelectorAll(".axis span")].find((x) => x.textContent.trim() === t); return e && e.getBoundingClientRect(); };
        const a9 = lab("09:00"), a22 = lab("22:00"), cols = [...cal.querySelectorAll(".col")].map((c) => c.getBoundingClientRect());
        return { n: cols.length, sideways: cal.scrollWidth - cal.clientWidth, t9: Math.round(a9.top), b22: Math.round(a22.bottom), headBottom: Math.round(head.bottom), calBottom: Math.round(ft.top), lastRight: Math.round(cols[cols.length - 1].right), calRight: Math.round(cr.right) };
      });
      check(m.n === 7, w + ": 7 specialist columns: " + m.n);
      check(m.sideways <= 1 && m.lastRight <= m.calRight + 1, w + ": all columns fit the width, no sideways scrolling: " + JSON.stringify(m));
      check(m.t9 >= m.headBottom - 1 && m.b22 <= m.calBottom + 1, w + ": 09:00 and 22:00 are both on screen without scrolling: " + JSON.stringify(m));
      // the setting is kept after reopening the app
      await p.reload(); await p.locator("#tabs:not([hidden])").waitFor({ timeout: 15000 }); await p.waitForTimeout(3300);
      const kept = await p.evaluate(() => { const cal = document.getElementById("cal"); return cal && cal.classList.contains("fit") && cal.scrollWidth - cal.clientWidth <= 1; });
      check(kept, w + ": «Bütün gün» is kept after reload");
      // back to «Standart»: the calendar is taller than the screen again (scrolls as before)
      await p.click('#tabs [data-tab="readers"]'); await p.click('#top [data-act="set-sec"][data-id="view"]'); await p.click('[data-act="hourh"][data-id="75"]');
      await p.click('#tabs [data-tab="day"]'); await p.waitForTimeout(400);
      const std = await p.evaluate(() => { const c = document.getElementById("cal"); return { fit: c.classList.contains("fit"), down: c.scrollHeight - c.clientHeight }; });
      check(!std.fit && std.down > 200, w + ": «Standart» scrolls down as before: " + JSON.stringify(std));
      // Russian: the button is translated
      await p.evaluate(() => { localStorage.setItem("ruqya.lang", "ru"); }); await p.reload(); await p.locator("#tabs:not([hidden])").waitFor({ timeout: 15000 }); await p.waitForTimeout(3300);
      await p.click('#tabs [data-tab="readers"]'); await p.click('#top [data-act="set-sec"][data-id="view"]'); await p.waitForTimeout(300);
      check((await p.locator('[data-act="hourh"][data-id="fit"]').textContent()).trim() === "Весь день", w + ": Russian label «Весь день»");
      check(!s.errors.length, w + ": no page errors: " + s.errors.join("; "));
    } finally { await s.close(); }
  }
};
