// Owner 24.11 — wave 2 of the liked ideas:
//  (11) VIP from the 5th visit: the whole block gold, ⭐VIP (owner: «Целиком золотой»); cancelled stays black; works from
//       the database's count (ruqya_patient_marks) and, without it, from what is loaded.
//  (12) the patient at a glance on top of a booking (⭐ VIP, sessions, cancels, last visit) → a tap opens the card.
//  (13) the same number with two names: an admin keeps one name for all bookings (ruqya_merge_patients).
//  (14) a day's list per specialist as plain text, WhatsApp / copy (📋 under the calendar; ‹ › days).
//  (15) «Mənim» in Pasiyentlər: the patients of the bookings this user wrote.
const { open, check, OWNER, AGENT, seed, R1, R2, bakuToday, uuid } = require("../lib");
const row = (o) => Object.assign({ id: uuid(), reader_id: R1, date: bakuToday(), time: "10:00", duration: 90, name: "X", phone: "", price: 0, share: 0, status: "wait", note: "", settled: false, service: "Ruqya", confirmed: false, place: "ofis", follow: 0, created_by: AGENT, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }, o);
function data() {
  const db = seed();
  db.appts = [];
  for (const d of [-40, -20, -4, -2]) db.appts.push(row({ date: bakuToday(d), name: "Vip Xanım", phone: "055 555 55 55" }));
  db.appts.push(row({ date: bakuToday(), time: "12:00", name: "Vip Xanım", phone: "+994 55 555 55 55" }));                   // the 5th
  db.appts.push(row({ date: bakuToday(), time: "16:00", reader_id: R2, name: "Vip Xanım", phone: "055 555 55 55", status: "cancel" }));
  for (const d of [-3, -1]) db.appts.push(row({ date: bakuToday(d), name: "Az Gələn", phone: "055 444 44 44" }));
  db.appts.push(row({ date: bakuToday(), time: "14:00", reader_id: R2, name: "Az Gələn", phone: "055 444 44 44" }));
  db.appts.push(row({ date: bakuToday(-6), name: "Aysel", phone: "050 777 77 77", created_by: OWNER }));
  db.appts.push(row({ date: bakuToday(3), name: "Aysel Məmmədova", phone: "+994 50 777 77 77", created_by: OWNER }));
  db.appts.push(row({ date: bakuToday(1), time: "10:00", name: "Sabahkı", phone: "050 222 22 22", created_by: OWNER, place: "onlayn" }));
  return db;
}
module.exports = async () => {
  let s = await open(OWNER, { db: data(), viewport: { width: 390, height: 844 } });
  try {
    const p = s.page;
    await p.locator("#tabs:not([hidden])").waitFor({ timeout: 15000 }); await p.waitForTimeout(3000);
    const blocks = () => p.evaluate(() => [...document.querySelectorAll("#cal .ev")].map((e) => ({ t: e.textContent, vip: e.classList.contains("vip"), cancel: e.classList.contains("cancel"), bg: getComputedStyle(e).backgroundImage })));
    let b = await blocks();
    const v5 = b.find((x) => /Vip Xanım/.test(x.t) && !x.cancel), vc = b.find((x) => /Vip Xanım/.test(x.t) && x.cancel), az = b.find((x) => /Az Gələn/.test(x.t));
    check(v5 && v5.vip && /gradient/.test(v5.bg) && /⭐/.test(v5.t), "the 5th visit: a gold block with ⭐VIP: " + JSON.stringify(v5));
    check(vc && !vc.vip, "her cancelled booking stays black, not gold");
    check(az && !az.vip && !/⭐/.test(az.t), "3 visits: not VIP");
    check((s.ctl.rpc || []).includes("ruqya_patient_marks"), "the count is asked from the database");
    // (12) at a glance
    await p.click("#cal .ev.vip"); await p.locator("#sheet .pglance").waitFor();
    const gl = await p.textContent("#sheet .pglance");
    check(/⭐ VIP/.test(gl) && /\d+ seans/.test(gl) && /son: /.test(gl), "the patient at a glance: " + gl);
    await p.click("#sheet .pglance"); await p.waitForTimeout(500);
    check(/Vip Xanım/.test(await p.textContent("#sheet h2")) && await p.isVisible('#sheet [data-act="repeat"]'), "a tap opens the patient's card");
    await p.click('[data-act="close"]'); await p.waitForTimeout(300);
    // (14) the day's list
    await p.click('#cal .cal-foot [data-act="daylist"]'); await p.locator("#sheet .dlist").first().waitFor();
    const dl = await p.evaluate(() => [...document.querySelectorAll("#sheet .dlist")].map((d) => ({ t: d.querySelector(".dltxt").textContent, wa: d.querySelector("a.wa").href })));
    check(dl.length === 2 && /^Əli - /.test(dl[0].t) && /10:00-11:30 Sabahkı \(Ruqya, Onlayn\)/.test(dl[0].t) && /Cəmi: 1 seans/.test(dl[0].t), "Əli's list for tomorrow, plain text: " + JSON.stringify(dl[0].t));
    check(/Qəbul yoxdur/.test(dl[1].t), "İlkin: no sessions");
    check(dl[0].wa.startsWith("https://wa.me/?text=") && decodeURIComponent(dl[0].wa.split("text=")[1]) === dl[0].t, "WhatsApp gets exactly that text");
    check(!/050 222/.test(dl[0].t), "no phone numbers in the list sent out");
    await p.click('#sheet [data-act="dl-day"][data-n="-1"]'); await p.waitForTimeout(200);
    check(/12:00-13:30 Vip Xanım/.test(await p.textContent("#sheet .dlist .dltxt")), "‹ goes to today: " + await p.textContent("#sheet .dlist .dltxt"));
    await p.click('[data-act="close"]'); await p.waitForTimeout(300);
    // (13) duplicates
    await p.click('#tabs [data-tab="patients"]'); await p.waitForTimeout(1500);
    const db0 = await p.textContent('[data-act="dups"]');
    check(/: 1/.test(db0), "Pasiyentlər shows one duplicate: " + db0);
    await p.click('[data-act="dups"]'); await p.locator("#sheet .dupg").waitFor();
    const keepBtn = p.locator('#sheet .dupg .visit', { hasText: "Aysel Məmmədova" }).locator('[data-act="dup-keep"]');
    await keepBtn.click(); check(/bir də basın/.test(await keepBtn.textContent()), "asks again: " + await keepBtn.textContent());
    check(s.db.appts.filter((a) => /777 77 77/.test(a.phone)).map((a) => a.name).includes("Aysel"), "nothing changed after one tap");
    await p.waitForTimeout(700); await keepBtn.click(); await p.waitForTimeout(1500);
    const names = [...new Set(s.db.appts.filter((a) => /777 77 77/.test(a.phone)).map((a) => a.name))];
    check(JSON.stringify(names) === '["Aysel Məmmədova"]', "merged: one name for both bookings: " + JSON.stringify(names));
    check(/Dublikat yoxdur/.test(await p.textContent("#sheet")), "the sheet now says there is none");
    await p.click('[data-act="close"]'); await p.waitForTimeout(800);
    check(!(await p.$('[data-act="dups"]')), "the button is gone");
    // VIP mark in the patients list
    check(/⭐VIP\s*Vip Xanım/.test(await p.textContent("#plist")), "⭐VIP in the patients list");
    check(!s.errors.length, "no page errors: " + s.errors.join(" | "));
    await s.close();

    // (15) «Mənim» for an agent; and VIP without the database function (from what is loaded)
    const db2 = data(); db2.appts = db2.appts.filter((a) => a.date >= bakuToday(-5));   // only 3 of her visits are recent…
    for (const d of [-5, -3]) db2.appts.push(row({ date: bakuToday(d), name: "Vip Xanım", phone: "055 555 55 55" }));   // …now 5, all loaded
    db2.__noMarks = true;
    s = await open(AGENT, { db: db2, viewport: { width: 390, height: 844 } });
    const q = s.page;
    await q.locator("#tabs:not([hidden])").waitFor({ timeout: 15000 }); await q.waitForTimeout(3000);
    check(await q.evaluate(() => !!document.querySelector("#cal .ev.vip")), "without the database function: VIP counted from the loaded bookings");
    await q.click('#tabs [data-tab="patients"]'); await q.waitForTimeout(1200);
    await q.click('[data-act="p-sec"][data-id="mine"]'); await q.waitForTimeout(400);
    const mine = await q.evaluate(() => [...document.querySelectorAll("#plist .prow b")].map((x) => x.textContent));
    check(mine.some((x) => /Vip Xanım/.test(x)) && mine.some((x) => /Az Gələn/.test(x)) && !mine.some((x) => /Aysel|Sabahkı/.test(x)), "«Mənim»: only the agent's own patients: " + JSON.stringify(mine));
    check(!(await q.$('[data-act="dups"]')), "an agent has no merge button");
    check(!s.errors.length, "no page errors (agent): " + s.errors.join(" | "));
  } finally { await s.close().catch(() => {}); }
};
