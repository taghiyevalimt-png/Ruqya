"""Writes the Content-Security-Policy script hashes into index.html, so only the page's own inline scripts can run
(no 'unsafe-inline'). Run after every change of an inline script; publish.sh runs it and then checks it.
Usage: python3 tools/csp.py [--check]"""
import base64, hashlib, re, sys
p = __file__.rsplit('/tools/', 1)[0] + '/index.html'
s = open(p, encoding='utf-8').read()
scripts = re.findall(r'<script>(.*?)</script>', s, re.S)
hashes = " ".join("'sha256-%s'" % base64.b64encode(hashlib.sha256(x.encode('utf-8')).digest()).decode() for x in scripts)
m = re.search(r"script-src 'self'[^;\"]*;", s)
if not m: sys.exit('CSP script-src not found')
want = "script-src 'self' %s;" % hashes
if '--check' in sys.argv:
    if m.group(0) != want: sys.exit('CSP hashes are out of date: run python3 tools/csp.py')
    print('CSP ok: %d inline scripts' % len(scripts)); sys.exit(0)
s = s[:m.start()] + want + s[m.end():]
open(p, 'w', encoding='utf-8').write(s)
print('CSP updated: %d inline scripts' % len(scripts))
