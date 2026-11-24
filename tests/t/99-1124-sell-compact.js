// Owner 24.11 evening (screenshots 19:12): in «Məhsul satışı» the date and the total go to the top (they were at the
// very bottom, under all the products) and stay in view while the products scroll; the product buttons are at least
// twice smaller in width and height (4 in a row at 390 px, no letter circle). Taps, «−», the count badge and saving work.
const { open, check, OWNER, seed, uuid } = require("../lib");
module.exports = async () => {
  for (const [w, h, lang] of [[390, 640, "az"], [360, 600, "ru"]]) {
    const db = seed(), now = new Date().toISOString();
    const names = ["Ruqyalı su", "Ruqyalı içməli su", "Sidr tozu", "İbn Davud Zeyt yağı", "Dr.Taymasova Neurocalm", "Nar suyu", "Aloe-bal məcunu", "İmmunitet məcunu", "Ruqyalı sirkə", "Udi hindi tozu", "Ruqyalı şaftalı suyu", "Dr.Günel Qripə son məcunu", "Dr.Günel Saç üçün yağ qarışımı", "Ruqyalı zəmzəm suyu", "Ruqyalı udi hindi yağı", "Ruqyalı saç qarışımı yağı"];
    db.products = names.map((n, i) => ({ id: uuid(), name: n, price: 2 + i, archived: false, sort: i + 1, created_at: now }));
    const s = await open(OWNER, { db, viewport: { width: w, height: h }, init: [(l) => { try { localStorage.setItem("ruqya.lang", l); } catch (e) {} }, lang] });
    try {
      const p = s.page, tag = w + " " + lang + ": ";
      await p.locator("#tabs:not([hidden])").waitFor({ timeout: 15000 }); await p.waitForTimeout(2500);
      await p.click('#tabs [data-tab="cash"]'); await p.click('[data-act="new-prod"]'); await p.waitForTimeout(500);
      const m = await p.evaluate(() => { const sh = document.getElementById("sheet"), r = (e) => e.getBoundingClientRect();
        const bar = sh.querySelector(".sellbar"), grid = sh.querySelector(".pgrid"), date = sh.querySelector("#sl-date"), tot = sh.querySelector(".sellbar .ptotal");
        const cards = [...sh.querySelectorAll(".pbtn")].map((b) => ({ w: r(b).width, h: r(b).height, lines: Math.round(r(b.querySelector("b")).height / 13.8), circle: getComputedStyle(b, "::before").display }));
        const rows = new Set([...sh.querySelectorAll(".pgrid")][0].querySelectorAll(".pbtn").length ? [...[...sh.querySelectorAll(".pgrid")][0].querySelectorAll(".pbtn")].map((b) => Math.round(r(b).top)) : []);
        return { barAbove: !!(bar && grid && r(bar).bottom <= r(grid).top + 1), dateIn: !!(bar && date && bar.contains(date)), totIn: !!(bar && tot && bar.contains(tot)),
          oldBottom: [...sh.children].slice(-4).some((x) => x.classList && x.classList.contains("ptotal")), cards, perRow: (() => { const g = [...sh.querySelectorAll(".pgrid")].pop(), bs = [...g.querySelectorAll(".pbtn")]; return bs.filter((b) => Math.round(r(b).top) === Math.round(r(bs[0]).top)).length; })() };
      });
      check(m.barAbove && m.dateIn && m.totIn && !m.oldBottom, tag + "date and total at the top, above the products (not at the bottom): " + JSON.stringify([m.barAbove, m.dateIn, m.totIn, m.oldBottom]));
      check(m.perRow === 4, tag + "4 product buttons in a row: " + m.perRow);
      const one = m.cards.filter((c) => c.lines <= 1), maxW = Math.max(...m.cards.map((c) => c.w));
      check(maxW <= (w - 32) / 2 / 2 + 8 && m.cards.every((c) => c.circle === "none"), tag + "buttons at most half as wide as before (two in a row), no letter circle: " + Math.round(maxW) + " px");
      check(one.length && one.every((c) => c.h <= 48), tag + "a one-line product button at most 48 px high (was 82+): " + one.map((c) => Math.round(c.h)).join(","));
      // taps, «−», the badge; the total at the top follows
      await p.click(".pbtn >> nth=0"); await p.click(".pbtn >> nth=0"); await p.click(".pbtn >> nth=5");
      let t = await p.textContent(".sellbar .ptotal");
      check(/11/.test(t) && /3/.test(t), tag + "2 × 2 + 7 = 11, 3 pieces, shown at the top: " + t);
      await p.click(".pminus >> nth=0"); t = await p.textContent(".sellbar .ptotal");
      check(/9/.test(t), tag + "«−» takes one back: " + t);
      // the bar stays in view while the products scroll
      await p.evaluate(() => { document.getElementById("sheet").scrollTop = 99999; }); await p.waitForTimeout(150);
      const pin = await p.evaluate(() => { const sh = document.getElementById("sheet"), b = sh.querySelector(".sellbar").getBoundingClientRect(), r = sh.getBoundingClientRect(); return { top: Math.round(b.top - r.top), scrolled: sh.scrollTop > 50 }; });
      check(pin.scrolled && pin.top >= -2 && pin.top <= 12, tag + "the date and total stay at the top while scrolling: " + JSON.stringify(pin));
      await p.click('[data-act="sell-save"]'); await p.waitForTimeout(800);
      check(s.db.product_sales.length === 2, tag + "saved: two lines (2 × first, 1 × sixth): " + s.db.product_sales.length);
      check(!s.errors.length, tag + "no page errors: " + s.errors.join(" | "));
    } finally { await s.close(); }
  }
};
