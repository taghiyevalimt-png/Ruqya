// Owner 18.11: online sessions get «Ödəniş edib» — after «Ləğv et», under «Təsdiqləyib»; a tap puts ✅ before the word
// (again: takes it back). Only in the list («Siyahı») and in the booking window, not in the calendar or elsewhere.
const { open, check, AGENT, seed, uuid, bakuToday, R1 } = require("../lib");
module.exports = async () => {
  const db = seed(), now = new Date().toISOString(); db.appts = [];
  const mk = (name, place) => db.appts.push({ id: uuid(), reader_id: R1, date: bakuToday(0), time: name === "Onlayn" ? "21:00" : "22:00", duration: 60, name, phone: "050 1", price: 150, share: 0, status: "wait", note: "", settled: false, service: "Ruqya", confirmed: true, place, follow: 0, created_by: AGENT, created_at: now, updated_at: now });
  mk("Onlayn", "onlayn"); mk("Ofisdə", "ofis");
  const s = await open(AGENT, { db, viewport: { width: 390, height: 844 } });
  try {
    const p = s.page; await p.locator("#tabs:not([hidden])").waitFor({ timeout: 15000 }); await p.waitForTimeout(3300);
    await p.click('#tabs [data-tab="day"]');
    // calendar: no «Ödəniş»
    await p.click('[data-act="view"][data-id="grid"]').catch(() => {}); await p.waitForTimeout(300);
    check(!/Ödəniş/.test(await p.textContent("#main")), "the calendar has no «Ödəniş edib»");
    // list
    await p.click('[data-act="view"][data-id="list"]'); await p.waitForTimeout(400);
    const card = (n) => p.evaluate((n) => { const c = [...document.querySelectorAll("#main .appt, #main .card, #main [data-id]")].map((e) => e.closest(".appt") || e.closest(".card")).filter(Boolean).find((e) => e.textContent.includes(n));
      return c ? [...c.querySelectorAll("button")].map((b) => b.textContent.trim()) : null; }, n);
    const on = await card("Onlayn"), of = await card("Ofisdə");
    check(on && on.includes("Ödəniş edib") && on.indexOf("Ödəniş edib") === on.indexOf("Ləğv et") + 1, "online card: «Ödəniş edib» right after «Ləğv et»: " + JSON.stringify(on));
    check(of && !of.some((t) => /Ödəniş/.test(t)), "office card: no «Ödəniş edib»: " + JSON.stringify(of));
    await p.click('#main [data-act="paid"]'); await p.waitForTimeout(400);
    check(s.db.appts.find((x) => x.name === "Onlayn").settled === true, "saved: settled = true");
    check((await card("Onlayn")).some((t) => /^✅\s*Ödəniş edib$/.test(t)), "the ✅ is before the word: " + JSON.stringify(await card("Onlayn")));
    await p.click('#main [data-act="paid"]'); await p.waitForTimeout(400);
    check(s.db.appts.find((x) => x.name === "Onlayn").settled === false && (await card("Onlayn")).includes("Ödəniş edib"), "a second tap takes it back");
    // the booking window
    await p.click('[data-act="view"][data-id="grid"]'); await p.waitForTimeout(300);
    await p.click('#cal .ev:has-text("Onlayn")'); await p.locator("#sheet").waitFor(); await p.waitForTimeout(300);
    const sh = await p.evaluate(() => [...document.querySelectorAll("#sheet button")].map((b) => b.textContent.trim()));
    const ci = sh.findIndex((t) => /^Ləğv et/.test(t));
    check(ci >= 0 && sh[ci + 1] === "Ödəniş edib", "booking window: «Ödəniş edib» right after «Ləğv et»: " + JSON.stringify(sh));
    await p.click('#sheet [data-act="paid"]'); await p.waitForTimeout(400);
    check(/✅\s*Ödəniş edib/.test(await p.textContent("#sheet")) && s.db.appts.find((x) => x.name === "Onlayn").settled === true, "booking window: the tap marks it: " + JSON.stringify([(await p.textContent("#sheet")).slice(-200), s.db.appts.find((x) => x.name === "Onlayn").settled]));
    await p.click('[data-act="close"]'); await p.waitForTimeout(300);
    await p.click('#cal .ev:has-text("Ofisdə")'); await p.locator("#sheet").waitFor(); await p.waitForTimeout(300);
    check(!/Ödəniş/.test(await p.textContent("#sheet")), "office booking window: no «Ödəniş edib»");
    check(!s.errors.length, "no page errors: " + s.errors.join("; "));
  } finally { await s.close(); }
};
