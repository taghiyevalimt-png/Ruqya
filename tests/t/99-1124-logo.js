// Owner 24.11 (two screenshots of the opening): «the logo looks very bad at the opening — it must look 10 times better».
// The emblem was a small picture cut out of a white background (grey fringe, soft edges). Now it is drawn as a vector
// (logo.svg, from points measured on the owner's logo; tools/logo_svg.py): sharp at any size, no fringe. Checked:
// the opening and the sign-in screen show logo.svg (loaded, not broken), crisp at 3× (the picture is drawn from the
// vector, not scaled up); the iPhone start screens are the night look with the emblem; the backup copy of the site
// takes logo.svg and sw.js along.
const fs = require("fs"), path = require("path");
const { open, check, seed } = require("../lib");
module.exports = async () => {
  const root = path.join(__dirname, "..", "..");
  const svg = fs.readFileSync(path.join(root, "logo.svg"), "utf8");
  check(/^<svg [^>]*viewBox="12 10 584 594"/.test(svg) && /linearGradient id="gold"/.test(svg) && svg.length < 40000, "logo.svg: a small vector with its gold, green and water gradients (" + svg.length + " bytes)");
  const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
  check((html.match(/<img src="logo\.svg"/g) || []).length >= 1 && /'<div class="brand"><img src="logo\.svg"/.test(html) && /rel="preload" as="image" href="logo\.svg"/.test(html), "the opening and the sign-in screen use the vector");
  const cfg = fs.readFileSync(path.join(root, "tools", "configure.py"), "utf8");
  check(/'sw\.js'/.test(cfg) && /'\.svg'/.test(cfg), "the backup copy of the site takes logo.svg and sw.js");
  const { PNG } = (() => { try { return require("pngjs"); } catch (e) { return {}; } })();
  for (const look of ["night", "sand"]) {
    const s = await open(null, { db: seed(), viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, init: [(k) => { try { if (k === "sand") localStorage.setItem("ruqya.look", "sand"); } catch (e) {} }, look] });
    try {
      const p = s.page; await p.waitForTimeout(900);
      const m = await p.evaluate(() => { const i = document.querySelector("#splash img"); return i ? { src: i.getAttribute("src"), ok: i.complete && i.naturalWidth > 0, w: Math.round(i.getBoundingClientRect().width), bg: getComputedStyle(document.getElementById("splash")).backgroundColor } : null; });
      check(m && m.src === "logo.svg" && m.ok && m.w >= 150, look + ": the opening shows the vector emblem, loaded, " + (m && m.w) + " px wide: " + JSON.stringify(m));
      check(m && m.bg === (look === "night" ? "rgb(48, 49, 71)" : "rgb(206, 187, 160)"), look + ": on its own background " + (m && m.bg));
      check(!s.errors.length, look + ": no page errors: " + s.errors.join(" | "));
    } finally { await s.close(); }
  }
  // the iPhone start screens: night, the emblem in the middle (not the old sand)
  const { execFileSync } = require("child_process");
  const px = execFileSync("python3", ["-c", "from PIL import Image;i=Image.open('" + path.join(root, "launch", "l-1170x2532.png") + "').convert('RGB');print(i.getpixel((20,2500)),i.getpixel((585,1000)))"], { encoding: "utf8" }).trim();
  check(/^\(48, 49, 71\)/.test(px) && !/\(48, 49, 71\)$/.test(px), "iPhone start screen: night background, the emblem in the middle: " + px);
};
