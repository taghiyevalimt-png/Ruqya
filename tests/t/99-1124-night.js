// Owner 24.11 (evening, palette photo): «add a dark colour that people can choose in the settings: the main solid colour
// #303147, the buttons #405577 — like an interior, cosy as at home. For the widgets too. Everyone has this dark by
// default; in the settings they may choose the other». Checked: default (even with an old «light»/«dark» choice left on
// the phone) = night; Ayarlar → Görünüş: «Gecə / Qum» for the app and for the widget; the choice stays after a reload;
// the Android window is told (setLook); the widget data says "t":"night" or "sand"; cancelled blocks stay black.
const { open, check, OWNER, seed, uuid, bakuToday, R1 } = require("../lib");
module.exports = async () => {
  const db = seed(), now = new Date().toISOString();
  db.appts.push({ id: uuid(), reader_id: R1, date: bakuToday(), time: "12:00", duration: 60, name: "Ləğv", phone: "050", price: 0, share: 0, status: "cancel", note: "", settled: false, service: "Ruqya", confirmed: false, place: "ofis", follow: 0, created_by: OWNER, created_at: now, updated_at: now });
  for (const lang of ["az", "ru"]) {
    const s = await open(OWNER, { db, viewport: { width: 390, height: 844 }, init: [(l) => { localStorage.setItem("ruqya.theme", "light"); localStorage.setItem("ruqya.lang", l); window.__w = []; window.__look = []; window.RuqyaApp = { setWidgetData: (j) => window.__w.push(j), setLook: (x) => window.__look.push(x), version: () => "test" }; }, lang] });
    try {
      const p = s.page, tag = lang + ": ";
      await p.locator("#tabs:not([hidden])").waitFor({ timeout: 15000 }); await p.waitForTimeout(3000);
      const look = () => p.evaluate(() => { const cs = (e) => getComputedStyle(e); const c = document.querySelector("#cal .ev.cancel");
        return { night: document.documentElement.classList.contains("night"), bg: cs(document.body).backgroundColor, btn: cs(document.documentElement).getPropertyValue("--btn"),
          meta: document.querySelector('meta[name="theme-color"]').content, cancel: c && cs(c).backgroundColor, native: window.__look.slice(), w: window.__w.length ? JSON.parse(window.__w[window.__w.length - 1]).t : null }; });
      let m = await look();
      check(m.night && m.bg === "rgb(48, 49, 71)" && /405577/i.test(m.btn) && m.meta === "#303147", tag + "night is the default (#303147, buttons #405577), even with an old «light» left: " + JSON.stringify(m));
      check(m.native[0] === "night", tag + "the Android window is told: night " + JSON.stringify(m.native));
      check(m.w === "night", tag + "the widget draws night by default: " + m.w);
      check(/rgb\(1[0-2], 1[0-3], 1[0-6]\)|rgb\(0, 0, 0\)/.test(m.cancel || ""), tag + "a cancelled block stays black: " + m.cancel);
      await p.click('#tabs [data-tab="readers"]'); await p.click('#top [data-act="set-sec"][data-id="view"]'); await p.waitForTimeout(300);
      const segs = await p.evaluate(() => ["look", "wlook"].map((a) => [...document.querySelectorAll('[data-act="' + a + '"]')].map((b) => b.dataset.id + ":" + b.getAttribute("aria-pressed") + ":" + b.textContent.trim())));
      check(segs[0].length === 2 && segs[0][0].startsWith("night:true") && segs[1].length === 2 && segs[1][0].startsWith("night:true"), tag + "Ayarlar → Görünüş: Gecə / Qum for the app and for the widget: " + JSON.stringify(segs));
      await p.click('[data-act="look"][data-id="sand"]'); await p.waitForTimeout(300);
      m = await look();
      check(!m.night && m.bg === "rgb(206, 187, 160)" && m.meta === "#CEBBA0" && m.native[m.native.length - 1] === "sand", tag + "«Qum» → sand at once, the Android window too: " + JSON.stringify(m));
      check(m.w === "night", tag + "the widget keeps its own choice: " + m.w);
      await p.click('[data-act="wlook"][data-id="sand"]'); await p.waitForTimeout(300);
      check((await look()).w === "sand", tag + "the widget → sand");
      await p.reload(); await p.locator("#tabs:not([hidden])").waitFor({ timeout: 15000 }); await p.waitForTimeout(1500);
      m = await look();
      check(!m.night && m.bg === "rgb(206, 187, 160)", tag + "the choice stays after a reload");
      await p.click('#tabs [data-tab="readers"]'); await p.click('#top [data-act="set-sec"][data-id="view"]'); await p.click('[data-act="look"][data-id="night"]'); await p.waitForTimeout(300);
      check((await look()).night, tag + "back to night");
      check(!s.errors.length, tag + "no page errors: " + s.errors.join("; "));
    } finally { await s.close(); }
  }
};
