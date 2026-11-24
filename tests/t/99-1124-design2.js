// Owner 24.11: «make the design ten times better, change everything». Design 2.0 — checked in both themes:
//  warm ivory / graphite-gold palette; calendar blocks tinted in the specialist's colour with a coloured edge and a dark
//  (day) / light (night) text, cancelled ones still black (owner 17.11); a floating rounded tab bar whose chosen tab is
//  a gold/espresso pill; the week strip with counts as small badges; products to sell with a round initial; the time
//  of a list card on a plate; filled form fields; and on a weak phone no shadows (still as quick as before).
const { open, check, OWNER, seed, uuid, bakuToday, R1 } = require("../lib");
module.exports = async () => {
  for (const theme of ["light", "dark"]) {
    const db = seed(), now = new Date().toISOString();
    db.appts.push({ id: uuid(), reader_id: R1, date: bakuToday(), time: "12:00", duration: 60, name: "Ləğv olan", phone: "050", price: 0, share: 0, status: "cancel", note: "", settled: false, service: "Ruqya", confirmed: false, place: "ofis", follow: 0, created_by: OWNER, created_at: now, updated_at: now });
    db.products = [{ id: "cccccccc-0000-4000-8000-000000000801", name: "Ruqyalı su", price: 2, archived: false, sort: 1, created_at: now }];
    const s = await open(OWNER, { db, init: [(t) => { localStorage.setItem("ruqya.theme", t); localStorage.setItem("ruqya.view18", "1"); }, theme] });
    try {
      const p = s.page; await p.locator("#tabs:not([hidden])").waitFor({ timeout: 15000 }); await p.waitForTimeout(2500);
      await p.click('#tabs [data-tab="day"]'); await p.waitForTimeout(500);
      const m = await p.evaluate(() => {
        const cs = (e) => getComputedStyle(e), ev = [...document.querySelectorAll("#cal .ev")], ok = ev.find((e) => !e.classList.contains("cancel")), cn = ev.find((e) => e.classList.contains("cancel"));
        const tabs = document.getElementById("tabs"), cur = tabs.querySelector('[aria-current="page"]');
        return { bg: cs(document.body).backgroundColor, ev: ok && { bg: cs(ok).backgroundColor, edge: cs(ok).borderLeftWidth, col: cs(ok).color, varc: ok.style.getPropertyValue("--ec") }, cancel: cn && cs(cn).backgroundColor,
          tabs: { r: parseFloat(cs(tabs).borderTopLeftRadius), ml: parseFloat(cs(tabs).marginLeft), cur: cs(cur).backgroundImage }, badge: (() => { const i = document.querySelector(".wd i:not(:empty)"); return i ? parseFloat(cs(i).borderTopLeftRadius) : -1; })() };
      });
      const w = theme + ": ";
      check(m.bg === (theme === "light" ? "rgb(243, 238, 230)" : "rgb(8, 7, 6)"), w + "the new palette: " + m.bg);
      check(m.ev && /rgba\(.*0\.(17|3)\)/.test(m.ev.bg) && m.ev.edge === "3px" && m.ev.varc, w + "calendar blocks are tinted with a coloured edge: " + JSON.stringify(m.ev));
      const lum = (c) => { const v = c.match(/\d+/g).map(Number); return (v[0] * 299 + v[1] * 587 + v[2] * 114) / 1000; };
      check(theme === "light" ? lum(m.ev.col) < 110 : lum(m.ev.col) > 150, w + "the text is a dark (day) / light (night) shade: " + m.ev.col);
      check(m.cancel === "rgb(0, 0, 0)", w + "a cancelled booking stays black (owner 17.11): " + m.cancel);
      check(m.tabs.r >= 20 && m.tabs.ml >= 8 && /gradient/.test(m.tabs.cur), w + "a floating rounded tab bar, the chosen tab a pill: " + JSON.stringify(m.tabs));
      check(m.badge >= 8, w + "the week strip counts are badges: " + m.badge);
      await p.click('[data-act="view"][data-id="list"]'); await p.waitForTimeout(300);
      const plate = await p.evaluate(() => { const t = document.querySelector(".card .time"); return t ? { bg: getComputedStyle(t).backgroundColor, r: parseFloat(getComputedStyle(t).borderTopLeftRadius) } : null; });
      check(plate && plate.r >= 10 && plate.bg !== "rgba(0, 0, 0, 0)", w + "the time of a list card is on a plate: " + JSON.stringify(plate));
      await p.click('#tabs [data-tab="cash"]'); await p.waitForTimeout(300); await p.click('[data-act="new-prod"]'); await p.locator("#sheet .pbtn").first().waitFor();
      const pb = await p.evaluate(() => { const b = document.querySelector("#sheet .pbtn"); return { ini: b.getAttribute("data-ini"), before: getComputedStyle(b, "::before").content }; });
      check(pb.ini === "S" && /"S"/.test(pb.before), w + "a product to sell has its round initial (without «Ruqyalı»): " + JSON.stringify(pb));
      const fld = await p.evaluate(() => { const f = document.querySelector("#sheet .field input, #sheet .field select"); return f ? parseFloat(getComputedStyle(f).borderTopLeftRadius) : 14; });
      check(fld >= 12, w + "rounded fields: " + fld);
      check(!s.errors.length, w + "no page errors: " + s.errors.join("; "));
    } finally { await s.close(); }
  }
  // a weak phone: no shadows
  const s = await open(OWNER, { db: seed(), init: [() => localStorage.setItem("ruqya.lite", "1"), null] });
  try { const p = s.page; await p.locator("#tabs:not([hidden])").waitFor({ timeout: 15000 }); await p.waitForTimeout(2000);
    check(await p.evaluate(() => [...document.querySelectorAll(".tabs,.wd,.fab,.card,.pay")].every((e) => getComputedStyle(e).boxShadow === "none")), "a weak phone draws no shadows");
  } finally { await s.close(); }
};
