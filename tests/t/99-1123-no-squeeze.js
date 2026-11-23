// Owner 23.11 (photo, Android): in Ayarlar «Mütəxəssis əlavə et» and «Yeni qəbul: qiymət və müddət» ran into each other.
// Cause: the screen (main) is a scrolling flex column; a child with overflow:hidden (the yellow button) may be squeezed
// below its own height once the content is taller than the screen. Every screen and every Ayarlar section is checked on a
// small phone with many specialists: no block is squeezed and no two blocks overlap.
const { open, check, OWNER, seed, uuid } = require("../lib");
module.exports = async () => {
  const db = seed(), now = new Date().toISOString();
  for (let i = 0; i < 9; i++) db.readers.push({ id: uuid(), name: "Mütəxəssis " + (i + 1), archived: false, created_at: "2026-11-0" + (i % 9 + 3) + "T00:00:00Z", color: "#4a7fc9", price: 0, share: 0 });
  db.app_settings = [{ id: "presets", value: { price: 130 } }];
  const s = await open(OWNER, { db, viewport: { width: 360, height: 640 } });
  try {
    const p = s.page; await p.locator("#tabs:not([hidden])").waitFor({ timeout: 15000 }); await p.waitForTimeout(3000);
    const probe = () => p.evaluate(() => {
      const out = [], kids = [...document.querySelectorAll("main > *")].filter((e) => e.offsetParent !== null && getComputedStyle(e).position !== "absolute" && getComputedStyle(e).position !== "fixed");
      kids.forEach((e, i) => {
        const r = e.getBoundingClientRect(), grow = parseFloat(getComputedStyle(e).flexGrow) > 0;
        if (!grow && e.scrollHeight > Math.ceil(r.height) + 1) out.push("squeezed: " + (e.className || e.tagName) + " " + Math.round(r.height) + " < " + e.scrollHeight);
        const n = kids[i + 1]; if (n) { const q = n.getBoundingClientRect(); if (q.top < r.bottom - 1) out.push("overlap: " + (e.className || e.tagName) + " / " + (n.className || n.tagName) + " by " + Math.round(r.bottom - q.top)); }
      });
      return out;
    });
    const bad = [];
    for (const tab of ["day", "stats", "cash", "patients", "readers"]) {
      await p.click('#tabs [data-tab="' + tab + '"]'); await p.waitForTimeout(500);
      if (tab === "readers") {
        for (const sec of ["spec", "breaks", "staff", "view", "acc"]) {
          if (!(await p.locator('[data-act="set-sec"][data-id="' + sec + '"]').count())) continue;
          await p.click('[data-act="set-sec"][data-id="' + sec + '"]'); await p.waitForTimeout(400);
          (await probe()).forEach((x) => bad.push("Ayarlar/" + sec + ": " + x));
        }
      } else (await probe()).forEach((x) => bad.push(tab + ": " + x));
    }
    check(!bad.length, "no squeezed or overlapping blocks: " + bad.join(" | "));
    // the two buttons of the photo, by themselves
    await p.click('#tabs [data-tab="readers"]'); await p.click('[data-act="set-sec"][data-id="spec"]'); await p.waitForTimeout(300);
    const r = await p.evaluate(() => { const a = document.querySelector('[data-act="new-reader"]').getBoundingClientRect(), b = document.querySelector('[data-act="presets"]').getBoundingClientRect(); return { ah: a.height, gap: b.top - a.bottom }; });
    check(r.ah >= 44 && r.gap >= 8, "«Mütəxəssis əlavə et» keeps its height and stands apart from «Yeni qəbul…»: " + JSON.stringify(r));
    check(!s.errors.length, "no page errors: " + s.errors.join("; "));
  } finally { await s.close(); }
};
