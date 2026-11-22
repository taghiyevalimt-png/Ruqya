// Owner 22.11: «at the end of every statistics: how many sessions every sales agent / specialist wrote» and «Excel
// fully in sync with the statistics in the app — I type WP 5, Excel has it». The file is made from the screen's
// tables at the moment it is downloaded (and again whenever anything changes while its window is open).
const zlib = require("zlib");
const { open, check, OWNER, AGENT, SPEC, seed, R1, bakuToday, uuid } = require("../lib");
function unzip(buf) { const files = {}; let i = 0; while (buf.readUInt32LE(i) === 0x04034b50) { const method = buf.readUInt16LE(i + 8), csize = buf.readUInt32LE(i + 18), nlen = buf.readUInt16LE(i + 26), xlen = buf.readUInt16LE(i + 28);
  const name = buf.slice(i + 30, i + 30 + nlen).toString(), data = buf.slice(i + 30 + nlen + xlen, i + 30 + nlen + xlen + csize); files[name] = (method === 8 ? zlib.inflateRawSync(data) : data).toString("utf8"); i += 30 + nlen + xlen + csize; } return files; }
module.exports = async () => {
  const db = seed(), now = new Date().toISOString(), t = bakuToday();
  db.appts.push({ id: uuid(), reader_id: R1, date: t, time: "21:00", duration: 30, name: "Özü yazıb", phone: "050", price: 100, share: 0, status: "wait", note: "", settled: false, service: "Ruqya", confirmed: false, place: "ofis", follow: 0, created_by: SPEC, created_at: now, updated_at: now });
  const s = await open(OWNER, { db });
  try {
    const p = s.page; await p.locator("#tabs:not([hidden])").waitFor({ timeout: 15000 }); await p.waitForTimeout(2500);
    await p.click('#tabs [data-tab="stats"]'); await p.click('#top [data-act="st-sec"][data-id="cweek"]'); await p.waitForTimeout(300);
    const sess = await p.evaluate(() => [...document.querySelectorAll('[data-st="sess-cweek"] tbody tr')].map((r) => [...r.children].map((c) => c.textContent.trim()).join("|")));
    check(sess.includes("Nurlana|Satış agenti|1") && sess.includes("Əli|Mütəxəssis|1") && sess.some((r) => /^Admin\|Admin\|0/.test(r)), "every agent and specialist with his sessions at the end: " + JSON.stringify(sess));
    for (const sec of ["today", "week", "money", "prod"]) { await p.click('#top [data-act="st-sec"][data-id="' + sec + '"]'); await p.waitForTimeout(200); check(await p.locator('[data-st^="sess-"]').count() === 1, sec + ": the sessions table at the end"); }
    // type WP 5 for Nurlana this week
    await p.click('#top [data-act="st-sec"][data-id="cweek"]'); await p.waitForTimeout(200);
    await p.click('[data-st="big-cweek"] [data-act="st-edit"][data-id="' + AGENT + '"][data-col="w"]'); await p.locator("#se-v").waitFor();
    await p.fill("#se-v", "5"); await p.click('[data-act="st-edit-save"]'); await p.waitForTimeout(500);
    await p.click('[data-act="xls"]'); await p.waitForSelector("a[download]", { timeout: 15000 });
    const [dl] = await Promise.all([p.waitForEvent("download"), p.click("a[download]")]);
    const x = unzip(require("fs").readFileSync(await dl.path())), names = [...x["xl/workbook.xml"].matchAll(/<sheet name="([^"]+)"/g)].map((m) => m[1]);
    const rows = (n) => [...(x["xl/worksheets/sheet" + (names.indexOf(n) + 1) + ".xml"] || "").matchAll(/<row [^>]*>(.*?)<\/row>/g)].map((r) => [...r[1].matchAll(/<c [^>]*?(?:\/>|>(?:<v>([^<]*)<\/v>|<is><t[^>]*>([^<]*)<\/t><\/is>)<\/c>)/g)].map((m) => m[1] !== undefined ? m[1] : m[2] !== undefined ? m[2] : ""));
    const bw = rows("Bu həftə"), nur = bw.find((r) => r[0] === "Nurlana");
    check(nur && nur[1] === "5", "the typed WP 5 is in Excel: " + JSON.stringify(nur));
    check(bw.some((r) => r[0] === "Kim neçə seans yazıb") && bw.some((r) => r[0] === "Əli" && r[1] === "Mütəxəssis" && r[2] === "1"), "the sessions table is in Excel too");
    check(!s.errors.length, "no page errors: " + s.errors.join("; "));
  } finally { await s.close(); }
};
