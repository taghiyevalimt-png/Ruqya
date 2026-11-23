// 24.11 (owner: «make the look nicer, but very smooth even on the oldest Android»):
//  - the actions of a card (Zəng, Wp, Təsdiq, Dəyiş, Ləğv et / Sil) are small pills, not underlined links; the ones that
//    cancel or delete are red; colours and borders only (nothing animated);
//  - a weak phone (light motion) skips the tap ripple and fades a new tab in as one layer.
const { open, check, AGENT, seed } = require("../lib");
module.exports = async () => {
  for (const lite of [false, true]) {
    const s = await open(AGENT, { db: seed(), init: lite ? [() => localStorage.setItem("ruqya.lite", "1"), null] : undefined });
    try {
      const p = s.page; await p.locator("#tabs:not([hidden])").waitFor({ timeout: 15000 }); await p.waitForTimeout(2500);
      await p.click('#tabs [data-tab="day"]'); await p.click('[data-act="view"][data-id="list"]'); await p.waitForTimeout(400);
      const L = await p.evaluate(() => [...document.querySelectorAll(".card .links .link")].map((b) => { const c = getComputedStyle(b); return { t: b.textContent.trim(), u: c.textDecorationLine, r: parseFloat(c.borderTopLeftRadius), bg: c.backgroundColor, col: c.color, bad: /--bad/.test(b.getAttribute("style") || "") }; }));
      check(L.length >= 3 && L.every((x) => x.u === "none" && x.r >= 10 && x.bg !== "rgba(0, 0, 0, 0)"), "card actions are pills: " + JSON.stringify(L));
      const bad = L.filter((x) => x.bad), ok = L.filter((x) => !x.bad);
      check(bad.length >= 1 && bad.every((x) => x.bg !== ok[0].bg), "«Ləğv et» is a red pill: " + JSON.stringify(bad));
      // the tap ripple: drawn on a new phone, skipped on a weak one
      const b = p.locator('.card .links .link').first(); const bb = await b.boundingBox();
      await p.mouse.move(bb.x + 5, bb.y + 5); await p.mouse.down(); const rip = await p.evaluate(() => document.querySelectorAll(".rpw i").length); await p.mouse.move(5, 5); await p.mouse.up();   /* let go off the button: no call is started */
      check(lite ? rip === 0 : rip > 0, (lite ? "weak phone: no ripple" : "new phone: the ripple") + " (" + rip + ")");
      await p.keyboard.press("Escape"); await p.waitForTimeout(300); if (await p.locator("#overlay:not([hidden])").count()) await p.click('[data-act="close"]').catch(() => {});
      if (lite) { await p.click('#tabs [data-tab="stats"]'); let an = ""; for (let i = 0; i < 30 && !/fadein/.test(an); i++) { an = await p.evaluate(() => getComputedStyle(document.querySelector("main")).animationName + "/" + document.querySelector("main").className); await p.waitForTimeout(20); } check(/fadein/.test(an), "weak phone: a new tab fades in as one layer: " + an); }
      check(!s.errors.length, "no page errors: " + s.errors.join("; "));
    } finally { await s.close(); }
  }
};
