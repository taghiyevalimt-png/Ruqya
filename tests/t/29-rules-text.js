// B-10: «Qaydalar» and «Terminlər» (both languages) describe «Ləğv et» for no-shows, not deleting them from the
// calendar, and explain the «Ləğv» column. B-11: no hint in the app points to superseded SQL files.
const fs = require("fs"), path = require("path");
const { open, check, OWNER } = require("../lib");
const OLD = { az: [/gəlməyibsə, onu təqvimdən silirlər/, /təqvimdən silinməyən/], ru: [/его удаляют из календаря/, /не удалено из календаря/] };
const NEW = { az: [/«Ləğv et»/, /Ləğv/], ru: [/«Ləğv et»|Отмен/, /Отмена/] };
module.exports = async () => {
  for (const lang of ["az", "ru"]) {
    const s = await open(OWNER, { lang });
    try {
      const p = s.page; await p.waitForSelector("#tabs:not([hidden])", { timeout: 15000 }); await p.waitForTimeout(3300);
      await p.click('#tabs [data-tab="stats"]'); await p.waitForTimeout(300);
      let text = "";
      for (const sec of ["rules", "terms"]) { await p.click('#top [data-act="st-sec"][data-id="' + sec + '"]'); await p.waitForTimeout(300); text += (await p.textContent("#main")) + "\n"; }
      for (const re of OLD[lang]) check(!re.test(text), lang + ": rules/terms no longer say no-shows are deleted (" + re + ")");
      for (const re of NEW[lang]) check(re.test(text), lang + ": rules/terms explain cancelling (" + re + ")");
      check(!s.errors.length, "no page errors: " + s.errors.join("; "));
    } finally { await s.close(); }
  }
  const html = fs.readFileSync(path.join(__dirname, "..", "..", "index.html"), "utf8");
  for (const f of ["2026-11-owner.sql", "2026-11-privacy.sql"]) check(!html.includes(f + " faylını"), "no hint points to the superseded " + f);
};
