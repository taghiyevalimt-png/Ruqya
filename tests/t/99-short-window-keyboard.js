// Owner 17.11: «Yeni mütəxəssis» — what is typed must be visible. A short window (one field) sits at the bottom of the
// screen; when the phone keyboard opens (Android makes the page shorter, simulated here) its field must stay above
// the keyboard. (The tall booking window stays where it is — test 15-keyboard.)
const { open, check, OWNER } = require("../lib");
module.exports = async () => {
  const s = await open(OWNER, { viewport: { width: 412, height: 860 } });
  try {
    const p = s.page; await p.locator("#tabs:not([hidden])").waitFor({ timeout: 15000 }); await p.waitForTimeout(3300);
    await p.click('#tabs [data-tab="readers"]'); await p.click('#top [data-act="set-sec"][data-id="spec"]').catch(() => {}); await p.waitForTimeout(300);
    await p.click('[data-act="new-reader"] >> nth=0'); await p.locator("#r-name").waitFor();
    await p.$eval("#sheet", (e) => Promise.all(e.getAnimations().map((a) => a.finished)));
    await p.click("#r-name");
    await p.setViewportSize({ width: 412, height: 500 });   // keyboard opens
    await p.waitForTimeout(400); await p.$eval("#sheet", (e) => Promise.all(e.getAnimations().map((a) => a.finished)));
    await p.keyboard.type("Yeni Mütəxəssis");
    const r = await p.$eval("#r-name", (e) => { const b = e.getBoundingClientRect(); return { top: Math.round(b.top), bottom: Math.round(b.bottom), h: innerHeight, v: e.value }; });
    check(r.v === "Yeni Mütəxəssis", "typed: " + r.v);
    check(r.top >= 0 && r.bottom <= r.h, "the name field is above the keyboard (inside " + r.h + " px): " + JSON.stringify(r));
    const save = await p.$eval('[data-act="save-reader"]', (e) => Math.round(e.getBoundingClientRect().bottom));
    check(save <= r.h, "the save button is visible too: bottom " + save);
    check(!s.errors.length, "no page errors: " + s.errors.join("; "));
  } finally { await s.close(); }
};
