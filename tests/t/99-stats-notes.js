// Owner 18.11 notes — statistics, Excel, workers:
//  - statistics show where the sessions were (Ofis / Onlayn / Ünvan) like the services table;
//  - Excel has everything the statistics screen shows: services, places, agents × services (by day / week / month),
//    and the real service of each booking in «Bütün qəbullar» (it was always «Ruqya»: the column was not loaded);
//  - an admin can keep chosen sales agents out of the statistics (Ayarlar → İşçilər → «Statistikada göstərmə»);
//  - an admin changes his own name and other workers' names in the workers' list.
const zlib = require("zlib");
const { open, check, OWNER, AGENT, seed, uuid, R1, R2 } = require("../lib");
function unzip(buf) {
  const files = {}; let i = 0;
  while (buf.readUInt32LE(i) === 0x04034b50) {
    const method = buf.readUInt16LE(i + 8), csize = buf.readUInt32LE(i + 18), nlen = buf.readUInt16LE(i + 26), xlen = buf.readUInt16LE(i + 28);
    const name = buf.slice(i + 30, i + 30 + nlen).toString(), data = buf.slice(i + 30 + nlen + xlen, i + 30 + nlen + xlen + csize);
    files[name] = (method === 8 ? zlib.inflateRawSync(data) : data).toString("utf8"); i += 30 + nlen + xlen + csize;
  }
  return files;
}
function baku(off) { return new Date(Date.now() + 4 * 3600e3 + off * 864e5).toISOString().slice(0, 10); }
module.exports = async () => {
  // last finished Friday–Thursday week (the default of «Həftəlik»): its Monday
  const d = new Date(Date.now() + 4 * 3600e3), back = ((d.getUTCDay() - 5 + 7) % 7) + 7, day = baku(-back + 3), wr = baku(-back + 1) + "T08:00:00Z";
  const A2 = uuid(), now = new Date().toISOString();
  const db = seed(); db.appts = [];
  db.staff.push({ id: A2, name: "Asiya", role: "agent", want: null, created_at: now, hide_stats: false });
  const mk = (by, svc, place, time, rid = R1) => db.appts.push({ id: uuid(), reader_id: rid, date: day, time, duration: 30, name: "P " + time, phone: "050 " + time, price: 100, share: 0, status: "wait", note: "", settled: false, service: svc, confirmed: false, place, follow: 0, created_by: by, created_at: wr, updated_at: wr });
  mk(AGENT, "Ruqya", "ofis", "09:00"); mk(AGENT, "Hicama", "onlayn", "10:00"); mk(AGENT, "Ruqya", "unvan", "11:00");
  mk(A2, "Masaj", "ofis", "09:00", R2); mk(A2, "Masaj", "onlayn", "10:00", R2);
  const s = await open(OWNER, { db, viewport: { width: 390, height: 844 } });
  try {
    const p = s.page; await p.locator("#tabs:not([hidden])").waitFor({ timeout: 15000 }); await p.waitForTimeout(3300);
    const table = (st) => p.evaluate((st) => { const t = document.querySelector('[data-st="' + st + '"]'); return t ? [...t.querySelectorAll("tr")].map((tr) => [...tr.children].map((c) => c.textContent.trim())) : null; }, st);
    await p.click('#tabs [data-tab="stats"]'); await p.click('#top [data-act="st-sec"][data-id="week"]'); await p.waitForTimeout(400);
    // owner 22.11: the places are columns of the week's one table (totals row and «Uğurlu seans» row)
    const big = await table("big-week"), pl = big && big.slice(-2).map((r) => r.slice(-3));
    check(pl && JSON.stringify(pl) === JSON.stringify([["2", "2", "1"], ["2", "2", "1"]]), "statistics show the places (Ofis, Onlayn, Ünvan): " + JSON.stringify(pl));
    const sales0 = big;
    check(sales0 && sales0.some((r) => r[0] === "Asiya"), "Asiya is in the sales table before hiding");
    // Excel: services, places, agents × services; the service column of every booking
    const xls = async () => {
      await p.click('[data-act="xls"]'); await p.waitForSelector("a[download]", { timeout: 20000 });
      const [dl] = await Promise.all([p.waitForEvent("download"), p.click("a[download]")]);
      const x = unzip(require("fs").readFileSync(await dl.path()));
      const names = [...x["xl/workbook.xml"].matchAll(/name="([^"]+)"/g)].map((m) => m[1]);
      const shared = x["xl/sharedStrings.xml"] ? [...x["xl/sharedStrings.xml"].matchAll(/<t[^>]*>([^<]*)<\/t>/g)].map((m) => m[1]) : [];
      const rows = (n) => [...(x["xl/worksheets/sheet" + (names.indexOf(n) + 1) + ".xml"] || "").matchAll(/<row [^>]*>(.*?)<\/row>/g)].map((r) => [...r[1].matchAll(/<c [^>]*?(?:\/>|>(?:<v>([^<]*)<\/v>|<is><t[^>]*>([^<]*)<\/t><\/is>)<\/c>)/g)].map((m) => m[1] !== undefined ? m[1] : m[2] !== undefined ? m[2] : ""));
      await p.click('[data-act="close"]').catch(() => {}); await p.waitForTimeout(300);
      return { names, rows };
    };
    // owner 22.11: Excel = the screen's sections; the last finished week is the sheet «Keçən həftə»
    let X = await xls();
    check(JSON.stringify(X.names) === JSON.stringify(["Bu həftə", "Keçən həftə", "Bu ay", "Keçən ay", "Pul", "Məhsul"]), "Excel sheets are the sections: " + X.names.join(" | "));
    const kw = X.rows("Keçən həftə"), hd = kw.find((r) => r.includes("WP")), tot = kw.find((r) => r[0] === "Cəmi");
    const at = (n) => tot[hd.indexOf(n)];
    check(hd && tot && at("Masaj") === "2" && at("Hicama") === "1" && at("Ruqya") === "2" && at("Ünvan") === "1" && at("Onlayn") === "2", "Excel: services and places of the week like the screen: " + JSON.stringify([hd, tot]));
    check(kw.some((r) => r[0] === "Asiya" && r[hd.indexOf("Masaj")] === "2"), "Excel: Asiya's row with her 2 Masaj");
    // hide Asiya from the statistics
    await p.click('#tabs [data-tab="readers"]'); await p.click('#top [data-act="set-sec"][data-id="staff"]'); await p.waitForTimeout(300);
    await p.click('[data-act="edit-staff"][data-id="' + A2 + '"]'); await p.locator("#s-hide").check(); await p.click('[data-act="save-staff"]'); await p.waitForTimeout(600);
    check(s.db.staff.find((x) => x.id === A2).hide_stats === true, "saved in the database: hide_stats");
    await p.click('#tabs [data-tab="stats"]'); await p.click('#top [data-act="st-sec"][data-id="week"]'); await p.waitForTimeout(400);
    const sales1 = await table("big-week");
    check(sales1 && !sales1.some((r) => r[0] === "Asiya") && sales1.some((r) => r[0] === "Nurlana"), "Asiya is no longer in the statistics: " + JSON.stringify(sales1));
    X = await xls();
    check(!X.rows("Keçən həftə").some((r) => r[0] === "Asiya"), "nor in Excel");
    // names: the admin's own and another worker's
    await p.click('#tabs [data-tab="readers"]'); await p.click('#top [data-act="set-sec"][data-id="staff"]'); await p.waitForTimeout(300);
    check(await p.locator('[data-act="edit-staff"][data-id="' + OWNER + '"]').count() === 1, "the admin's own row has «Dəyiş»");
    await p.click('[data-act="edit-staff"][data-id="' + OWNER + '"]'); await p.fill("#s-name", "Baş Admin");
    check(await p.locator('#sheet [data-act="st-role"]').count() === 0, "own row: the role is not offered (it stays admin)");
    await p.click('[data-act="save-staff"]'); await p.waitForTimeout(600);
    check(s.db.staff.find((x) => x.id === OWNER).name === "Baş Admin" && s.db.staff.find((x) => x.id === OWNER).role === "admin", "own name changed, role kept");
    await p.click('[data-act="edit-staff"][data-id="' + AGENT + '"]'); await p.fill("#s-name", "Nurlana Q."); await p.click('[data-act="save-staff"]'); await p.waitForTimeout(600);
    check(s.db.staff.find((x) => x.id === AGENT).name === "Nurlana Q.", "another worker's name changed");
    check(/Baş Admin/.test(await p.textContent("#main")) && /Nurlana Q\./.test(await p.textContent("#main")), "the list shows the new names");
    check(!s.errors.length, "no page errors: " + s.errors.join("; "));
  } finally { await s.close(); }
};
