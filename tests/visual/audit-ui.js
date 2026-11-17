// Every screen and window, every state, five widths, light and dark: screenshot + automatic checks.
//   node tests/visual/audit-ui.js <outDir> [widths=320,375,768,1280,1920]
// Checks per shot: horizontal page scroll; text cut off inside a box (scrollWidth > clientWidth with overflow hidden),
// listing intentional cuts (calendar blocks only — R2-6: any other text shortened with "…" counts as cut) separately; overlapping controls in the top layer
// (each box cut by its scrolling ancestors; a control under a fixed/sticky bar is listed apart for review);
// controls smaller than 44x44 px; axe-core 4.10.2 rules for WCAG 2.0/2.1 A+AA (incl. colour contrast 4.5:1).
// Output: <outDir>/<width>-<theme>/<screen>.jpg, <outDir>/report.json, <outDir>/summary.tsv. Exit 1 on overflow,
// unintended cuts, overlaps or axe violations.
const fs = require("fs"), path = require("path");
const { open, OWNER, AGENT, SPEC, seed, uuid, bakuToday, R1, R2 } = require("../lib");
const AXE = fs.readFileSync(require.resolve("axe-core/axe.min.js"), "utf8");

function db(kind) {
  const d = seed(), now = new Date().toISOString();
  if (kind === "empty") { d.appts = []; return d; }
  const add = (day, t, r, st, by, name, phone, dur) => d.appts.push({ id: uuid(), reader_id: r, date: bakuToday(day), time: t, duration: dur || 90, name, phone, price: 130, share: 0, status: st, note: "Qeyd", settled: false, service: "Ruqya", confirmed: false, place: "ofis", follow: st === "cancel" ? 2 : 0, created_by: by, created_at: now, updated_at: now });
  add(0, "12:00", R1, "cancel", AGENT, "Ləğv Olunmuş Pasiyent", "055 111 11 11");
  add(0, "12:00", R2, "wait", AGENT, "Çox Uzun Adlı Pasiyent Məmmədova Gülnarə", "+994 55 123 45 67");
  add(0, "15:00", R1, "wait", OWNER, "Əli", "050 333 44 55", 30);
  add(-1, "09:00", R2, "wait", SPEC, "Dünən", "050 222 33 44");
  d.product_sales.push({ id: uuid(), date: bakuToday(0), amount: 25, names: "Zeytun yağı\nQara çörək otu yağı 250 ml", created_by: OWNER, created_at: now });
  d.expenses.push({ id: uuid(), date: bakuToday(0), title: "İcarə", amount: 500, created_by: OWNER, created_at: now });
  d.breaks.push({ id: uuid(), title: "Namaz", start_time: "13:00", end_time: "13:30", reader_id: null, created_at: now });
  return d;
}

const SCREENS = [
  ["day-grid", async (p) => { await tab(p, "day"); await p.click('[data-act="view"][data-id="grid"]').catch(() => {}); }],
  ["day-list", async (p) => { await tab(p, "day"); await p.click('[data-act="view"][data-id="list"]'); }],
  ["sheet-new-booking", async (p) => { await tab(p, "day"); await p.click('[data-act="view"][data-id="grid"]').catch(() => {}); await p.click("#fab"); }],
  ["sheet-new-booking-error", async (p) => { await p.click('[data-act="save-appt"]'); }],
  ["sheet-booking-card", async (p) => { await closeSheet(p); await p.click("#cal .ev:not(.cancel)"); }],
  ["sheet-cancelled-card", async (p) => { await closeSheet(p); await p.click("#cal .ev.cancel"); }],
  ["stats-today", async (p) => { await closeSheet(p); await tab(p, "stats"); await sec(p, "today"); }],
  ["stats-day", async (p) => sec(p, "day")], ["stats-week", async (p) => sec(p, "week")], ["stats-month", async (p) => sec(p, "month")],
  ["stats-rules", async (p) => sec(p, "rules")], ["stats-terms", async (p) => sec(p, "terms")],
  ["sheet-excel", async (p) => { await p.click('[data-act="xls"]'); }],
  ["cash", async (p) => { await closeSheet(p); await tab(p, "cash"); }],
  ["sheet-product", async (p) => { await p.click('[data-act="new-prod"]'); }],
  ["patients", async (p) => { await closeSheet(p); await tab(p, "patients"); await p.click('[data-act="p-sec"][data-id="all"]'); }],
  ["patients-cancelled", async (p) => { await p.click('[data-act="p-sec"][data-id="cancel"]'); }],
  ["sheet-patient", async (p) => { await p.click('[data-act="p-sec"][data-id="all"]'); await p.click("#plist [data-act=patient]"); }],
  ["settings-spec", async (p) => { await closeSheet(p); await tab(p, "readers"); await set(p, "spec"); }],
  ["settings-breaks", async (p) => set(p, "breaks")], ["settings-staff", async (p) => set(p, "staff")],
  ["settings-view", async (p) => set(p, "view")], ["settings-acc", async (p) => set(p, "acc")],
  ["sheet-journal", async (p) => { await set(p, "staff"); await p.click('[data-act="audit"]'); }],
];
async function tab(p, t) { await p.click('#tabs [data-tab="' + t + '"]'); }
async function sec(p, s) { await p.click('#top [data-act="st-sec"][data-id="' + s + '"]'); }
async function set(p, s) { await p.click('#top [data-act="set-sec"][data-id="' + s + '"]'); }
async function closeSheet(p) { if (!(await p.locator("#overlay").isHidden())) { await p.click('[data-act="close"]').catch(() => {}); await p.click('[data-act="draft-drop"]').catch(() => {}); } }

