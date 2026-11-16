# Acceptance review: «Mərkəz» booking app (Ruqya repository)

Reviewer: independent acceptance reviewer, on the customer's side
Date: 2026-11-16
Snapshot: `.../scratch-2026-11-16-970e3e/Ruqya`, branch `audit4`, HEAD `d537a5a`

**Line numbers.** `index.html` line numbers refer to the committed HEAD (`git show HEAD:index.html`). It is byte-identical to `origin/main`, which is the published site. While I was reviewing, someone else edited the working-tree `index.html`: the mtime is 22:07, there are 13 insertions and 7 deletions (`afterPaint`, tab switching), and the CSP hash changed. So working-tree lines after 3234 are shifted by +3 to +6. None of my findings depends on that edit.

**What I did.** I changed nothing in the snapshot. I read the code and ran read-only git commands. For the logic checks, I extracted the app script from a HEAD copy into my scratchpad and ran it in Node with small DOM stubs (`harness.js`, `t_xls.js`, `t_oct.js`, `t_misc.js` in my scratchpad). I did not contact the database or the live site.

---

## HIGH

### H-1. The Excel export counts in-advance bookings twice in the weekly and monthly sheets, including money (Qazanc)
- **Where:** `index.html` 2752, `xlsSheets()` → `slice(r)`:
  ```js
  for(var d=r.s,...;d<=r.end;...){if(byD[d])ap=ap.concat(byD[d]);if(byC[d])ap=ap.concat(byC[d]);...}
  ```
  A booking is filed under `byD[date]` and also under `byC[created]` when `created ≠ date`. When both days fall inside the same week or month, the booking goes into `ap` twice. `statData()` then counts Yazdı/Yazılıb, Uğurlu, Ləğv and Qazanc twice.
- **Why it matters:** the admin's Excel is the report that goes to management. Every booking made a few days ahead inside the same Friday–Thursday week, or the same statistics month, is doubled. That is the normal case. The on-screen tables are correct, so the two reports disagree.
- **Reproduce:** an agent writes a booking on Tue 10 Nov 2026 for Thu 12 Nov 2026, price 130 ₼. After 12 Nov, the admin opens Statistika → ⬇ Excel → any period.
  - Screen «Həftəlik» 6–12 Nov: Yazdı 1, Uğurlu 1, Qazanc 130.
  - Excel «Həftəlik — satış»: Yazdı 2, Uğurlu 2.
  - Excel «Həftəlik — pul»: Yazılıb 2, Uğurlu 2, Qazanc **260**.
- **Verified:** yes, by running it (`t_xls.js`). Output: `EXCEL «Həftəlik — pul»: [["6 noyabr – 12 noyabr 2026","Loğman",2,2,0,260]]`, against `ON SCREEN ... Qazanc=130`.

### H-2. The nightly backup will stop uploading once any appointment is older than the Excel "2 years" window
- **Where:**
  - `scripts/restore-smoke.js` 37–47 requires that the number of appointments in the app's Excel «Hamısı (2 il)» equals `count(*) from public.appts`.
  - In `index.html`, `xlsFrom("all")` (2739–2744) uses today − 731 days, moved back to a Friday or month start.
  - Appointments are never deleted. `2026-11-keep2y*.sql` says so, and neither the schema nor the migrations delete from `appts`.
  - The client (`okDate`, 1562) and the DB check `ruqya_appts_date` both accept dates back to 2020-01-01.
  - `backup.yml` runs the smoke test (180–203) before «Encrypt the backup» and the upload (205–233). A failed smoke test therefore means no artifact is kept that night.
- **Why it matters:** this is the same failure mode as finding A-01 (nightly backups failing before upload), but it is guaranteed with time. It fires when the oldest booking leaves the window (about Oct–Nov 2028 for data from Oct 2026). It also fires today if anyone has ever saved a booking dated before 2024-11-01 (a typo in the year is enough). Artifacts are kept for 35 days, so after that the customer has no backup at all.
- **Reproduce:** today `xlsFrom("all")` = `2024-11-01`, and on 2028-11-20 it = `2026-11-06`. Insert or keep one appointment dated before that and run the backup workflow. The smoke test prints `the app sees N-1 appointments, the database has N` and the job fails before encryption.
- **Verified:** the window dates were run (`t_misc.js`). The CI outcome was not run, but it follows directly from the code.

