// 25.11: the bundled Golos Text drew «ğ» and «Ğ» without the breve — «Uğurlu» read «Ugurlu», «Ləğv» «Ləgv» everywhere (screen,
// PDF). The letter now comes from Onest; the rest of Golos must stay Golos at every weight the app uses. («ə» is not in
// Golos at all — it has always come from the system font, which draws it right; that is left as it is.)
const { open, check, OWNER } = require("../lib");
module.exports = async () => {
  const s = await open(OWNER);
  try {
    const p = s.page; await p.waitForTimeout(2500);
    const r = await p.evaluate(async () => { await document.fonts.ready; const out = {};
      for (const w of ["400", "600", "700", "800"]) for (const fam of ['"Golos Text"', "serif"]) for (const ch of ["g", "ğ", "G", "Ğ", "ş", "ə", "a"]) {
        await document.fonts.load(w + " 60px " + fam, ch).catch(() => {});
        const c = document.createElement("canvas"); c.width = 100; c.height = 120; const g = c.getContext("2d"); g.font = w + " 60px " + fam; g.fillText(ch, 10, 80);
        const d = g.getImageData(0, 0, 100, 120).data; let top = 999, ink = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 100) { ink++; top = Math.min(top, Math.floor(i / 4 / 100)); }
        out[w + fam + ch] = [top, ink]; }
      return out; });
    for (const w of ["400", "600", "700", "800"]) {
      const G = (ch) => r[w + '"Golos Text"' + ch], S = (ch) => r[w + "serif" + ch];
      check(G("ğ")[0] < G("g")[0] - 6, w + ": «ğ» has its breve (top " + G("ğ")[0] + " against «g» " + G("g")[0] + ")");
      check(G("Ğ")[0] < G("G")[0] - 6, w + ": «Ğ» has its breve (top " + G("Ğ")[0] + " against «G» " + G("G")[0] + ") — «UĞURLU» in capitals");
      check(["g", "ş", "a"].every((ch) => JSON.stringify(G(ch)) !== JSON.stringify(S(ch))), w + ": the other letters are still Golos, not the fallback: " + JSON.stringify(["g", "ş", "a"].map((ch) => [G(ch), S(ch)])));
    }
    const t = await p.evaluate(() => { const b = document.createElement("b"); b.textContent = "Uğurlu"; b.style.cssText = "font:700 40px 'Golos Text'"; document.body.appendChild(b); const ok = document.fonts.check("700 40px 'Golos Text'", "ğ"); b.remove(); return ok; });
    check(t, "the font for «ğ» is loaded");
    check(!s.errors.length, "no page errors: " + s.errors.join(" | "));
  } finally { await s.close(); }
};
