#!/bin/sh
# Stage 5: lint + the whole test suite three times in a row; stops at the first failed run.
# Output: evidence/stage5/suite-run-<n>.txt with commit, start/end time and every result.
set -u
cd "$(dirname "$0")/.."
mkdir -p evidence/stage5
for n in 1 2 3; do
  f=evidence/stage5/suite-run-$n.txt
  { echo "# run $n of 3 — commit $(git rev-parse HEAD), tree $(git status --porcelain | wc -l | tr -d ' ') changed files — start $(date -u +%FT%TZ)"
    echo '$ node tests/lint.js && node tests/run.js'
    node tests/lint.js 2>&1 | sed -n '1,3p'
    node tests/run.js 2>&1; rc=$?
    echo "exit $rc  end $(date -u +%FT%TZ)"; } > "$f" 2>&1
  tail -n 1 "$f"; grep -q '^exit 0 ' "$f" || { echo "run $n failed"; exit 1; }
done
echo "3 of 3 passed"
