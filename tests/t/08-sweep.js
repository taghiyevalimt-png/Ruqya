// Every section for every role, both languages, phone to desktop width: no script errors, nothing wider than the screen.
const { open, check, OWNER, AGENT, SPEC } = require("../lib");

async function sweep(who, lang, width) {
  const s = await open(who, { lang, viewport: { width, height: 800 } });
  try {
    const p = s.page;
    await p.waitForSelector("#tabs:not([hidden])", { timeout: 15000 });
    await p.waitForTimeout(3300);
    const tabs = await p.$$eval("#tabs button:not([hidden])", (b) => b.map((x) => x.dataset.tab));
    for (const t of tabs) {
      await p.click('#tabs [data-tab="' + t + '"]');
      await p.waitForTimeout(250);
      const secs = await p.$$eval('#top [data-act="set-sec"], #top [data-act="st-sec"], #top .stsec button', (b) => b.map((x) => [x.dataset.act, x.dataset.id]));
      for (const [act, id] of secs.length ? secs : [[null]]) {
        if (act) { await p.click('#top [data-act="' + act + '"][data-id="' + id + '"]'); await p.waitForTimeout(150); }
        const over = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        check(over <= 1, `${who.slice(0, 4)} ${lang || "az"} ${width}px ${t}/${id || ""}: page ${over}px wider than the screen`);
      }
    }
    // the calendar card and the form open for this role
    await p.click('#tabs [data-tab="day"]');
    const ev = await p.$("#cal .ev");
    if (ev) { await ev.click(); await p.waitForTimeout(200); await p.click('[data-act="close"]').catch(() => {}); }
    if (await p.isVisible("#fab")) { await p.click("#fab"); await p.waitForTimeout(200); await p.click('[data-act="close"]'); }
    check(!s.errors.length, `${who.slice(0, 4)} ${lang || "az"} ${width}px: page errors: ` + s.errors.join("; "));
  } finally { await s.close(); }
}

module.exports = async () => {
  for (const who of [OWNER, AGENT, SPEC]) for (const lang of ["", "ru"]) for (const w of [320, 390, 1280]) await sweep(who, lang, w);
};
