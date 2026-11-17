const { open, check, AGENT } = require("../lib");
module.exports = async () => {
  const s = await open(AGENT);
  try {
    const p = s.page;
    await p.waitForSelector("text=Test Pasiyent", { timeout: 15000 });
    await p.waitForTimeout(3200); // logo animation
    await p.click("#fab"); await p.waitForSelector("#f-reader");
    await p.selectOption("#f-reader", { index: 1 });
    await p.selectOption("#f-dur", "60");
    await p.fill("#f-time", "14:00");
    await p.fill("#f-name", "Yeni Pasiyent");
    await p.fill("#f-phone", "050 222 33 44");
    await p.click('[data-act="save-appt"]');
    await p.waitForTimeout(800);
    check(s.db.appts.some((a) => a.name === "Yeni Pasiyent" && a.price === 130), "booking saved to db");
    check(!s.errors.length, "no page errors: " + s.errors.join("; "));
  } finally { await s.close(); }
};
