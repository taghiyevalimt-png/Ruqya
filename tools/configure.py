"""Makes a deployable copy of the site that talks to another Supabase project (a restored copy, a self-hosted stack,
a test stack), without touching the published files in this repository.

  SUPABASE_URL=https://abcd.supabase.co SUPABASE_ANON_KEY=... python3 tools/configure.py OUT_DIR
  python3 tools/configure.py --env-file .env OUT_DIR

In the copy it replaces the project URL and the public (anon / publishable) key in the app script, the
Content-Security-Policy connect-src (https + wss, or http + ws for a local stack), the dashboard links when the new
URL is a supabase.co project, and the session storage key name when the new host needs another one. Then it runs the
same CSP hash step as publish.sh (tools/csp.py, then tools/csp.py --check) on the copy, so the changed inline
scripts still pass the policy. Values from the environment win over the .env file.
Never put a service_role / secret key here: this key is shipped to every browser."""
import os, re, shutil, subprocess, sys, tempfile
from urllib.parse import urlsplit

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SITE = ['index.html', 'manifest.webmanifest', 'version.txt', 'vendor', 'launch']   # plus the *.png icons


def die(msg):
    sys.exit('configure: ' + msg)


def read_env_file(path):
    out = {}
    for n, line in enumerate(open(path, encoding='utf-8'), 1):
        line = line.strip()
        if not line or line.startswith('#'):
            continue
        if line.startswith('export '):
            line = line[7:].lstrip()
        if '=' not in line:
            die('%s:%d: expected NAME=value' % (path, n))
        k, v = line.split('=', 1)
        v = v.strip()
        if len(v) >= 2 and v[0] == v[-1] and v[0] in '"\'':
            v = v[1:-1]
        out[k.strip()] = v
    return out


def origin_of(url):
    u = urlsplit(url)
    if u.scheme not in ('https', 'http') or not u.hostname or u.path not in ('', '/') or u.query or u.fragment or u.username:
        die('SUPABASE_URL must look like https://<ref>.supabase.co or http://127.0.0.1:54321 (no path)')
    if u.scheme == 'http' and u.hostname not in ('127.0.0.1', 'localhost', '::1'):
        die('plain http is only accepted for a local stack (127.0.0.1 / localhost)')
    return '%s://%s' % (u.scheme, u.netloc), ('wss' if u.scheme == 'https' else 'ws') + '://' + u.netloc, u.hostname


def sub_once(pattern, repl, s, what):
    s2, n = re.subn(pattern, lambda m: repl, s, flags=re.M)
    if n != 1:
        die('expected exactly one %s in index.html, found %d' % (what, n))
    return s2


