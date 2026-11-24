// Owner 24.11 evening: «Kim neçə seans yazıb» in every statistics — no «Vəzifə»; instead a column for every specialist
// (his capital letter) with how many sessions this person wrote for him, and «Cəmi» at the end; the last row is the
// total per specialist. Two specialists with the same first letter get two letters (Le / Lo). A key under the table
// names them. The WhatsApp copy writes the full names («Nurlana - Əli 1, Leyla 2, Loğman 1, cəmi 4 seans»). An agent sees
// only his own line. (The numbers themselves: 99-1123-stats-oracle checks every cell against the rules.)
const { open, check, OWNER, AGENT, SPEC, seed, uuid, bakuToday, R1 } = require("../lib");
module.exports = async () => {
  const db = seed(), now = new Date().toISOString();
  const LE = uuid(), LO = uuid();
  db.readers.push({ ...db.readers[0], id: LE, name: "Leyla", sort: 5 }, { ...db.readers[0], id: LO, name: "Loğman", sort: 6 });
  const add = (rid, by, st) => db.appts.push({ id: uuid(), reader_id: rid, date: bakuToday(2), time: "1" + db.appts.length % 9 + ":00", duration: 60, name: "P" + db.appts.length, phone: "050 000 00 " + (10 + db.appts.length), price: 0, share: 0, status: st || "wait", note: "", settled: false, service: "Ruqya", place: "ofis", created_by: by, created_at: now });
  add(LE, AGENT); add(LE, AGENT, "cancel"); add(LO, AGENT); add(R1, SPEC); add(LO, SPEC);
  for (const who of [OWNER, AGENT]) {
    const s = await open(who, { db: JSON.parse(JSON.stringify(db)), viewport: { width: 390, height: 900 } });
    try {
      const p = s.page, tag = (who === OWNER ? "admin" : "agent") + ": ";
      await s.context.grantPermissions(["clipboard-read", "clipboard-write"]);
      await p.locator("#tabs:not([hidden])").waitFor({ timeout: 15000 }); await p.waitForTimeout(2500);
      await p.click('#tabs [data-tab="stats"]'); await p.click('#top [data-act="st-sec"][data-id="today"]'); await p.waitForTimeout(400);
      const t = await p.evaluate(() => { const box = document.querySelector('[data-st^="sess-"]'), tb = box.querySelector("table");
        const cells = (tr) => [...tr.cells].map((c) => c.textContent.trim());
        return { head: cells(tb.tHead.rows[0]), full: [...tb.tHead.rows[0].cells].map((c) => c.getAttribute("data-full")), rows: [...tb.tBodies[0].rows].map(cells), foot: tb.tFoot ? cells(tb.tFoot.rows[0]) : null, key: (box.querySelector(".sesskey") || {}).textContent || "", text: box.textContent }; });
      check(!/Vəzifə|Satış agenti|Mütəxəssis/.test(t.text), tag + "no «Vəzifə» column any more");
      check(t.head[t.head.length - 1] === "Cəmi" && t.head[0] === "Kim", tag + "Kim … Cəmi: " + JSON.stringify(t.head));
      const col = (n) => t.full.indexOf(n);
      check(col("Leyla") > 0 && col("Loğman") > 0 && col("Əli") > 0 && t.head[col("Leyla")] === "Le" && t.head[col("Loğman")] === "Lo" && t.head[col("Əli")] === "Ə", tag + "a letter per specialist, two when the first is shared: " + JSON.stringify([t.head, t.full]));
      check(/Le — Leyla/.test(t.key) && /Lo — Loğman/.test(t.key) && /Ə — Əli/.test(t.key), tag + "a key under the table: " + t.key);
      const nur = t.rows.find((r) => r[0] === "Nurlana");
      check(nur && nur[col("Leyla")] === "2" && nur[col("Loğman")] === "1" && nur[col("Əli")] === "1" && nur[nur.length - 1] === "4", tag + "Nurlana: Əli 1 (the basic test booking), Leyla 2 (a cancelled one too), Loğman 1, Cəmi 4: " + JSON.stringify(nur));
      if (who === OWNER) {
        const ali = t.rows.find((r) => r[0] === "Əli");
        check(ali && ali[col("Əli")] === "1" && ali[col("Loğman")] === "1" && ali[ali.length - 1] === "2", "the specialist Əli wrote 1 for himself, 1 for Loğman: " + JSON.stringify(ali));
        check(t.foot && t.foot[col("Leyla")] === "2" && t.foot[col("Loğman")] === "2" && t.foot[col("Əli")] === "2" && t.foot[t.foot.length - 1] === "6", "the last row: each specialist's total, 6 in all: " + JSON.stringify(t.foot));
        await p.click('[data-st^="sess-"] [data-act="st-copy-t"]'); await p.waitForTimeout(300);
        const u = await p.evaluate(() => navigator.clipboard.readText());
        check(u.split("\n").includes("Nurlana - Əli 1, Leyla 2, Loğman 1, cəmi 4 seans") && u.split("\n").includes("Cəmi - Əli 2, Leyla 2, Loğman 2, cəmi 6 seans"), "WhatsApp copy: full names, cəmi at the end: " + u);
      } else check(t.rows.length === 1, "an agent sees only his own line: " + JSON.stringify(t.rows));
      check(!s.errors.length, tag + "no page errors: " + s.errors.join(" | "));
    } finally { await s.close(); }
  }
};
