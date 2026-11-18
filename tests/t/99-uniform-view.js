// Owner 18.11 (second list of notes):
//  - default for everybody: height «Kiçik», width «Standart» (not «Bütün gün»), also on phones that had «Bütün gün»
//    before; the choice made afterwards in Ayarlar is kept;
//  - the specialists' names at the bottom in every mode, not only «Bütün gün»;
//  - in every mode a block shows the ✅ marks and the patient's name, the phone (a second line if needed) and only the
//    agent's name — no time, no «Yazdı:»; the same as in «Bütün gün» (marks included there too).
const { open, check, OWNER, AGENT, seed, uuid, bakuToday, R1, R2 } = require("../lib");
module.exports = async () => {
  const db = seed(), now = new Date().toISOString();
  db.appts = [];
  const mk = (rid, time, dur, name, phone, conf) => db.appts.push({ id: uuid(), reader_id: rid, date: bakuToday(0), time, duration: dur, name, phone, price: 130, share: 0, status: "wait", note: "", settled: false, service: "Ruqya", confirmed: conf, place: "ofis", follow: 0, created_by: AGENT, created_at: now, updated_at: now });
  mk(R1, "09:00", 120, "Terane", "+994 55 717 12 34", true); mk(R2, "12:00", 90, "Maya", "0705029298", false);
  const s = await open(OWNER, { db, viewport: { width: 390, height: 844 } });
  try {
    const p = s.page;
    // a phone that had «Bütün gün» (the previous default) and «Böyük»
    await p.evaluate(() => { localStorage.setItem("ruqya.fit", "1"); localStorage.setItem("ruqya.hour", "111"); localStorage.removeItem("ruqya.view18"); });
    await p.reload(); await p.locator("#tabs:not([hidden])").waitFor({ timeout: 15000 }); await p.waitForTimeout(3300);
    const cal = () => p.evaluate(() => {
      const c = document.getElementById("cal"), col = c.querySelector(".col"), foot = c.querySelector(".cal-foot");
      const blocks = [...c.querySelectorAll(".ev")].map((e) => ({ name: [...e.firstElementChild.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join(""), mark: (e.querySelector("b i.ok") || {}).textContent || "", lines: [...e.children].filter((x) => getComputedStyle(x).display !== "none").map((x) => x.textContent) }));
      return { fit: c.classList.contains("fit"), hour: parseFloat(getComputedStyle(col).backgroundSize.split(" ")[1]), colW: Math.round((parseFloat(c.querySelector(".cal-in").style.minWidth) - 54) / c.querySelectorAll(".col").length), /* the chosen width (columns may grow to fill the screen) */ topNames: c.querySelectorAll(".cal-head .ch").length, foot: !!foot && foot.querySelectorAll('[data-act="filter"]').length, footBottom: foot && Math.round(foot.getBoundingClientRect().bottom - c.getBoundingClientRect().bottom), blocks };
    });
    const g = await cal();
    check(!g.fit && g.hour === 45, "default after the update: «Kiçik» (45 px an hour), not «Bütün gün»: " + JSON.stringify({ fit: g.fit, hour: g.hour }));
    check(g.colW === 90, "default width «Standart» (90 px columns): " + g.colW);
    check(g.topNames === 0 && g.foot === 2 && Math.abs(g.footBottom) <= 1, "names at the bottom in «Kiçik» too: " + JSON.stringify({ top: g.topNames, foot: g.foot, at: g.footBottom }));
    const t = g.blocks.find((b) => b.name === "Terane"), m = g.blocks.find((b) => b.name === "Maya");
    check(t && /✅/.test(t.mark), "the ✅ mark is shown in the block: " + JSON.stringify(t));
    check(t && JSON.stringify(t.lines.slice(1)) === JSON.stringify(["+994 55 717 12 34", "Nurlana"]), "block: name, phone, agent only: " + JSON.stringify(t && t.lines));
    const all = g.blocks.map((b) => b.lines.join("|")).join(" ");
    check(!/Yazdı/.test(all) && !/\b\d\d:\d\d\b/.test(all), "no time and no «Yazdı:» in any block: " + all);
    // Ayarlar shows the defaults pressed; the phone's own choice is kept
    await p.click('#tabs [data-tab="readers"]'); await p.click('#top [data-act="set-sec"][data-id="view"]'); await p.waitForTimeout(300);
    check(await p.getAttribute('[data-act="hourh"][data-id="45"]', "aria-pressed") === "true" && await p.getAttribute('[data-act="colw"][data-id="90"]', "aria-pressed") === "true", "Ayarlar: «Kiçik» and «Standart» chosen");
    await p.click('[data-act="hourh"][data-id="fit"]'); await p.waitForTimeout(200);
    await p.reload(); await p.locator("#tabs:not([hidden])").waitFor({ timeout: 15000 }); await p.waitForTimeout(3300);
    const f = await cal();
    check(f.fit, "after choosing «Bütün gün» it stays after reopening");
    const tf = f.blocks.find((b) => b.name === "Terane");
    check(tf && /✅/.test(tf.mark), "«Bütün gün» shows the ✅ marks too: " + JSON.stringify(tf));
    check(f.topNames === 0 && f.foot === 2, "«Bütün gün»: names at the bottom");
    await p.click('#tabs [data-tab="readers"]'); await p.click('#top [data-act="set-sec"][data-id="view"]'); await p.click('[data-act="hourh"][data-id="111"]'); await p.click('[data-act="colw"][data-id="130"]');
    await p.reload(); await p.locator("#tabs:not([hidden])").waitFor({ timeout: 15000 }); await p.waitForTimeout(3300);
    const b = await cal();
    check(!b.fit && b.hour === 111 && b.colW === 130, "«Böyük» + «Geniş» kept after reopening: " + JSON.stringify({ fit: b.fit, hour: b.hour, w: b.colW }));
    check(b.topNames === 0 && b.foot === 2, "«Böyük»: names at the bottom");
    const tb = b.blocks.find((x) => x.name === "Terane");
    check(tb && JSON.stringify(tb.lines.slice(1)) === JSON.stringify(["+994 55 717 12 34", "Nurlana"]), "«Böyük»: name, phone, agent only: " + JSON.stringify(tb && tb.lines));
    check(!s.errors.length, "no page errors: " + s.errors.join("; "));
  } finally { await s.close(); }
};
