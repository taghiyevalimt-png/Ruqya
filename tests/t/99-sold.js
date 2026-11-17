// Owner 17.11: «Satış edildi» on a cancelled booking makes it a successful one in the app — own colour on the
// calendar (not black), counted as «Uğurlu» in statistics, gone from «Ləğv olunanlar»; pressing it again makes it
// cancelled again. The database keeps status cancel + follow 3 (access rules and the free slot unchanged).
const { open, check, AGENT, seed, uuid, bakuToday, R1 } = require("../lib");
module.exports = async () => {
  const db = seed(), now = new Date().toISOString();
  // a session that has ended: today 08:00–08:30 Baku when the test runs after 09:00 there, otherwise yesterday
  const bakuHour = new Date(Date.now() + 4 * 3600e3).getUTCHours(), day = bakuHour >= 9 ? bakuToday(0) : bakuToday(-1);
  db.appts.push({ id: uuid(), reader_id: R1, date: day, time: "08:00", duration: 30, name: "Satış Pasiyent", phone: "050 444 55 66", price: 130, share: 0, status: "cancel", note: "", settled: false, service: "Ruqya", confirmed: false, place: "ofis", follow: 2, created_by: AGENT, created_at: now, updated_at: now });
  const s = await open(AGENT, { db });
  try {
    const p = s.page; await p.locator("#tabs:not([hidden])").waitFor({ timeout: 15000 }); await p.waitForTimeout(3300);
    const row = () => s.db.appts.find((a) => a.name === "Satış Pasiyent");
    const block = async () => { await p.click('#tabs [data-tab="day"]'); await p.click('[data-act="goto"][data-d="' + day + '"]').catch(() => {}); await p.waitForTimeout(400); return p.evaluate(() => { const e = [...document.querySelectorAll("#cal .ev")].find((x) => /Satış Pasiyent/.test(x.textContent)); return e ? { cls: e.className, bg: getComputedStyle(e).backgroundColor } : null; }); };
    const stats = async () => { await p.click('#tabs [data-tab="stats"]'); await p.click('#top [data-act="st-sec"][data-id="' + (day === bakuToday(0) ? "today" : "day") + '"]').catch(() => {}); await p.waitForTimeout(400); return (await p.textContent("#main")).replace(/\s+/g, " "); };
    const inCancelled = async () => { await p.click('#tabs [data-tab="patients"]'); await p.click('[data-act="p-sec"][data-id="cancel"]'); await p.waitForTimeout(400); return /Satış Pasiyent/.test(await p.textContent("#plist")); };
    const b0 = await block(), st0 = await stats();
    check(b0 && /\bcancel\b/.test(b0.cls), "before: the cancelled booking is black on the calendar: " + JSON.stringify(b0));
    check(await inCancelled(), "before: in «Ləğv olunanlar»");
    // press «Satış edildi» in its card
    await p.click("#plist >> text=Satış Pasiyent"); await p.locator(".folbtns").waitFor();
    await p.click('[data-act="follow"][data-n="3"]'); await p.waitForTimeout(600);
    check(row().follow === 3 && row().status === "cancel", "database: follow 3, status still cancel: " + row().follow + " " + row().status);
    await p.click('[data-act="close"]').catch(() => {}); await p.waitForTimeout(300);
    check(!(await inCancelled()), "after: gone from «Ləğv olunanlar»");
    const b1 = await block();
    check(b1 && !/\bcancel\b/.test(b1.cls) && b1.bg !== "rgb(0, 0, 0)", "after: own colour on the calendar: " + JSON.stringify(b1));
    const st1 = await stats();
    check(st1 !== st0, "after: statistics changed (counted as successful, not cancelled)");
    // the card still has the buttons: pressing «Satış edildi» again makes it cancelled again
    await block(); await p.click("#cal .ev >> text=Satış Pasiyent"); await p.locator(".folbtns").waitFor();
    await p.locator('[data-act="follow"][data-n="3"]').first().click(); await p.waitForTimeout(600);
    check(row().follow === 2, "pressed again: follow 2 (cancelled again): " + row().follow);
    await p.click('[data-act="close"]').catch(() => {});
    check(await inCancelled(), "pressed again: back in «Ləğv olunanlar»");
    check((await stats()) === st0, "pressed again: statistics as before");
    check(!s.errors.length, "no page errors: " + s.errors.join("; "));
  } finally { await s.close(); }
};
