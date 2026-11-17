# EVIDENCE_INDEX — перечень доказательств

Каждый файл доказательств начинается со строки: что проверено, когда (UTC) и на каком коммите. Снимки экранов — по папкам (число файлов). SHA-256 — первые 16 знаков; полные суммы — SHA256SUMS.

| Файл | Байт | SHA-256 | Первая строка |
|---|---|---|---|
| `evidence/findings/A-01/green-backup-run.txt` | 2391 | eb0ccd1a6bd279e5 | # A-01 GREEN: backup.yml run 43919849130 — 2026-11-16T17:48:15Z — commit abda94d |
| `evidence/findings/A-01/red-backup-run.txt` | 5730 | 442ff040387ad3a9 | # A-01 RED: backup.yml run 43918407863 (main 4fb4418) — 2026-11-16T17:34:23Z |
| `evidence/findings/B-01/green.txt` | 42 | 40adb4b930e6bba7 | PASS 23-excel-counts.js 7.4s |
| `evidence/findings/B-01/red.txt` | 705 | 652e8ea734cdaeaa | FAIL 23-excel-counts.js  |
| `evidence/findings/B-01/related.txt` | 287 | d70e48cfc71fcc42 | Related places checked (B-01): statData on screen reads state.appts (kept unique by upsertBy/uniq); refresh() merges window + 'written earli |
| `evidence/findings/B-03/green-keepalive.txt` | 1101 | 6470de706fbaa706 | ping	Read one row with the public key	2026-11-16T18:27:10.0434893Z ^[[36;1mecho "status $code"; cat body.json; echo^[[0m |
| `evidence/findings/B-04/green.txt` | 44 | 2b7afb64442407d0 | PASS 25-many-patients.js 11.1s |
| `evidence/findings/B-04/note-B-15.txt` | 222 | aa09b62677269313 | B-15 (low, found while testing B-04): patient search with letters and digits («Köhnə 5») also matches every phone containing those digits —  |
| `evidence/findings/B-04/red.txt` | 588 | f9118414175853ca | FAIL 25-many-patients.js  |
| `evidence/findings/B-05/green.txt` | 47 | 596b7af0ff6b1fea | PASS 26-draft-background.js 11.9s |
| `evidence/findings/B-05/red.txt` | 593 | 0b9f8d4adcb1cc34 | FAIL 26-draft-background.js  |
| `evidence/findings/B-06/green.txt` | 591 | 296fce415ffa25d0 | # green: widget-check run 43973416317 on commit 8f2b0c7 (fix) — 2026-11-16T22:51:37Z |
| `evidence/findings/B-06/green/idle-23.txt` | 233 | 07681c511e40e5d6 | B-06 widget 12-hour rule (API 23) |
| `evidence/findings/B-06/green/idle-33.txt` | 233 | b7d1405ab919a1e7 | B-06 widget 12-hour rule (API 33) |
| `evidence/findings/B-06/red.txt` | 429 | 8e40f48f541ac2b4 | # red: widget-check run 43972735296 on commit f78fd36 (test only, no fix) — 2026-11-16T22:47:31Z |
| `evidence/findings/B-06/red/idle-23.txt` | 165 | afd5a8046ac8e3fa | B-06 widget 12-hour rule (API 23) |
| `evidence/findings/B-06/red/idle-33.txt` | 165 | 5dfe50d178cabd9a | B-06 widget 12-hour rule (API 33) |
| `evidence/findings/B-07/green.txt` | 43 | 773d390d3aa02d8a | PASS 28-publish-guard.js 3.1s |
| `evidence/findings/B-07/red.txt` | 614 | 1e90b906dc1057a5 | FAIL 28-publish-guard.js  |
| `evidence/findings/B-10/green-test.txt` | 191 | f34e294f100bc12b | # green: working tree on b282510d68815ffba09903630d57019b3ed0f979 + dead entries removed — 2026-11-16T22:38:52Z |
| `evidence/findings/B-10/green.txt` | 202 | be2f3540aa1d816a | # commit 156ee6585fcad98a991ef4eaccbf13d45bace82c — 2026-11-16T22:37:26Z |
| `evidence/findings/B-10/red-test.txt` | 745 | 41a9a4ade1b37249 | # red: index.html of ac8d029cd71ea075758914a8c20b4d6adc13e2d9 — 2026-11-16T22:38:35Z |
| `evidence/findings/B-10/red.txt` | 203 | 7d5e437d5ca8c80e | # commit ac8d029cd71ea075758914a8c20b4d6adc13e2d9 — 2026-11-16T22:37:25Z |
| `evidence/findings/B-11/green.txt` | 163 | 86bcdbeac6b977f3 | # commit 156ee6585fcad98a991ef4eaccbf13d45bace82c — 2026-11-16T22:37:28Z |
| `evidence/findings/B-11/red.txt` | 163 | a56908c594e17aba | # commit ac8d029cd71ea075758914a8c20b4d6adc13e2d9 — 2026-11-16T22:37:27Z |
| `evidence/findings/B-15/green.txt` | 206 | a79b84766ffc02e7 | # green: 354b36d773704332f6ffabb88828ec4c6e5311bb + B-15 fix — 2026-11-16T22:40:43Z |
| `evidence/findings/B-15/red.txt` | 249 | ba9aeb4bd99eb2b1 | # red: 354b36d773704332f6ffabb88828ec4c6e5311bb — 2026-11-16T22:40:24Z |
| `evidence/findings/B-16/green-43970993475.txt` | 1648 | 77d0dff63992091f | # gh run view 43970993475 --log (filtered) — 2026-11-16T22:36:39Z |
| `evidence/findings/B-16/red-43928936075.txt` | 431 | 5d26c39a4198ceb8 | # gh run view 43928936075 --log-failed (filtered: error lines only, values blanked by the workflow) — 2026-11-16T22:36:28Z |
| `evidence/findings/B-16/red-43930946242.txt` | 431 | b7c63d2176fff4a3 | # gh run view 43930946242 --log-failed (filtered: error lines only, values blanked by the workflow) — 2026-11-16T22:36:31Z |
| `evidence/findings/B-16/red-43969449184.txt` | 722 | 16866cf123f6f860 | # gh run view 43969449184 --log-failed (filtered: error lines only, values blanked by the workflow) — 2026-11-16T22:36:34Z |
| `evidence/findings/B-16/red-43970247349.txt` | 432 | 9dbb53d2ff4c07f2 | # gh run view 43970247349 --log-failed (filtered: error lines only, values blanked by the workflow) — 2026-11-16T22:36:36Z |
| `evidence/findings/B-17/green.txt` | 704 | 6886709a73592db4 | # green: commit 664ba75318bb9c8df4a02c59551af976cbb96635 + sql/2026-11-realtime.sql in the install — 2026-11-17T01:17:54Z |
| `evidence/findings/B-17/red.txt` | 678 | 9ac8cc5a98cad417 | # red: commit 664ba75318bb9c8df4a02c59551af976cbb96635 — 2026-11-17T01:17:53Z |
| `evidence/findings/B-18/green.txt` | 411 | 4e7421f84281b211 | # green (configuration): commit on main c2865f25bb3521cf95698e88dadddce0425e19b5 — 2026-11-17T01:55:32Z |
| `evidence/findings/B-18/red.txt` | 392 | 6e5ad1577cae2c8f | # red: intervals between successful scheduled backups (gh run list -w backup.yml, event=schedule) — 2026-11-17T01:54:51.227136Z |
| `evidence/findings/B-19/green-test.txt` | 58 | 288a7b0f30281a72 | # green test |
| `evidence/findings/B-19/green.txt` | 223 | a3d2998762ab0279 | # green: tools/configure.py fixed — 2026-11-17T01:58:32Z |
| `evidence/findings/B-19/red-test.txt` | 201 | 449571fe28902d96 | # red test on configure.py of e0b77c03a6efaca353bef3ffb7fc846c508c0528 |
| `evidence/findings/B-19/red.txt` | 272 | 58f879cce3d5c7f8 | # red: tools/configure.py of e0b77c0 — files of the configured copy (no logo-hq.webp, the splash/sign-in logo of P-02) |
| `evidence/findings/B-20/green.txt` | 219 | 4394962791185730 | # green: backup run 44009166420 with break_check=true (main 232157d) — 2026-11-17T03:21:22Z |
| `evidence/findings/B-20/red.txt` | 262 | bb1ace5ae96c8be1 | # red: runs whose restore check failed kept no copy (artifacts per run) — 2026-11-17T03:17:18Z |
| `evidence/findings/B-21/green-list.txt` | 72 | db959d1dbed272de | # L() literal calls: 660, dictionary keys: 789, without translation: 0 |
| `evidence/findings/B-21/green.txt` | 122 | cb701eff548d4f6a | # green |
| `evidence/findings/B-21/red.txt` | 236 | a3be44cc653487a1 | # L() literal calls: 660, dictionary keys: 789, without translation: 1 |
| `evidence/findings/F-READER/green.txt` | 98 | 41c8e5b001fc3eaf | # green |
| `evidence/findings/F-READER/red.txt` | 236 | be02339f43ef0004 | # red: 7fdffc7a8aa39942a429a0f5d1708f210f16ae86 — 2026-11-17T05:46:49Z |
| `evidence/findings/F-SERVICE/green.txt` | 75 | cff6b177bce4710d | # green |
| `evidence/findings/F-SERVICE/red.txt` | 156 | 93cd127ca206dceb | # red: index.html of 65173aecd53ef2e9b2e7384ec2398f52a285361a — 2026-11-17T05:45:26Z |
| `evidence/findings/F-SOLD/green.txt` | 57 | 086331a663616f1f | # green: + sold logic |
| `evidence/findings/F-SOLD/red.txt` | 159 | b763bf559b3a5049 | # red: index.html of bd0f67351810b63eb134775f20c5ab1b8b8ff6fc — 2026-11-17T05:33:42Z |
| `evidence/findings/P-02/attempt-splash-1.5s.json` | 9561 | af662ead1ced8234 | { |
| `evidence/findings/P-02/attempt-splash-1.5s.txt` | 879 | 09a0ec71401ef7ac | # ПОПЫТКА (отменена): заставка 1,5 с вместо 2 с — LCP не изменился, причина в другом (см. lcp-breakdown-*.txt) |
| `evidence/findings/P-02/green.json` | 9117 | fb3b55097d31fba1 | { |
| `evidence/findings/P-02/green.txt` | 697 | f9b3c625f586e1f2 | # green: commit ed82e07516f87db1f3fea3bdbddf948ad14f015f + logo-hq.webp — 2026-11-16T23:15:48Z |
| `evidence/findings/P-02/lcp-breakdown-after.txt` | 780 | ed5dc30ccaa60acb | # after: commit ed82e07516f87db1f3fea3bdbddf948ad14f015f + logo-hq.webp — 2026-11-16T23:15:38Z |
| `evidence/findings/P-02/lcp-breakdown-before.txt` | 767 | a898bf04333e0c52 | # before: commit ed82e07516f87db1f3fea3bdbddf948ad14f015f — 2026-11-16T23:15:26Z |
| `evidence/findings/P-02/pixels-identical.txt` | 53 | fd900fe547d81179 | max premultiplied pixel difference png vs webp: 0.0 |
| `evidence/findings/P-02/red.json` | 8543 | 4f8c827198c73500 | { |
| `evidence/findings/P-02/red.txt` | 695 | 1e3ff5254d08dbaf | # red: commit ed82e07516f87db1f3fea3bdbddf948ad14f015f — 2026-11-16T23:08:16Z |
| `evidence/findings/P-03/after.json` | 4348 | ef5d667fcd2c255c | { |
| `evidence/findings/P-03/after.txt` | 1333 | 5b9b99964c0c2d2e | # after: 0a8695053146efcc58ddb3332fae9fe67f56a246 + P-03 (only: Cyrillic font part fetched when idle) — 2026-11-17T00:15:52Z |
| `evidence/findings/P-03/analysis.md` | 2925 | 23d679336bd54ea4 | # P-03 — кадры > 50 мс при выезде окна «Yeni qəbul» (первое открытие после загрузки) |
| `evidence/findings/P-03/attempt-pre-frame.json` | 4178 | d3e2b97f4c33ece6 | { |
| `evidence/findings/P-03/attempt-pre-frame.txt` | 1661 | d5980d8297242df9 | # ПОПЫТКА (отменена): шрифт + окно рисуется в стартовой позиции выезда — улучшение не доказано (медиана кадра выезда 118 против 93 мс до), п |
| `evidence/findings/P-03/before.json` | 4959 | 9bfc7627ae3d9316 | { |
| `evidence/findings/P-03/before.txt` | 1387 | 1b53c4953f15d663 | # before: index.html of 0a8695053146efcc58ddb3332fae9fe67f56a246, check tests/perf/frames.js (working tree) — 2026-11-17T00:01:31Z |
| `evidence/findings/P-03/shadow-experiment.txt` | 541 | 670da4f582792613 | # experiment 2026-11-17T00:37:25Z, commit 0a8695053146efcc58ddb3332fae9fe67f56a246 + P-03 font: window shadow lighter / none (temporary edit |
| `evidence/findings/P-04/green.txt` | 1822 | 540c191dc5bb088f | # green: commit 4ae9e2326ede97132d2159e753e134d0d5bc3691 + 2026-11-patients-scale.sql (with the S-07 helper filter) — 2026-11-17T02:37:32Z |
| `evidence/findings/P-04/red.txt` | 1604 | 50a65c87eb8aa7ba | # red: commit ffbcf51f5380a29765496693a277607a7d8cdec9 + stricter db-scale (nested plans, rows read) — 2026-11-17T01:33:24Z |
| `evidence/findings/P-04/red/Excel_one_month.plan.txt` | 1973 | d10354011ed77f57 | -- owner |
| `evidence/findings/P-04/red/appts_changed_since_poll_.plan.txt` | 1458 | 2a44951910479128 | -- agent |
| `evidence/findings/P-04/red/appts_window_as_specialist_RLS_by_column_.plan.txt` | 2158 | d7621dcdb09041ea | -- spec |
| `evidence/findings/P-04/red/appts_window_refresh_.plan.txt` | 2081 | dd9a549895a45838 | -- agent |
| `evidence/findings/P-04/red/appts_written_in_window_for_earlier_days.plan.txt` | 1616 | 22d578fc242e2dbf | -- agent |
| `evidence/findings/P-04/red/breaks.plan.txt` | 1141 | 2c28391799def89f | -- agent |
| `evidence/findings/P-04/red/expenses_window.plan.txt` | 1751 | c83f1e872ab98ad9 | -- agent |
| `evidence/findings/P-04/red/journal_deleted_only_admin_.plan.txt` | 790 | bb53f3dcbfa580ea | -- owner |
| `evidence/findings/P-04/red/journal_page_admin_.plan.txt` | 806 | ee8ce449c5cad867 | -- owner |
| `evidence/findings/P-04/red/one_patient_s_old_visits_RPC_.plan.txt` | 2719 | ec7767ed404cc0a9 | -- agent |
| `evidence/findings/P-04/red/patients_grouped_RPC_2_years_.plan.txt` | 3339 | 6a3bcea1a2db3f97 | -- agent |
| `evidence/findings/P-04/red/product_sales_window.plan.txt` | 1776 | a94b8427628e8904 | -- agent |
| `evidence/findings/P-04/red/readers.plan.txt` | 886 | 0e110c61f91090aa | -- agent |
| `evidence/findings/P-04/red/staff.plan.txt` | 1109 | c25e176d852510a7 | -- agent |
| `evidence/findings/P-04/red/stat_edits.plan.txt` | 1818 | 52baab4d806d8c5a | -- agent |
| `evidence/findings/P-04/red/summary.txt` | 1500 | 7dc2fbccee03aea4 | # DB scale check — 2026-11-17T01:34:36.841Z — PostgreSQL 17.11 embedded, 1000000 bookings |
| `evidence/findings/P-05/green-app.txt` | 230 | 085938a658271ed9 | # green: ffbcf51f5380a29765496693a277607a7d8cdec9 + keyset pages in the app — 2026-11-17T01:44:49Z |
| `evidence/findings/P-05/green-db.txt` | 1822 | 540c191dc5bb088f | # green: commit 4ae9e2326ede97132d2159e753e134d0d5bc3691 + 2026-11-patients-scale.sql (with the S-07 helper filter) — 2026-11-17T02:37:32Z |
| `evidence/findings/P-05/red-app.txt` | 267 | 7a4aeab4b45a7417 | # red: index.html of ffbcf51f5380a29765496693a277607a7d8cdec9, test 31 — 2026-11-17T01:44:35Z |
| `evidence/findings/P-05/red-db.txt` | 1604 | 50a65c87eb8aa7ba | # red: commit ffbcf51f5380a29765496693a277607a7d8cdec9 + stricter db-scale (nested plans, rows read) — 2026-11-17T01:33:24Z |
| `evidence/findings/P-07/breakdown.txt` | 1274 | d94be5b2fa89f009 | # event timing breakdown of the old code (vitals flow, 5 runs): [name, duration, input delay, processing, presentation, target] |
| `evidence/findings/P-07/green.json` | 9107 | 8d866e73c7d93fe7 | { |
| `evidence/findings/P-07/green.txt` | 745 | 5fdb96d9087b1485 | # green: commit 3788d727d5e3a78882646fbc937e3604383b3fec + P-07 (closeSheet hides first, history back after paint) — 2026-11-17T04:28:40Z |
| `evidence/findings/P-07/red.json` | 9191 | 737d8552d45ab011 | { |
| `evidence/findings/P-07/red.txt` | 819 | 635915cc191be340 | # red: INP 488 ms median; slow interaction = closing the booking window (7th click), see breakdown.txt |
| `evidence/findings/R2-12/green.txt` | 109 | 95da41b7863da44e | # green: publish.sh with the R2-12 guard — 2026-11-17T03:14:58Z |
| `evidence/findings/R2-12/red.txt` | 229 | b0eb513aae458061 | # red: publish.sh of ad76b9319bb228175777d8caa68969c689066971, test 28 — 2026-11-17T03:14:48Z |
| `evidence/findings/R2-7/green.txt` | 684 | 0bce4c4228f6a0bd | # green: widget-check run 44008309902 on db846ca (fix) — 2026-11-17T03:32:30Z |
| `evidence/findings/R2-7/red.txt` | 498 | 1b6cb61321446aa6 | # red: widget-check run 44007789543 on 822d70b (test only) — 2026-11-17T03:10:32Z |
| `evidence/findings/S-01/deploy-check.txt` | 6608 | 8dee58c9ccbfff1c | # deploy-check run 43989546222 on audit4 c659aa83af0801c5a10d298f60c04311c4961465 — 2026-11-17T00:41:35Z |
| `evidence/findings/S-04/green.txt` | 34 | 35273984f3954110 | PASS 90-sql.js 17.8s |
| `evidence/findings/S-04/red.txt` | 844 | 2edeadd8334455cb | FAIL 90-sql.js  |
| `evidence/findings/S-07/attacks.tsv` | 3478 | b2384525fbdc8b92 | # attacks on copy — 2026-11-17T02:37:20.665Z |
| `evidence/findings/S-07/green.txt` | 236 | 95711217dc2277b8 | # green: 4ae9e2326ede97132d2159e753e134d0d5bc3691 + helper filters like the read policy — 2026-11-17T02:36:48Z |
| `evidence/findings/S-07/red.txt` | 406 | ee522d2459d28f08 | # red: 4ae9e2326ede97132d2159e753e134d0d5bc3691 + X-33/X-34 — 2026-11-17T02:36:25Z |
| `evidence/findings/T-01/green.txt` | 157 | b8959cb04939d381 | # green: 15-keyboard 5x alone + 8x with 4 copies in parallel (busy machine) — 2026-11-17T05:02:11Z |
| `evidence/findings/T-01/red-suite-run-2.txt` | 2380 | b7472e5e0dbb9cf1 | # run 2 of 3 — commit 8355be8a31ff2cec447f674a59ff43ddef3f236d, tree 14 changed files — start 2026-11-17T04:44:08Z |
| `evidence/findings/T-01/suite-run-1.txt` | 1821 | bd395152223a9241 | # run 1 of 3 — commit 8355be8a31ff2cec447f674a59ff43ddef3f236d, tree 2 changed files — start 2026-11-17T04:30:25Z |
| `evidence/findings/V-01/green.txt` | 34 | 38690c41773ac60f | PASS 24-aria.js 8.7s |
| `evidence/findings/V-01/red.txt` | 677 | 63bbacbdf396448c | FAIL 24-aria.js  |
| `evidence/findings/V-03/green.txt` | 42 | cec2812c94fa0a5a | PASS 27-dialog-focus.js 7.1s |
| `evidence/findings/V-03/red.txt` | 573 | 14221d98ced2426a | FAIL 27-dialog-focus.js  |
| `evidence/stage0/backup/README.txt` | 548 | 68930dba3f322b7d | # DR export run 43919463263 (GitHub Actions) — 2026-11-16T17:33:52Z — commit 42e61502963e69745eb227907baa1e47f915d110 |
| `evidence/stage0/backup/SHA256SUMS` | 313 | 524eb32db87450c0 | 17ce84d7c60472c75e70418488a54dcc88da5bb49e10e8708032759369e92dc0  data.sql.enc |
| `evidence/stage0/backup/dr-restore-local.txt` | 910 | 01ec3b5ac0e16598 | # DR restore — 2026-11-16T17:33:38.941Z — artifact C:\Users\taghi\AppData\Local\Temp\ruqya-dr\run-43919463263\dr-export-43919463263 |
| `evidence/stage0/backup/manifest.tsv` | 561 | 1e5302d047f52fb1 | auth.identities/11/caf35707a05d01c7afcf8e31263b132b |
| `evidence/stage0/baseline/live-network.json` | 1635 | e7c28cfc5e00f5fd | { |
| `evidence/stage0/baseline/supabase-advisors-security.json` | 1106 | 80d52f89e779f819 | {"tool":"Supabase MCP get_advisors(type=security)","project":"ldkhdeehrrajvgrtieal","fetched":"2026-11-16T17:29:07Z","result":{"lints":[{"na |
| `evidence/stage0/baseline/supabase-logs-24h.txt` | 959 | 659251412695261d | # Supabase logs, last 24 h before 2026-11-16 ~17:45 UTC — tool: Supabase MCP query_logs (ClickHouse SQL) |
| `evidence/stage0/baseline/ui/report.json` | 254898 | 8edd299b5caa2463 | [ |
| `evidence/stage0/baseline/ui/summary.tsv` | 38073 | 2ee8334ec24b265a | width	theme	state	screen	overflowX	cut	cutIntended	overlaps	small<44	axe |
| `evidence/stage0/baseline/vitals.json` | 9167 | 3f10a5ea9d6f009d | { |
| `evidence/stage0/capabilities.txt` | 1926 | 2712eaca46df9d2e | # Capability probe — 2026-11-16T17:21:23Z — commit 3178e1486efe66152d1478a21f646b49b50a4bcd |
| `evidence/stage0/published/compare.txt` | 3446 | 56a06f58dcf68b82 | # Published vs repo — 2026-11-16T17:25:50Z — commit 3178e1486efe66152d1478a21f646b49b50a4bcd |
| `evidence/stage0/supabase-probe.txt` | 1862 | 09b814ff1a44760d | # Supabase probe (read-only) — tool: Supabase MCP execute_sql, project ldkhdeehrrajvgrtieal |
| `evidence/stage2/access-matrix-baseline.txt` | 15659 | 11d9e8cc5f48204d | # access matrix on copy — 2026-11-16T17:57:39.893Z |
| `evidence/stage2/attacks-baseline.txt` | 2688 | 694ee6e7e0875bf4 | # attacks on copy — 2026-11-16T17:59:07.793Z |
| `evidence/stage2/dependency-audit.txt` | 867 | 0e9562f9ccc38a6b | # dependency vulnerabilities — 2026-11-16T18:08:34Z — commit d537a5ab0930f61091debda2b629371b97dd60d7 |
| `evidence/stage2/eslint-triage.md` | 1703 | fb290902af33b5b8 | # ESLint triage (evidence/stage2/eslint.txt, 321 messages) — read by the auditor, 2026-11-16 |
| `evidence/stage2/eslint.txt` | 29537 | 0608b6125b55a2af | # ESLint 9.15.0 + eslint-plugin-security 3.0.1 — 2026-11-16T18:12:37.244Z |
| `evidence/stage2/faults.txt` | 1323 | f95ae1c1a06acea2 | # fault cases — 2026-11-16T18:23:36.854Z |
| `evidence/stage2/headers-and-auth-settings.txt` | 2184 | b4193d5b819b99a1 | # security headers of the live site — 2026-11-16T18:08:59Z |
| `evidence/stage2/independent/acceptance-review.md` | 17341 | 179d61bf35691542 | # Acceptance review: «Mərkəz» booking app (Ruqya repository) |
| `evidence/stage2/independent/pentest-report.md` | 11462 | 3930792af3e21fd4 | # Penetration Test Report — Ruqya booking DB (PostgreSQL 17 / PostgREST-style RLS) |
| `evidence/stage2/secret-scan.txt` | 752 | fa92e626bb4f1f96 | # secret scan — 2026-11-16T18:08:18.448Z — HEAD d537a5ab0930f61091debda2b629371b97dd60d7 |
| `evidence/stage4/full-suite-1.txt` | 1667 | 896dc15f21ae6a21 | # full suite after stage-4 fixes — commit f78fd36cd2e8be899f4f0a4534ebc8f1262d9fc1 (+ uncommitted Android B-06, not used by these tests) — s |
| `evidence/stage4/s05-admin-api-grep.txt` | 155 | 7dd96a1e9f782e16 | # S-05: admin-API calls in the app — 2026-11-16T22:44:52Z commit f78fd36cd2e8be899f4f0a4534ebc8f1262d9fc1 |
| `evidence/stage5/db-scale.txt` | 1837 | cac35eb6bf83b1d8 | # green: commit cd8c391bc2d098130a2bb13952597a4858d23af2 + R2-4 (real patient key) — 2026-11-17T02:53:28Z |
| `evidence/stage5/db-scale/Excel_one_month.plan.txt` | 2012 | a7cf11b2671844aa | -- owner |
| `evidence/stage5/db-scale/appts_changed_since_poll_.plan.txt` | 1482 | 092da68ea8d75d18 | -- agent |
| `evidence/stage5/db-scale/appts_window_as_specialist_RLS_by_column_.plan.txt` | 2120 | 76e673308a12e361 | -- spec |
| `evidence/stage5/db-scale/appts_window_refresh_.plan.txt` | 2051 | 35a557be2fe559a6 | -- agent |
| `evidence/stage5/db-scale/appts_written_in_window_for_earlier_days.plan.txt` | 1616 | e1b2f3799ff9a020 | -- agent |
| `evidence/stage5/db-scale/breaks.plan.txt` | 1101 | e3440ccef4111b1e | -- agent |
| `evidence/stage5/db-scale/expenses_window.plan.txt` | 1741 | 709897d8d9290afd | -- agent |
| `evidence/stage5/db-scale/journal_deleted_only_admin_.plan.txt` | 790 | 0b414afbcbfd121e | -- owner |
| `evidence/stage5/db-scale/journal_page_admin_.plan.txt` | 781 | 259eff7d74d71d9a | -- owner |
| `evidence/stage5/db-scale/one_patient_s_old_visits_RPC_.plan.txt` | 312 | 6dc88acac96f782b | -- agent |
| `evidence/stage5/db-scale/one_patient_s_old_visits_as_specialist_RPC_RLS_.plan.txt` | 294 | d560281b4539b6f8 | -- spec |
| `evidence/stage5/db-scale/patients_page_1_RPC_keyset_.plan.txt` | 3357 | 71d175e1b9d0c955 | -- agent |
| `evidence/stage5/db-scale/patients_page_as_specialist_RPC_keyset_RLS_.plan.txt` | 3733 | 4a5b2b3d1e14ebc4 | -- spec |
| `evidence/stage5/db-scale/patients_page_in_the_middle_RPC_keyset_.plan.txt` | 3339 | 58f2c55a9cc62056 | -- agent |
| `evidence/stage5/db-scale/product_sales_window.plan.txt` | 1766 | 1d856007831037e1 | -- agent |
| `evidence/stage5/db-scale/readers.plan.txt` | 875 | 608b481822529093 | -- agent |
| `evidence/stage5/db-scale/staff.plan.txt` | 1109 | e54e39e74ef27b7d | -- agent |
| `evidence/stage5/db-scale/stat_edits.plan.txt` | 1808 | 0a3e55cbd0ae21c6 | -- agent |
| `evidence/stage5/db-scale/summary.txt` | 1753 | c390d7a8034e5db9 | # DB scale check — 2026-11-17T02:54:44.960Z — PostgreSQL 17.11 embedded, 1000000 bookings |
| `evidence/stage5/frames-experiment-no-font-prefetch.json` | 9218 | b62b993ef2d1ecf0 | { |
| `evidence/stage5/frames-experiment-will-change.json` | 8617 | e117c98d06dfd60a | { |
| `evidence/stage5/frames.json` | 7887 | 12814e005b56525f | { |
| `evidence/stage5/frames.txt` | 1351 | b24fa908bd39bd97 | # frames, quiet machine — commit 3788d727d5e3a78882646fbc937e3604383b3fec — 2026-11-17T04:03:37Z |
| `evidence/stage5/gallery.html` | 135676 | eb87b79b4a71144d | <!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Галерея |
| `evidence/stage5/mutation-db.txt` | 1042 | c9d275778b92cfff | # DB test mutation check — 2026-11-16T18:01:40.220Z |
| `evidence/stage5/npm-audit.txt` | 701 | d411dec7c64d760a | # 2026-11-17T02:28:20Z |
| `evidence/stage5/person-export.json` | 3702 | 90340d69ea787e1b | { |
| `evidence/stage5/pii-in-logs.txt` | 1102 | 6c55c6cf217027bf | # T-43: personal data in Supabase logs (last 24 h), Supabase MCP query_logs (read-only) — 2026-11-17T04:31:52Z |
| `evidence/stage5/secret-scan.txt` | 641 | d2ef1813d387cc6e | # 2026-11-17T02:28:17Z commit c28bb58e37ad780ff1cab939a5efe018a43b9b3a |
| `evidence/stage5/soak-10min-before-fix.json` | 845 | d1e82ec21774550d | { |
| `evidence/stage5/soak-8min-heapdiff.json` | 722 | c88ae3061d541e05 | { |
| `evidence/stage5/soak.json` | 11631 | 4a3dee8607743cf5 | { |
| `evidence/stage5/soak.txt` | 291 | 0c3e2626ec79d048 | # soak 120 min — commit ffbcf51f5380a29765496693a277607a7d8cdec9 — start 2026-11-17T01:20:18Z |
| `evidence/stage5/suite-run-1.txt` | 1613 | 8c8fce9ba7e0c8cc | # run 1 of 3 — commit 6cd35666ce2043848310cb0b0440adb38c3f27f9, tree 1 changed files — start 2026-11-17T00:37:57Z |
| `evidence/stage5/suite-run-2.txt` | 1614 | f8b49a9cc60035ba | # run 2 of 3 — commit 664ba75318bb9c8df4a02c59551af976cbb96635, tree 4 changed files — start 2026-11-17T00:50:50Z |
| `evidence/stage5/suite-run-3.txt` | 1614 | 14e2f6bb6c32aaa7 | # run 3 of 3 — commit 664ba75318bb9c8df4a02c59551af976cbb96635, tree 5 changed files — start 2026-11-17T01:03:40Z |
| `evidence/stage5/tokens.txt` | 2095 | d424305424743e85 | # colour values in CSS of index.html (comments removed): tokens --x: 72 ; literals in rules: 40 |
| `evidence/stage5/ui-run.txt` | 266 | cf9116489c18a280 | # UI audit (az + ru) — commit ad76b9319bb228175777d8caa68969c689066971 — start 2026-11-17T03:12:51Z |
| `evidence/stage5/ui/report.json` | 218384 | 8a5393f374196a6f | [ |
| `evidence/stage5/ui/summary.tsv` | 33691 | cf213b1cbcd84cf2 | width	theme	state	screen	overflowX	cut	cutIntended	overlaps	coveredByBar(review)	small<44	axe |
| `evidence/stage5/vitals.json` | 9191 | 737d8552d45ab011 | { |
| `evidence/stage5/vitals.txt` | 716 | f9d2a073055cca26 | # vitals, quiet machine — commit 3788d727d5e3a78882646fbc937e3604383b3fec — 2026-11-17T04:10:59Z |
| `evidence/stage6/dr-drill.txt` | 1676 | 1093ae3e8527e825 | # DR drill — 2026-11-17T01:54:01.633Z |
| `evidence/stage6/reproducible-build.txt` | 443 | 0fa3a043d931fee0 | # reproducible build: two clean checkouts of 080a5623631cdb08f782bdc167d98fce97287032, tools/configure.py into two folders — 2026-11-17T01:5 |
| `evidence/stage6/schema-check.txt` | 598 | dfb6bfaed4141773 | $ node tools/schema_check.js evidence/stage6/structure-live.tsv |
| `evidence/stage6/standard-restore-timing.txt` | 1141 | cb03956617fa22e4 | # backup.yml run 43970993475 (nightly standard copy, restored into a fresh local Supabase stack + app smoke test) — step times |
| `evidence/stage6/structure-live.tsv` | 807 | b938d4d966d30808 | # live structure fingerprint (scripts/backup-structure.sql via Supabase MCP execute_sql, read-only) — 2026-11-17T00:42:42Z |
| `evidence/stage7/independent/acceptance-review.md` | 29205 | 658dea1a1de90e59 | # Повторная приёмка «Mərkəz» (этап 7, независимый приёмщик) |
| `evidence/stage7/independent/pentest-report.md` | 10769 | 79392e109dca2f6d | # Penetration Test Report — Ruqya booking DB (stage 7, independent) |
| `evidence/stage8/load50.json` | 685 | d5982c4b212e1e98 | { |
| `evidence/stage8/load50.txt` | 1445 | 155a945030b0e4bb | # load test — commit 4e30e2790e79e83ba22f878c5bd86920c2bd8fa1 + load50 fixes (phone, error codes, pause) — 2026-11-17T06:59:47Z |
| `evidence/stage8/mutate-app-first-run.txt` | 670 | 2ba8a666c8c855cd | # app mutations, first run — 2026-11-17 ~05:55 UTC (tests before strengthening), node tests/mutate-app.js |
| `evidence/stage8/mutate-app.txt` | 1039 | 07d2b08301604a53 | # app mutations — 2026-11-17T06:07:05.317Z |
| `evidence/stage8/soak.txt` | 154 | 8781f69e2ad07a3f | # soak 120 min — commit c311be5e77fbd5cf1b819656d4c6e632a61ff625 — start 2026-11-17T07:05:57Z |
| `evidence/stage8/suite-run-1.txt` | 2004 | ee03119288becc25 | # run 1 of 3 — commit 1f9919a2f80a0e6bf0c21702a3a8234583e7dded, tree 1 changed files — start 2026-11-17T06:08:06Z |
| `evidence/stage8/suite-run-2.txt` | 2004 | 025b0fc3bf29781d | # run 2 of 3 — commit 1f9919a2f80a0e6bf0c21702a3a8234583e7dded, tree 10 changed files — start 2026-11-17T06:23:16Z |
| `evidence/stage8/suite-run-3.txt` | 2004 | fffaba87d3d5d03a | # run 3 of 3 — commit 1f9919a2f80a0e6bf0c21702a3a8234583e7dded, tree 11 changed files — start 2026-11-17T06:38:07Z |
| `evidence/stage8/ui-run.txt` | 155 | ea5581d2dda36779 | # UI audit (az + ru) — commit c311be5e77fbd5cf1b819656d4c6e632a61ff625 — start 2026-11-17T07:05:58Z |
| `evidence/stage8/widget-7days.txt` | 714 | 93e4ebde66e6bb4e | # widget-check run 44026732176 on 51bb71d (7-day rule + WhatsApp Business build) — 2026-11-17T06:07:41Z |

## Снимки экранов

| Папка | Снимков |
|---|---|
| `evidence/findings/F-READER` | 4 |
| `evidence/stage0/baseline/ui/1280-dark` | 24 |
| `evidence/stage0/baseline/ui/1280-light` | 79 |
| `evidence/stage0/baseline/ui/1920-dark` | 24 |
| `evidence/stage0/baseline/ui/1920-light` | 79 |
| `evidence/stage0/baseline/ui/320-dark` | 24 |
| `evidence/stage0/baseline/ui/320-light` | 79 |
| `evidence/stage0/baseline/ui/375-dark` | 24 |
| `evidence/stage0/baseline/ui/375-light` | 79 |
| `evidence/stage0/baseline/ui/768-dark` | 24 |
| `evidence/stage0/baseline/ui/768-light` | 79 |
| `evidence/stage5/ui/1280-dark` | 24 |
| `evidence/stage5/ui/1280-light` | 124 |
| `evidence/stage5/ui/1920-dark` | 24 |
| `evidence/stage5/ui/1920-light` | 124 |
| `evidence/stage5/ui/320-dark` | 24 |
| `evidence/stage5/ui/320-light` | 124 |
| `evidence/stage5/ui/375-dark` | 24 |
| `evidence/stage5/ui/375-light` | 124 |
| `evidence/stage5/ui/768-dark` | 24 |
| `evidence/stage5/ui/768-light` | 124 |
| `evidence/stage8/ui/320-light` | 39 |
