// T-07 / T-11 / T-12: the server answers 401, 403, 409, 429, 500 or not at all (timeout) on each kind of request,
// two people edit one booking, wrong phone clock, full / blocked browser storage. For every case: no page error,
// no empty screen, a message the user understands, and nothing typed is lost.
// FAULTS_OUT=<file> writes what the user saw in each case.
const fs = require("fs"), path = require("path");
const { open, check, AGENT, OWNER } = require("../lib");

async function ready(p) { await p.waitForSelector("text=Test Pasiyent", { timeout: 15000 }); await p.waitForTimeout(3300); }
async function fillBooking(p, name) {
  await p.click("#fab"); await p.waitForSelector("#f-reader");
  await p.selectOption("#f-reader", { index: 1 }); await p.fill("#f-time", "16:00"); await p.fill("#f-name", name); await p.fill("#f-phone", "050 222 33 44");
}
const seen = [];
async function note(p, label) {
  const t = ((await p.textContent("body")) || "").replace(/\s+/g, " ");
  const main = (await p.$eval("#main", (e) => e.children.length).catch(() => 0));
  const login = await p.$("#l-mail");
  const msg = (t.match(/(Yadda saxlanmadı[^.]*\.|Serverlə əlaqə yoxdur[^.]*\.|Bu saat artıq tutulub[^.]*\.|Bunu etməyə icazəniz yoxdur\.|Bir saatda çox dəyişiklik[^.]*\.|Girişin vaxtı bitib[^.]*\.|Qəbulları yükləmək olmadı[^.]*\.|Yadda saxlanmayan qəbul: [^Gİ]*)/g) || []).slice(0, 2).join(" | ");
  seen.push(label + "\tmain children " + main + (login ? " (sign-in screen)" : "") + "\tmessage: " + (msg || "—"));
  return { main, msg, login };
}

module.exports = async () => {
  const cases = [
    [401, { code: "PGRST301", message: "JWT expired" }], [403, { code: "42501", message: "permission denied" }],
    [409, { code: "23505", message: "Bu saat artiq tutulub" }], [429, { code: "429", message: "Too Many Requests" }],
    [500, { code: "XX000", message: "internal error" }], ["net", null],
  ];
  for (const [st, body] of cases) {
    const s = await open(AGENT);
    try {
      const p = s.page; await ready(p);
      await fillBooking(p, "Sınaq " + st);
      if (st === 401) { s.ctl.expired = true; s.ctl.authDown = true; }
      else s.ctl.failWrite = st === "net" ? "net" : { status: st, body };
      await p.click('[data-act="save-appt"]'); await p.waitForTimeout(2500);
      const r = await note(p, "save booking → " + st);
      check(!s.errors.length, st + ": no page error: " + s.errors.join("; "));
      check(r.main > 0 || r.login, st + ": screen not empty");
      check(!!r.msg, st + ": user sees a message");
      check(!s.db.appts.some((a) => a.name === "Sınaq " + st), st + ": nothing half-saved");
      if (st === 401) { s.ctl.authDown = false; await p.fill("#l-mail", "agent@x.az"); await p.fill("#l-pass", "x1234567"); await p.click('[data-act="login"]'); await p.waitForSelector(".draftbox", { timeout: 15000 }); }
      check(await p.isVisible(".draftbox"), st + ": the typing is kept (draft notice)");
    } finally { await s.close(); }
  }
  // the first load fails (500, then network): message, retry, no blank screen
  for (const st of [500, "net"]) {
    const s = await open(AGENT, { noWait: true });
    try {
      const p = s.page; s.ctl.offlineReads = st;
      await p.route("**/rest/v1/appts*", (r) => (st === "net" ? r.abort() : r.fulfill({ status: 500, body: '{"message":"x"}', headers: { "content-type": "application/json" } })));
      await p.reload(); await p.waitForTimeout(6000);
      const r = await note(p, "first load of bookings → " + st);
      check(!s.errors.length, "load " + st + ": no page error: " + s.errors.join("; "));
      check(r.main > 0, "load " + st + ": screen not empty");
      check(/yükləmək olmadı/i.test(r.msg), "load " + st + ": the user is told: " + r.msg);
      await p.unroute("**/rest/v1/appts*");
      await p.waitForSelector("text=Test Pasiyent", { timeout: 30000 });   // it retries by itself
    } finally { await s.close(); }
  }
  // two people change the same booking: different fields both survive
  {
    const s = await open(AGENT);
    try {
      const p = s.page; await ready(p);
      await p.click("#cal >> text=Test Pasiyent"); await p.click('[data-act="edit-appt"]'); await p.waitForSelector("#f-note");
      s.db.appts[0].price = 999;   // the other phone changed the price meanwhile
      await p.fill("#f-note", "mənim qeydim"); await p.click('[data-act="save-appt"]'); await p.waitForTimeout(900);
      check(s.db.appts[0].price === 999 && s.db.appts[0].note === "mənim qeydim", "both changes kept: " + JSON.stringify({ price: s.db.appts[0].price, note: s.db.appts[0].note }));
      seen.push("two people edit one booking (price on phone 2, note on phone 1)\tprice " + s.db.appts[0].price + ", note «" + s.db.appts[0].note + "»");
    } finally { await s.close(); }
  }
  // phone clock 3 days behind, storage full, storage blocked
  {
    const s = await open(AGENT, { clock: Date.now() - 3 * 864e5 });
    try { const p = s.page; await p.waitForSelector("#tabs:not([hidden])", { timeout: 15000 }); check(!s.errors.length, "wrong clock: no page error"); seen.push("phone clock 3 days behind\topens, no error"); } finally { await s.close(); }
  }
  {
    const s = await open(AGENT, { init: [() => { try { const big = "x".repeat(1024 * 1024); for (let i = 0; i < 9; i++) localStorage.setItem("fill" + i, big); } catch (e) {} }, null] });
    try { const p = s.page; await ready(p); await fillBooking(p, "Dolu yaddaş"); await p.click('[data-act="save-appt"]'); await p.waitForTimeout(900); check(s.db.appts.some((a) => a.name === "Dolu yaddaş"), "full storage: booking still saved"); check(!s.errors.length, "full storage: no page error: " + s.errors.join("; ")); seen.push("browser storage full\tbooking saved, no error"); } finally { await s.close(); }
  }
  {
    const s = await open(AGENT, { init: [() => { const deny = () => { throw new DOMException("denied", "SecurityError"); }; try { Object.defineProperty(window, "localStorage", { get: deny }); Object.defineProperty(window, "sessionStorage", { get: deny }); } catch (e) {} }, null] });
    try { const p = s.page; await p.waitForTimeout(5000); const t = await p.textContent("body"); check(!s.errors.length, "storage blocked: no page error: " + s.errors.join("; ")); check(/Daxil ol|Qəbul|Mərkəz/.test(t), "storage blocked: something shown"); seen.push("browser storage blocked\t" + (/Daxil ol/.test(t) ? "sign-in screen shown" : "app shown") + ", no error"); } finally { await s.close(); }
  }
  const out = process.env.FAULTS_OUT;
  if (out) { fs.mkdirSync(path.dirname(out), { recursive: true }); fs.writeFileSync(out, "# fault cases — " + new Date().toISOString() + "\n" + seen.join("\n") + "\n"); }
};
