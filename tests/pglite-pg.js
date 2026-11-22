// Stand-in for @electric-sql/pglite when that package cannot be installed (audit 6: no npm here): every PGlite
// gets its own fresh database on the PostgreSQL named by RUQYA_PG_PORT (tests/localpg.js), dropped on close().
// Roles are cluster-wide on a real server, so «create role X» becomes «create it if it is not there».
const { Client } = require("./pg-wire");
let n = 0;
class PGlite {
  constructor() { this.name = "pglite_" + process.pid + "_" + (++n); this.ready = this.init(); }
  async init() {
    const port = +process.env.RUQYA_PG_PORT; if (!port) throw new Error("PGlite stand-in needs RUQYA_PG_PORT");
    const a = new Client({ host: "127.0.0.1", port, user: "postgres", database: "postgres" }); await a.connect();
    await a.query("drop database if exists " + this.name); try { await a.query("create database " + this.name + " template template0 encoding 'UTF8' lc_collate 'C' lc_ctype 'C.UTF-8'"); } catch (e) { await a.query("create database " + this.name); }   /* PGlite has UTF-8 character rules */ await a.end();
    this.c = new Client({ host: "127.0.0.1", port, user: "postgres", database: this.name }); this.c.on("error", () => {}); await this.c.connect();
    this.port = port;
  }
  fix(sql) { return String(sql).replace(/create role (\w+)( [^;]*)?;/gi, (m, r, rest) => "do $$ begin if not exists (select 1 from pg_roles where rolname='" + r + "') then create role " + r + (rest || "") + "; end if; end $$;"); }
  async exec(sql) { await this.ready; const r = await this.c.query(this.fix(sql)); return (r.all || [r]).map((x) => ({ rows: x.rows, affectedRows: x.rowCount, fields: x.fields })); }
  async query(sql, params) { await this.ready; const r = await this.c.query(this.fix(sql), params); return { rows: r.rows, affectedRows: r.rowCount, fields: r.fields }; }
  async close() { await this.ready; await this.c.end(); const a = new Client({ host: "127.0.0.1", port: this.port, user: "postgres", database: "postgres" }); await a.connect(); await a.query("drop database if exists " + this.name + " with (force)"); await a.end(); }
  get waitReady() { return this.ready; }
}
module.exports = { PGlite };
