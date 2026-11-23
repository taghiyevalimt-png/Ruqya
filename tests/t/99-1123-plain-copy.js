// Owner 23.11 (late evening): «sadə stil əladır, bütün statistikalarda kopyanı bu cür sadə stildə et» and «mütəxəssisin
// sözünü sil, ancaq payı qalsın». Every «Kopyala» in every section of Statistika — for an admin, an agent and a
// specialist, in Azerbaijani and Russian — gives plain text: no stars, underscores or emoji, no ₼ sign (the word
// «manat»), a title line with the period, then one «Name - …» line per row of the table on the screen.
const { open, check, OWNER, AGENT, SPEC, seed, R1, R2, bakuToday, uuid } = require("../lib");
module.exports = async () => {
  const db = seed(), now = new Date().toISOString(), t = bakuToday();
  const mk = (rid, svc, place, by, st) => ({ id: uuid(), reader_id: rid, date: t, time: "08:00", duration: 30, name: "X", phone: "050", price: 0, share: 0, status: st || "wait", note: "", settled: false, service: svc, confirmed: false, place, follow: 0, created_by: by, created_at: now, updated_at: now });
  db.appts.push(mk(R1, "Hicama", "onlayn", AGENT), mk(R2, "Ruqya", "ofis", AGENT, "cancel"), mk(R1, "Ruqya", "ofis", SPEC));
  const P1 = "cccccccc-0000-4000-8000-0000000000e1";
  db.products = [{ id: P1, name: "Ruqyalı su", price: 2.5, archived: false, sort: 1, created_at: now }];
  db.product_shares = [{ product_id: P1, staff_id: SPEC, pct: 10, amt: null }];
  db.product_sales = [{ id: uuid(), date: t, product_id: P1, qty: 3, price: 2.5, amount: 7.5, names: "", created_by: AGENT, patient_of: SPEC, created_at: now }];
  let total = 0;
  for (const [who, lang] of [[OWNER, "az"], [OWNER, "ru"], [AGENT, "az"], [SPEC, "az"]]) {
    const s = await open(who, { db, init: [(l) => { try { localStorage.setItem("ruqya.lang", l); } catch (e) {} }, lang] });
    try {
      const p = s.page; await p.context().grantPermissions(["clipboard-read", "clipboard-write"]);
      await p.locator("#tabs:not([hidden])").waitFor({ timeout: 15000 }); await p.waitForTimeout(2500);
      await p.click('#tabs [data-tab="stats"]'); await p.waitForTimeout(300);
      const secs = await p.evaluate(() => [...document.querySelectorAll('#top [data-act="st-sec"]')].map((b) => b.dataset.id));
      for (const sec of secs) {
        await p.click('#top [data-act="st-sec"][data-id="' + sec + '"]'); await p.waitForTimeout(300);
        for (const per of sec === "prod" ? ["today", "cweek"] : [null]) {
          if (per) { await p.click('[data-act="st-per"][data-id="' + per + '"]'); await p.waitForTimeout(300); }
          const n = await p.locator('#main [data-act="st-copy-t"]').count();
          for (let i = 0; i < n; i++) {
            const btn = p.locator('#main [data-act="st-copy-t"]').nth(i);
            const info = await btn.evaluate((b) => { const pay = b.closest(".pay"), tb = pay.querySelector("table"); return { st: pay.getAttribute("data-st"), rows: tb ? [...tb.querySelectorAll("tbody tr, tfoot tr")].map((r) => r.cells[0].textContent.replace(/\s+/g, " ").trim()) : [] }; });
            await p.evaluate(() => navigator.clipboard.writeText(""));
            await btn.click(); await p.waitForTimeout(250);
            const txt = (await p.evaluate(() => navigator.clipboard.readText())).replace(/[  ]/g, " ");
            const where = who.slice(0, 4) + "/" + lang + "/" + info.st + ": ";
            const lines = txt.split("\n");
            check(txt.length > 0 && !/[*_₼]|[\u{1F300}-\u{1FAFF}☀-➿▪▫]/u.test(txt), where + "plain text, no stars, underscores, emoji or ₼: " + JSON.stringify(txt));
            check(lines[0].length > 0 && lines[1] === "", where + "a title line, then an empty line: " + JSON.stringify(txt));
            check(!/mütəxəssisin payı|доля специалиста/.test(txt), where + "«payı», not «mütəxəssisin payı»");
            if (lang === "ru") check(!/(^|[^\d])[2-4] (сеанс|продаж)(?![а-я])|(^|[^\d])[05-9] (сеанса|продажи)(?![а-я])|(^|[^\d])1 (сеанса|продажи|продаж)(?![а-я])/m.test(txt), where + "Russian counts with the right ending: " + JSON.stringify(txt));
            // every name of the screen's table that has numbers is a line of the copy («Name - …» / «Name (role) - …»)
            if (!/^prod-/.test(info.st)) for (const r of info.rows) check(lines.some((l) => l === r || l.startsWith(r + " - ") || l.startsWith(r + " (")), where + "the row «" + r + "» is in the copy: " + JSON.stringify(txt));
            total++;
            await p.waitForTimeout(3100);   // the button says «Kopyalandı ✓» for 3 s
          }
        }
      }
      check(!s.errors.length, "no page errors: " + s.errors.join("; "));
    } finally { await s.close(); }
  }
  check(total >= 20, "all the copy buttons were tried: " + total);
};
