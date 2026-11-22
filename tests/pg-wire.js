// Minimal stand-in for the npm package "pg" (only what the Ruqya tests use): Client({host,port,user,database}),
// connect(), query(text, params) -> {rows, rowCount, fields}, end(), on('error'). PostgreSQL wire protocol v3,
// trust authentication only. Simple query protocol without parameters (several statements allowed), extended
// protocol with text parameters otherwise. Values are converted like pg-types for the common types.
// Written for audit 6 because npm packages cannot be installed in this environment (no network).
"use strict";
const net = require("net"), EventEmitter = require("events");

function parseArray(s, conv) {
  // one-dimensional text array literal {a,"b c",NULL}
  if (s === "{}") return [];
  const out = []; let i = 1, cur = "", q = false, quoted = false;
  for (; i < s.length; i++) {
    const ch = s[i];
    if (q) { if (ch === "\\") { cur += s[++i]; } else if (ch === '"') q = false; else cur += ch; continue; }
    if (ch === '"') { q = true; quoted = true; continue; }
    if (ch === "," || ch === "}") { out.push(!quoted && cur === "NULL" ? null : conv(cur)); cur = ""; quoted = false; continue; }
    cur += ch;
  }
  return out;
}
const id = (x) => x, int = (x) => parseInt(x, 10), flt = (x) => parseFloat(x);
const date = (x) => { if (/^\d{4}-\d{2}-\d{2}$/.test(x)) { const [y, m, d] = x.split("-").map(Number); return new Date(y, m - 1, d); } return new Date(x); };
const ts = (x) => { if (x === "infinity" || x === "-infinity") return x; return new Date(/[+-]\d\d(:\d\d)?$/.test(x) ? x.replace(" ", "T").replace(/([+-]\d\d)$/, "$1:00") : x.replace(" ", "T")); };
const TYPES = {
  16: (x) => x === "t", 20: id, 21: int, 23: int, 26: int, 700: flt, 701: flt, 1700: id, 114: JSON.parse, 3802: JSON.parse,
  1082: date, 1114: ts, 1184: ts,
  1000: (x) => parseArray(x, (v) => v === "t"), 1005: (x) => parseArray(x, int), 1007: (x) => parseArray(x, int), 1016: (x) => parseArray(x, id),
  1009: (x) => parseArray(x, id), 1015: (x) => parseArray(x, id), 1182: (x) => parseArray(x, id), 2951: (x) => parseArray(x, id),
  199: (x) => parseArray(x, JSON.parse), 3807: (x) => parseArray(x, JSON.parse), 1021: (x) => parseArray(x, flt), 1022: (x) => parseArray(x, flt),
};

