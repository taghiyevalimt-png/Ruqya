// Owner 22.11: «Pul» shows how much every specialist earned from every service, and the admin writes a percent per
// specialist and service («İlkin: Ruqya 50%») — «Pul» then shows what stays with the specialist. «Məhsul» is one table.
// The app and Excel are the same tables.
const zlib = require("zlib");
const { open, check, OWNER, AGENT, SPEC, seed, R1, R2, bakuToday, uuid } = require("../lib");
function unzip(buf) { const files = {}; let i = 0; while (buf.readUInt32LE(i) === 0x04034b50) { const method = buf.readUInt16LE(i + 8), csize = buf.readUInt32LE(i + 18), nlen = buf.readUInt16LE(i + 26), xlen = buf.readUInt16LE(i + 28);
  const name = buf.slice(i + 30, i + 30 + nlen).toString(), data = buf.slice(i + 30 + nlen + xlen, i + 30 + nlen + xlen + csize); files[name] = (method === 8 ? zlib.inflateRawSync(data) : data).toString("utf8"); i += 30 + nlen + xlen + csize; } return files; }
module.exports = async () => {
  const db = seed(), now = new Date().toISOString(), t = bakuToday();
  const mk = (rid, svc, price) => ({ id: uuid(), reader_id: rid, date: t, time: "08:00", duration: 30, name: "P", phone: "050", price, share: 0, status: "wait", note: "", settled: false, service: svc, confirmed: false, place: "ofis", follow: 0, created_by: AGENT, created_at: now, updated_at: now });
  db.appts = [mk(R2, "Ruqya", 100), mk(R2, "Hicama", 60), mk(R1, "Ruqya", 130)];
  const PID = "cccccccc-0000-4000-8000-000000000001";
  db.products = [{ id: PID, name: "Misvak", price: 3, archived: false, sort: 1, created_at: now }, { id: "cccccccc-0000-4000-8000-000000000002", name: "Bal", price: 10, archived: false, sort: 2, created_at: now }];
  db.product_sales = [{ id: uuid(), date: t, product_id: PID, qty: 2, price: 3, amount: 6, names: "Misvak", created_by: SPEC, created_at: now }];
  const s = await open(OWNER, { db, clock: new Date(t + "T20:00:00Z") });   // late evening: the sessions are over (successful)
  try {
    const p = s.page; await p.locator("#tabs:not([hidden])").waitFor({ timeout: 15000 }); await p.waitForTimeout(2500);
    await p.click('#tabs [data-tab="stats"]'); await p.click('#top [data-act="st-sec"][data-id="money"]'); await p.click('[data-act="st-per"][data-id="cweek"]'); await p.waitForTimeout(300);
    await p.click('[data-act="svc-pct"]'); await p.locator('#sheet input[data-sp-r]').first().waitFor();
    await p.fill('#sheet input[data-sp-r="' + R2 + '"][data-sp-s="Ruqya"]', "50"); await p.fill('#sheet input[data-sp-r="' + R2 + '"][data-sp-s="Hicama"]', "30");
    await p.click('[data-act="svc-pct-save"]'); await p.waitForTimeout(500);
    check(s.db.service_shares.map((x) => x.service + "=" + x.pct).sort().join(",") === "Hicama=30,Ruqya=50", "saved İlkin Ruqya 50%, Hicama 30%: " + JSON.stringify(s.db.service_shares));
    const tb = await p.evaluate(() => { const t = document.querySelector('[data-st="money-cweek"] table'), h = [...t.querySelectorAll("th.v span")].map((x) => x.textContent.trim());
      const row = [...t.querySelectorAll("tbody tr")].find((r) => r.children[0].textContent.trim() === "İlkin"); return { h, r: [...row.children].slice(1).map((c) => c.textContent.replace(/\s+/g, " ").trim()) }; });
    const at = (n) => tb.r[tb.h.indexOf(n)];
    check(/^100/.test(at("Ruqya")) && /^60/.test(at("Hicama")) && /^160/.test(at("Qazanc")), "İlkin earned 100 from Ruqya, 60 from Hicama: " + JSON.stringify(tb));
    check(/^68/.test(at("Mütəxəssisə")) && /^92/.test(at("Mərkəzə")), "50% of 100 + 30% of 60 = 68 for İlkin, 92 for the centre: " + JSON.stringify(tb));
    check(tb.h.includes("Kombo") && tb.h.includes("Psixoloq"), "every service is a column");
    // owner 22.11: a fixed amount instead of a percent — Hicama: 20 ₼ for every successful session
    await p.click('[data-act="svc-pct"]'); await p.locator('#sheet input[data-sp-r]').first().waitFor();
    const hi = '#sheet input[data-sp-r="' + R2 + '"][data-sp-s="Hicama"]';
    await p.fill(hi, "20"); await p.locator(hi).locator("xpath=following-sibling::select").selectOption("a");
    await p.click('[data-act="svc-pct-save"]'); await p.waitForTimeout(500);
    const hs = s.db.service_shares.find((x) => x.service === "Hicama");
    check(hs && hs.amt === 20 && hs.pct == null, "saved Hicama as 20 ₼, not a percent: " + JSON.stringify(hs));
    const tb2 = await p.evaluate(() => { const t = document.querySelector('[data-st="money-cweek"] table'), h = [...t.querySelectorAll("th.v span")].map((x) => x.textContent.trim());
      const row = [...t.querySelectorAll("tbody tr")].find((r) => r.children[0].textContent.trim() === "İlkin"); return { h, r: [...row.children].slice(1).map((c) => c.textContent.replace(/\s+/g, " ").trim()) }; });
    check(/^70/.test(tb2.r[tb2.h.indexOf("Mütəxəssisə")]) && /20/.test(tb2.r[tb2.h.indexOf("Hicama")].replace(/^60/, "")), "50% of 100 + 20 ₼ = 70 for İlkin: " + JSON.stringify(tb2));
    await p.click('[data-act="st-sec"][data-id="prod"]'); await p.waitForTimeout(300);
    check(await p.locator('[data-st^="prod-"] table').count() === 1 && !/Satanlar üzrə|Məhsullar üzrə/.test(await p.textContent("#main")), "«Məhsul»: one table");
    const ph = await p.evaluate(() => [...document.querySelectorAll('[data-st^="prod-"] th.v span')].map((x) => x.textContent.trim()));
    check(ph.includes("Misvak") && ph.includes("Bal"), "products are columns: " + ph);
    // Excel: the same tables
    await p.click('[data-act="xls"]'); await p.waitForSelector("a[download]", { timeout: 15000 });
    const [dl] = await Promise.all([p.waitForEvent("download"), p.click("a[download]")]);
    const x = unzip(require("fs").readFileSync(await dl.path())), names = [...x["xl/workbook.xml"].matchAll(/<sheet name="([^"]+)"/g)].map((m) => m[1]);
    const rows = (n) => [...(x["xl/worksheets/sheet" + (names.indexOf(n) + 1) + ".xml"] || "").matchAll(/<row [^>]*>(.*?)<\/row>/g)].map((r) => [...r[1].matchAll(/<c [^>]*?(?:\/>|>(?:<v>([^<]*)<\/v>|<is><t[^>]*>([^<]*)<\/t><\/is>)<\/c>)/g)].map((m) => m[1] !== undefined ? m[1] : m[2] !== undefined ? m[2] : ""));
    const pul = rows("Pul"), il = pul.find((r) => r[0] === "İlkin");
    check(il && il.includes("70") && il.includes("90") && il.includes("100") && il.includes("60"), "Excel «Pul» has the services and the parts: " + JSON.stringify(il));
    const mh = rows("Məhsul");
    check(mh.some((r) => r[0] === "Əli" && r.includes("2")) && !mh.some((r) => /Satanlar üzrə/.test(r[0])), "Excel «Məhsul» is the one table");
    // copy copies the table as shown
    await p.click('[data-act="close"]'); await p.click('[data-act="st-sec"][data-id="money"]'); await p.waitForTimeout(200);
    check(!s.errors.length, "no page errors: " + s.errors.join("; "));
  } finally { await s.close(); }
};
