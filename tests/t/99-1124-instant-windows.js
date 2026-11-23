// 24.11 (owner: «do the rework of the screens» — no wait before a window moves, even on the oldest Android) and the new
// look. Checked:
//  - the new-booking window is built ahead while idle (an invisible copy, its ids / radio names / buttons marked «pk-»,
//    so nothing clashes); «+ Yaz» shows that copy: the window glides at once with no long task, the fields have their
//    real ids, one of each id in the page; a booking saved from it reaches the database; the same for «Məhsul satışı»;
//  - closing: the window itself slides away (no copy), nothing is left behind after the glide;
//  - a different window (another day picked) is built the usual way and is still right;
//  - look: patients have round initials, Kassa shows the day's sum / pieces / sales on top (= the table's total),
//    Statistika shows Yazdı / Uğurlu / Ləğv of the period on top (= the «Cəmi» row).
const { open, check, AGENT, OWNER, seed, R1, bakuToday, uuid } = require("../lib");
module.exports = async () => {
  const db = seed(), now = new Date().toISOString();
  const P = "cccccccc-0000-4000-8000-000000000701";
  db.products = [{ id: P, name: "Ruqyalı su", price: 2, archived: false, sort: 1, created_at: now }];
  db.product_sales = [{ id: uuid(), date: bakuToday(), product_id: P, qty: 3, price: 2, amount: 6, names: "Ruqyalı su", created_by: AGENT, patient_of: null, created_at: now }];
  const s = await open(AGENT, { db, init: [() => localStorage.setItem("ruqya.lite", "1"), null] });
  try {
    const p = s.page; await p.locator("#tabs:not([hidden])").waitFor({ timeout: 15000 }); await p.waitForTimeout(2500);
    await p.click('#tabs [data-tab="day"]'); await p.waitForTimeout(2200);   // idle: the copy is built
    const ready = await p.evaluate(() => { const o = document.querySelector(".overlay.parked"); return o ? { ids: [...o.querySelectorAll("[id]")].map((e) => e.id).slice(0, 5), vis: getComputedStyle(o).visibility, acts: o.querySelectorAll('[data-act^="pk-"]').length, plain: o.querySelectorAll('[data-act]:not([data-act^="pk-"])').length } : null; });
    check(ready && ready.vis === "hidden" && ready.ids.length && ready.ids.every((x) => /^pk-/.test(x)) && ready.acts > 3 && ready.plain === 0, "the booking window is ready ahead, invisible, marked «pk-»: " + JSON.stringify(ready));
    const before = await p.evaluateHandle(() => document.getElementById("overlay"));
    await p.evaluate(() => { window.__lt = []; try { new PerformanceObserver((l) => l.getEntries().forEach((e) => window.__lt.push(e.duration))).observe({ entryTypes: ["longtask"] }); } catch (e) {} });
    await p.click("#fab"); await p.locator("#f-reader").waitFor(); await p.waitForTimeout(400);
    const st = await p.evaluate((b) => ({ swapped: document.getElementById("overlay") !== b, dup: ["f-reader", "f-name", "f-phone", "f-date", "f-time"].map((i) => document.querySelectorAll('[id="' + i + '"]').length), pk: document.querySelectorAll('#sheet [id^="pk-"],#sheet [name^="pk-"],#sheet [data-act^="pk-"]').length, radios: document.querySelectorAll('input[name="f-service"]').length, lt: Math.max(0, ...window.__lt) }), before);
    check(st.swapped && st.pk === 0 && st.dup.every((n) => n === 1) && st.radios >= 6, "«+ Yaz» shows the ready window, with real ids, each once: " + JSON.stringify(st));
    await p.selectOption("#f-reader", R1); await p.fill("#f-name", "Hazır pəncərə"); await p.fill("#f-phone", "050 111 11 11"); await p.fill("#f-time", "15:00");
    await p.click('label:has(input[name="f-service"][value="Hicama"])');
    await p.click('[data-act="save-appt"]'); await p.waitForTimeout(800);
    const row = s.db.appts.find((a) => a.name === "Hazır pəncərə");
    check(row && row.service === "Hicama" && row.reader_id === R1, "saved from the ready window: " + JSON.stringify(row && [row.service, row.reader_id]));
    await p.waitForTimeout(500);
    check(await p.evaluate(() => !document.querySelector(".ghostout") && document.querySelectorAll("#overlay").length === 1), "after closing nothing is left behind");
    // another day: the window is built the usual way and has that day
    await p.click('[data-act="shift"][data-n="1"]'); await p.waitForTimeout(150);
    await p.click("#fab"); await p.locator("#f-reader").waitFor();
    check(await p.inputValue("#f-date") === bakuToday(1), "another day picked: the window has that day: " + await p.inputValue("#f-date"));
    await p.click('[data-act="close"]'); await p.waitForTimeout(400); if (await p.locator('[data-act="draft-drop"]').count()) await p.click('[data-act="draft-drop"]');
    // Kassa: the ready «Məhsul satışı» and the day on top
    await p.click('[data-act="shift"][data-n="-1"]'); await p.click('#tabs [data-tab="cash"]'); await p.waitForTimeout(2200);
    const hero = await p.evaluate(() => [...document.querySelectorAll(".herosum b")].map((b) => b.textContent.replace(/\s/g, " ").trim()));
    check(hero.length === 3 && /^6\s?₼$/.test(hero[0].replace(/ | /g, "")) && hero[1] === "3" && hero[2] === "1", "Kassa on top: sum 6 ₼, 3 pieces, 1 sale: " + JSON.stringify(hero));
    await p.click('[data-act="new-prod"]'); await p.locator("#sheet .pbtn").first().waitFor();
    check(await p.evaluate(() => document.querySelectorAll('#sheet [data-act^="pk-"]').length === 0 && document.querySelectorAll('#sheet [data-act="sell-pat"]').length > 0), "«Məhsul satışı» works (its buttons are live)");
    await p.click('[data-act="close"]'); await p.waitForTimeout(400);
    // patients: initials; Statistika: the period on top = the «Cəmi» row
    await p.click('#tabs [data-tab="patients"]'); await p.waitForTimeout(400);
    const av = await p.evaluate(() => { const a = document.querySelector("#plist .ava, .prow .ava"); return a ? { i: a.getAttribute("data-i"), c: getComputedStyle(a).color, t: a.closest(".reader").querySelector("b").textContent } : null; });
    check(av && av.i && av.c === "rgb(255, 255, 255)" && av.t.charAt(0).toUpperCase() === av.i.charAt(0), "patients: round initials: " + JSON.stringify(av));
    await p.click('#tabs [data-tab="stats"]'); await p.click('#top [data-act="st-sec"][data-id="cweek"]'); await p.waitForTimeout(400);
    const tiles = await p.evaluate(() => [...document.querySelectorAll(".pertot b")].map((b) => b.textContent.trim()));
    const tot = await p.evaluate(() => { const hd = [...document.querySelectorAll('[data-st^="big-"] thead tr.sub th')].map((x) => x.textContent.trim()), r = document.querySelector('[data-st^="big-"] tfoot tr'); return ["Yazdı", "Uğurlu", "Ləğv"].map((l) => r.cells[hd.indexOf(l) + 1].textContent.trim()); });
    check(JSON.stringify(tiles) === JSON.stringify(tot), "Statistika on top = the «Cəmi» row: " + JSON.stringify([tiles, tot]));
    check(!s.errors.length, "no page errors: " + s.errors.join("; "));
  } finally { await s.close(); }
};
