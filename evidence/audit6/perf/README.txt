# audit 6 — load test on the copy (tests/perf/load50.js), 2026-11-22T19:4xZ, this sandbox: 2 CPU, PostgreSQL 16 local
# 66 000 made-up bookings (~3 years), 50 users at once, through RLS as role authenticated
strict profile (pause 200 ms, ~33 req/s): errors 0; p95 window 2351, poll 2076, patients 4209, visits 1265, write 740 ms
person-at-work profile (pause 3000 ms):     errors 0; p95 window 1245, poll 1129, patients 4882, visits 921, write 768 ms
single call, no load: patient list page 300–340 ms, the visible window 4 ms
Verdict: 0 errors, 0 deadlocks; the 500 ms p95 target is NOT met on this 2-CPU machine. The patient list page groups all
visits of 2 years on every page (cost grows with the 2-year volume, not with 10 years). Open risk P-08 (RISK_REGISTER),
measured again here; a real decision needs a run on the Supabase server size the customer will pay for — [НЕ ПРОВЕРЕНО].