### H-3. GitHub will switch the nightly backup off after 60 days without commits; only the keepalive job protects itself
- **Where:** `.github/workflows/keepalive.yml` 29–37 calls the `/enable` API, but only for `keepalive.yml`. `backup.yml` has a `schedule:` and no equivalent step.
- **Why it matters:** the repository is public. GitHub disables each scheduled workflow after 60 days with no repository activity, and the keepalive comment itself states this rule. After handover, development normally stops. Around day 60 `backup.yml` stops running and no failure e-mail is sent, because the job simply does not run. After 35 more days the last artifact expires.
  - `docs/BACKUP.md` relies on "the job fails → GitHub e-mails", which does not happen when the job is disabled.
  - `docs/BACKUP.md` also relies on the owner manually copying an archive each week. Nothing checks that this happens.
- **Reproduce:** make no commits for 60 days, then look at Actions → Database backup, which shows "This scheduled workflow is disabled".
- **Verified:** by reading only (documented GitHub behaviour, plus the workflow code).

---

## MEDIUM

### M-1. The Pasiyentlər list and visit counts are silently cut off at the API row limit once there are more than about 1000 older patients
- **Where:** `index.html` 1850, `sb.rpc("ruqya_hist_patients",{before,since})` with no `.range()` or pagination. The SQL function (schema 471–482) returns one row per patient with no order. `fetchAll()` (1688) paginates tables but is not used for this RPC.
- **Why it matters:** Supabase's API «Max rows» applies to stored-procedure results too (default 1000). A clinic with a few hundred patients a month passes 1000 distinct patients within a year. After that, an arbitrary subset of old patients disappears from Pasiyentlər and from search. Their "N dəfə gəlib" / "gəlməyib" tags in the list view are also understated, with no warning.
- **Reproduce:** have more than 1000 distinct phone/name keys with visits between 2 years ago and `loadedFrom` (about 6–10 weeks ago). Open Pasiyentlər and search for an old patient who is missing from the returned 1000. The patient is not found.
- **Verified:** by reading only. It assumes the project's Max rows is the default 1000, which is not visible in the snapshot.

### M-2. A booking being typed is not kept if the app is closed by the phone; a restored draft is deleted as soon as it is reopened
- **Where:**
  - `keepDraft()` (1990) is called only from `hideSheet()` (3298, when the form is closed with × or back) and from the failed-save path (3385).
  - The `visibilitychange` handler (3894–3909) does not save the form, and there is no `pagehide` handler.
  - `openSheet()` deletes the stored draft immediately when it is reopened with «Geri aç» (3250, `dropDraft()`).
- **Why it matters:** HANDOFF §2 and the audit-3 notes promise that drafts keep typing. Agents routinely switch to WhatsApp to copy a patient's number while filling in the form. iOS (home-screen PWA) and Android (WebView under memory pressure) often kill the backgrounded page. The typed name, phone and note are then lost. A reopened draft is also lost again if the same thing happens a second time.
- **Reproduce:** iPhone home-screen app → «+ Yaz» → type name and phone → switch to WhatsApp → force-close the app from the app switcher → reopen. There is no «Yadda saxlanmayan qəbul» notice.
- **Verified:** by reading only.

### M-3. The Android widget keeps showing patient names after the 12-hour idle sign-out
- **Where:**
  - `index.html` 2079–2094: `idleOut()` blanks the widget only through `signedOut()`, which needs the web page to be running.
  - `MonthWidget.java` never expires its stored data. It stores `u` (the last update time), but that is used only for the «Yeniləndi» label (473–484). It refreshes every 30 minutes from SharedPreferences.
- **Why it matters:** the code comment and HANDOFF say that after 12 h without a touch, the session and "every copy of data on this device" are removed. The widget copy, with up to 4 patient names per day for up to 24 months, stays on the home screen indefinitely if the app is not opened again. This is a privacy gap for health-related data.
- **Reproduce:** Android APK → add the widget → sign in → leave the phone for more than 12 h without opening the app. The widget still lists the names.
- **Verified:** by reading only.

### M-4. `publish.sh` reports success even when nothing was published; on the documented branch it pushes the wrong ref
- **Where:** `publish.sh` 22–24:
  - `git commit` goes to the current branch.
  - `git push origin main 2>&1 | tail -1` pushes the local `main` ref, not HEAD. Under plain `sh` the pipeline's exit status is that of `tail`, so a rejected push does not stop the script, and it ends with `echo "version $v"`.
  - There is no check that the current branch is `main` and up to date.
  - `git add -A` also commits every untracked file to the public repository.
