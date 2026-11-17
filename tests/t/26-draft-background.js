// B-05: typing in a new booking, then the phone switches to WhatsApp and the system closes the app:
// the typing must come back as a draft when the app is opened again.
const { open, check, AGENT, R1 } = require("../lib");
module.exports = async () => {
  const s = await open(AGENT);
  try {
    const p = s.page; await p.waitForSelector("text=Test Pasiyent"); await p.waitForTimeout(3300);
    await p.click("#fab"); await p.waitForSelector("#f-name");
    await p.selectOption("#f-reader", R1); await p.fill("#f-name", "Arxa planda"); await p.fill("#f-phone", "050 777 66 55");
    await p.evaluate(() => { Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true }); Object.defineProperty(document, "hidden", { value: true, configurable: true }); document.dispatchEvent(new Event("visibilitychange")); });   // Android: only visibilitychange when the app goes to the background (T-52 mutation A-10)
    // Android may kill the app in the background without any further event: the draft must already be stored now
    check(await p.evaluate(() => /Arxa planda/.test(localStorage.getItem("ruqya.draft.v1") || "")), "draft stored as soon as the app went to the background (before any page close)");
    await p.reload(); await p.waitForSelector("text=Test Pasiyent"); await p.waitForTimeout(3300);
    check((await p.locator(".draftbox").count()) === 1, "draft notice after the app was closed in the background");
    await p.click('[data-act="draft-open"]'); await p.waitForSelector("#f-name");
    check((await p.inputValue("#f-name")) === "Arxa planda" && (await p.inputValue("#f-phone")) === "050 777 66 55", "typing restored");
    // a form left untouched does not leave a draft behind
    await p.click('[data-act="close"]'); await p.click('[data-act="draft-drop"]').catch(() => {});
    await p.click("#fab"); await p.waitForSelector("#f-name");
    await p.evaluate(() => window.dispatchEvent(new Event("pagehide")));
    await p.click('[data-act="close"]'); await p.waitForTimeout(300);
    check((await p.locator(".draftbox").count()) === 0, "empty form leaves no draft");
    check(!s.errors.length, "no page errors: " + s.errors.join("; "));
  } finally { await s.close(); }
};
