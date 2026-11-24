// Owner 24.11 (4 screenshots 14:02–14:07): on the calendar
//  1. the row of week days with their numbers is gone (more height for the calendar);
//  2. Təqvim / Siyahı are bigger and stand at the top, on the right of «24 noyabr»;
//  3. the specialists' names at the bottom are their own solid strip — blocks never show through them;
//  4. a narrow but long block shows only the patient's name, top to bottom, whole (no word broken, nothing cut);
//     a narrow short block shows only the name, across, never broken in the middle of a word.
// Also: in Russian the round «+» button shows only «+» (the label «+ Записать» stays hidden).
const { open, check, OWNER, seed, uuid, bakuToday, R1, R2 } = require("../lib");
module.exports = async () => {
  for (const [w, lang] of [[390, "az"], [360, "ru"]]) {
    const db = seed(), t = bakuToday(), now = new Date().toISOString();
    const add = (r, time, dur, name) => db.appts.push({ id: uuid(), reader_id: r, date: t, time, duration: dur, name, phone: "070 702 41 21", price: 0, share: 0, status: "wait", note: "", settled: false, service: "", created_by: null, created_at: now });
    add(R1, "10:00", 120, "Mehman Əliyev"); add(R1, "10:30", 120, "Amirə"); add(R1, "14:00", 60, "Kənan Quliyev"); add(R1, "14:20", 60, "Cəmilə");
    add(R2, "11:00", 90, "Elvir Məmmədov");
    const s = await open(OWNER, { db, viewport: { width: w, height: 820 }, init: [(l) => { try { localStorage.setItem("ruqya.lang", l); localStorage.setItem("ruqya.fit", "0"); localStorage.setItem("ruqya.view", "grid") } catch (e) {} }, lang] });
    try {
      const p = s.page;
      await p.waitForSelector("#cal .ev", { timeout: 15000 }); await p.waitForTimeout(1200);
      await p.evaluate(() => { document.querySelector("#cal").scrollTop = 0; });
      await p.evaluate(() => new Promise((r) => requestAnimationFrame(() => r())));
      const r = await p.evaluate(() => {
        const box = (e) => e.getBoundingClientRect(), nav = document.querySelector("#top .daynav"), sw = nav && nav.querySelector(".vsw2"), lab = nav && nav.querySelector(".label");
        const foot = document.querySelector("#cal .cal-foot"), bg = getComputedStyle(foot).backgroundColor;
        const words = (b) => { let broken = 0; const tn = [...b.childNodes].filter((n) => n.nodeType === 3); tn.forEach((n) => { const re = /\S+/g; let m; while ((m = re.exec(n.data))) { const rg = document.createRange(); rg.setStart(n, m.index); rg.setEnd(n, m.index + m[0].length); const rs = [...rg.getClientRects()].filter((x) => x.width > 0.5 && x.height > 0.5); if (rs.length > 1) broken++; } }); return broken; };
        const evs = [...document.querySelectorAll("#cal .ev")].map((e) => { const b = e.querySelector("b"), cs = getComputedStyle(b), okv = e.querySelector(".okv");
          return { name: b.textContent.replace(/[✅☑️]/g, "").trim(), W: e.clientWidth, H: e.clientHeight, cls: e.className, wm: cs.writingMode || cs.webkitWritingMode,
            fx: [...e.querySelectorAll(".fx")].filter((x) => getComputedStyle(x).display !== "none").length, cut: b.scrollHeight > e.clientHeight || box(b).right > box(e).right + 1 || box(b).bottom > box(e).bottom + 1, broken: words(b), fs: parseFloat(cs.fontSize), okOver: okv ? okv.getBoundingClientRect().bottom > b.getBoundingClientRect().top + 1 : false } });
        const fab = document.querySelector("#fab"), fabt = fab.querySelector(".fabt");
        return { week: document.querySelectorAll("#top .week, #top .wd").length, sw: !!sw, swRight: sw && lab ? box(sw).left >= box(lab).right - 1 : false, swTop: sw && lab ? Math.abs(box(sw).top - box(lab).top) < 40 : false,
          btns: sw ? [...sw.querySelectorAll("button")].map((b) => [Math.round(box(b).width), Math.round(box(b).height), b.getAttribute("aria-label"), !!b.querySelector("svg")]) : [],
          oldSw: document.querySelectorAll("#cal .vsw, #main .lsw, .cal-foot [data-act=view]").length, labelCut: lab ? lab.scrollWidth > lab.clientWidth + 1 : true,
          footBg: bg, evs, fabText: fab.textContent, fabtW: fabt ? fabt.getBoundingClientRect().width : -1, fabKids: fab.children.length };
      });
      const tag = w + " " + lang + ": ";
      check(r.week === 0, tag + "no week strip with day numbers at the top");
      check(r.sw && r.swRight && r.swTop, tag + "Təqvim / Siyahı stand at the top, right of the date");
      check(r.btns.length === 2 && r.btns.every((b) => b[0] >= 40 && b[1] >= 34 && b[2] && b[3]), tag + "two symbol buttons (evening 24.11: symbols instead of words), big enough for a thumb, named for screen readers: " + JSON.stringify(r.btns));
      check(r.oldSw === 0, tag + "the switch is no longer at the bottom left nor above the list");
      check(!r.labelCut, tag + "the date next to the switch is not cut");
      check(/rgb\(|rgba\(.*,\s*1\)/.test(r.footBg) && !/rgba\(.*,\s*0(\.\d+)?\)/.test(r.footBg), tag + "the names strip is solid (" + r.footBg + "): blocks do not show through");
      const narrow = r.evs.filter((e) => e.W < 60);
      check(narrow.length >= 4, tag + "narrow blocks on the day: " + narrow.length);
      for (const e of narrow) {
        const tall = e.H >= e.W * 1.25 && e.H >= 44;
        if (tall) check(/\bvnm\b/.test(e.cls) && /vertical/.test(e.wm), tag + e.name + " (" + e.W + "×" + e.H + "): written top to bottom");
        else check(/\bnnm\b/.test(e.cls), tag + e.name + " (" + e.W + "×" + e.H + "): name only, across");
        check(!e.okOver, tag + e.name + ": the ✅ row stands above the name, not over it");
        check(e.fx === 0, tag + e.name + ": no phone, no agent in a narrow block");
        check(!e.cut && e.broken === 0, tag + e.name + ": whole name, no word broken (cut " + e.cut + ", broken words " + e.broken + ", " + e.fs + " px)");
      }
      const wide = r.evs.filter((e) => e.W >= 60);
      check(wide.length && wide.every((e) => !/\b(vnm|nnm)\b/.test(e.cls) && e.fx > 0), tag + "a wide block keeps its phone and agent, across");
      check(r.fabKids === 1 && r.fabtW <= 1, tag + "the round «+» shows no text (label hidden): " + JSON.stringify(r.fabText));
      // the switch still works from its new place
      await p.click('#top .vsw2 [data-id="list"]'); await p.waitForTimeout(500);
      const list = await p.evaluate(() => ({ cal: !!document.querySelector("#cal"), on: document.querySelector('#top .vsw2 [data-id="list"]').getAttribute("aria-pressed") }));
      check(!list.cal && list.on === "true", tag + "«Siyahı» from the top opens the list");
      await p.click('#top .vsw2 [data-id="grid"]'); await p.waitForTimeout(500);
      check(await p.evaluate(() => !!document.querySelector("#cal .ev")), tag + "«Təqvim» brings the calendar back");
      // «Bu gün» under the date on another day
      await p.click('#top [data-act=shift][data-n="1"]'); await p.waitForTimeout(400);
      const tb = await p.evaluate(() => { const b = document.querySelector("#top .dsub [data-act=today]"); return b ? Math.round(b.getBoundingClientRect().height) : 0; });
      check(tb > 0, tag + "on another day «Bu gün» is under the date");
      await p.click("#top .dsub [data-act=today]"); await p.waitForTimeout(400);
      check(await p.evaluate((d) => document.querySelector("#cal").getAttribute("data-d") === d, t), tag + "«Bu gün» returns to today");
      check(!s.errors.length, tag + "no page errors: " + s.errors.join(" | "));
    } finally { await s.close(); }
  }
};
