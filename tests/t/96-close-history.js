// P-07: closing a window with × hides it at once and then drops its history entry (so the phone's Back button does not
// "close" an already closed window); Back closes an open window; a window opened right after closing another stays open.
const { open, check, AGENT } = require("../lib");
module.exports = async () => {
  const s = await open(AGENT, {});
  try {
    const p = s.page; await p.locator("#cal .ev").first().waitFor({ timeout: 15000 }); await p.waitForTimeout(3300);
    const len0 = await p.evaluate(() => history.length);
    await p.click("#fab"); await p.locator("#f-name").waitFor();
    check(await p.evaluate(() => !!(history.state && history.state.sheet)), "an open window has its history entry");
    await p.click('[data-act="close"]');
    check(await p.locator("#overlay").isHidden(), "× hides the window at once");
    await p.waitForTimeout(400);
    check(await p.evaluate(() => !(history.state && history.state.sheet)), "after × the window's history entry is dropped");
    // Back closes an open window
    await p.click("#fab"); await p.locator("#f-name").waitFor();
    await p.goBack(); await p.waitForTimeout(400);
    check(await p.locator("#overlay").isHidden(), "Back closes an open window");
    // close and at once open another window: it must stay open with its own entry
    await p.click("#fab"); await p.locator("#f-name").waitFor();
    await p.click('[data-act="close"]'); await p.click('[data-act="draft-drop"]', { timeout: 300 }).catch(() => {});
    await p.click("#fab"); await p.locator("#f-name").waitFor(); await p.waitForTimeout(600);
    check(await p.locator("#overlay").isVisible(), "a window opened right after closing another stays open");
    check(await p.evaluate(() => !!(history.state && history.state.sheet)), "and has its own history entry");
    check((await p.evaluate(() => history.length)) <= len0 + 3, "history does not pile up entries");
    check(!s.errors.length, "no page errors: " + s.errors.join("; "));
  } finally { await s.close(); }
};
