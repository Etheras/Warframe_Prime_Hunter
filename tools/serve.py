#!/usr/bin/env python3
"""
Serve VorFrame and open it in the default browser.

    python tools/serve.py                    # this machine only
    python tools/serve.py --host 0.0.0.0     # anyone on your network
    python tools/serve.py --port 8777        # pin the port

Picks a port that actually works. Windows reserves port ranges dynamically
(Hyper-V/WSL), so a hardcoded port can start failing between one day and the
next with nothing but a traceback to explain it.

Binding to 0.0.0.0 puts the site on your local network, which is genuinely
useful for ticking parts off on a phone while you play — but there is no login
and no encryption, and Backup/Import is right there in the page, so anyone who
can reach the port can read *and* overwrite your collection. Use it on a network
you trust. The banner says as much when it starts.
"""

from __future__ import annotations

import argparse
import functools
import http.server
import json
import os
import socket
import socketserver
import sys
import threading
import time
import webbrowser

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BASE_PORT = 8777        # where the search starts, and the fixed port for --host
PORT_TRIES = 40         # 8777-8816; past that something is badly wrong


def usable(port: int, host: str) -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        try:
            s.bind((host, port))
            return True
        except OSError:
            return False


def pick_port(host: str) -> int:
    """
    First free port from BASE_PORT upward.

    Trying to bind is the same question `netstat -ano` answers, asked directly:
    it also catches ports that are reserved rather than listening, which
    Windows does dynamically for Hyper-V and WSL and which netstat does not
    show as in use.

    Only used for the local-only server, where the port wandering does not
    matter because the browser is opened for you. A network-facing server keeps
    a fixed port instead, so a bookmark on your phone keeps working.
    """
    for p in range(BASE_PORT, BASE_PORT + PORT_TRIES):
        if usable(p, host):
            return p
    raise SystemExit(f"No free port between {BASE_PORT} and "
                     f"{BASE_PORT + PORT_TRIES - 1}. Close something and retry.")


def lan_address() -> str | None:
    """Best guess at the address a phone on the same Wi-Fi would use."""
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as s:
            s.connect(("10.255.255.255", 1))       # no packet is actually sent
            return s.getsockname()[0]
    except OSError:
        return None


# Upstream freshness, checked by the server before it hands over stale data.
#
# The browser is not involved and does not know this happens. It asks for the
# data file as usual; we check whether Digital Extremes have moved on since the
# build, and plant the answer on the file as we serve it. That request blocks
# while the check runs, which is a deliberate trade - a slow first load beats
# quietly serving data you have no reason to trust.
#
# It could not be done from the page anyway: warframe.com and the artwork CDN
# send no CORS headers, so a cross-origin fetch fails outright and a no-cors one
# comes back opaque with unreadable headers. Having every visitor contact the
# CDN would also undo the point of holding artwork locally.
#
# Verification only - three HEAD requests, no downloads, nothing rebuilt. It is
# throttled to once an hour so a page reload does not hammer DE, and a failure
# upstream is silent rather than alarming.
FRESHNESS_TTL = 3600
_freshness: dict = {"checked": 0.0, "body": None}
_freshness_lock = threading.Lock()


def freshness() -> dict:
    with _freshness_lock:
        age = time.time() - _freshness["checked"]
        if _freshness["body"] is not None and age < FRESHNESS_TTL:
            return _freshness["body"]
    try:
        import sources
        sig = sources.upstream_signature(False)
        prev = (sources.load_state() or {}).get("signature") or {}
        moved = sorted(k for k in set(sig) | set(prev) if sig.get(k) != prev.get(k))
        body = {"ok": True, "stale": bool(moved), "moved": moved,
                "checkedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())}
    except Exception as exc:                              # noqa: BLE001
        # upstream unreachable is not the page's problem - say nothing rather
        # than cry stale, which would be wrong and unactionable
        body = {"ok": False, "stale": False, "error": str(exc)[:120]}
    with _freshness_lock:
        _freshness["checked"] = time.time()
        _freshness["body"] = body
    return body


class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, fmt, *args):  # noqa: A003 - keep the console readable
        pass

    def do_GET(self):                                     # noqa: N802
        """
        The dataset is the one request worth checking before answering: it is
        asked for exactly once per page load, by both pages, and it is the thing
        that would be stale. Everything else is served untouched.
        """
        if self.path.split("?")[0].endswith("/data/vorframe-data.js"):
            path = os.path.join(ROOT, "data", "vorframe-data.js")
            if os.path.exists(path):
                with open(path, "rb") as fh:
                    blob = fh.read()
                note = json.dumps(freshness())
                tail = "\nwindow.VORFRAME_UPSTREAM = " + note + ";\n"
                blob += tail.encode("utf-8")
                self.send_response(200)
                self.send_header("Content-Type", "application/javascript")
                self.send_header("Content-Length", str(len(blob)))
                self.send_header("Cache-Control", "no-store")
                self.end_headers()
                self.wfile.write(blob)
                return
        super().do_GET()


def main() -> int:
    ap = argparse.ArgumentParser(description="Serve VorFrame locally.")
    ap.add_argument("--host", default="127.0.0.1",
                    help="interface to bind (default 127.0.0.1; use 0.0.0.0 for "
                         "the whole local network)")
    ap.add_argument("--port", type=int, default=None,
                    help="port to use (default: the first one that works)")
    ap.add_argument("--no-browser", action="store_true",
                    help="do not open a browser window")
    args = ap.parse_args()

    if not os.path.exists(os.path.join(ROOT, "data", "vorframe-data.js")):
        print("No data yet. Run refresh-data.cmd first (about a minute).")
        return 1

    host = args.host
    lan = host not in ("127.0.0.1", "localhost")
    if args.port:
        port = args.port                      # asked for explicitly: honour it
    elif lan:
        # Fixed, so a bookmark on a phone survives a restart. If it is taken we
        # say so rather than silently moving and breaking that bookmark.
        port = BASE_PORT
        if not usable(port, host):
            print(f"Port {port} is in use, and a network server keeps a fixed port "
                  f"so saved links stay valid.")
            print("Close whatever is using it, or pass --port to choose another.")
            return 1
    else:
        port = pick_port(host)
    url = f"http://localhost:{port}"
    handler = functools.partial(QuietHandler, directory=ROOT)

    socketserver.TCPServer.allow_reuse_address = True
    try:
        httpd = socketserver.TCPServer((host, port), handler)
    except OSError as exc:
        print(f"Could not start a server on {host}:{port} — {exc}")
        return 1

    # flush explicitly: stdout is block-buffered when the console window is not
    # a terminal, which would leave the launcher window blank until it closed
    lines = ["", f"  VorFrame is running at  {url}"]
    if lan:
        addr = lan_address()
        if addr:
            lines.append(f"  On this network:        http://{addr}:{port}")
        lines += [
            "",
            "  Anyone on this network can open it. They get their own tracker -",
            "  ticks live in each browser, so yours is neither visible nor",
            "  changeable by them. This folder is readable though, .cache and",
            "  all, so keep private files out of it.",
        ]
    lines += ["", "  Keep this window open while you use the site.",
              "  Close it (or press Ctrl+C) to stop.", ""]
    print("\n".join(lines), flush=True)

    if not args.no_browser:
        threading.Timer(1.0, lambda: webbrowser.open(url)).start()
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nStopped.")
    finally:
        httpd.server_close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
