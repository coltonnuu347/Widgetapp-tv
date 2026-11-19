#!/usr/bin/env python3
"""Checks for tools/serve.py. Run: python3 test/serve.test.py"""
import importlib.util
import os
import sys
import threading
import urllib.error
import urllib.parse
import urllib.request

here = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location('serve', os.path.join(here, '..', 'tools', 'serve.py'))
serve = importlib.util.module_from_spec(spec)
spec.loader.exec_module(serve)

failed = 0


def check(name, ok, extra=''):
    global failed
    print(('PASS ' if ok else 'FAIL ') + name + ('' if ok else ' - ' + str(extra)))
    if not ok:
        failed += 1


A = serve.allowed
check('an iCloud calendar address is allowed', A('https://p138-caldav.icloud.com/published/2/abc') is not None)
check('webcal:// is turned into https://', A('webcal://p01-caldav.icloud.com/published/2/abc') == 'https://p01-caldav.icloud.com/published/2/abc')
check('icloud.com itself is allowed', A('https://icloud.com/x') is not None)
check('other hosts are refused', A('https://example.com/x') is None)
check('a look-alike (icloud.com.evil.com) is refused', A('https://icloud.com.evil.com/x') is None)
check('a look-alike (eviliccloud.com / evilicloud.com) is refused', A('https://evilicloud.com/x') is None)
check('user@host tricks are refused', A('https://icloud.com@evil.com/x') is None and A('https://evil.com@icloud.com/x') is None)
check('plain http is refused', A('http://p01-caldav.icloud.com/x') is None)
check('a non-standard port is refused', A('https://p01-caldav.icloud.com:8443/x') is None)
check('file:// and empty are refused', A('file:///etc/passwd') is None and A('') is None and A(None) is None)

# the real server on a free port: the folder is served, a refused address gives 403
srv = serve.Server(('127.0.0.1', 0), serve.Handler)
port = srv.server_address[1]
threading.Thread(target=srv.serve_forever, daemon=True).start()
base = 'http://127.0.0.1:%d' % port


def get(path):
    try:
        with urllib.request.urlopen(base + path, timeout=10) as r:
            return r.status, r.read()
    except urllib.error.HTTPError as e:
        return e.code, e.read()


s, body = get('/index.html')
check('the app folder is served', s == 200 and b'<title>' in body, s)
s, body = get('/calproxy?url=' + urllib.parse.quote('https://example.com/x', safe=''))
check('/calproxy refuses a host that is not icloud.com (403)', s == 403, s)
s, body = get('/calproxy')
check('/calproxy with no address is refused (403)', s == 403, s)
srv.shutdown()

if failed:
    print('%d FAILED' % failed)
    sys.exit(1)
print('All server checks passed')
