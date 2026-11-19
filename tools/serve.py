#!/usr/bin/env python3
"""A small web server for previewing the dashboard on your Mac (and on the TV's browser).

It serves this folder like `python3 -m http.server`, and adds one thing: /calproxy?url=<address>,
which fetches your iCloud calendar for the page. Browsers refuse to read iCloud directly (a "CORS" block),
which shows up as "Couldn't load ... (Failed to fetch)". Nothing else is fetched: only https addresses whose
host is icloud.com or a subdomain of it are allowed.

Run:  python3 tools/serve.py [port]      (Start TV Preview.command does this for you)
"""
import http.server
import os
import socketserver
import sys
import urllib.error
import urllib.parse
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MAX_BYTES = 8 * 1024 * 1024


def allowed(url):
    """True only for https://icloud.com/... or https://<something>.icloud.com/... (webcal:// is turned into https:// first)."""
    url = (url or '').strip()
    if url.lower().startswith('webcal://') or url.lower().startswith('webcals://'):
        url = 'https://' + url.split('://', 1)[1]
    try:
        p = urllib.parse.urlsplit(url)
    except ValueError:
        return None
    host = (p.hostname or '').lower()
    if p.scheme != 'https' or p.username or p.password or (p.port not in (None, 443)):
        return None
    if host == 'icloud.com' or host.endswith('.icloud.com'):
        return url
    return None


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **k):
        super().__init__(*a, directory=ROOT, **k)

    def do_GET(self):
        parts = urllib.parse.urlsplit(self.path)
        if parts.path != '/calproxy':
            return super().do_GET()
        target = allowed(urllib.parse.parse_qs(parts.query).get('url', [''])[0])
        if not target:
            return self.reply(403, b'Only icloud.com calendar addresses are allowed.')
        try:
            req = urllib.request.Request(target, headers={'User-Agent': 'Mozilla/5.0 (TV Dashboard preview)'})
            with urllib.request.urlopen(req, timeout=20) as r:
                body = r.read(MAX_BYTES + 1)
                if len(body) > MAX_BYTES:
                    return self.reply(502, b'The calendar file is too large.')
                return self.reply(200, body, r.headers.get('Content-Type', 'text/calendar'))
        except urllib.error.HTTPError as e:
            return self.reply(e.code, ('iCloud answered HTTP %d.' % e.code).encode())
        except Exception as e:  # network down, timeout, bad certificate ...
            return self.reply(502, ('Could not reach iCloud: %s' % e).encode())

    def reply(self, code, body, ctype='text/plain; charset=utf-8'):
        self.send_response(code)
        self.send_header('Content-Type', ctype)
        self.send_header('Content-Length', str(len(body)))
        self.send_header('Cache-Control', 'no-store')
        self.end_headers()
        self.wfile.write(body)

    def end_headers(self):
        # A page loaded from another address (for example the TV) may use this proxy
        self.send_header('Access-Control-Allow-Origin', '*')
        super().end_headers()


class Server(socketserver.ThreadingMixIn, http.server.HTTPServer):
    daemon_threads = True
    allow_reuse_address = True


if __name__ == '__main__':
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8765
    with Server(('', port), Handler) as s:
        print('Serving the dashboard on port %d (with the calendar helper). Press Control-C to stop.' % port)
        try:
            s.serve_forever()
        except KeyboardInterrupt:
            pass