class Client extends EventEmitter {
  constructor(o) { super(); o = typeof o === "string" ? { connectionString: o } : (o || {});
    if (o.connectionString) { const u = new URL(o.connectionString); o = { host: u.hostname, port: +u.port || 5432, user: decodeURIComponent(u.username || "postgres"), database: u.pathname.slice(1) || "postgres" }; }
    this.o = { host: o.host || "127.0.0.1", port: o.port || 5432, user: o.user || "postgres", database: o.database || o.user || "postgres" };
    this.buf = Buffer.alloc(0); this.q = []; this.cur = null; this.ready = false; }
  connect(cb) {
    const p = new Promise((ok, bad) => {
      const s = this.s = net.connect(this.o.port, this.o.host);
      this.connCb = { ok, bad };
      s.on("connect", () => {
        const kv = Buffer.from("user\0" + this.o.user + "\0database\0" + this.o.database + "\0client_encoding\0UTF8\0\0");
        const h = Buffer.alloc(8); h.writeInt32BE(8 + kv.length, 0); h.writeInt32BE(196608, 4); s.write(Buffer.concat([h, kv]));
      });
      s.on("data", (d) => { this.buf = Buffer.concat([this.buf, d]); this.read(); });
      s.on("error", (e) => { if (this.connCb) { this.connCb.bad(e); this.connCb = null; } else { if (this.cur) { this.cur.bad(e); this.cur = null; } this.emit("error", e); } });
      s.on("close", () => { const e = new Error("Connection terminated"); if (this.cur) { this.cur.bad(e); this.cur = null; } this.q.forEach((x) => x.bad(e)); this.q = []; });
    });
    if (cb) p.then(() => cb(null), cb);
    return p;
  }
  read() {
    while (this.buf.length >= 5) {
      const t = String.fromCharCode(this.buf[0]), len = this.buf.readInt32BE(1);
      if (this.buf.length < 1 + len) return;
      const b = this.buf.slice(5, 1 + len); this.buf = this.buf.slice(1 + len); this.msg(t, b);
    }
  }
  msg(t, b) {
    const c = this.cur;
    switch (t) {
      case "R": { const code = b.readInt32BE(0); if (code !== 0 && this.connCb) { this.connCb.bad(new Error("auth method " + code + " not supported")); this.connCb = null; } return; }
      case "S": case "K": case "N": case "1": case "2": case "3": case "n": case "s": case "A": return;
      case "Z": if (this.connCb) { this.ready = true; this.connCb.ok(this); this.connCb = null; this.next(); return; }
        if (c) { this.cur = null; if (c.err) c.bad(c.err); else { const r = c.results.length ? c.results[c.results.length - 1] : { rows: [], rowCount: 0, fields: [], command: null }; r.all = c.results; c.ok(r); } } this.next(); return;
      case "T": { const n = b.readInt16BE(0); let o = 2; const f = [];
        for (let i = 0; i < n; i++) { const e = b.indexOf(0, o); const name = b.slice(o, e).toString("utf8"); o = e + 1; const typ = b.readInt32BE(o + 6); o += 18; f.push({ name, dataTypeID: typ }); }
        c.fields = f; c.rows = []; return; }
      case "D": { const n = b.readInt16BE(0); let o = 2; const row = {};
        for (let i = 0; i < n; i++) { const l = b.readInt32BE(o); o += 4; const fd = c.fields[i]; if (l < 0) { row[fd.name] = null; continue; }
          const v = b.slice(o, o + l).toString("utf8"); o += l; const conv = TYPES[fd.dataTypeID]; row[fd.name] = conv ? conv(v) : v; }
        c.rows.push(row); return; }
      case "C": { const tag = b.slice(0, b.length - 1).toString(); const m = tag.match(/(\d+)$/); const cmd = tag.split(" ")[0];
        c.results.push({ command: cmd, rowCount: m && cmd !== "SELECT" || m ? +m[1] : null, rows: c.rows || [], fields: c.fields || [] }); c.rows = null; c.fields = null; return; }
      case "I": c.results.push({ command: null, rowCount: null, rows: [], fields: [] }); return;
      case "E": { const e = this.err(b); if (this.connCb) { this.connCb.bad(e); this.connCb = null; return; } if (c && !c.err) c.err = e; return; }
      default: return;
    }
  }
  err(b) { const f = {}; let o = 0; while (o < b.length && b[o] !== 0) { const k = String.fromCharCode(b[o]); const e = b.indexOf(0, o + 1); f[k] = b.slice(o + 1, e).toString("utf8"); o = e + 1; }
    const e = new Error(f.M || "error"); e.code = f.C; e.severity = f.S; e.detail = f.D; e.hint = f.H; e.where = f.W; e.position = f.P; return e; }
  query(text, params, cb) {
    if (typeof text === "object" && text.text) { params = text.values; text = text.text; }
    if (typeof params === "function") { cb = params; params = undefined; }
    const p = new Promise((ok, bad) => { this.q.push({ text: String(text), params, ok, bad, results: [] }); if (this.ready && !this.cur) this.next(); });
    if (cb) p.then((r) => cb(null, r), (e) => cb(e));
    return p;
  }
  next() {
    if (this.cur || !this.q.length || !this.ready) return;
    const c = this.cur = this.q.shift(), s = this.s;
    const msg = (t, body) => { const h = Buffer.alloc(5); h.write(t, 0); h.writeInt32BE(4 + body.length, 1); return Buffer.concat([h, body]); };
    const cstr = (x) => Buffer.from(x + "\0", "utf8");
    if (!c.params || !c.params.length) { s.write(msg("Q", cstr(c.text))); return; }
    const parse = msg("P", Buffer.concat([cstr(""), cstr(c.text), Buffer.from([0, 0])]));
    const parts = [cstr(""), cstr(""), Buffer.from([0, 0])], n = Buffer.alloc(2); n.writeInt16BE(c.params.length); parts.push(n);
    for (const v of c.params) {
      if (v === null || v === undefined) { const l = Buffer.alloc(4); l.writeInt32BE(-1); parts.push(l); continue; }
      const sv = Buffer.from(v instanceof Date ? v.toISOString() : typeof v === "object" ? JSON.stringify(v) : String(v), "utf8");
      const l = Buffer.alloc(4); l.writeInt32BE(sv.length); parts.push(l, sv);
    }
    parts.push(Buffer.from([0, 0]));
    const bind = msg("B", Buffer.concat(parts));
    const desc = msg("D", Buffer.concat([Buffer.from("P"), cstr("")]));
    const exe = msg("E", Buffer.concat([cstr(""), Buffer.from([0, 0, 0, 0])]));
    s.write(Buffer.concat([parse, bind, desc, exe, msg("S", Buffer.alloc(0))]));
  }
  end(cb) { const p = new Promise((ok) => { try { const h = Buffer.from([88, 0, 0, 0, 4]); this.s.end(h); } catch (e) {} this.s.once("close", ok); setTimeout(ok, 500); }); if (cb) p.then(() => cb()); return p; }
}
class Pool extends EventEmitter {
  constructor(o) { super(); this.o = o; }
  async connect() { const c = new Client(this.o); await c.connect(); c.release = () => c.end(); return c; }
  async query(t, p) { const c = new Client(this.o); await c.connect(); try { return await c.query(t, p); } finally { await c.end(); } }
  async end() {}
}
module.exports = { Client, Pool, types: { setTypeParser() {} } };