async function check(p) {
  return p.evaluate(() => {
    const W = window.innerWidth, out = { overflowX: Math.max(0, document.documentElement.scrollWidth - W), cut: [], cutIntended: 0, overlaps: [], covered: [], small: 0, controls: 0 };
    const vis = (e) => { const r = e.getBoundingClientRect(), cs = getComputedStyle(e); return r.width > 0 && r.height > 0 && cs.visibility !== "hidden" && cs.display !== "none" && +cs.opacity > 0 && r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < W; };
    const name = (e) => e.tagName.toLowerCase() + (e.id ? "#" + e.id : "") + (e.className && typeof e.className === "string" ? "." + e.className.trim().split(/\s+/).slice(0, 2).join(".") : "") + (e.dataset && e.dataset.act ? "[" + e.dataset.act + "]" : "") + " «" + (e.textContent || "").trim().slice(0, 30) + "»";
    const sheetOpen = !document.getElementById("overlay").hidden, layer = sheetOpen ? document.getElementById("sheet") : document.body;
    for (const e of layer.querySelectorAll("b,span,p,h1,h2,h3,label,button,a,td,th,div")) {
      if (!vis(e) || !e.childNodes.length || ![...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) continue;
      const cs = getComputedStyle(e);
      if ((cs.overflow === "hidden" || cs.overflowX === "hidden" || cs.overflowX === "clip") && e.scrollWidth > e.clientWidth + 1) {
        if (e.closest(".ev")) out.cutIntended++; else out.cut.push(name(e) + (cs.textOverflow === "ellipsis" ? " (…)" : ""));
      }
    }
    const ctl = [...layer.querySelectorAll("button,a[href],input:not([type=hidden]),select,textarea,[data-act]")].filter((e) => vis(e) && (!sheetOpen || e.closest("#sheet")) && (sheetOpen || !e.closest("#overlay")));
    out.controls = ctl.length;
    for (const e of ctl) { const r = e.getBoundingClientRect(); if ((r.width < 44 || r.height < 44) && !e.closest("#cal")) out.small++; }
    // what of a control can be seen: its box cut by every scrolling/clipping ancestor (a control scrolled out of a
    // list is not "under" the one now in view); and its layer: inside a fixed or sticky bar or not — a bar over
    // scrolled content covers it by design, that is not an overlap of two controls
    const clip = (e) => { let r = e.getBoundingClientRect(), x0 = r.left, y0 = r.top, x1 = r.right, y1 = r.bottom;
      for (let p = e.parentElement; p && p !== document.body; p = p.parentElement) { const cs = getComputedStyle(p); if (cs.overflow !== "visible" || cs.overflowX !== "visible" || cs.overflowY !== "visible") { const q = p.getBoundingClientRect(); x0 = Math.max(x0, q.left); y0 = Math.max(y0, q.top); x1 = Math.min(x1, q.right); y1 = Math.min(y1, q.bottom); } }
      return { left: x0, top: y0, right: x1, bottom: y1 }; };
    const layerOf = (e) => { for (let p = e; p && p !== document.body; p = p.parentElement) { const ps = getComputedStyle(p).position; if (ps === "fixed" || ps === "sticky") return p; } return null; };
    for (let i = 0; i < ctl.length; i++) for (let j = i + 1; j < ctl.length; j++) {
      const a = ctl[i], b = ctl[j]; if (a.contains(b) || b.contains(a)) continue;
      const cross = layerOf(a) !== layerOf(b);
      const r = clip(a), s = clip(b);
      const ix = Math.min(r.right, s.right) - Math.max(r.left, s.left), iy = Math.min(r.bottom, s.bottom) - Math.max(r.top, s.top);
      if (ix > 4 && iy > 4) { const top = document.elementFromPoint(Math.max(r.left, s.left) + ix / 2, Math.max(r.top, s.top) + iy / 2); if (top && (a.contains(top) || b.contains(top))) (cross ? out.covered : out.overlaps).push(name(a) + " × " + name(b)); }
    }
    return out;
  });
}

(async () => {
  const outDir = process.argv[2], widths = (process.argv[3] || "320,375,768,1280,1920").split(",").map(Number), rep = [];
  fs.mkdirSync(outDir, { recursive: true });
  const states = [["owner", OWNER, "full"], ["owner-empty", OWNER, "empty"], ["agent", AGENT, "full"], ["specialist", SPEC, "full"]];
  // R2-11: the Russian interface too (its texts are longer): light theme, owner and agent, every width and window
  const langs = (process.env.LANGS || "az,ru").split(",");
  for (const lang of langs) for (const theme of ["light", "dark"]) for (const w of widths) for (const [st0, who, data] of states) {
    if (theme === "dark" && st0 !== "owner") continue;
    if (lang === "ru" && (theme === "dark" || (st0 !== "owner" && st0 !== "agent"))) continue;
    const st = lang === "az" ? st0 : st0 + "-" + lang;
    const s = await open(who, { viewport: { width: w, height: w < 768 ? 800 : 900 }, bypassCSP: true, colorScheme: theme, db: db(data), lang: lang === "az" ? undefined : lang });
    const p = s.page;
    p.setDefaultTimeout(4000);   // a screen this role does not have is skipped quickly
    try {
      await p.waitForSelector("#tabs:not([hidden])", { timeout: 15000 }); await p.waitForTimeout(3300);
      const dir = path.join(outDir, w + "-" + theme); fs.mkdirSync(dir, { recursive: true });
      for (const [scr, go] of SCREENS) {
        let ok = true; try { await go(p); await p.waitForTimeout(350); } catch (e) { ok = false; }
        if (!ok) { rep.push({ w, theme, state: st, screen: scr, skipped: "not available for this role/state" }); continue; }
        const c = await check(p);
        await p.addScriptTag({ content: AXE }).catch(() => {});
        const ax = await p.evaluate(async () => { if (!window.axe) return null; const r = await axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] } }); return r.violations.map((v) => ({ id: v.id, impact: v.impact, n: v.nodes.length, sample: v.nodes.slice(0, 3).map((x) => x.target.join(" ")) })); });
        const file = path.join(dir, st + "__" + scr + ".jpg");
        await p.screenshot({ path: file, type: "jpeg", quality: 55 });
        rep.push({ w, theme, state: st, screen: scr, ...c, axe: ax, shot: path.relative(outDir, file) });
      }
      rep.push({ w, theme, state: st, screen: "_console", errors: s.errors });
    } finally { await s.close(); }
    console.log("done", w, theme, st);
  }
  fs.writeFileSync(path.join(outDir, "report.json"), JSON.stringify(rep, null, 1));
  const lines = ["width\ttheme\tstate\tscreen\toverflowX\tcut\tcutIntended\toverlaps\tcoveredByBar(review)\tsmall<44\taxe"];
  let bad = 0;
  for (const r of rep) {
    if (r.skipped || r.screen === "_console") { if (r.errors && r.errors.length) { bad++; lines.push([r.w, r.theme, r.state, "console", "", "", "", "", "", "", r.errors.join(" | ")].join("\t")); } continue; }
    const ax = (r.axe || []).map((v) => v.id + ":" + v.n).join(" ");
    if (r.overflowX > 1 || r.cut.length || r.overlaps.length || (r.axe || []).length) bad++;
    lines.push([r.w, r.theme, r.state, r.screen, r.overflowX, r.cut.length + (r.cut.length ? " " + r.cut.slice(0, 2).join(" ; ") : ""), r.cutIntended, r.overlaps.length + (r.overlaps.length ? " " + r.overlaps.slice(0, 2).join(" ; ") : ""), (r.covered || []).length + ((r.covered || []).length ? " " + r.covered.slice(0, 2).join(" ; ") : ""), r.small, ax].join("\t"));
  }
  fs.writeFileSync(path.join(outDir, "summary.tsv"), lines.join("\n") + "\n");
  console.log("shots:", rep.filter((r) => r.shot).length, "with problems:", bad);
  process.exit(bad ? 1 : 0);
})();