def main(argv):
    env_file, out = None, None
    args = list(argv)
    while args:
        a = args.pop(0)
        if a == '--env-file':
            env_file = args.pop(0) if args else die('--env-file needs a path')
        elif a in ('-h', '--help'):
            print(__doc__); return 0
        elif out is None:
            out = a
        else:
            die('unexpected argument ' + a)
    if not out:
        die('usage: configure.py [--env-file .env] OUT_DIR')
    conf = {}
    if env_file:
        conf.update(read_env_file(env_file))
    elif os.path.exists('.env'):
        conf.update(read_env_file('.env')); env_file = '.env'
    for k in ('SUPABASE_URL', 'SUPABASE_ANON_KEY'):
        if os.environ.get(k):
            conf[k] = os.environ[k]
    url, key = conf.get('SUPABASE_URL', '').strip().rstrip('/'), conf.get('SUPABASE_ANON_KEY', '').strip()
    if not url or not key:
        die('SUPABASE_URL and SUPABASE_ANON_KEY are required (environment or --env-file)')
    if not re.fullmatch(r'[A-Za-z0-9._-]{20,2000}', key):
        die('SUPABASE_ANON_KEY does not look like an anon / publishable key')
    if key.startswith('sb_secret_') or '"role":"service_role"' in _jwt_payload(key):
        die('that is a secret / service_role key; use the anon or publishable key')
    http_origin, ws_origin, host = origin_of(url)

    out = os.path.abspath(out)
    if out == ROOT or out.startswith(ROOT + os.sep):
        die('the output folder must be outside the repository (it would be published)')
    if os.path.exists(out) and os.listdir(out):
        die(out + ' exists and is not empty')

    src = open(os.path.join(ROOT, 'index.html'), encoding='utf-8').read()
    m = re.search(r'^var SB_URL="(https://([a-z0-9]+)\.supabase\.co)";$', src, re.M)
    if not m:
        die('var SB_URL="https://<ref>.supabase.co"; not found in index.html')
    old_url, old_ref = m.group(1), m.group(2)
    s = src
    s = sub_once(r'^var SB_URL="[^"]*";$', 'var SB_URL="%s";' % http_origin, s, 'var SB_URL line')
    s = sub_once(r'^var SB_KEY="[^"]*";$', 'var SB_KEY="%s";' % key, s, 'var SB_KEY line')
    old_csp = 'connect-src \'self\' %s %s;' % (old_url, old_url.replace('https://', 'wss://'))
    s = sub_once(re.escape(old_csp), 'connect-src \'self\' %s %s;' % (http_origin, ws_origin), s, 'CSP connect-src')
    # supabase-js keeps the session under sb-<first label of the host>-auth-token; the app derives the same name
    # from SB_URL with an expression that only works for https://<ref>.supabase.co, so write it out when it differs.
    token = 'sb-%s-auth-token' % host.split('.')[0]
    app_token = 'sb-' + re.sub(r'^https://|\..*$', '', http_origin) + '-auth-token'
    if app_token != token:
        s = sub_once(r'^var SB_TOKEN=.*$', 'var SB_TOKEN="%s";   /* where supabase-js keeps the session */' % token, s, 'var SB_TOKEN line')
    new_ref = re.fullmatch(r'([a-z0-9]+)\.supabase\.co', host)
    if new_ref:
        s = s.replace('supabase.com/dashboard/project/%s/' % old_ref, 'supabase.com/dashboard/project/%s/' % new_ref.group(1))
    if old_url in s or (new_ref and new_ref.group(1) != old_ref and old_ref in s):
        die('the old project is still referenced after the changes; refusing to write a mixed copy')

    tmp = tempfile.mkdtemp(prefix='ruqya-site-', dir=os.path.dirname(out) or None)
    try:
        for name in SITE + sorted(f for f in os.listdir(ROOT) if f.endswith('.png')):
            p = os.path.join(ROOT, name)
            if os.path.isdir(p):
                shutil.copytree(p, os.path.join(tmp, name))
            elif os.path.exists(p):
                shutil.copy2(p, os.path.join(tmp, name))
        open(os.path.join(tmp, 'index.html'), 'w', encoding='utf-8').write(s)
        # the CSP hash step of publish.sh, run on the copy with the repository's own tools/csp.py
        os.mkdir(os.path.join(tmp, 'tools'))
        shutil.copy2(os.path.join(ROOT, 'tools', 'csp.py'), os.path.join(tmp, 'tools', 'csp.py'))
        for extra in ([], ['--check']):
            r = subprocess.run([sys.executable, '-I', os.path.join(tmp, 'tools', 'csp.py')] + extra, capture_output=True, text=True)
            if r.returncode:
                die('csp.py %s failed: %s' % (' '.join(extra), (r.stderr or r.stdout).strip()))
        print(r.stdout.strip())
        shutil.rmtree(os.path.join(tmp, 'tools'))
        if shutil.which('node'):   # same syntax check as publish.sh
            t = open(os.path.join(tmp, 'index.html'), encoding='utf-8').read()
            js = os.path.join(tmp, '.check.js')
            open(js, 'w', encoding='utf-8').write(t[t.rindex('<script>') + 8:t.rindex('</script>')])
            r = subprocess.run(['node', '--check', js], capture_output=True, text=True)
            os.remove(js)
            if r.returncode:
                die('node --check failed: ' + r.stderr.strip())
        if os.path.exists(out):
            os.rmdir(out)
        os.rename(tmp, out)
    except BaseException:
        shutil.rmtree(tmp, ignore_errors=True)
        raise
    print('configured copy in %s for %s%s' % (out, http_origin, (' (values from %s)' % env_file) if env_file else ''))
    return 0


def _jwt_payload(key):
    parts = key.split('.')
    if len(parts) != 3:
        return ''
    import base64
    try:
        return base64.urlsafe_b64decode(parts[1] + '=' * (-len(parts[1]) % 4)).decode('utf-8', 'replace').replace(' ', '')
    except Exception:
        return ''


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
