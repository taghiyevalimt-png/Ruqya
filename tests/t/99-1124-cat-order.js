// Owner 24.11 evening: in the product settings the order can be changed, so chosen products stand at the top of
// «Digər məhsullar» in the sale window (the fixed «Əsas məhsullar» keep their order). Checked: ⤒ (to the very top),
// ↑ and ↓; the ends are disabled; only the products whose place changed are saved; the sale window follows; the order
// stays after a reload; a refusal by the server puts the old order back.
const { open, check, OWNER, seed, uuid } = require("../lib");
module.exports = async () => {
  const db = seed(), now = new Date().toISOString();
  const names = ["Ruqyalı su", "Sidr tozu", "İbn Davud Zeyt yağı", "Dr.Taymasova Neurocalm", "Nar suyu", "Aloe-bal məcunu", "İmmunitet məcunu"];
  db.products = names.map((n, i) => ({ id: uuid(), name: n, price: 5 + i, archived: false, sort: i + 1, created_at: now }));
  const id = (n) => db.products.find((x) => x.name === n).id;
  const s = await open(OWNER, { db, viewport: { width: 390, height: 844 } });
  try {
    const p = s.page;
    await p.locator("#tabs:not([hidden])").waitFor({ timeout: 15000 }); await p.waitForTimeout(2500);
    await p.click('#tabs [data-tab="cash"]'); await p.click('[data-act="catalog"]'); await p.waitForTimeout(400);
    const other = () => p.evaluate(() => { const hs = [...document.querySelectorAll("#sheet h3.sec")], h = hs.find((x) => /Digər/.test(x.textContent)); let e = h && h.nextElementSibling; while (e && !e.classList.contains("pay")) e = e.nextElementSibling; return e ? [...e.querySelectorAll(".catrow > span:first-child")].map((x) => x.textContent.trim()) : []; });
    const fixed = await p.evaluate(() => { const h = [...document.querySelectorAll("#sheet h3.sec")].find((x) => /Əsas/.test(x.textContent)); const e = h && h.nextElementSibling; return e ? { n: e.querySelectorAll(".catrow").length, arrows: e.querySelectorAll('[data-act="cat-mv"]').length } : null; });
    check(fixed && fixed.n === 2 && fixed.arrows === 0, "the fixed «Əsas məhsullar» first, without arrows: " + JSON.stringify(fixed));
    check(JSON.stringify(await other()) === JSON.stringify(names.slice(2)), "«Digər məhsullar» in the saved order: " + JSON.stringify(await other()));
    const dis = await p.evaluate((a) => ({ topUp: document.querySelector('[data-act="cat-mv"][data-id="' + a[0] + '"][data-n="-1"]').disabled, lastDown: document.querySelector('[data-act="cat-mv"][data-id="' + a[1] + '"][data-n="1"]').disabled }), [id("İbn Davud Zeyt yağı"), id("İmmunitet məcunu")]);
    check(dis.topUp && dis.lastDown, "the first cannot go up, the last cannot go down");
    s.ctl.log.length = 0;
    await p.click('[data-act="cat-mv"][data-id="' + id("Nar suyu") + '"][data-n="top"]'); await p.waitForTimeout(500);
    check(JSON.stringify(await other()) === JSON.stringify(["Nar suyu", "İbn Davud Zeyt yağı", "Dr.Taymasova Neurocalm", "Aloe-bal məcunu", "İmmunitet məcunu"]), "⤒ puts «Nar suyu» at the very top: " + JSON.stringify(await other()));
    const sorted = () => s.db.products.slice().sort((a, b) => a.sort - b.sort).map((x) => x.name);
    check(JSON.stringify(sorted().slice(2)) === JSON.stringify(await other()), "saved in the database: " + JSON.stringify(sorted()));
    const writes = s.ctl.log.filter((l) => /^POST \/rest\/v1\/products/.test(l));
    check(writes.length === 1, "one request for the move: " + writes.join(" | "));
    await p.click('[data-act="cat-mv"][data-id="' + id("Aloe-bal məcunu") + '"][data-n="-1"]'); await p.waitForTimeout(300);
    await p.click('[data-act="cat-mv"][data-id="' + id("Nar suyu") + '"][data-n="1"]'); await p.waitForTimeout(400);
    const want = ["İbn Davud Zeyt yağı", "Nar suyu", "Aloe-bal məcunu", "Dr.Taymasova Neurocalm", "İmmunitet məcunu"];
    check(JSON.stringify(await other()) === JSON.stringify(want), "↑ and ↓ one place: " + JSON.stringify(await other()));
    // the sale window follows
    await p.click('[data-act="close"]'); await p.waitForTimeout(300); await p.click('[data-act="new-prod"]'); await p.waitForTimeout(400);
    const sale = await p.evaluate(() => [...document.querySelectorAll("#sheet .pgrid")].map((g) => [...g.querySelectorAll(".pbtn b")].map((b) => b.textContent)));
    check(JSON.stringify(sale[1]) === JSON.stringify(want) && sale[0].includes("Ruqyalı su"), "the sale window: «Digər məhsullar» in the admin's order: " + JSON.stringify(sale));
    await p.click('[data-act="close"]'); await p.waitForTimeout(300);
    // after a reload
    await p.reload(); await p.locator("#tabs:not([hidden])").waitFor({ timeout: 15000 }); await p.waitForTimeout(1500);
    await p.click('#tabs [data-tab="cash"]'); await p.click('[data-act="catalog"]'); await p.waitForTimeout(400);
    check(JSON.stringify(await other()) === JSON.stringify(want), "the order stays after a reload");
    // the server refuses: the old order comes back
    s.ctl.failWrite = { status: 403, body: { code: "42501", message: "denied" } };
    await p.click('[data-act="cat-mv"][data-id="' + id("İmmunitet məcunu") + '"][data-n="top"]'); await p.waitForTimeout(900);
    check(JSON.stringify(await other()) === JSON.stringify(want), "a refused move is put back: " + JSON.stringify(await other()));
    check(!s.errors.length, "no page errors: " + s.errors.join(" | "));
  } finally { await s.close(); }
};
