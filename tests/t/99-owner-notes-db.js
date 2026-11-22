// Owner 18.11 notes, database part (sql/2026-11-owner-notes.sql), on the copy database:
//  - a specialist adds, changes and deletes breaks of his own column only (not shared ones, not other columns);
//  - breaks can have days of the week and a date range; wrong values are refused;
//  - only an admin can keep an agent out of the statistics (hide_stats), the agent cannot change it for himself;
//  - the rollback brings the earlier rules back.
const fs = require("fs"), path = require("path");
const { start } = require("../localpg"), { build, upTo, as, R } = require("../dbcopy"), { check } = require("../lib");
module.exports = async () => {
  const pg = await start(54371); let c;
  try {
    c = await build(pg, "ownernotes", { after: upTo("2026-11-owner-notes.sql") })   /* audit 6: its rollback is rehearsed below — newer migrations are not on top */;
    const brk = (rid, extra = "") => "insert into public.breaks (title, start_time, end_time, reader_id" + (extra ? ", days, date_from, date_to" : "") + ") values ('Namaz', '13:00', '13:30', " + (rid ? "'" + rid + "'" : "null") + (extra ? ", " + extra : "") + ") returning id";
    // specialist (column «Əli») — own column yes, other column and shared no
    let r = await as(c, "spec", brk(R.ali)); check(r.ok && r.rowCount === 1, "specialist adds a break to his own column: " + (r.ok ? "ok" : r.error));
    r = await as(c, "spec", brk(R.ilkin)); check(!r.ok, "specialist cannot add a break to another column: " + (r.ok ? "allowed" : r.code));
    r = await as(c, "spec", brk(null)); check(!r.ok, "specialist cannot add a shared break (for everyone): " + (r.ok ? "allowed" : r.code));
    const own = (await c.query(brk(R.ali))).rows[0].id, other = (await c.query(brk(R.ilkin))).rows[0].id;
    r = await as(c, "spec", "update public.breaks set title = 'Nahar' where id = '" + own + "'"); check(r.ok && r.rowCount === 1, "specialist changes his own break");
    r = await as(c, "spec", "update public.breaks set reader_id = '" + R.ilkin + "' where id = '" + own + "'"); check(!r.ok, "specialist cannot move his break to another column");
    r = await as(c, "spec", "update public.breaks set title = 'X' where id = '" + other + "'"); check(r.ok && r.rowCount === 0, "specialist cannot change another column's break (0 rows)");
    r = await as(c, "spec", "delete from public.breaks where id = '" + own + "'"); check(r.ok && r.rowCount === 1, "specialist deletes his own break");
    r = await as(c, "spec", "delete from public.breaks where id = '" + other + "'"); check(r.ok && r.rowCount === 0, "specialist cannot delete another column's break");
    r = await as(c, "agentA", brk(null)); check(r.ok, "agents still add shared breaks: " + (r.ok ? "ok" : r.error));
    r = await as(c, "pending", brk(R.ali)); check(!r.ok || r.rowCount === 0, "a person without a role adds nothing");
    // days of the week and dates
    r = await as(c, "agentA", brk(R.ali, "array[1,3,5]::smallint[], current_date, current_date + 30")); check(r.ok, "break on Mon/Wed/Fri for a month: " + (r.ok ? "ok" : r.error));
    r = await as(c, "agentA", brk(R.ali, "null, current_date + 2, current_date + 2")); check(r.ok, "break on one date: " + (r.ok ? "ok" : r.error));
    r = await as(c, "agentA", brk(R.ali, "array[0,8]::smallint[], null, null")); check(!r.ok && r.code === "23514", "day numbers outside 1–7 are refused: " + (r.ok ? "accepted" : r.code));
    r = await as(c, "agentA", brk(R.ali, "null, current_date + 5, current_date + 1")); check(!r.ok && r.code === "23514", "an end date before the start is refused: " + (r.ok ? "accepted" : r.code));
    // hide_stats: admin only
    r = await as(c, "admin2", "update public.staff set hide_stats = true where id = 'a0000000-0000-4000-8000-0000000000ab'"); check(r.ok && r.rowCount === 1, "admin keeps an agent out of the statistics: " + (r.ok ? r.rowCount : r.error));
    r = await as(c, "owner", "update public.staff set hide_stats = true where id = 'a0000000-0000-4000-8000-0000000000aa'"); check(r.ok && r.rowCount === 1, "the main admin too: " + (r.ok ? r.rowCount : r.error));
    r = await as(c, "agentA", "update public.staff set hide_stats = true where id = 'a0000000-0000-4000-8000-0000000000aa'"); check(!r.ok && r.code === "42501", "an agent cannot change it for himself: " + (r.ok ? "allowed" : r.code));
    r = await as(c, "agentA", "update public.staff set name = 'Agent A yeni' where id = 'a0000000-0000-4000-8000-0000000000aa'"); check(r.ok && r.rowCount === 1, "an agent still changes his own name: " + (r.ok ? r.rowCount : r.error));
    r = await as(c, "admin2", "update public.staff set name = 'Agent B yeni' where id = 'a0000000-0000-4000-8000-0000000000ab'"); check(r.ok && r.rowCount === 1, "admin changes another worker's name: " + (r.ok ? r.rowCount : r.error));
    r = await as(c, "admin2", "update public.staff set name = 'Admin 2 yeni' where id = 'a0000000-0000-4000-8000-0000000000a2'"); check(r.ok && r.rowCount === 1, "admin changes his own name: " + (r.ok ? r.rowCount : r.error));
    r = await as(c, "owner", "update public.staff set name = 'Sahib' where id = 'bad097d4-5edc-402b-ad59-f633252c35d9'"); check(r.ok && r.rowCount === 1, "the main admin changes his own name: " + (r.ok ? r.rowCount : r.error));
    r = await as(c, "admin2", "update public.staff set name = 'X' where id = 'bad097d4-5edc-402b-ad59-f633252c35d9'"); check(!r.ok, "another admin cannot change the main admin's name");
    // rollback
    await c.query(fs.readFileSync(path.join(__dirname, "..", "..", "sql", "rollback-2026-11-owner-notes.sql"), "utf8"));
    r = await as(c, "spec", brk(R.ali)); check(!r.ok, "after the rollback specialists cannot add breaks again");
    const cols = (await c.query("select column_name from information_schema.columns where table_schema='public' and ((table_name='breaks' and column_name in ('days','date_from','date_to')) or (table_name='staff' and column_name='hide_stats'))")).rowCount;
    check(cols === 0, "after the rollback the new columns are gone: " + cols);
    r = await as(c, "agentA", "update public.staff set name = 'Agent A 3' where id = 'a0000000-0000-4000-8000-0000000000aa'"); check(r.ok && r.rowCount === 1, "after the rollback the staff rules work as before");
  } finally { if (c) await c.end().catch(() => {}); await pg.stop(); }
};
