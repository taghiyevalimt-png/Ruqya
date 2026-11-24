// Owner 24.11 (palette photo + logo): «instead of black #CEBBA0, instead of gold #9A765E; one look, no switching; cosy like
// at home; the widget in these colours too; no coloured circles before names — colours only in the blocks, and rich ones,
// like in the homes of rich modern people; nice animations on every press, even on the oldest Android; the opening must
// be beautiful, not as if the app dies».
const { open, check, OWNER, seed, uuid, bakuToday, R1, R2 } = require("../lib");
module.exports = async () => {
  const db = seed(), now = new Date().toISOString();
  db.readers.forEach((r, i) => { r.color = ["#1a73e8", "#c2185b"][i] || null; });   // colours chosen before 24.11 (bright)
  db.appts.push({ id: uuid(), reader_id: R1, date: bakuToday(), time: "11:00", duration: 60, name: "Mavi idi", phone: "050", price: 0, share: 0, status: "wait", note: "", settled: false, service: "Ruqya", confirmed: false, place: "ofis", follow: 0, created_by: OWNER, created_at: now, updated_at: now },
    { id: uuid(), reader_id: R2, date: bakuToday(), time: "12:00", duration: 60, name: "Ləğv", phone: "050", price: 0, share: 0, status: "cancel", note: "", settled: false, service: "Ruqya", confirmed: false, place: "ofis", follow: 0, created_by: OWNER, created_at: now, updated_at: now });
  const s = await open(OWNER, { db, viewport: { width: 390, height: 844 }, init: [() => { localStorage.setItem("ruqya.theme", "dark"); localStorage.setItem("ruqya.look", "sand");   /* 24.11 evening: sand is now a choice (night is the default) */ localStorage.setItem("ruqya.view18", "1"); window.__w = []; window.RuqyaApp = { setWidgetData: (j) => window.__w.push(j), version: () => "test" }; }, null] });
  try {
    const p = s.page; await p.emulateMedia({ colorScheme: "dark" });
    // the opening: the logo on sand; the app comes in by opacity/transform; then it settles
    const sp = await p.evaluate(() => { const e = document.getElementById("splash"); return e ? { bg: getComputedStyle(e).backgroundColor, img: getComputedStyle(e.querySelector("img")).filter } : null; });
    check(sp && sp.bg === "rgb(206, 187, 160)" && sp.img === "none", "the opening: the logo on #CEBBA0, nothing heavy on it: " + JSON.stringify(sp));
    await p.locator("#tabs:not([hidden])").waitFor({ timeout: 15000 }); await p.waitForTimeout(3600);
    const cls = await p.evaluate(() => document.documentElement.className + " / app transition: " + getComputedStyle(document.querySelector(".app")).transitionProperty);
    check(/\bready\b/.test(cls) && /\bsettled\b/.test(cls) && /opacity/.test(cls) && /transform/.test(cls), "the app comes in by opacity and transform, then settles: " + cls);
    await p.click('#tabs [data-tab="day"]'); await p.waitForTimeout(500);
    const m = await p.evaluate(() => {
      const cs = (e) => getComputedStyle(e), ev = [...document.querySelectorAll("#cal .ev")];
      const blue = ev.find((e) => /Mavi/.test(e.textContent)), cancel = ev.find((e) => e.classList.contains("cancel"));
      return { theme: document.documentElement.getAttribute("data-theme"), bg: cs(document.body).backgroundColor, accent: cs(document.querySelector(".daynav .label .wk")).color,
        blueVar: blue && blue.style.getPropertyValue("--ec"), blueText: blue && cs(blue).color, cancel: cancel && cs(cancel).backgroundColor,
        press: cs(document.querySelector(".vsw2 button")).transitionProperty + " / " + cs(document.querySelector(".vsw2 button")).transitionTimingFunction /* 24.11: the week chips are gone */ };
    });
    check(m.theme === "light" && m.bg === "rgb(206, 187, 160)", "sand chosen: the sand look, even with the phone dark and an old «dark» choice: " + JSON.stringify([m.theme, m.bg]));
    check(m.accent === "rgb(154, 118, 94)", "the brown #9A765E instead of gold: " + m.accent);
    check(m.blueVar === "#4d5d70" && m.blueText === "rgb(251, 244, 232)", "an old bright blue is shown as rich slate, with cream text: " + JSON.stringify([m.blueVar, m.blueText]));
    check(m.cancel === "rgb(0, 0, 0)", "cancelled still black (owner 17.11): " + m.cancel);
    check(/transform/.test(m.press) && /1\.56/.test(m.press), "every press squeezes and springs back (transform): " + m.press);
    // the widget gets the rich colours
    await p.waitForFunction(() => window.__w.length > 0, null, { timeout: 8000 });
    const wd = await p.evaluate(() => JSON.parse(window.__w[window.__w.length - 1]));
    const cols = JSON.stringify(wd).match(/#[0-9a-f]{6}/gi) || [];
    check(cols.length && !cols.some((c) => /#1a73e8|#c2185b/i.test(c)), "the widget gets the rich colours: " + cols.slice(0, 6).join(","));
    // no coloured circles before names; Ayarlar: «Rəng» opens the rich palette; no theme choices
    await p.click('#tabs [data-tab="patients"]'); await p.waitForTimeout(300);
    check(!(await p.locator(".ava").count()), "patients: no coloured circles");
    await p.click('#tabs [data-tab="readers"]'); await p.waitForTimeout(300);
    check(!(await p.locator(".reader .sw").count()) && await p.locator('.reader [data-act="color"]').count() > 0, "specialists: no coloured circles, «Rəng» instead");
    await p.click('.reader [data-act="color"]'); await p.locator(".swatches").waitFor();
    const pal = await p.evaluate(() => [...document.querySelectorAll(".swatches button")].map((b) => b.dataset.id));
    check(pal.length >= 12 && pal.includes("#6e4b33") && pal.includes("#2e5e5c") && !pal.includes("#1a73e8"), "the palette is rich interior tones: " + pal.join(","));
    await p.click('[data-act="close"]'); await p.waitForTimeout(300);
    await p.click('#top [data-act="set-sec"][data-id="view"]').catch(() => {}); await p.waitForTimeout(300);
    check(!(await p.locator('[data-act="theme"], [data-act="wtheme"]').count()), "no old light/dark/auto choices (24.11 evening: «Gecə / Qum» instead, see 99-1124-night)");
    check(!s.errors.length, "no page errors: " + s.errors.join("; "));
  } finally { await s.close(); }
};
