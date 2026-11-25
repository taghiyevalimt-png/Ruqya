// 24.11 (owner): «Bildirişlər» in Ayarlar — off by default; a specialist chooses how many minutes before a session to be
// reminded, and whether to hear when a session is booked for him. Checked with the mock server:
//  - the section is there for the specialist (his name is a column) and for admins (evening report), not for an agent;
//  - both off at first; a choice asks the device's permission, subscribes this browser (Web Push) and saves;
//    turning everything off drops the browser's subscription; a refused permission changes nothing and says so;
//  - iPhone Safari (not on the home screen): a hint how to add it, the choices are disabled;
//  - the Android app: gets a device token and starts its own check (notifyConfig); an older app: «install the new one»;
//  - «Çıxış» stops the notices on this device.
const { open, check, SPEC, AGENT, OWNER, seed } = require("../lib");
const fakePush = () => { const fake = { endpoint: "https://push.example/x1", toJSON() { return { endpoint: this.endpoint, keys: { p256dh: "B" + "A".repeat(86), auth: "AAAAAAAAAAAAAAAAAAAAAA" } }; }, unsubscribe() { window.__unsub = 1; window.__sub = null; return Promise.resolve(true); } };
  window.__sub = null; if (window.PushManager) { PushManager.prototype.subscribe = function () { window.__sub = fake; return Promise.resolve(fake); }; PushManager.prototype.getSubscription = function () { return Promise.resolve(window.__sub); }; } };
const go = async (p) => { await p.locator("#tabs:not([hidden])").waitFor({ timeout: 15000 }); await p.waitForTimeout(2500); await p.click('#tabs [data-tab="readers"]'); await p.waitForTimeout(300); };
const state = (p) => p.evaluate(() => ({ rem: [...document.querySelectorAll('[data-act="ntf-rem"]')].filter((b) => b.getAttribute("aria-pressed") === "true").map((b) => b.dataset.id),
  nw: [...document.querySelectorAll('[data-act="ntf-new"]')].filter((b) => b.getAttribute("aria-pressed") === "true").map((b) => b.dataset.id),
  dis: [...document.querySelectorAll('[data-act="ntf-rem"]')].every((b) => b.disabled), hint: (document.querySelector('#main [role="status"]') || {}).textContent || "", test: !!document.querySelector('[data-act="ntf-test"]') }));
