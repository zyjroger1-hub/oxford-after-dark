#!/usr/bin/env python3
"""No-install loopback-only server. Run from any directory."""
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
import argparse, functools, webbrowser, threading
parser=argparse.ArgumentParser();parser.add_argument('--port',type=int,default=4173);parser.add_argument('--no-browser',action='store_true');args=parser.parse_args()
root=Path(__file__).resolve().parents[1]
handler=functools.partial(SimpleHTTPRequestHandler,directory=str(root))
try:server=ThreadingHTTPServer(('127.0.0.1',args.port),handler)
except OSError as e:raise SystemExit(f'Cannot start on port {args.port}: {e}. Try --port 4174.')
url=f'http://127.0.0.1:{args.port}'
print(f'Oxford After Dark → {url}\nLocal only. Press Ctrl+C to stop.',flush=True)
if not args.no_browser:threading.Timer(.25,lambda:webbrowser.open(url)).start()
try:server.serve_forever()
except KeyboardInterrupt:pass
finally:server.server_close()
