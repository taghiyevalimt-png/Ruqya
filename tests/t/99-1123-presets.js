// 23.11: (1) the length of a new booking comes from the database (app_settings, row «presets»), and the admin changes
// it in Ayarlar → «Yeni qəbul: müddət»; an agent has no such button. Empty = nothing put in. Since 23.11 late evening
// there are no prices (old price values in the row are ignored).
// (2) a load no longer asks twelve «is this column there?» questions — each read up to 1000 rows of one column
// (…?select=<column>&limit=1000&offset=0); 23 requests per load became 12.
// (3) a new catalog product whose answer was lost is the same row when «Əlavə et» is pressed again (A5-08).
const { open, check, AGENT, OWNER, seed, R1, R2 } = require("../lib");
module.exports = async () => {
  const db = seed(), now = new Date().toISOString();
  db.app_settings = [{ id: "presets", value: { price: 111, svc: { Masaj: [45, 70], Hicama: [null, 35] }, reader: { [R2]: [120, 200] } }, updated_at: now }];
  let s = await open(AGENT, { db, viewport: { width: 390, height: 844 } });
  try {
    const p = s.page; await p.locator("#tabs:not([hidden])").waitFor({ timeout: 15000 }); await p.waitForTimeout(3300);
    const probes = s.ctl.log.filter((x) => /^GET \/rest\/v1\/\w+\?select=[a-z_]+(%2C[a-z_]+)?&limit=1000&offset=0$/.test(x));
    check(!probes.length, "no column probes at load: " + probes.join(" | "));
    check(s.ctl.log.some((x) => /app_settings/.test(x)), "the presets row is read");
    await p.click('#tabs [data-tab="day"]'); await p.click("#fab"); await p.locator("#f-reader").waitFor();
    const vals = () => p.evaluate(() => ({ dur: document.getElementById("f-dur").value, price: !!document.getElementById("f-price") }));
    let v = await vals(); check(v.price === false && v.dur === "90", "a new booking: no price, 1 h 30 min: " + JSON.stringify(v));
    await p.selectOption("#f-reader", R1); await p.waitForTimeout(150);
    v = await vals(); check(v.dur === "90", "Əli has no preset: nothing changes: " + JSON.stringify(v));
    await p.click('label:has(input[name="f-service"][value="Masaj"])'); await p.waitForTimeout(150);
    v = await vals(); check(v.dur === "45", "Masaj from the database: 45 min: " + JSON.stringify(v));
    await p.click('label:has(input[name="f-service"][value="Hicama"])'); await p.waitForTimeout(150);
    v = await vals(); check(v.dur === "45", "Hicama has only an old price: the length stays: " + JSON.stringify(v));
    await p.click('label:has(input[name="f-service"][value="Kombo"])'); await p.waitForTimeout(150);
    v = await vals(); check(v.dur === "45", "Kombo is not in the database row: " + JSON.stringify(v));
    await p.selectOption("#f-reader", R2); await p.waitForTimeout(150);
    v = await vals(); check(v.dur === "120", "İlkin from the database: 2 h: " + JSON.stringify(v));
    await p.click('[data-act="close"]'); await p.waitForTimeout(300);
    if (await p.locator('[data-act="draft-drop"]').count()) await p.click('[data-act="draft-drop"]');
    await p.click('#tabs [data-tab="readers"]'); await p.waitForTimeout(300);
    check(!(await p.locator('[data-act="presets"]').count()), "an agent has no presets button");
    check(!s.errors.length, "no page errors (agent): " + s.errors.join("; "));
  } finally { await s.close(); }

  s = await open(OWNER, { db, viewport: { width: 390, height: 844 } });
  try {
    const p = s.page; await p.locator("#tabs:not([hidden])").waitFor({ timeout: 15000 }); await p.waitForTimeout(3000);
    await p.click('#tabs [data-tab="readers"]'); await p.click('[data-act="set-sec"][data-id="spec"]').catch(() => {});
    await p.click('[data-act="presets"]'); await p.locator('[data-act="ps-save"]').waitFor();
    check(!(await p.locator('#ps-price, [data-f="p"]').count()), "no prices in the window");
    check(await p.inputValue('[data-ps="svc"][data-k="Masaj"][data-f="d"]') === "45", "the window shows Masaj's length");
    await p.selectOption('[data-ps="svc"][data-k="Masaj"][data-f="d"]', "");
    await p.selectOption('[data-ps="svc"][data-k="Kombo"][data-f="d"]', "60");
    await p.click('[data-act="ps-save"]'); await p.waitForTimeout(800);
    const row = s.db.app_settings.find((x) => x.id === "presets"), val = row && row.value;
    check(val && val.price === null, "no price saved: " + JSON.stringify(val));
    check(val && !val.svc.Masaj && JSON.stringify(val.svc.Kombo) === "[60,null]" && !val.svc.Hicama, "lengths saved, emptied ones removed: " + JSON.stringify(val && val.svc));
    check(val && JSON.stringify(val.reader[R2]) === "[120,null]" && !val.reader[R1], "specialists saved: " + JSON.stringify(val && val.reader));
    await p.click('#tabs [data-tab="day"]'); await p.click("#fab"); await p.locator("#f-reader").waitFor();
    await p.click('label:has(input[name="f-service"][value="Kombo"])'); await p.waitForTimeout(150);
    check(await p.inputValue("#f-dur") === "60" && !(await p.locator("#f-price").count()), "the next new booking: Kombo 1 hour, no price");
    await p.click('[data-act="close"]'); await p.waitForTimeout(300); if (await p.locator('[data-act="draft-drop"]').count()) await p.click('[data-act="draft-drop"]');

    // (3) a new product, its answer lost, «Əlavə et» again: one row
    // the server stores it but the answer is lost, and the list this phone reloads does not show it yet (a slow
    // replica / the reload still on its way): the admin presses «Əlavə et» again with the same name
    let lose = true, stale = true, posts = 0;
    await p.route("**/rest/v1/products*", async (r) => {
      const m = r.request().method();
      if (m === "POST") { posts++; if (lose) { lose = false; const b = JSON.parse(r.request().postData()); (Array.isArray(b) ? b : [b]).forEach((x) => s.db.products.push({ archived: false, created_at: now, ...x })); return r.abort("connectionreset"); } stale = false; }
      if (m === "GET" && stale) return r.fulfill({ status: 200, contentType: "application/json", body: "[]" });
      return r.fallback();
    });
    await p.click('#tabs [data-tab="cash"]'); await p.click('[data-act="catalog"]'); await p.locator("#c-name").waitFor();
    await p.fill("#c-name", "Zeytun yağı"); await p.fill("#c-price", "12");
    await p.click('[data-act="cat-save"]'); await p.waitForTimeout(2500);
    if (!(await p.locator("#c-name").count())) { await p.click('[data-act="catalog"]'); await p.locator("#c-name").waitFor(); }
    await p.fill("#c-name", "Zeytun yağı"); await p.fill("#c-price", "12"); await p.click('[data-act="cat-save"]'); await p.waitForTimeout(800);
    check(posts === 2, "the retry was sent: " + posts);
    await p.waitForTimeout(1500);
    check(s.db.products.filter((x) => x.name === "Zeytun yağı").length === 1, "one product in the database: " + s.db.products.filter((x) => x.name === "Zeytun yağı").length);
    check(!s.errors.length, "no page errors (admin): " + s.errors.join("; "));
  } finally { await s.close(); }
};
