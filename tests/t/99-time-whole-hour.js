// Owner 22.11: «the round clock on Android in the new-booking window opens on 19:00, not 19:48 (now)». An empty time
// field gets the whole hour of now just before its clock opens; a break's end opens one hour after its start.
const { open, check, OWNER, R1 } = require("../lib");
module.exports = async () => {
  // 19:48 in Baku
  const clock = new Date("2026-11-20T15:48:00Z");
  const s = await open(OWNER, { clock, viewport: { width: 390, height: 844 } });
  try {
    const p = s.page;
    await p.locator("#tabs:not([hidden])").waitFor({ timeout: 15000 }); await p.waitForTimeout(1500);
    await p.click("#fab"); await p.locator("#f-time").waitFor();
    await p.selectOption("#f-reader", R1);
    check(await p.inputValue("#f-time") === "", "the field starts empty (nothing is booked by accident)");
    await p.dispatchEvent("#f-time", "touchstart");
    check(await p.inputValue("#f-time") === "19:00", "the clock opens on 19:00: " + await p.inputValue("#f-time"));
    // a field with a time keeps it
    await p.fill("#f-time", "10:30"); await p.dispatchEvent("#f-time", "mousedown");
    check(await p.inputValue("#f-time") === "10:30", "a chosen time stays");
    // break form: start and end
    await p.click('[data-act="kind"][data-id="brk"]'); await p.locator("#b-start").waitFor();
    check(await p.inputValue("#b-start") === "10:30" && await p.inputValue("#b-end") === "11:30", "a break from the booking window starts at its time, ends an hour later");
    await p.evaluate(() => { document.getElementById("b-end").value = ""; }); await p.dispatchEvent("#b-end", "touchstart");
    check(await p.inputValue("#b-end") === "11:30", "an emptied end opens one hour after the start: " + await p.inputValue("#b-end"));
    check(!s.errors.length, "no page errors: " + s.errors.join("; "));
  } finally { await s.close(); }
};
