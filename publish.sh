#!/bin/sh
# Stamp the app version so open copies reload themselves, check the script, then commit and push.
# Usage: ./publish.sh "commit message"
set -e
cd "$(dirname "$0")"
v=$(date -u +%Y%m%d%H%M%S)
sed -i "s/^var APP_VERSION=\"[^\"]*\";\$/var APP_VERSION=\"$v\";/" index.html
grep -q "^var APP_VERSION=\"$v\";\$" index.html
python3 -c "
s=open('index.html',encoding='utf-8').read()
i=s.rindex('<script>');j=s.rindex('</script>')
open('/tmp/publish_check.js','w',encoding='utf-8').write(s[i+8:j])"
node --check /tmp/publish_check.js
git add -A
git commit -q -F - <<MSG
$1

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01B7V6YDzvxrHSJcNgF6PGgj
MSG
git push origin main 2>&1 | tail -1
echo "version $v"
