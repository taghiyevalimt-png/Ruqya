// Owner 23.11: «проверь идеально правильно работает статистика или нет! Это очень очень важно!»
// The app's statistics against an independent calculation of the owner's rules, on 700 random bookings and 120 product
// sales (fixed seed), at five moments around the week and month boundaries, for every section and every table:
//   periods: a week is Friday–Thursday; «Bu həftə» = the week of today, «Keçən həftə» = the last finished week; a month
//            runs from its first Friday to the day before the next month's first Friday; «Bu ay» = the one of today,
//            «Keçən ay» = the last finished one; «Bu gün» = today (Baku time);
//   «Kim neçə seans yazıb»: every booking written in the period (Baku date of writing), cancelled ones too;
//   «Ümumi cədvəl»: Yazdı = written in the period by an agent/admin (cancelled too); Uğurlu = not cancelled, its day in
//            the period and already over; Ləğv = cancelled («Ləğv» / «Gəlmədi»), its day in the period; a specialist's
//            own bookings are «·» there; Xidmətlər / Yer = not cancelled sessions whose day is in the period, in the row
//            of whoever wrote them; «Uğurlu seans» = the same, only those already over;
//   staff hidden from the statistics are left out; an author no longer in the staff list is «Adsız»;
//   a cancelled booking marked as «sold» (follow 3) counts as a normal booking;
//   «Məhsul satışları»: per seller the pieces and the sum; «Payı» = what each person gets: an agent from his own sales, a
//            specialist from sales to his patients (his own sales are always his patients'), a «Keçici» sale gives
//            specialists nothing; «Məhsullar üzrə»: pieces per product (no sum since 24.11).
const { open, check, OWNER, AGENT, SPEC, uuid } = require("../lib");
module.exports = async () => {
  let seedN = 20261123; const rnd = () => { seedN = (seedN * 1103515245 + 12345) % 2147483648; return seedN / 2147483648; };
  const pick = (a) => a[Math.floor(rnd() * a.length)];
  const now0 = "2026-11-01T00:00:00Z";
  const ids = Array.from({ length: 9 }, (_, i) => "dddddddd-0000-4000-8000-00000000000" + i);
  const staff = [
    { id: OWNER, name: "Admin", role: "admin" }, { id: AGENT, name: "Nurlana", role: "agent" }, { id: SPEC, name: "Əli", role: "specialist" },
    { id: ids[0], name: "Nərmin", role: "agent" }, { id: ids[1], name: "Asiya", role: "agent" }, { id: ids[2], name: "Loğman", role: "specialist" },
    { id: ids[3], name: "Gizli agent", role: "agent", hide_stats: true }, { id: ids[4], name: "Şəms", role: "admin" }, { id: ids[5], name: "Amina", role: "agent" },
  ].map((x) => ({ want: null, created_at: now0, hide_stats: false, ...x }));
  const GONE = ids[8];   // wrote bookings, then was removed from the staff list
  const readers = Array.from({ length: 5 }, (_, i) => ({ id: "aaaaaaaa-0000-4000-8000-00000000010" + i, name: ["Əli", "Loğman", "Rizvan", "Təranə", "Dr. Günel"][i], archived: i === 4, created_at: now0, color: "", price: 0, share: 0 }));
  const svcs = ["Ruqya", "Ruqya", "Ruqya", "Hicama", "Masaj", "Kombo", "Dr.Günel", "Psixoloq", "Ruqyə", "Hicamə"];
  const places = ["ofis", "ofis", "ofis", "onlayn", "unvan", null];
  const authors = staff.map((x) => x.id).concat([GONE, null]);
  const ymd = (d) => d.toISOString().slice(0, 10);
  const appts = [];
  for (let i = 0; i < 700; i++) {
    const day = new Date(Date.UTC(2026, 9, 20) + Math.floor(rnd() * 60) * 864e5);   // 20 Oct – 18 Dec
    const h = 8 + Math.floor(rnd() * 15), m = pick([0, 30]), dur = pick([30, 45, 60, 90, 90, 120]);
    const time = String(h).padStart(2, "0") + ":" + String(m).padStart(2, "0");
    // written up to 20 days before the session, sometimes after it (put into a past day), at any hour (UTC → Baku day)
    const wr = new Date(day.getTime() + (h - 4) * 36e5 - Math.floor(rnd() * 20 * 864e5) + (rnd() < 0.1 ? 3 * 864e5 : 0) - Math.floor(rnd() * 864e5));
    const created = new Date(Math.max(Date.UTC(2026, 9, 25), Math.min(wr.getTime(), Date.UTC(2026, 11, 3, 19, 0))));
    const st = rnd() < 0.18 ? "cancel" : rnd() < 0.04 ? "noshow" : "wait";
    appts.push({ id: uuid(), reader_id: pick(readers).id, date: ymd(day), time, duration: dur, name: "P" + i, phone: "050" + i, price: 0, share: 0, status: st, note: "", settled: false,
      service: pick(svcs), confirmed: false, place: pick(places), follow: st === "cancel" && rnd() < 0.2 ? 3 : Math.floor(rnd() * 3), created_by: pick(authors), created_at: created.toISOString(), updated_at: created.toISOString() });
  }
  const prods = Array.from({ length: 6 }, (_, i) => ({ id: "cccccccc-0000-4000-8000-0000000001a" + i, name: ["Ruqyalı su", "Ruqyalı zeytun yağı", "Sidr tozu", "Ruqyalı gül suyu", "Bal", "Məcun"][i], price: [2, 18, 5, 10, 15, 55][i], archived: false, sort: i + 1, created_at: now0 }));
  const shares = [[0, SPEC, null, 1], [0, ids[2], null, 1], [1, SPEC, null, 6], [1, ids[2], null, 6], [1, AGENT, 10, null], [2, SPEC, null, 2], [3, ids[2], 20, null], [3, ids[0], null, 1.5], [5, SPEC, 15, null], [5, ids[3], null, 5]]
    .map(([p, k, pct, amt]) => ({ product_id: prods[p].id, staff_id: k, pct, amt }));
  const sellers = [AGENT, ids[0], ids[1], SPEC, ids[2], OWNER, ids[3], GONE];
  const specs = [SPEC, ids[2]];
  const sales = [];
  for (let i = 0; i < 120; i++) {
    const p = pick(prods), q = 1 + Math.floor(rnd() * 3), by = pick(sellers), d = new Date(Date.UTC(2026, 9, 28) + Math.floor(rnd() * 38) * 864e5);
    const isSpec = specs.includes(by), pat = isSpec ? by : rnd() < 0.5 ? pick(specs) : null;
    sales.push({ id: uuid(), date: ymd(d), product_id: p.id, qty: q, price: p.price, amount: Math.round(q * p.price * 100) / 100, names: p.name, created_by: by, patient_of: pat, created_at: d.toISOString() });
  }

  // ---------- the reference: the owner's rules, written apart from the app ----------
  const name = (k) => { const s = staff.find((x) => x.id === k); return s ? s.name : "Adsız"; };
  const role = (k) => { const s = staff.find((x) => x.id === k); return s ? s.role : ""; };
  const hidden = (k) => { const s = staff.find((x) => x.id === k); return !!(s && s.hide_stats); };
  const bakuDay = (iso) => new Date(new Date(iso).getTime() + 4 * 36e5).toISOString().slice(0, 10);
  const add = (d, n) => ymd(new Date(Date.parse(d + "T00:00:00Z") + n * 864e5));
  const dow = (d) => new Date(d + "T00:00:00Z").getUTCDay();
  const fri = (d) => add(d, -((dow(d) - 5 + 7) % 7));
  const firstFri = (y, m) => { let d = ymd(new Date(Date.UTC(y, m, 1))); while (dow(d) !== 5) d = add(d, 1); return d; };
  const block = (y, m) => ({ s: firstFri(y, m), end: add(firstFri(m === 11 ? y + 1 : y, (m + 1) % 12), -1) });
  const periods = (today) => {
    const y = +today.slice(0, 4), m = +today.slice(5, 7) - 1;
    let cm = block(y, m); if (cm.s > today) cm = block(m === 0 ? y - 1 : y, (m + 11) % 12);
    const cmy = +cm.s.slice(0, 4), cmm = +cm.s.slice(5, 7) - 1, lm = block(cmm === 0 ? cmy - 1 : cmy, (cmm + 11) % 12);
    const cw = fri(today);
    return { today: { s: today, end: today }, cweek: { s: cw < "2026-11-06" ? "2026-11-06" : cw, end: add(cw, 6) }, week: { s: add(cw, -7), end: add(cw, -1) }, cmonth: cm, month: lm };
  };
  const svcN = (s) => (s === "Ruqyə" ? "Ruqya" : s === "Hicamə" ? "Hicama" : s || "Ruqya");
  const plN = (p) => (p === "onlayn" || p === "unvan" ? p : "ofis");
  const ref = (nowIso, r) => {
    const nb = new Date(new Date(nowIso).getTime() + 4 * 36e5), today = nb.toISOString().slice(0, 10), nowM = nb.getUTCHours() * 60 + nb.getUTCMinutes();
    const isGone = (a) => (a.status === "cancel" && !(a.follow >= 3)) || a.status === "noshow";
    const over = (a) => a.date < today || (a.date === today && +a.time.slice(0, 2) * 60 + +a.time.slice(3) + a.duration <= nowM);
    const key = (k) => (k && staff.some((x) => x.id === k) ? k : "-");
    const sess = {}, sessR = {}, sales = {}, wr = {}, T = { a: 0, b: 0, d: 0, svc: {}, pl: {}, svcU: {}, plU: {} };
    for (const a of appts) {
      if (hidden(a.created_by)) continue;
      const k = key(a.created_by), c = bakuDay(a.created_at), inW = c >= r.s && c <= r.end, inD = a.date >= r.s && a.date <= r.end;
      if (inW) { sess[k] = (sess[k] || 0) + 1; const m = sessR[k] || (sessR[k] = {}); m[a.reader_id] = (m[a.reader_id] || 0) + 1; }
      if (role(k) !== "specialist") {
        const x = sales[k] || (sales[k] = { a: 0, b: 0, d: 0 });
        if (inW) { x.a++; T.a++; } if (inD && !isGone(a) && over(a)) { x.b++; T.b++; } if (inD && isGone(a)) { x.d++; T.d++; }
      }
      if (inD && !isGone(a)) {
        const w = wr[k] || (wr[k] = { svc: {}, pl: {} }), sv = svcN(a.service), pl = plN(a.place);
        w.svc[sv] = (w.svc[sv] || 0) + 1; w.pl[pl] = (w.pl[pl] || 0) + 1; T.svc[sv] = (T.svc[sv] || 0) + 1; T.pl[pl] = (T.pl[pl] || 0) + 1;
        if (over(a)) { T.svcU[sv] = (T.svcU[sv] || 0) + 1; T.plU[pl] = (T.plU[pl] || 0) + 1; }
      }
    }
    // products
    const P = {}, PP = {}, PT = { q: 0, m: 0, sh: 0 };
    const pat = (x) => x.patient_of || (role(x.created_by) === "specialist" ? x.created_by : null);
    for (const x of sales_) {
      if (x.date < r.s || x.date > r.end) continue;
      const k = x.created_by && staff.some((s) => s.id === x.created_by) ? x.created_by : "-";
      const w = P[k] || (P[k] = { q: 0, m: 0, sh: 0 }); w.q += x.qty; w.m += x.amount; PT.q += x.qty; PT.m += x.amount;
      const pp = PP[x.product_id] || (PP[x.product_id] = { q: 0, m: 0 }); pp.q += x.qty; pp.m += x.amount;
      for (const sh of shares) {
        if (sh.product_id !== x.product_id || hidden(sh.staff_id) || !staff.some((s) => s.id === sh.staff_id)) continue;
        const gets = role(sh.staff_id) === "specialist" ? pat(x) === sh.staff_id : x.created_by === sh.staff_id;
        if (!gets) continue;
        const v = sh.amt ? Math.round(sh.amt * x.qty * 100) / 100 : Math.round(x.amount * sh.pct) / 100;
        (P[sh.staff_id] || (P[sh.staff_id] = { q: 0, m: 0, sh: 0 })).sh += v; PT.sh += v;
      }
    }
    return { sess, sessR, sales, wr, T, P, PP, PT };
  };
  const sales_ = sales;

  const db = { readers, staff, appts, breaks: [], expenses: [], product_sales: sales, products: prods, product_shares: shares, service_shares: [], stat_edits: [], services: [], audit_log: [{ id: 1 }], app_errors: [] };
  const num = (v) => { v = String(v).replace(/[\s  ₼]/g, "").replace(",", "."); return v === "" || v === "·" || v === "—" ? v : +v; };
  const eq = (a, b) => Math.abs(a - b) < 0.006;
  let checked = 0;
  // Mon evening; Thu 23:50 (last minute of a week); Fri 00:10 (a new week); the last evening and the first morning of a month
  for (const clock of ["2026-11-23T15:30:00Z", "2026-11-26T19:50:00Z", "2026-11-26T20:10:00Z", "2026-12-03T19:40:00Z", "2026-12-03T20:20:00Z"]) {
    const s = await open(OWNER, { db: JSON.parse(JSON.stringify(db)), clock });
    try {
      const p = s.page; await p.locator("#tabs:not([hidden])").waitFor({ timeout: 15000 }); await p.waitForTimeout(2500);
      await p.click('#tabs [data-tab="stats"]'); await p.waitForTimeout(300);
      const nb = new Date(new Date(clock).getTime() + 4 * 36e5).toISOString().slice(0, 10), PER = periods(nb);
      const read = (sel) => p.evaluate((q) => [...document.querySelectorAll(q)].map((tr) => [...tr.cells].map((c) => c.textContent.replace(/\s+/g, " ").trim())), sel);
      for (const sec of ["today", "cweek", "week", "cmonth", "month"]) {
        await p.click('#top [data-act="st-sec"][data-id="' + sec + '"]'); await p.waitForTimeout(250);
        const R = ref(clock, PER[sec]), w = clock + " " + sec + " (" + PER[sec].s + "…" + PER[sec].end + "): ";
        const head = await p.textContent("#main .sthead").catch(() => "");
        // «Kim neçə seans yazıb»
        const ss = await read('[data-st^="sess-"] tbody tr');
        // owner 24.11 evening: a column per specialist (his letter; the full name in data-full), «Cəmi» last
        const sh = await p.evaluate(() => [...document.querySelectorAll('[data-st^="sess-"] thead th')].map((x) => x.getAttribute("data-full") || x.textContent.trim()));
        const rid = (nm) => (readers.find((x) => x.name === nm) || {}).id;
        for (const row of ss) { const nm = row[0], n = row[row.length - 1], k = Object.keys(R.sess).find((x) => name(x) === nm);
          check(+n === (k ? R.sess[k] : 0), w + "«Kim neçə seans yazıb» " + nm + ": app " + n + ", rules " + (k ? R.sess[k] : 0) + " / " + head); checked++;
          for (let i = 1; i < row.length - 1; i++) { const exp = k && R.sessR[k] ? R.sessR[k][rid(sh[i])] || 0 : 0; check((+row[i] || 0) === exp, w + nm + " → " + sh[i] + ": app " + (row[i] || 0) + ", rules " + exp); checked++; }
          const sumCols = row.slice(1, -1).reduce((a, b) => a + (+b || 0), 0); check(sumCols === +n, w + nm + ": the specialists' columns add up to Cəmi"); }
        const want = new Set(Object.values(R.sessR).flatMap((m) => Object.keys(m)));
        check(sh.length - 2 === want.size && [...want].every((id) => sh.includes((readers.find((x) => x.id === id) || {}).name)), w + "a column for exactly the specialists written for: " + JSON.stringify(sh));
        for (const k of Object.keys(R.sess)) check(ss.some((r) => r[0] === name(k)), w + name(k) + " is missing in «Kim neçə seans yazıb»");
        const sf = await read('[data-st^="sess-"] tfoot tr');
        check(+sf[0][sf[0].length - 1] === Object.values(R.sess).reduce((a, b) => a + b, 0), w + "«Kim neçə seans yazıb» total");
        // «Ümumi cədvəl»
        const hd = await p.evaluate(() => [...document.querySelectorAll('[data-st^="big-"] thead tr.sub th')].map((x) => x.textContent.trim()));
        const big = await read('[data-st^="big-"] tbody tr'), bf = await read('[data-st^="big-"] tfoot tr');
        const col = (lab) => hd.indexOf(lab) + 1;
        for (const r of big) {
          const nm = r[0], k = [...staff.map((x) => x.id), "-"].find((x) => name(x) === nm);
          if (role(k) === "specialist") check(r[col("Yazdı")] === "·", w + nm + ": a specialist's sales numbers are «·»");
          else { const x = R.sales[k] || { a: 0, b: 0, d: 0 };
            check(+r[col("Yazdı")] === x.a && +r[col("Uğurlu")] === x.b && +r[col("Ləğv")] === x.d, w + nm + ": Yazdı/Uğurlu/Ləğv app " + [r[col("Yazdı")], r[col("Uğurlu")], r[col("Ləğv")]] + ", rules " + [x.a, x.b, x.d]); }
          const wv = R.wr[k] || { svc: {}, pl: {} };
          for (const sv of ["Ruqya", "Hicama", "Kombo", "Masaj", "Dr.Günel", "Psixoloq"]) check(+r[col(sv)] === (wv.svc[sv] || 0), w + nm + " " + sv + ": app " + r[col(sv)] + ", rules " + (wv.svc[sv] || 0));
          for (const [pl, lab] of [["ofis", "Ofis"], ["onlayn", "Onlayn"], ["unvan", "Ünvan"]]) check(+r[col(lab)] === (wv.pl[pl] || 0), w + nm + " " + lab + ": app " + r[col(lab)] + ", rules " + (wv.pl[pl] || 0));
          checked++;
        }
        for (const k of Object.keys(R.wr).concat(Object.keys(R.sales).filter((x) => R.sales[x].a + R.sales[x].b + R.sales[x].d > 0))) check(big.some((r) => r[0] === name(k)), w + name(k) + " is missing in «Ümumi cədvəl»");
        const tot = bf[0], ok2 = bf[1];
        check(+tot[col("Yazdı")] === R.T.a && +tot[col("Uğurlu")] === R.T.b && +tot[col("Ləğv")] === R.T.d, w + "Cəmi Yazdı/Uğurlu/Ləğv app " + [tot[col("Yazdı")], tot[col("Uğurlu")], tot[col("Ləğv")]] + ", rules " + [R.T.a, R.T.b, R.T.d]);
        // the «Uğurlu seans» row has one cell spanning the six sales columns
        const okv = (lab) => ok2[col(lab) - 5];
        for (const sv of ["Ruqya", "Hicama", "Kombo", "Masaj", "Dr.Günel", "Psixoloq"]) {
          check(+tot[col(sv)] === (R.T.svc[sv] || 0), w + "Cəmi " + sv + ": app " + tot[col(sv)] + ", rules " + (R.T.svc[sv] || 0));
          check(+okv(sv) === (R.T.svcU[sv] || 0), w + "Uğurlu seans " + sv + ": app " + okv(sv) + ", rules " + (R.T.svcU[sv] || 0));
        }
        for (const [pl, lab] of [["ofis", "Ofis"], ["onlayn", "Onlayn"], ["unvan", "Ünvan"]]) {
          check(+tot[col(lab)] === (R.T.pl[pl] || 0), w + "Cəmi " + lab);
          check(+okv(lab) === (R.T.plU[pl] || 0), w + "Uğurlu seans " + lab + ": app " + okv(lab) + ", rules " + (R.T.plU[pl] || 0));
        }
      }
      // «Məhsul» for every period
      await p.click('#top [data-act="st-sec"][data-id="prod"]'); await p.waitForTimeout(250);
      for (const per of ["today", "cweek", "week", "cmonth", "month"]) {
        await p.click('[data-act="st-per"][data-id="' + per + '"]'); await p.waitForTimeout(250);
        const R = ref(clock, PER[per]), w = clock + " Məhsul " + per + ": ";
        const rows = await read('[data-st^="prod-"] tbody tr'), ft = await read('[data-st^="prod-"] tfoot tr');
        for (const [nm, q, m, sh] of rows) {
          const k = [...staff.map((x) => x.id), "-"].find((x) => name(x) === nm), x = R.P[k] || { q: 0, m: 0, sh: 0 };
          check(+q === x.q && eq(num(m), x.m) && eq(num(sh), x.sh), w + nm + ": app " + [q, m, sh] + ", rules " + [x.q, x.m, x.sh]); checked++;
        }
        for (const k of Object.keys(R.P)) if (R.P[k].q || R.P[k].sh > 0) check(rows.some((r) => r[0] === name(k)), w + name(k) + " is missing");
        check(+ft[0][1] === R.PT.q && eq(num(ft[0][2]), R.PT.m) && eq(num(ft[0][3]), R.PT.sh), w + "Cəmi app " + ft[0].slice(1) + ", rules " + [R.PT.q, R.PT.m, R.PT.sh]);
        const pr = await read('[data-st^="prodp-"] tbody tr');
        for (const c of prods) { const r = pr.find((x) => x[0] === c.name), v = R.PP[c.id] || { q: 0, m: 0 }; check(r && r.length === 2 && +r[1] === v.q, w + c.name + ": app " + (r && r.slice(1)) + ", rules " + v.q + " (pieces only since 24.11)"); }
      }
      check(!s.errors.length, clock + ": no page errors: " + s.errors.join("; "));
    } finally { await s.close(); }
  }
  check(checked > 300, "rows compared: " + checked);
};
