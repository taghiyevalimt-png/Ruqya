// Owner 22.11: «a break for one day; the break goes into the new-booking window; the window like Google Calendar, one
// day by default; the break's functions fully like Google Calendar». The new-booking window has «Qəbul | Fasilə»;
// a break starts with the window's day, time and specialist; a tap on a break opens it; a repeating break is changed
// or deleted «only this day», «this and the following days» or «all days»; «Bütün gün» closes the whole day.
const { open, check, OWNER, seed, R1, R2, bakuToday } = require("../lib");
module.exports = async () => {
  const db = seed(); db.appts = [];
  const s = await open(OWNER, { db, viewport: { width: 390, height: 844 } });
  try {
    const p = s.page, t = bakuToday(), wd = (d) => (new Date(d + "T12:00:00Z").getUTCDay() + 6) % 7 + 1;
    const add = (d, n) => { const x = new Date(d + "T12:00:00Z"); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
    await p.locator("#tabs:not([hidden])").waitFor({ timeout: 15000 }); await p.waitForTimeout(3000);
    const blocks = () => p.locator("#cal .brk").count();
    const go = async (d) => { await p.evaluate((d) => { const b = document.querySelector('[data-act="goto"][data-d="' + d + '"]'); if (b) b.click(); }, d);
      while ((await p.evaluate(() => document.getElementById("cal").dataset.d)) !== d) { await p.click('[data-act="shift"][data-n="' + ((await p.evaluate(() => document.getElementById("cal").dataset.d)) < d ? 1 : -1) + '"]'); } await p.waitForTimeout(200); };
    // 1. from the new-booking window: Fasilə, the specialist and time come along, one day by default
    await p.click("#fab"); await p.locator("#f-name").waitFor();
    await p.selectOption("#f-reader", R2); await p.fill("#f-time", "15:00"); await p.fill("#f-name", "Yazılan ad");
    await p.click('[data-act="kind"][data-id="brk"]'); await p.locator("#b-title").waitFor();
    check(await p.inputValue("#b-date") === t && await p.inputValue("#b-start") === "15:00" && await p.inputValue("#b-end") === "16:00", "the window's day and time come along, one hour long");
    check(await p.getAttribute('[data-act="b-who"][data-id="' + R2 + '"]', "aria-pressed") === "true", "the window's specialist comes along");
    check(await p.inputValue("#b-rep") === "none", "one day by default (Təkrarlanmır)");
    // back to «Qəbul» keeps what was typed
    await p.click('[data-act="kind"][data-id="appt"]'); await p.locator("#f-name").waitFor();
    check(await p.inputValue("#f-name") === "Yazılan ad", "switching back keeps the typed name");
    await p.click('[data-act="kind"][data-id="brk"]'); await p.locator("#b-title").waitFor();
    await p.fill("#b-title", "Namaz"); await p.selectOption("#b-rep", "week"); await p.waitForTimeout(100);
    await p.click('[data-act="save-break"]'); await p.waitForTimeout(500);
    let b = s.db.breaks.find((x) => x.title === "Namaz");
    check(b && b.reader_id === R2 && JSON.stringify(b.days) === "[" + wd(t) + "]" && b.date_from === t && !b.date_to, "weekly on today's weekday from today, İlkin: " + JSON.stringify(b));
    await go(t); check(await blocks() === 1, "shown today");
    // 2. delete only today: next week it is still there
    await p.locator("#cal .brk").first().click(); await p.locator('#sheet [data-act="brk-del"]').waitFor();
    await p.click('#sheet [data-act="brk-del"]'); await p.waitForTimeout(200);
    check(await p.locator('#sheet [data-act="brk-scope"][data-id="next"]').count() === 0, "on the first day «this and following» is not offered (it is «all»)");
    await p.click('#sheet [data-act="brk-scope"][data-id="one"]'); await p.waitForTimeout(500);
    b = s.db.breaks.find((x) => x.title === "Namaz");
    check(b && JSON.stringify(b.skip) === JSON.stringify([t]), "today is left out: " + JSON.stringify(b));
    check(await blocks() === 0, "gone today");
    const n1 = add(t, 7), n2 = add(t, 14);
    await go(n1); check(await blocks() === 1, "still there next week");
    // 3. change this and the following ones (from next week): 14:00–14:30
    await p.locator("#cal .brk").first().click(); await p.click('#sheet [data-act="brk-edit"]'); await p.locator("#b-start").waitFor();
    check(await p.inputValue("#b-date") === n1, "the form opens on the tapped day");
    await p.fill("#b-start", "14:00"); await p.fill("#b-end", "14:30"); await p.click('[data-act="save-break"]'); await p.waitForTimeout(200);
    await p.click('#sheet [data-act="brk-scope"][data-id="next"]'); await p.waitForTimeout(500);
    const all = s.db.breaks.filter((x) => x.title === "Namaz");
    check(all.length === 1 && all[0].start_time === "14:00" && all[0].date_from === n1, "the old part had no day left and is gone; the new part starts next week at 14:00: " + JSON.stringify(all));
    await go(n2); check((await p.locator("#cal .brk").first().getAttribute("style")).length > 0 && await blocks() === 1, "in two weeks: the changed break");
    // 4. «Bütün gün» on one day for Əli, then delete it (one day: one confirm)
    await p.click("#fab"); await p.click('[data-act="kind"][data-id="brk"]'); await p.locator("#b-title").waitFor();
    await p.fill("#b-title", "İstirahət"); await p.click('[data-act="b-all"]'); await p.waitForTimeout(100);
    check(await p.locator("#b-start").count() === 0, "«Bütün gün» hides the times");
    await p.click('[data-act="b-who"][data-id="' + R1 + '"]'); await p.click('[data-act="save-break"]'); await p.waitForTimeout(500);
    const off = s.db.breaks.find((x) => x.title === "İstirahət");
    check(off && off.start_time === "00:00" && off.end_time === "23:59" && off.date_from === n2 && off.date_to === n2 && off.reader_id === R1, "a whole free day on the day on screen: " + JSON.stringify(off));
    check(await p.locator("#cal .brk").count() === 2, "two breaks drawn that day");
    await p.locator('#cal .brk:has-text("İstirahət")').click(); await p.locator('#sheet [data-act="brk-del"]').waitFor();
    check(/Bütün gün/.test(await p.textContent("#sheet")), "the card says «Bütün gün»");
    const del = p.locator('#sheet [data-act="brk-del"]'); await del.click(); await p.waitForTimeout(700); await del.click(); await p.waitForTimeout(500);
    check(!s.db.breaks.some((x) => x.title === "İstirahət"), "deleted with a second tap");
    // 5. the list view shows the break and opens it
    await p.click('[data-act="view"][data-id="list"]'); await p.waitForTimeout(300);
    check(await p.locator('.card.brkrow [data-act="brk-one"]').count() === 1, "the list shows the break");
    check(!s.errors.length, "no page errors: " + s.errors.join("; "));
  } finally { await s.close(); }
};
