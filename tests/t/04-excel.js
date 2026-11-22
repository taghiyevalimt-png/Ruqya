// Owner 22.11: «in Excel only what the statistics in the app show (except Bu gün): six sheets — Bu həftə, Keçən
// həftə, Bu ay, Keçən ay, Pul, Məhsul — each a proper table with a readable font». F-03 still holds: only the days
// the periods need are loaded, and only the needed columns.
const zlib = require("zlib");
const { open, check, OWNER, seed, bakuToday, uuid, R1, AGENT } = require("../lib");
function unzip(buf) {
  const files = {}; let i = 0;
  while (buf.readUInt32LE(i) === 0x04034b50) {
    const method = buf.readUInt16LE(i + 8), csize = buf.readUInt32LE(i + 18), nlen = buf.readUInt16LE(i + 26), xlen = buf.readUInt16LE(i + 28);
    const name = buf.slice(i + 30, i + 30 + nlen).toString(), data = buf.slice(i + 30 + nlen + xlen, i + 30 + nlen + xlen + csize);
    files[name] = (method === 8 ? zlib.inflateRawSync(data) : data).toString("utf8"); i += 30 + nlen + xlen + csize;
  }
  return files;
}
module.exports = async () => {
  const db = seed(), now = new Date().toISOString();
  db.appts.push({ id: uuid(), reader_id: R1, date: bakuToday(-150), time: "11:00", duration: 60, name: "Köhnə Pasiyent", phone: "050 999 88 77", price: 100, share: 0, status: "wait", note: "", settled: false, service: "Ruqya", confirmed: false, created_by: AGENT, created_at: now, updated_at: now, place: "ofis", follow: 0 });
  db.products = [{ id: "cccccccc-0000-4000-8000-000000000001", name: "Misvak", price: 3, archived: false, sort: 1, created_at: now }];
  const s = await open(OWNER, { db });
  try {
    const p = s.page;
    await p.waitForSelector("text=Test Pasiyent", { timeout: 15000 }); await p.waitForTimeout(3200);
    await p.click('#tabs [data-tab="stats"]'); await p.click('[data-act="st-sec"][data-id="cweek"]'); await p.waitForTimeout(300);
    const screen = await p.evaluate(() => [...document.querySelectorAll('[data-st="big-cweek"] tbody tr')].map((r) => [...r.children].map((c) => c.textContent.trim())));
    s.ctl.log.length = 0;
    await p.click('[data-act="xls"]');
    await p.waitForSelector("a[download]", { timeout: 15000 });
    const q = s.ctl.log.filter((l) => /^GET \/rest\/v1\/appts/.test(l));
    check(q.length && q.every((l) => /date=gte\.|created_at=gte\./.test(l)) && q.every((l) => !/select=\*/.test(l)), "appts asked only from a start date, only the needed columns: " + q.join(" | "));
    const [dl] = await Promise.all([p.waitForEvent("download"), p.click("a[download]")]);
    const x = unzip(require("fs").readFileSync(await dl.path()));
    const names = [...x["xl/workbook.xml"].matchAll(/<sheet name="([^"]+)"/g)].map((m) => m[1]);
    check(JSON.stringify(names) === JSON.stringify(["Bu həftə", "Keçən həftə", "Bu ay", "Keçən ay", "Pul", "Məhsul"]), "six sheets like the sections: " + names.join(" | "));
    const rows = (n) => [...(x["xl/worksheets/sheet" + (names.indexOf(n) + 1) + ".xml"] || "").matchAll(/<row [^>]*>(.*?)<\/row>/g)].map((r) => [...r[1].matchAll(/<c [^>]*?(?:\/>|>(?:<v>([^<]*)<\/v>|<is><t[^>]*>([^<]*)<\/t><\/is>)<\/c>)/g)].map((m) => m[1] !== undefined ? m[1] : m[2] !== undefined ? m[2] : ""));
    const bw = rows("Bu həftə"), all = bw.map((r) => r.join("|")).join("\n");
    check(!/Köhnə Pasiyent/.test(all), "no booking list in the file");
    const nur = bw.find((r) => r[0] === "Nurlana"), sn = screen.find((r) => r[0] === "Nurlana");
    check(nur && sn && nur.length === sn.length && nur.every((v, i) => String(v) === sn[i] || (sn[i] === "—" && v === "—") || (sn[i] === "·" && v === "·")), "Excel row = the screen row: " + JSON.stringify([nur, sn]));
    const pul = rows("Pul").map((r) => r[0]).filter((v) => /—/.test(v));
    check(pul.length === 4, "Pul: the four periods one under another: " + pul.join(" | "));
    check(/Misvak/.test(rows("Məhsul").map((r) => r.join("|")).join("\n")), "Məhsul: the products table");
    const st = x["xl/styles.xml"];
    check(/<sz val="12"\/>/.test(st) && !/<sz val="(8|9|10|11)"\/>/.test(st), "readable font (12)");
    check(/<mergeCell ref=/.test(x["xl/worksheets/sheet1.xml"]), "group headers merged like on the screen");
    check(!s.errors.length, "no page errors: " + s.errors.join("; "));
  } finally { await s.close(); }
};
