// B-01 (acceptance reviewer H-1): in the weekly/monthly Excel sheets a booking written earlier in the same period
// for a later day of that period must be counted once (Yazdı, Uğurlu, Qazanc), the same as on the screen.
const zlib = require("zlib");
const { open, check, OWNER, AGENT, seed, uuid, R1 } = require("../lib");
function unzip(buf) {   // tiny reader for the app's own xlsx (stored or deflated entries with sizes in the local header)
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
  // a past Friday–Thursday week: booking written on its Saturday for its Monday (both inside the week), 130 ₼
  const d = new Date(Date.now() + 4 * 3600e3); const back = ((d.getUTCDay() - 5 + 7) % 7) + 7;   // the Friday of last week
  const fri = -back, written = baku(fri + 1), day = baku(fri + 3);
  const db = seed(); db.appts = [{ id: uuid(), reader_id: R1, date: day, time: "10:00", duration: 60, name: "Bir dəfə", phone: "050 123 45 67", price: 130, share: 0, status: "wait", note: "", settled: false, service: "Ruqya", confirmed: false, place: "ofis", follow: 0, created_by: AGENT, created_at: written + "T08:00:00Z", updated_at: written + "T08:00:00Z" }];
  const s = await open(OWNER, { db });
  try {
    const p = s.page; await p.waitForSelector("#tabs:not([hidden])"); await p.waitForTimeout(3300);
    await p.click('#tabs [data-tab="stats"]'); await p.waitForTimeout(400);
    await p.click('[data-act="xls"]'); await p.click('[data-act="xls-per"][data-id="m3"]'); await p.waitForSelector("a[download]", { timeout: 20000 });
    const [dl] = await Promise.all([p.waitForEvent("download"), p.click("a[download]")]);
    const x = unzip(require("fs").readFileSync(await dl.path()));
    const wb = x["xl/workbook.xml"], names = [...wb.matchAll(/name="([^"]+)"/g)].map((m) => m[1]);
    const shared = x["xl/sharedStrings.xml"] ? [...x["xl/sharedStrings.xml"].matchAll(/<t[^>]*>([^<]*)<\/t>/g)].map((m) => m[1]) : [];
    const sheet = (n) => x["xl/worksheets/sheet" + (names.indexOf(n) + 1) + ".xml"] || "";
    const cells = (xml) => [...xml.matchAll(/<c [^>]*?(t="(s|inlineStr|str)")?[^>]*>(?:<v>([^<]*)<\/v>|<is><t[^>]*>([^<]*)<\/t><\/is>)<\/c>/g)].map((m) => (m[2] === "s" ? shared[+m[3]] : m[3] !== undefined ? m[3] : m[4]));
    const money = cells(sheet("Həftəlik — pul")), sales = cells(sheet("Həftəlik — satış"));
    const nums = (arr) => arr.filter((v) => /^\d+(\.\d+)?$/.test(v)).map(Number);
    check(!nums(money).includes(260), "weekly money sheet: 130 ₼ booking counted once, not 260: " + money.join(" | "));
    check(nums(money).includes(130), "weekly money sheet shows 130: " + money.join(" | "));
    check(!nums(sales).some((n) => n === 2), "weekly sales sheet: written once, successful once (no 2): " + sales.join(" | "));
    check(!s.errors.length, "no page errors: " + s.errors.join("; "));
  } finally { await s.close(); }
};
