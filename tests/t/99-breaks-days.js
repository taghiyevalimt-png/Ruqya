// Owner 18.11 notes — breaks: on chosen days of the week or on chosen dates (like Google Calendar), and the
// specialists can change breaks too (their own column only; shared ones stay with admins and agents).
const { open, check, OWNER, SPEC, seed, R1, R2 } = require("../lib");
module.exports = async () => {
  const db = seed(); db.appts = [];
  let s = await open(OWNER, { db, viewport: { width: 390, height: 844 } });
  const strip = async (p) => p.evaluate(() => [...document.querySelectorAll('[data-act="goto"]')].map((b) => b.dataset.d));
  const wd = (d) => (new Date(d + "T12:00:00Z").getUTCDay() + 6) % 7 + 1;
  const breaksIn = async (p, d) => { await p.click('#tabs [data-tab="day"]'); await p.click('[data-act="goto"][data-d="' + d + '"]'); await p.waitForTimeout(400);
    return p.evaluate(() => [...document.querySelectorAll("#cal .col")].map((c, i) => [...c.querySelectorAll(".brk")].map((b) => i + ":" + b.textContent)).flat()); };
  let days;
  try {
    const p = s.page; await p.locator("#tabs:not([hidden])").waitFor({ timeout: 15000 }); await p.waitForTimeout(3300);
    days = await strip(p);   // the 7 days of this week, Monday first
    const addBreak = async (title, start, end, who, rep, extra) => {
      await p.click('#tabs [data-tab="readers"]'); await p.click('#top [data-act="set-sec"][data-id="breaks"]'); await p.waitForTimeout(200);
      await p.click('[data-act="new-break"]'); await p.locator("#b-title").waitFor();
      await p.fill("#b-title", title); await p.fill("#b-start", start); await p.fill("#b-end", end);
      if (who) await p.click('[data-act="b-who"][data-id="' + who + '"]');
      if (rep) { await p.click('[data-act="b-rep"][data-id="' + rep + '"]'); await extra(); }
      await p.click('[data-act="save-break"]'); await p.waitForTimeout(500);
    };
    // Mondays only, column «Əli»
    await addBreak("Namaz", "13:00", "13:30", R1, "wd", async () => { await p.click('[data-act="b-day"][data-id="1"]'); });
    const b1 = s.db.breaks.find((x) => x.title === "Namaz");
    check(b1 && JSON.stringify(b1.days) === "[1]" && b1.reader_id === R1 && !b1.date_from, "saved: Mondays, column Əli: " + JSON.stringify(b1));
    // one date (the Thursday of this week), column «İlkin»
    const thu = days[3];
    await addBreak("Görüş", "15:00", "16:00", R2, "dates", async () => { await p.fill("#b-from", thu); });
    const b2 = s.db.breaks.find((x) => x.title === "Görüş");
    check(b2 && b2.date_from === thu && b2.date_to === thu && !b2.days, "saved: one date: " + JSON.stringify(b2));
    // every day, for everybody (as before)
    await addBreak("Nahar", "14:00", "14:30", null, null);
    const b3 = s.db.breaks.find((x) => x.title === "Nahar");
    check(b3 && !b3.days && !b3.date_from && !b3.reader_id, "saved: every day, everybody: " + JSON.stringify(b3));
    // the list shows when
    const listTxt = await p.textContent("#main");
    check(/Namaz[\s\S]*B\.e/.test(listTxt), "the list says «B.e» for the Monday break");
    // the calendar: Monday shows Namaz in Əli's column, Tuesday does not; Thursday shows Görüş in İlkin's column only
    const mon = await breaksIn(p, days[0]), tue = await breaksIn(p, days[1]), th = await breaksIn(p, thu);
    check(mon.includes("0:Namaz") && mon.includes("0:Nahar") && mon.includes("1:Nahar"), "Monday: Namaz in Əli's column, Nahar everywhere: " + mon);
    check(!tue.some((x) => /Namaz|Görüş/.test(x)) && tue.includes("0:Nahar"), "Tuesday: no Namaz, no Görüş: " + tue);
    check(th.includes("1:Görüş") && !th.includes("0:Görüş") && !th.some((x) => /Namaz/.test(x)), "Thursday: Görüş only in İlkin's column: " + th);
    check(wd(days[0]) === 1, "the first strip day is a Monday");
    // a tap in the break time: on Monday «Bu vaxt fasilədir», on Tuesday the new booking opens
    const tapAt = async (d, hm) => { await p.click('[data-act="goto"][data-d="' + d + '"]'); await p.waitForTimeout(400);
      const pt = await p.evaluate((hm) => { const c = document.querySelector("#cal .col"), hour = parseFloat(getComputedStyle(c).backgroundSize.split(" ")[1]), r = c.getBoundingClientRect(), m = +hm.slice(0, 2) * 60 + +hm.slice(3);
        const y = r.top + (m - 8 * 60) * hour / 60; document.getElementById("cal").scrollTop += y - 300; return null; }, hm);
      const pos = await p.evaluate((hm) => { const c = document.querySelector("#cal .col"), hour = parseFloat(getComputedStyle(c).backgroundSize.split(" ")[1]), r = c.getBoundingClientRect(), m = +hm.slice(0, 2) * 60 + +hm.slice(3);
        return { x: r.left + r.width / 2, y: r.top + (m - 8 * 60) * hour / 60 + 4 }; }, hm);
      await p.mouse.click(pos.x, pos.y); await p.waitForTimeout(500);
      const sheetOpen = await p.evaluate(() => !document.getElementById("overlay").hidden);
      const msg = await p.evaluate(() => document.body.textContent.includes("Bu vaxt fasilədir"));
      if (sheetOpen) { await p.click('[data-act="close"]').catch(() => {}); await p.waitForTimeout(300); }
      return { sheetOpen, msg }; };
    const tMon = await tapAt(days[0], "13:10"), tTue = await tapAt(days[1], "13:10");
    check(!tMon.sheetOpen && tMon.msg, "Monday 13:10 in Əli's column: the break stops the booking: " + JSON.stringify(tMon));
    check(tTue.sheetOpen, "Tuesday 13:10: free, the new booking opens: " + JSON.stringify(tTue));
    check(!s.errors.length, "admin: no page errors: " + s.errors.join("; "));
  } finally { await s.close(); }
  // the specialist (column «Əli»): adds and deletes his own breaks; the shared ones stay closed for him
  s = await open(SPEC, { db: s.db, viewport: { width: 390, height: 844 } });
  try {
    const p = s.page; await p.locator("#tabs:not([hidden])").waitFor({ timeout: 15000 }); await p.waitForTimeout(3300);
    await p.click('#tabs [data-tab="readers"]'); await p.click('#top [data-act="set-sec"][data-id="breaks"]'); await p.waitForTimeout(300);
    check(await p.locator('[data-act="new-break"]').count() === 1, "specialist: «Fasilə əlavə et» is there");
    await p.click('[data-act="new-break"]'); await p.locator("#b-title").waitFor();
    const chips = await p.evaluate(() => [...document.querySelectorAll('[data-act="b-who"]')].map((b) => b.textContent + "=" + b.getAttribute("aria-pressed")));
    check(JSON.stringify(chips) === JSON.stringify(["Əli=true"]), "specialist: only his own column, already chosen, no «Hamısı»: " + JSON.stringify(chips));
    await p.fill("#b-title", "Dərs"); await p.fill("#b-start", "18:00"); await p.fill("#b-end", "19:00");
    await p.click('[data-act="b-rep"][data-id="wd"]'); await p.click('[data-act="b-day"][data-id="2"]'); await p.click('[data-act="b-day"][data-id="4"]');
    await p.click('[data-act="save-break"]'); await p.waitForTimeout(500);
    const b4 = s.db.breaks.find((x) => x.title === "Dərs");
    check(b4 && b4.reader_id === R1 && JSON.stringify(b4.days) === "[2,4]", "specialist's break saved for his column, Tue/Thu: " + JSON.stringify(b4));
    const dis = await p.evaluate(() => [...document.querySelectorAll('[data-act="brk-open"]')].map((b) => b.textContent.replace(/\s+/g, " ").trim() + "=" + b.disabled));
    check(dis.some((x) => /Nahar.*=true/.test(x)) && dis.some((x) => /Dərs.*=false/.test(x)), "the shared «Nahar» is closed for him, his own «Dərs» opens: " + JSON.stringify(dis));
    await p.click('[data-act="brk-open"]:has-text("Dərs")'); await p.locator('#sheet [data-act="del-breaks"], #sheet [data-act="del-break"]').first().waitFor();
    const del = p.locator('#sheet [data-act="del-breaks"]').first(); await del.click(); await p.waitForTimeout(700); await del.click(); await p.waitForTimeout(500);   // the second tap counts after 0.6 s (double-tap guard)
    check(!s.db.breaks.some((x) => x.title === "Dərs"), "the specialist deleted his own break");
    check(s.db.breaks.some((x) => x.title === "Nahar"), "the shared break is still there");
    check(!s.errors.length, "specialist: no page errors: " + s.errors.join("; "));
  } finally { await s.close(); }
};