- **Why it matters:** HANDOFF says the state is branch `audit4` and that publication is `sh publish.sh`. In this snapshot, local `main` (`3178e14`) is behind `origin/main` (`abda94d`), and HEAD is `audit4`. A successor following HANDOFF gets a commit on `audit4`, a rejected or no-op push of stale `main`, and a printed "version …". The site is not updated. Untracked items present now (`evidence/…jpg` screenshots, `tests/pentest-copy.js`, `tools/secret_scan.js`) would be committed to the public repository.
- **Reproduce:** with the snapshot as it is, run `sh publish.sh "x"` (I did not run it). Or check the refs read-only: `git rev-parse --abbrev-ref HEAD` gives `audit4`; `git rev-parse main origin/main` gives two different commits.
- **Verified:** the refs and branch state were checked with read-only git commands. The script behaviour comes from reading it.

### M-5. HANDOFF and the workflows point to documents that do not exist
- **Where:**
  - HANDOFF §2 names `DATA_MAP.md`.
  - HANDOFF §4 names `THREAT_MODEL.md`.
  - HANDOFF §6 names `DISASTER_RECOVERY.md (этап 6)`.
  - HANDOFF §8 names `RISK_REGISTER.md`.
  - `.github/workflows/dr-export.yml` line 10 says `Restore: docs/DISASTER_RECOVERY.md («Restore from the DR export»)`.
- **Why it matters:** none of these files exists in the snapshot, on `audit4`, or on `origin/main` (`ls` and `git ls-tree -r origin/main` checked). So the access matrix, data map, residual risks and the DR restore runbook promised to the customer are missing. The only DR instructions are the header comment of `tools/dr_restore.js`.
- **Verified:** yes, with `ls` and `git ls-tree`.

### M-6. The booking window is not keyboard or screen-reader accessible
- **Where:**
  - `index.html` 633: `role="dialog" aria-modal="true"` with no accessible name (`aria-labelledby`).
  - `openSheet()` (3237–3257) never moves focus into the window (except for the copy text box), there is no focus trap, and `hideSheet()` does not return focus to the button that opened it.
- **Why it matters:** `aria-modal` tells assistive technology that the rest of the page is inert. Focus, however, stays on the page behind the window, so screen-reader and keyboard users cannot reach the form without searching for it. A government customer usually requires WCAG 2.1 AA (2.4.3 Focus Order, 4.1.2 Name, Role, Value).
- **Reproduce:** on desktop, press Tab to «+ Yaz» and press Enter. Focus stays on «+ Yaz», and the next Tab moves through the page behind the overlay.
- **Verified:** by reading only.

---

## LOW

### L-1. Excel leaves out a month that the screen shows
- **Where:** `allPeriods()` (2731–2736) never goes before `ST_START="2026-11-06"` (2438). Meanwhile `monthRange()` and `ST_FIRSTM` (2439) show October 2026 on screen.
- **Effect:** today the on-screen «Aylıq» is October 2026 (2 Oct – 5 Nov, with data), while every Excel file has an empty «Aylıq — pul» / «Aylıq — satış» sheet.
- **Verified:** by running it (`t_oct.js`). Output: screen `Uğurlu=1 Qazanc=200`, Excel «Aylıq — pul» data rows `0`.

### L-2. The in-app «Qaydalar» rules tell staff to delete no-shows, which contradicts the current «Ləğv et» workflow
- **Where:** `index.html` 2601–2602 (and the RU entries 1280–1281): «Pasiyent gəlməyibsə, onu təqvimdən silirlər … Silinən qəbul heç yerdə sayılmır».
- **Effect:** the app now cancels no-shows (they are counted in «Ləğv» and appear in «Ləğv olunanlar» with reminders), and HANDOFF §7 says the same. Staff following the written rules would hard-delete bookings. They would lose the cancellation statistics and the follow-up list. The «Terminlər» section also has no definition of «Ləğv».
- **Verified:** by reading only.

