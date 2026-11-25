// Owner 25.11: «В pdf пусть будет всё то же самое, что бывает в excel. Абсолютно то же самое и схема работы то же самое».
// The PDF is made from the very sheets of the Excel file (xlsFetch → xlsSheets): every sheet starts a page, every
// title, header and number of the Excel file is drawn, in the same order; the window says the same things, the file
// is named like the Excel one, and it is made again when the statistics change while the window is open.
const zlib = require("zlib");
function unzip(buf) {   // the app's own xlsx: stored or deflated entries with sizes in the local header
  const files = {}; let i = 0;
  while (buf.readUInt32LE(i) === 0x04034b50) { const method = buf.readUInt16LE(i + 8), csize = buf.readUInt32LE(i + 18), nlen = buf.readUInt16LE(i + 26), xlen = buf.readUInt16LE(i + 28);
    const name = buf.slice(i + 30, i + 30 + nlen).toString("utf8"), data = buf.slice(i + 30 + nlen + xlen, i + 30 + nlen + xlen + csize);
    files[name] = (method === 8 ? zlib.inflateRawSync(data) : data).toString("utf8"); i += 30 + nlen + xlen + csize; }
  return files;
}
const unx = (t) => t.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&amp;/g, "&");
const { open, check, OWNER, seed, R1, R2, AGENT, bakuToday, uuid } = require("../lib");
module.exports = async () => {
  const t = bakuToday(), db = seed();
  const add = (date, rid, name, st) => db.appts.push({ id: uuid(), reader_id: rid, date, time: "10:00", duration: 60, name, phone: "050 200 00 0" + db.appts.length, price: 0, share: 0, status: st || "wait", note: "", settled: false, service: "Ruqya", confirmed: false, place: "ofis", follow: 0, created_by: AGENT, created_at: date + "T06:00:00Z", updated_at: date + "T06:00:00Z" });
  for (let i = 1; i <= 9; i++) { const d = new Date(Date.now() - i * 864e5).toISOString().slice(0, 10); add(d, i % 2 ? R1 : R2, "Pasiyent " + i, i === 4 ? "cancel" : "wait"); }
  db.products = [{ id: uuid(), name: "Ruqyalı su", price: 5, archived: false, sort: 1, created_at: t + "T06:00:00Z" }];
  db.product_sales = [{ id: uuid(), date: t, amount: 15, qty: 3, price: 5, names: "Ruqyalı su", product_id: db.products[0].id, created_by: AGENT, created_at: t + "T06:00:00Z" }];
  const s = await open(OWNER, { db, viewport: { width: 390, height: 844 } });
  try {
    const p = s.page;
    await p.locator("#tabs:not([hidden])").waitFor({ timeout: 15000 }); await p.waitForTimeout(2000);
    await p.click('#tabs [data-tab="stats"]'); await p.waitForTimeout(800);
    // what the PDF draws = the Excel sheets: catch every text drawn on the pages
    await p.evaluate(() => { window.__drawn = []; const f = CanvasRenderingContext2D.prototype.fillText; CanvasRenderingContext2D.prototype.fillText = function (tx) { if (this.canvas.width > this.canvas.height) window.__drawn.push([this.canvas, String(tx)]); return f.apply(this, arguments); }; });
    await p.click('[data-act="xls"]'); await p.locator('#sheet a.primary[download$=".xlsx"]').waitFor({ timeout: 20000 });
    const xlsText = await p.$eval("#sheet", (x) => x.innerText);
    const [xd] = await Promise.all([p.waitForEvent("download"), p.click('#sheet a.primary[download$=".xlsx"]')]);
    const XF = unzip(require("fs").readFileSync(await xd.path()));
    const names = [...XF["xl/workbook.xml"].matchAll(/<sheet name="([^"]*)"/g)].map((m) => unx(m[1]));
    const X = names.map((name, i) => ({ name, cells: [...XF["xl/worksheets/sheet" + (i + 1) + ".xml"].matchAll(/<c r="[A-Z]+\d+"(?: t="inlineStr")? s="(\d+)"(?:\/>|>(?:<v>([^<]*)<\/v>|<is><t xml:space="preserve">([^<]*)<\/t><\/is>)<\/c>)/g)]
      .filter((m) => m[2] != null || m[3] != null).map((m) => ({ s: +m[1], v: m[2] != null ? m[2] : unx(m[3]) })) }));
    await p.click('#sheet [data-act="close"]'); await p.waitForTimeout(400);
    await p.evaluate(() => { window.__drawn = []; });
    await p.click('[data-act="pdf"]'); await p.locator('#sheet a.primary[download$=".pdf"]').waitFor({ timeout: 30000 });
    const pdfText = await p.$eval("#sheet", (x) => x.innerText);
    const D = await p.evaluate(() => { const cvs = []; window.__drawn.forEach((d) => { if (cvs.indexOf(d[0]) < 0) cvs.push(d[0]); }); return { pages: cvs.length, list: window.__drawn.map((d) => [cvs.indexOf(d[0]), d[1]]) }; });
    // the sheets come in the same order, each from a new page, every cell drawn in order (a long cell may be cut with …)
    check(X.length === 5 && X.map((x) => x.name).join(",") === "Bu həftə,Keçən həftə,Bu ay,Keçən ay,Məhsul", "Excel sheets: " + X.map((x) => x.name));
    const drawn = D.list.filter((d) => !/^\d+ \/ \d+$/.test(d[1]));   // page numbers aside
    let k = 0, page = -1;
    for (const sh of X) {
      check(drawn[k] && drawn[k][0] > page, "sheet «" + sh.name + "» starts a new page: " + JSON.stringify(drawn[k]));
      for (const c of sh.cells) {
        const d = drawn[k++], money = c.s === 8 || c.s === 9, num = (x) => +String(x).replace(/[^\d,.-]/g, "").replace(/\.(?=\d{3}\b)/g, "").replace(",", ".");
        const ok = d && (money ? num(d[1]) === +c.v && /₼/.test(d[1]) : d[1] === c.v || (d[1].endsWith("…") && c.v.startsWith(d[1].slice(0, -1))));
        check(ok, "sheet «" + sh.name + "»: Excel has «" + c.v + "», the PDF drew «" + (d && d[1]) + "»");
        page = d[0];
      }
    }
    check(k === drawn.length, "nothing more than the Excel file: " + JSON.stringify(drawn.slice(k, k + 5)));
    check(/Ruqyalı su/.test(drawn.map((d) => d[1]).join("|")), "the products sheet is there");
    // the same window
    const same = (x) => x.replace(/^(Excel|PDF)/, "").replace(/(\d+) (vərəq|səhifə)/, "N").replace(/«Fayllar» və ya Excel ilə/, "«Fayllar» ilə");
    check(same(xlsText) === same(pdfText), "the window says the same:\nXLS " + xlsText + "\nPDF " + pdfText);
    check(new RegExp("Fayl hazırdır: " + D.pages + " səhifə, \\d+ qəbul").test(pdfText), "pages counted: " + pdfText);
    const [dl] = await Promise.all([p.waitForEvent("download"), p.click('#sheet a.primary[download$=".pdf"]')]);
    check(dl.suggestedFilename() === "Merkez-statistika-" + t + ".pdf", "named like the Excel file: " + dl.suggestedFilename());
    const buf = require("fs").readFileSync(await dl.path()), all = buf.toString("latin1");
    check(all.startsWith("%PDF-1.4") && /\/MediaBox \[0 0 841\.89 595\.28\]/.test(all) && (all.match(/\/Type \/Page\b/g) || []).length === D.pages, "landscape A4 pages, as Excel prints");
    // made again when the statistics change while the window is open
    const url0 = await p.getAttribute('#sheet a.primary[download$=".pdf"]', "href");
    add(t, R1, "Yeni Biri"); await p.evaluate(() => window.dispatchEvent(new Event("online")));   // a booking written on another phone; the app reloads
    await p.waitForFunction((u) => { const a = document.querySelector('#sheet a.primary[download$=".pdf"]'); return a && a.getAttribute("href") !== u; }, url0, { timeout: 15000 });
    check(!s.errors.length, "no page errors: " + s.errors.join(" | "));
  } finally { await s.close(); }
};