module.exports = async () => {
  // who sees the section
  for (const [who, name, want] of [[AGENT, "agent", false], [OWNER, "admin without a column (24.11 wave 3: the evening report)", true], [SPEC, "specialist", true]]) {
    const s = await open(who, { db: seed() });
    try { await go(s.page); check((await s.page.locator('#top [data-act="set-sec"][data-id="notify"]').count() > 0) === want, name + ": «Bildirişlər» " + (want ? "shown" : "not shown")); }
    finally { await s.close(); }
  }
  // a server without the notification functions yet: a note, nothing to choose, no error
  {
    const s = await open(SPEC, { db: seed() });
    try {
      const p = s.page; s.ctl.noNotify = true; await go(p); await p.click('#top [data-act="set-sec"][data-id="notify"]'); await p.waitForTimeout(600);
      const st = await state(p);
      check(st.dis && /tezliklə/.test(st.hint) && !s.errors.length, "server not ready yet: «soon», choices disabled, no error: " + JSON.stringify(st));
    } finally { await s.close(); }
  }
  // the web (a computer, Android Chrome, an iPhone home-screen app)
  {
    const s = await open(SPEC, { db: seed(), init: [fakePush, null] });
    try {
      const p = s.page; await s.context.grantPermissions(["notifications"]); await go(p);
      await p.click('#top [data-act="set-sec"][data-id="notify"]'); await p.waitForTimeout(500);
      let st = await state(p);
      check(st.rem.join() === "0" && st.nw.join() === "0" && !st.dis, "web: both off at first, the choices work: " + JSON.stringify(st));
      await p.click('[data-act="ntf-rem"][data-id="15"]'); await p.waitForTimeout(1500);
      const N = () => s.db.notify || { prefs: {}, subs: [] };
      check(N().subs.length === 1 && N().subs[0].endpoint === "https://push.example/x1", "web: this browser is subscribed: " + JSON.stringify(N().subs));
      check(N().prefs[SPEC] && N().prefs[SPEC].remind_min === 15 && N().prefs[SPEC].on_new === false, "web: «15 minutes before» saved: " + JSON.stringify(N().prefs));
      check(await p.evaluate(() => navigator.serviceWorker.getRegistration().then((g) => !!g && /sw\.js$/.test((g.active || g.waiting || g.installing).scriptURL))), "web: the notification worker (sw.js) is registered");
      await p.click('[data-act="ntf-new"][data-id="1"]'); await p.waitForTimeout(1000);
      st = await state(p);
      check(N().prefs[SPEC].on_new === true && st.rem.join() === "15" && st.nw.join() === "1" && st.test, "web: «tell me about new bookings» on; a test button: " + JSON.stringify(st));
      await p.click('[data-act="ntf-test"]'); await p.waitForTimeout(500);
      await p.click('[data-act="ntf-rem"][data-id="0"]'); await p.waitForTimeout(800); await p.click('[data-act="ntf-new"][data-id="0"]'); await p.waitForTimeout(1200);
      check(N().prefs[SPEC].remind_min === null && N().prefs[SPEC].on_new === false && N().subs.length === 0 && await p.evaluate(() => window.__unsub === 1), "web: all off → saved, the browser's subscription dropped");
      check(!s.errors.length, "web: no page errors: " + s.errors.join(" | "));
    } finally { await s.close(); }
  }
  // permission refused
  {
    const s = await open(SPEC, { db: seed(), init: [() => { window.Notification.requestPermission = () => Promise.resolve("denied"); }, null] });
    try {
      const p = s.page; await go(p); await p.click('#top [data-act="set-sec"][data-id="notify"]'); await p.waitForTimeout(500);
      await p.click('[data-act="ntf-rem"][data-id="30"]'); await p.waitForTimeout(1000);
      const st = await state(p);
      check(st.rem.join() === "0" && !(s.db.notify && s.db.notify.prefs[SPEC]) && /icazə/.test(st.hint), "refused permission: nothing saved, it says why: " + JSON.stringify(st));
    } finally { await s.close(); }
  }
  // iPhone Safari, not on the home screen
  {
    const ua = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
    const s = await open(SPEC, { db: seed(), init: [(u) => { Object.defineProperty(navigator, "userAgent", { get: () => u }); }, ua] });
    try {
      const p = s.page; await go(p); await p.click('#top [data-act="set-sec"][data-id="notify"]'); await p.waitForTimeout(500);
      const st = await state(p);
      check(st.dis && /Ana ekrana/.test(st.hint), "iPhone Safari: how to add it to the home screen; choices disabled: " + JSON.stringify(st));
    } finally { await s.close(); }
  }
  // the Android app, new and old
  for (const fresh of [true, false]) {
    const s = await open(SPEC, { db: seed(), init: [(f) => { window.__cfg = []; window.RuqyaApp = { setWidgetData() {}, version: () => 99, setLook() {} }; if (f) { window.RuqyaApp.notifyConfig = (j) => window.__cfg.push(JSON.parse(j)); window.RuqyaApp.notifyTest = () => { window.__tested = 1; }; } }, fresh] });
    try {
      const p = s.page; await go(p); await p.click('#top [data-act="set-sec"][data-id="notify"]'); await p.waitForTimeout(500);
      if (!fresh) { const st = await state(p); check(st.dis && /yeni versiya/.test(st.hint), "an older Android app: «install the new version»: " + JSON.stringify(st)); continue; }
      await p.click('[data-act="ntf-rem"][data-id="30"]'); await p.waitForTimeout(1200);
      const cfg = await p.evaluate(() => window.__cfg);
      check(cfg.length === 1 && cfg[0].on === true && /^d0000000-/.test(cfg[0].token) && /supabase\.co$/.test(cfg[0].url) && cfg[0].key, "Android: a device token, its own check started: " + JSON.stringify(cfg));
      check(s.db.notify.prefs[SPEC].remind_min === 30, "Android: saved");
      await p.click('[data-act="ntf-test"]'); check(await p.evaluate(() => window.__tested === 1), "Android: the test notice is shown by the app");
      await p.reload(); await p.locator("#tabs:not([hidden])").waitFor({ timeout: 15000 }); await p.waitForTimeout(800);
      check(await p.evaluate(() => window.__cfg.length === 1 && window.__cfg[0].on === true), "Android: at the next start the check is armed again");
    } finally { await s.close(); }
  }
};
