// Owner 17.11: six services in the booking form (last field, like «Yer»), Ruqya chosen by default and changeable;
// saved, shown in the booking card, editable, and every service listed in statistics with its count.
const { open, check, AGENT, R1, bakuToday } = require("../lib");
module.exports = async () => {
  const s = await open(AGENT, {});
  try {
    const p = s.page; await p.locator("#cal .ev").first().waitFor({ timeout: 15000 }); await p.waitForTimeout(3300);
    await p.click("#fab"); await p.locator("#f-reader").waitFor();
    const opts = await p.$$eval('input[name="f-service"]', (els) => els.map((e) => e.value + (e.checked ? "*" : "")));
    check(JSON.stringify(opts) === JSON.stringify(["Ruqya*", "Hicama", "Kombo", "Masaj", "Dr.Günel", "Psixoloq"]), "six services, Ruqya chosen: " + opts.join(","));
    const last = await p.$$eval("#sheet input, #sheet select", (els) => els.filter((e) => e.name || e.id).map((e) => e.name || e.id).pop());
    check(last === "f-service", "the service is the last field: " + last);
    await p.selectOption("#f-reader", R1); await p.fill("#f-name", "Xidmət Pasiyent"); await p.fill("#f-phone", "050 999 88 77"); await p.fill("#f-time", "21:00");
    await p.click('label.segb:has(input[name="f-service"][value="Masaj"])');
    await p.click('[data-act="save-appt"]'); await p.waitForTimeout(800);
    const row = () => s.db.appts.find((a) => a.name === "Xidmət Pasiyent");
    check(row() && row().service === "Masaj", "saved with service Masaj: " + (row() && row().service));
    // the card shows it; editing changes it
    await p.click("#cal >> text=Xidmət Pasiyent"); await p.waitForTimeout(400);
    check(/Masaj/.test(await p.textContent("#sheet")), "the booking card shows the service");
    await p.click('[data-act="edit-appt"]').catch(() => {}); await p.locator('input[name="f-service"]').first().waitFor();
    check(await p.isChecked('input[name="f-service"][value="Masaj"]'), "the edit form has Masaj chosen");
    await p.click('label.segb:has(input[name="f-service"][value="Psixoloq"])'); await p.click('[data-act="save-appt"]'); await p.waitForTimeout(800);
    check(row().service === "Psixoloq", "service changed to Psixoloq: " + row().service);
    // statistics: every service listed
    await p.click('#tabs [data-tab="stats"]'); await p.click('#top [data-act="st-sec"][data-id="day"]');   // today (the week section shows the last finished week) await p.waitForTimeout(400);
    const t = await p.$eval('[data-st="svc"]', (e) => e.textContent.replace(/\s+/g, " ")).catch(() => "");
    for (const v of ["Ruqya", "Hicama", "Kombo", "Masaj", "Dr.Günel", "Psixoloq"]) check(t.includes(v), "statistics list " + v + ": " + t.slice(0, 160));
    check(/Psixoloq ?1 ?0/.test(t), "the Psixoloq session is counted (1 session, 0 successful yet): " + t);
    check(!s.errors.length, "no page errors: " + s.errors.join("; "));
  } finally { await s.close(); }
};
