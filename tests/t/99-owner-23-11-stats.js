// Owner 23.11: «Məhsul satışları statistikasını iki yerə böl … pul statistikasından xidmətləri sil … pul və məhsul
// statistikasına "bu gün" əlavə et, hansı ki ancaq tətbiqdə görsənəcək … "bu gün" statistikalarında dünənə də baxmaq olsun …
// exceldə görsənməyəcək». Synthetic data only.
const zlib = require("zlib");
const { open, check, OWNER, AGENT, SPEC, seed, bakuToday, uuid } = require("../lib");
function unzip(buf) { const files = {}; let i = 0; while (buf.readUInt32LE(i) === 0x04034b50) { const method = buf.readUInt16LE(i + 8), csize = buf.readUInt32LE(i + 18), nlen = buf.readUInt16LE(i + 26), xlen = buf.readUInt16LE(i + 28);
  const name = buf.slice(i + 30, i + 30 + nlen).toString(), data = buf.slice(i + 30 + nlen + xlen, i + 30 + nlen + xlen + csize); files[name] = (method === 8 ? zlib.inflateRawSync(data) : data).toString("utf8"); i += 30 + nlen + xlen + csize; } return files; }
function dayBefore(d) { const x = new Date(d + "T12:00:00Z"); x.setUTCDate(x.getUTCDate() - 1); return x.toISOString().slice(0, 10); }
module.exports = async () => {
  const db = seed(), t = bakuToday(), y = dayBefore(t), now = new Date().toISOString(), PID = "cccccccc-0000-4000-8000-000000000019";
  db.products = [{ id: PID, name: "Misvak", price: 5, archived: false, sort: 1, created_at: now }];
  db.product_sales = [
    { id: uuid(), date: t, product_id: PID, qty: 1, price: 5, amount: 5, names: "Misvak", created_by: SPEC, created_at: now },
    { id: uuid(), date: y, product_id: PID, qty: 3, price: 5, amount: 15, names: "Misvak", created_by: AGENT, created_at: now },
  ];
  const s = await open(OWNER, { db });
  try {
    const p = s.page; await p.locator("#tabs:not([hidden])").waitFor({ timeout: 15000 }); await p.waitForTimeout(2500);
    await p.click('#tabs [data-tab="stats"]');
    const txt = (sel) => p.evaluate((q) => { const e = document.querySelector(q); return e ? e.textContent.replace(/\s+/g, " ").trim() : ""; }, sel);
    // Məhsul → Bu gün
    await p.click('#top [data-act="st-sec"][data-id="prod"]'); await p.waitForTimeout(200);
    const chips = await p.evaluate(() => [...document.querySelectorAll('[data-act="st-per"]')].map((b) => b.dataset.id));
    check(chips.length === 5 && chips[0] === "today", "Məhsul: «Bu gün» is the first period: " + chips);
    await p.click('[data-act="st-per"][data-id="today"]'); await p.waitForTimeout(200);
    const hd = await p.evaluate(() => [...document.querySelectorAll('[data-st^="prod-"] thead th')].map((x) => x.textContent.trim()).filter(Boolean));
    check(hd.join("|") === "Satan|Satış|Məbləğ|Payı" || hd.join("|") === "Satan|Satış|Məbləğ", "first table has only Satış, Məbləğ, Payı: " + hd);
    check(/Bugün/.test(await txt("#main .sthead")) && /Əli15 ₼/.test(await txt('[data-st^="prod-"]')) && /Nurlana00 ₼/.test(await txt('[data-st^="prod-"]')), "today: only today's sale: " + await txt("#main .sthead") + " / " + await txt('[data-st^="prod-"]'));
    check(/Məhsullar üzrə/.test(await txt('[data-st^="prodp-"]')) && /Misvak/.test(await txt('[data-st^="prodp-"]')), "second table: per product");
    // owner 24.11: «Məhsullar üzrə» — only the pieces, no sum
    check((await p.evaluate(() => [...document.querySelectorAll('[data-st^="prodp-"] thead th')].map((x) => x.textContent.trim()).join("|"))) === "Məhsul|Ədəd" && !/₼/.test(await txt('[data-st^="prodp-"] table')), "«Məhsullar üzrə»: Məhsul and Ədəd only");
    const back = '#main .sthead [data-act="st-tday"][data-n="-1"]', fwd = '#main .sthead [data-act="st-tday"][data-n="1"]';
    check(await p.locator(fwd).isDisabled(), "no going past today");
    await p.click(back); await p.waitForTimeout(200);
    check(/Dünən/.test(await txt("#main .sthead")) && /Nurlana315 ₼/.test(await txt('[data-st^="prod-"]')) && /Əli00 ₼/.test(await txt('[data-st^="prod-"]')), "‹ shows yesterday's sales");
    check(await p.locator(back).isDisabled(), "no going further back than yesterday");
    // (the «Pul» section is gone since 23.11 late evening) › goes back to today
    await p.click(fwd); await p.waitForTimeout(200);
    check(/Bugün/.test(await txt("#main .sthead")) && await p.locator(fwd).isDisabled(), "› back to today");
    // main «Bu gün» section can go to yesterday too
    await p.click('#top [data-act="st-sec"][data-id="today"]'); await p.waitForTimeout(200);
    await p.click(back); await p.waitForTimeout(200);
    check(/Dünən/.test(await txt("#main .sthead")), "main «Bu gün»: ‹ shows yesterday");
    await p.click(fwd); await p.waitForTimeout(200);
    // Excel: no «Bu gün», Məhsul has both titled tables
    await p.click('#top [data-act="st-sec"][data-id="prod"]'); await p.waitForTimeout(200);
    await p.click('[data-act="xls"]'); await p.waitForSelector("a[download]", { timeout: 15000 });
    const [dl] = await Promise.all([p.waitForEvent("download"), p.click("a[download]")]);
    const x = unzip(require("fs").readFileSync(await dl.path())), all = Object.keys(x).filter((k) => /^xl\/(worksheets|sharedStrings|workbook)/.test(k)).map((k) => x[k]).join("");
    check(!/Bugün|Dünən/.test(all), "Excel has no «Bu gün» / «Dünən»");
    check(/Məhsullar üzrə/.test(all) && /Məhsul satışları/.test(all), "Excel «Məhsul»: both tables with their titles");
    check(!s.errors.length, "no page errors: " + s.errors.join("; "));
  } finally { await s.close(); }
};
