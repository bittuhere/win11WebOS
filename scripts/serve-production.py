"""Local production/CSP test server. Hosting policy lives in public/_headers.
Frame embedding restrictions are omitted ONLY here to allow the workspace preview.
Usage: python scripts/serve-production.py [port]
"""
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
import sys, fnmatch
ROOT = Path(__file__).resolve().parents[1]
class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT / 'build'), **kwargs)
    def end_headers(self):
        pattern = None
        headers = {}
        for line in (ROOT / 'public/_headers').read_text().splitlines():
            if not line.strip() or line.startswith('#'): continue
            if not line.startswith(' '): pattern = line.strip(); continue
            if pattern and fnmatch.fnmatch(self.path.split('?')[0], pattern):
                key, value = line.strip().split(':', 1)
                if key == 'X-Frame-Options': continue
                if key == 'Content-Security-Policy':
                    value = value.replace("; frame-ancestors 'self'", '')
                headers[key] = value.strip()
        for key, value in headers.items(): self.send_header(key, value)
        super().end_headers()
    def log_message(self, *args): pass
if __name__ == '__main__':
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 4180
    print(f'Production preview on 0.0.0.0:{port}', flush=True)
    ThreadingHTTPServer(('0.0.0.0', port), Handler).serve_forever()
