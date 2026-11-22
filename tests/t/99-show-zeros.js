// Owner 22.11 (second note): «show it even without that» — a specialist has Kassa even before the admin added any
// product; statistics show every service (and every worker, every product) also with zero.
const { open, check, OWNER, SPEC, seed } = require("../lib");
module.exports = async () => {
  const db = seed();
  let s = await open(SPEC, { db });
  try {
    const p = s.page; await p.locator("#tabs:not([hidden])").waitFor({ timeout: 15000 }); await p.waitForTimeout(3000);
    check(await p.locator('#tabs [data-tab="cash"]:not([hidden])').count() === 1, "the specialist has Kassa with an empty product list");
    await p.click('#tabs [data-tab="cash"]'); await p.click('[data-act="new-prod"]'); await p.waitForTimeout(300);
    check(/Admin məhsulları əlavə etməlidir/.test(await p.textContent("#sheet")), "the sale window says the admin has to add products");
    check(!s.errors.length, "specialist: no page errors: " + s.errors.join("; "));
  } finally { await s.close(); }
  db.products = [{ id: "cccccccc-0000-4000-8000-000000000001", name: "Misvak", price: 3, archived: false, sort: 1, created_at: "2026-11-01T00:00:00Z" }];
  s = await open(OWNER, { db });
  try {
    const p = s.page; await p.locator("#tabs:not([hidden])").waitFor({ timeout: 15000 }); await p.waitForTimeout(3000);
    await p.click('#tabs [data-tab="stats"]'); await p.click('#top [data-act="st-sec"][data-id="month"]'); await p.waitForTimeout(400);
    const h = await p.evaluate(() => [...document.querySelectorAll('[data-st^="big-"] th.v span')].map((x) => x.textContent.trim()));
    check(["Ruqya", "Hicama", "Kombo", "Masaj", "Dr.Günel", "Psixoloq", "Ofis", "Onlayn", "Ünvan"].every((x) => h.includes(x)), "every service and place even in a month with nothing: " + h);
    const rows = await p.evaluate(() => [...document.querySelectorAll('[data-st^="big-"] tbody tr td:first-child')].map((x) => x.textContent.trim()));
    check(rows.includes("Nurlana") && rows.includes("Əli") && rows.includes("Admin"), "every worker is a row: " + rows);
    await p.click('#top [data-act="st-sec"][data-id="prod"]'); await p.waitForTimeout(300);
    check(/Misvak/.test(await p.textContent("#main")), "a product with no sale is listed with 0");
    check(!s.errors.length, "admin: no page errors: " + s.errors.join("; "));
  } finally { await s.close(); }
};
