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
    const pl = await table("place");
    check(pl && JSON.stringify(pl.slice(1)) === JSON.stringify([["Ofis", "2", "2"], ["Onlayn", "2", "2"], ["Ünvan", "1", "1"], ["Cəmi", "5", "5"]]), "statistics show the places: " + JSON.stringify(pl));
    const sales0 = await table("sales-week");
    check(sales0 && sales0.some((r) => r[0] === "Asiya"), "Asiya is in the sales table before hiding");
    // Excel: services, places, agents × services; the service column of every booking
    const xls = async () => {
      await p.click('[data-act="xls"]'); await p.click('[data-act="xls-per"][data-id="m3"]'); await p.waitForSelector("a[download]", { timeout: 20000 });
      const [dl] = await Promise.all([p.waitForEvent("download"), p.click("a[download]")]);
      const x = unzip(require("fs").readFileSync(await dl.path()));
      const names = [...x["xl/workbook.xml"].matchAll(/name="([^"]+)"/g)].map((m) => m[1]);
      const shared = x["xl/sharedStrings.xml"] ? [...x["xl/sharedStrings.xml"].matchAll(/<t[^>]*>([^<]*)<\/t>/g)].map((m) => m[1]) : [];
      const rows = (n) => { const xml = x["xl/worksheets/sheet" + (names.indexOf(n) + 1) + ".xml"] || ""; return [...xml.matchAll(/<row[^>]*>(.*?)<\/row>/g)].map((r) => [...r[1].matchAll(/<c [^>]*?(?:t="(s|inlineStr|str)")?[^>]*>(?:<v>([^<]*)<\/v>|<is><t[^>]*>([^<]*)<\/t><\/is>)<\/c>/g)].map((m) => (m[1] === "s" ? shared[+m[2]] : m[2] !== undefined ? m[2] : m[3]))); };
      await p.click('[data-act="close"]').catch(() => {}); await p.waitForTimeout(300);
      return { names, rows };
    };
    let X = await xls();
    for (const n of ["Həftəlik — xidmət", "Həftəlik — yer", "Həftəlik — agent×xidmət", "Aylıq — xidmət", "Günlük — xidmət"]) check(X.names.includes(n), "Excel has the sheet «" + n + "»: " + X.names.join(" | "));
    const sv = X.rows("Həftəlik — xidmət").filter((r) => r[1] === "Masaj" || r[1] === "Hicama" || r[1] === "Cəmi").map((r) => r.slice(1));
    check(JSON.stringify(sv) === JSON.stringify([["Hicama", "1", "1"], ["Masaj", "2", "2"], ["Cəmi", "5", "5"]]), "Excel services per week match the screen: " + JSON.stringify(sv));
    const yr = X.rows("Həftəlik — yer").filter((r) => r[1] === "Ünvan" || r[1] === "Cəmi").map((r) => r.slice(1));
    check(JSON.stringify(yr) === JSON.stringify([["Ünvan", "1", "1"], ["Cəmi", "5", "5"]]), "Excel places per week: " + JSON.stringify(yr));
    const ag = X.rows("Həftəlik — agent×xidmət");
    check(ag[0] && ag[0].join("|") === "Dövr|Agent|Ruqya|Hicama|Kombo|Masaj|Dr.Günel|Psixoloq|Cəmi" && ag.some((r) => r[1] === "Asiya" && r[5] === "2" && r[8] === "2"), "Excel agents × services: " + JSON.stringify(ag.slice(0, 3)));
    const all = X.rows("Bütün qəbullar"), hi = all[0].indexOf("Xidmət");
    check(hi > 0 && all.slice(1).map((r) => r[hi]).sort().join(",") === "Hicama,Masaj,Masaj,Ruqya,Ruqya", "«Bütün qəbullar» has each booking's real service: " + all.slice(1).map((r) => r[hi]).join(","));
    // hide Asiya from the statistics
    await p.click('#tabs [data-tab="readers"]'); await p.click('#top [data-act="set-sec"][data-id="staff"]'); await p.waitForTimeout(300);
    await p.click('[data-act="edit-staff"][data-id="' + A2 + '"]'); await p.locator("#s-hide").check(); await p.click('[data-act="save-staff"]'); await p.waitForTimeout(600);
    check(s.db.staff.find((x) => x.id === A2).hide_stats === true, "saved in the database: hide_stats");
    await p.click('#tabs [data-tab="stats"]'); await p.click('#top [data-act="st-sec"][data-id="week"]'); await p.waitForTimeout(400);
    const sales1 = await table("sales-week"), as1 = await table("svc-agents");
    check(sales1 && !sales1.some((r) => r[0] === "Asiya"), "Asiya is no longer in the sales table: " + JSON.stringify(sales1));
    check(as1 && !as1.some((r) => r[0] === "Asiya") && as1.some((r) => r[0] === "Nurlana"), "nor in «Agentlər üzrə xidmətlər»: " + JSON.stringify(as1));
    X = await xls();
    check(!X.rows("Həftəlik — satış").some((r) => r[1] === "Asiya") && !X.rows("Həftəlik — agent×xidmət").some((r) => r[1] === "Asiya"), "nor in Excel");
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
