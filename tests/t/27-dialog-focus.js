// V-03: a window that opens takes the keyboard focus (without opening the phone keyboard), has a name, keeps Tab
// inside itself while open, and gives the focus back to the button that opened it when it closes.
const { open, check, OWNER } = require("../lib");
module.exports = async () => {
  const s = await open(OWNER, { viewport: { width: 1280, height: 800 } });
  try {
    const p = s.page; await p.waitForSelector("#cal .ev"); await p.waitForTimeout(3300);
    await p.focus("#fab"); await p.keyboard.press("Enter"); await p.waitForSelector("#f-reader"); await p.waitForTimeout(200);
    const st = await p.evaluate(() => { const a = document.activeElement, d = document.getElementById("sheet"); return { inside: d.contains(a), tag: a.tagName, name: d.getAttribute("aria-labelledby") && (document.getElementById(d.getAttribute("aria-labelledby")) || {}).textContent }; });
    check(st.inside, "focus moves into the window (now on " + st.tag + ")");
    check(st.tag !== "INPUT" && st.tag !== "SELECT", "no field is focused on open (the phone keyboard must not pop up)");
    check(/Yeni qəbul/.test(st.name || ""), "the window is named by its title: " + st.name);
    let out = 0; for (let i = 0; i < 40; i++) { await p.keyboard.press("Tab"); if (!(await p.evaluate(() => document.getElementById("sheet").contains(document.activeElement)))) out++; }
    check(out === 0, "Tab stays inside the open window (" + out + " times outside)");
    await p.keyboard.press("Escape"); await p.waitForTimeout(300);
    check(await p.evaluate(() => document.activeElement && document.activeElement.id === "fab"), "focus back on «+ Yaz» after closing");
    check(!s.errors.length, "no page errors: " + s.errors.join("; "));
  } finally { await s.close(); }
};