### L-3. The app tells the admin to run migration files that are marked "Do NOT run again"
- **Where:**
  - `index.html` 3643 shows «Bərpa üçün bazada 2026-11-owner.sql faylını bir dəfə işə salın».
  - `index.html` 2861 shows «… 2026-11-privacy.sql faylını bir dəfə işə salın».
  - Both files start with `SUPERSEDED: … Do NOT run again — re-running would bring old rules back`. `2026-11-stability.sql` and `2026-11-keep2y.sql` carry the same mark.
- **Effect:** on a database where those hints appear (a restored or self-hosted copy missing a function or column), an admin following the app could roll back the security rules.
- **Related:** HANDOFF §6 gives no order for the `sql/2026-11-*.sql` files. Their alphabetical order is not the order they were applied in, so the database cannot be rebuilt from `sql/`; only `db/schema_live_20261116.sql` is reliable.
- **Verified:** by reading only.

### L-4. After moving to a new database project, CI still points at the old one
- **Where:**
  - `keepalive.yml` 23–24 hard-codes the old URL and key.
  - `scripts/restore.sh` 22 hard-codes `LIVE_REF`.
  - The «Next steps» (`restore.sh` 88–100) and `docs/BACKUP.md` mention neither updating `keepalive.yml` nor replacing the `SUPABASE_DB_URL` secret.
- **Effect:** after a disaster recovery, the new free-tier project gets no keepalive and pauses after 7 quiet days (holidays). Meanwhile the nightly backup keeps copying the old project.
- **Verified:** by reading only.

### L-5. Dead code: `slotGrid()` does nothing since the time buttons were removed
- **Where:** `index.html` 3305–3318 looks up `#f-busy` and `#f-slots`. `apptForm()` (3319–3339) no longer renders them, so the function returns at once. It is still called from 3252, 3694, 3800 and 3824, and the CSS for `#f-slots` remains (247, 249, 467).
- **Verified:** with grep. Those ids appear only in CSS and in `slotGrid`.

### L-6. Backup logs in the public repository reveal business volume
- **Where:**
  - `backup.yml` 133 and 173 print the source and restored manifests (row count per table) into the Actions log.
  - The manifest files are uploaded unencrypted next to the archive (223).
- **Effect:** the repository is public, so anyone can read the number of appointments, staff, expenses and auth users each night. No row contents are exposed.
- **Verified:** by reading only.

### L-7. Admin accounts have password-only sign-in
- **Where:** `index.html` 3473–3484 has only e-mail and password. There is no MFA in the app or in HANDOFF.
- **Effect:** a single admin password gives access to all patient data, the journal, anonymisation and Excel exports. Supabase supports TOTP MFA, but it is not used.
- **Note:** this is a design gap, not a code bug.
- **Verified:** by reading only.

---

## Checked and found in order (not defects)
- **Escaping:** every `innerHTML` that contains user data goes through `esc()`. That covers names, phones, notes, break titles, product names, the journal (`esc(auditLine(x))`) and the security warning. Colours are checked against `^#[0-9a-f]{6}$`; links use digits only.
- **CSP:** the `tools/csp.py --check` hashes match HEAD (`CSP ok: 5 inline scripts`).
- **Excel formula injection:** Excel cells are `inlineStr`, so patient names cannot become formulas.
- **Secrets:** a scan of the full git history found no secrets. Only the publishable key appears; there are no `sb_secret_`, JWT service keys, DB URLs with passwords, or private keys.
- **Week and month logic:** Friday–Thursday weeks and "first-Friday" months, including the year boundary and 29 February 2028, follow the rules written in the code. Baku time (UTC+4) is used consistently for "today", "written on" and `bakuStart()`.
- **Server-side rules:** RLS, the owner and overlap triggers, the throttle and the restore function match the role table in HANDOFF §4.
- **Pagination:** table loads are paginated (`fetchAll`).

---

## Counts by severity
| Severity | Count | Findings |
|---|---|---|
| Critical | 0 | — |
| High | 3 | H-1 Excel doubles counts and money; H-2 backup smoke test fails once data is older than 2 years; H-3 backup schedule disabled after 60 quiet days |
| Medium | 6 | M-1 patients RPC cut at 1000 rows; M-2 typed booking lost when the app is killed; M-3 widget outlives the 12 h sign-out; M-4 publish.sh false success; M-5 missing handoff documents; M-6 booking window accessibility |
| Low | 7 | L-1 to L-7 |
| **Total** | **16** | |
