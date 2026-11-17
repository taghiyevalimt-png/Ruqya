// Owner 17.11: «the Android widget is only black — make white possible too». In the Android app (the page sees the
// bridge window.RuqyaApp) Ayarlar → Görünüş → Vidcet offers Avtomatik / Ağ / Qara; the choice is kept on the phone and
// handed to the widget with its data as "t" (auto / light / dark), also in the signed-out data. The widget's drawing
// in both colours is checked on the emulators (android/test-widget.sh, widget-check.yml).
const { open, check, OWNER } = require("../lib");
module.exports = async () => {
  const s = await open(OWNER, { viewport: { width: 412, height: 860 } });
  try {
    const p = s.page;
    await p.addInitScript(() => { window.__w = []; window.RuqyaApp = { setWidgetData: (j) => window.__w.push(j), version: () => "test" }; });
    await p.reload(); await p.locator("#tabs:not([hidden])").waitFor({ timeout: 15000 }); await p.waitForTimeout(3300);
    const last = () => p.evaluate(() => { const j = window.__w[window.__w.length - 1]; return j ? JSON.parse(j) : null; });
    await p.waitForFunction(() => window.__w.length > 0, null, { timeout: 8000 });
    check((await last()).t === "auto", "before any choice the widget follows the phone: " + JSON.stringify((await last()).t));
    await p.click('#tabs [data-tab="readers"]'); await p.click('#top [data-act="set-sec"][data-id="view"]'); await p.waitForTimeout(300);
    for (const [id, label] of [["auto", "Avtomatik"], ["light", "Ağ"], ["dark", "Qara"]])
      check((await p.locator('[data-act="wtheme"][data-id="' + id + '"]').textContent()).trim() === label, "button " + label);
    await p.click('[data-act="wtheme"][data-id="light"]'); await p.waitForTimeout(300);
    check(await p.getAttribute('[data-act="wtheme"][data-id="light"]', "aria-pressed") === "true", "«Ağ» shown as chosen");
    check((await last()).t === "light", "the widget gets the white colour at once: " + JSON.stringify(await last()));
    await p.click('[data-act="wtheme"][data-id="dark"]'); await p.waitForTimeout(300);
    check((await last()).t === "dark", "and black: " + (await last()).t);
    // kept after reopening
    await p.reload(); await p.locator("#tabs:not([hidden])").waitFor({ timeout: 15000 }); await p.waitForTimeout(3300);
    await p.waitForFunction(() => window.__w.length > 0, null, { timeout: 8000 });
    check((await last()).t === "dark", "kept after reopening: " + (await last()).t);
    // signed out: the widget's signed-out picture keeps the colour
    await p.click('#tabs [data-tab="readers"]'); await p.click('#top [data-act="set-sec"][data-id="acc"]'); await p.click('[data-act="logout"]');
    await p.waitForTimeout(2500);
    const out = await last();
    check(out.out === 1 && out.t === "dark", "signed out: the widget data keeps the colour: " + JSON.stringify(out));
    // Russian labels
    await p.evaluate(() => localStorage.setItem("ruqya.lang", "ru"));
    check(!s.errors.length, "no page errors: " + s.errors.join("; "));
  } finally { await s.close(); }
};
