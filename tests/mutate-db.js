// Are the access tests good enough? Each mutation below breaks one protection on a fresh copy; the access matrix
// and the attack list are then run. A mutation is "caught" when at least one check fails.
//   node tests/mutate-db.js <out.txt>
const fs = require("fs");
const { start } = require("./localpg"), { build, as } = require("./dbcopy"), { ROLES, M } = require("./access-matrix"), { ATTACKS } = require("./attacks");
const MUT = [
  ["M-01 bookings readable by everyone signed in", "drop policy ruqya_appts_read on public.appts; create policy ruqya_appts_read on public.appts for select to authenticated using (true);"],
  ["M-02 every signed-in user is admin", "create or replace function public.ruqya_is_admin() returns boolean language sql stable security definer set search_path=public as $$ select true $$;"],
  ["M-03 owner/writer check removed from bookings", "drop trigger ruqya_appt_owner on public.appts;"],
  ["M-04 journal readable by everyone", "drop policy ruqya_audit_owner on public.audit_log; create policy ruqya_audit_owner on public.audit_log for select to authenticated using (true);"],
  ["M-05 expenses of others visible to agents", "drop policy ruqya_expenses_staff on public.expenses; create policy ruqya_expenses_staff on public.expenses to authenticated using (public.ruqya_sees_all()) with check (public.ruqya_sees_all());"],
  ["M-06 role guard removed (self-promotion)", "drop trigger ruqya_staff_guard on public.staff;"],
  ["M-07 writer stamp removed (fake author)", "drop trigger ruqya_stamp on public.appts;"],
  ["M-08 specialists see every column", "create or replace function public.ruqya_sees_all() returns boolean language sql stable security definer set search_path=public as $$ select true $$;"],
  ["M-09 price/share columns opened", "grant select on public.readers to authenticated;"],
  ["M-10 restore without admin check", "create or replace function public.ruqya_restore(aid bigint) returns text language plpgsql security definer set search_path=public as $$ begin return 'ok'; end $$;"],
  ["M-11 RLS switched off on product sales", "alter table public.product_sales disable row level security;"],
  ["M-12 rate limit removed", "drop trigger ruqya_zthrottle on public.appts;"],
  ["M-13 journal writable by signed-in users", "grant insert, update, delete on public.audit_log to authenticated; create policy x on public.audit_log for all to authenticated using (true) with check (true);"],
  ["M-14 statistics corrections of others writable", "drop policy ruqya_stat_edits_write on public.stat_edits; create policy ruqya_stat_edits_write on public.stat_edits for all to authenticated using (true) with check (true);"],
];
async function checks(c) {
  let fail = 0;
  for (const [t, ops] of Object.entries(M)) for (const [op, [sql, want]] of Object.entries(ops)) for (let i = 0; i < ROLES.length; i++) {
    const r = await as(c, ROLES[i], sql); const got = r.ok && (op === "INSERT" || r.rowCount > 0) ? 1 : 0; if (got !== want[i]) fail++;
  }
  for (const [, , who, sql, safe] of ATTACKS) { const r = await as(c, who, sql); if (!safe(r)) fail++; }
  return fail;
}
(async () => {
  const pg = await start(54334), lines = [];
  let caught = 0;
  try {
    for (let i = 0; i < MUT.length; i++) {
      const c = await build(pg, "mut" + i);
      await c.query(MUT[i][1]);
      const f = await checks(c); await c.end();
      if (f > 0) caught++;
      lines.push((f > 0 ? "CAUGHT  " : "MISSED  ") + MUT[i][0] + "  (" + f + " failing checks)");
      console.log(lines[lines.length - 1]);
    }
    const c0 = await build(pg, "mutnone"); const f0 = await checks(c0); await c0.end();
    lines.push("control (no mutation): " + f0 + " failing checks");
  } finally { await pg.stop(); }
  const txt = "# DB test mutation check — " + new Date().toISOString() + "\n# caught " + caught + " of " + MUT.length + "\n" + lines.join("\n") + "\n";
  if (process.argv[2]) { fs.mkdirSync(require("path").dirname(process.argv[2]), { recursive: true }); fs.writeFileSync(process.argv[2], txt); }
  console.log("caught " + caught + " of " + MUT.length);
  process.exit(caught === MUT.length ? 0 : 1);
})();
