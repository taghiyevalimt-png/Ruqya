#!/bin/sh
# Stamp the app version so open copies reload themselves, check the script, then commit and push.
# Usage: ./publish.sh "commit message"
set -eu
(set -o pipefail) 2>/dev/null && set -o pipefail
cd "$(dirname "$0")"
# B-07: publish only from an up-to-date main, and fail loudly if the push does not reach origin/main
br=$(git rev-parse --abbrev-ref HEAD)
[ "$br" = "main" ] || { echo "publish.sh: switch to main first (now on $br)"; exit 1; }
git fetch -q origin main
[ "$(git rev-list --count HEAD..origin/main)" = "0" ] || { echo "publish.sh: origin/main has commits this main does not have; pull first"; exit 1; }
v=$(date -u +%Y%m%d%H%M%S)
printf "%s\n" "$v" > version.txt
sed -i "s/^var APP_VERSION=\"[^\"]*\";\$/var APP_VERSION=\"$v\";/" index.html
grep -q "^var APP_VERSION=\"$v\";\$" index.html
PY=python3; $PY -c "" 2>/dev/null || PY=python   # Windows: "python3" may be only a shop shortcut
$PY tools/csp.py && $PY tools/csp.py --check   # new version = new script text = new CSP hash
mkdir -p tests/out
$PY -c "
s=open('index.html',encoding='utf-8').read()
i=s.rindex('<script>');j=s.rindex('</script>')
open('tests/out/publish_check.js','w',encoding='utf-8').write(s[i+8:j])"
node --check tests/out/publish_check.js
git add -A
git commit -q -F - <<MSG
$1

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
MSG
git push origin HEAD:main
[ "$(git rev-parse HEAD)" = "$(git rev-parse origin/main)" ] || { echo "publish.sh: push did not reach origin/main"; exit 1; }
echo "version $v"
