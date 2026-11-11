#!/bin/sh
# Stamp the app version so open copies reload themselves, then commit and push.
# Usage: ./publish.sh "commit message"
set -e
cd "$(dirname "$0")"
v=$(date -u +%Y%m%d%H%M%S)
sed -i "s/var APP_VERSION=\"[^\"]*\"/var APP_VERSION=\"$v\"/" index.html
git add -A
git commit -q -F - <<MSG
$1

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01B7V6YDzvxrHSJcNgF6PGgj
MSG
git push origin main 2>&1 | tail -1
echo "version $v"
