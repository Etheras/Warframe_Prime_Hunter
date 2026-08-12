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
import hashlib
import http.server
import json
import os
import socket
import socketserver
import sys
import urllib.parse
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


# Exactly what the site asks for, and nothing else. The pages request eight
# files plus artwork; serving the containing folder handed out a great deal
# more.
#
# An allowlist rather than a blocklist, deliberately: a blocklist has to predict
# what is worth hiding, and the thing that made this urgent -- a whole .git
# directory, pack files and all, from which a private repository can be
# reconstructed -- was not on anyone's list of things to think about.
ALLOWED_FILES = frozenset({
    "index.html", "plan.html",
    "assets/styles.css", "assets/shared.js", "assets/rotation.js",
    "assets/app.js", "assets/plan.js",
    "data/vorframe-data.js",
})
ALLOWED_DIRS = ("assets/img/",)          # artwork, named from the item data

# No 'unsafe-inline' and no 'unsafe-eval': the app is four script files of its
# own -- two shared modules, then whichever page you are on -- and one
# stylesheet. frame-ancestors 'none' stops the page being framed, form-action
# 'none' because there is no form to submit anywhere.
#
# img-src is decided from the dataset rather than fixed. When artwork has been
# pulled local -- which refresh-data does by default -- no third party is
# involved and the policy says so, which turns "we do not call the CDN" from an
# intention into something the browser enforces. A visitor's IP then reaches
# nobody but this server.
def build_csp() -> str:
    img = "'self' data:"
    try:
        with open(os.path.join(ROOT, "data", "vorframe-data.js"), encoding="utf-8") as fh:
            if "cdn.warframestat.us" in fh.read():
                img += " https://cdn.warframestat.us"
    except OSError:
        pass
    return ("default-src 'none'; "
            "script-src 'self'; "
            "style-src 'self'; "
            f"img-src {img}; "
            "connect-src 'self'; "
            "base-uri 'none'; "
            "form-action 'none'; "
            "frame-ancestors 'none'")


CSP = build_csp()


def allowed(rel: str) -> bool:
    if rel in ALLOWED_FILES:
        return True
    return any(rel.startswith(d) and "/" not in rel[len(d):] for d in ALLOWED_DIRS)


# ── abuse control, without keeping anything about anybody ──────────────────
#
# A token bucket per client. The GDPR question this raises is a fair one: an IP
# address is personal data, so rate limiting does process it. Three choices keep
# that proportionate, and they are design decisions rather than paperwork:
#
#   * The address is never stored. It is hashed with a salt generated fresh at
#     start-up and held only in memory, so buckets cannot be tied back to an
#     address, cannot be correlated across restarts, and vanish when the process
#     exits. Nothing is written to disk, ever.
#   * Buckets expire on their own, so there is no retention period to define
#     beyond "until it goes idle".
#   * The purpose is security. Recital 49 names network and information security
#     as a legitimate interest, which is the basis this relies on -- and the
#     footer says so plainly rather than burying it.
#
# What is deliberately absent: no request log, no addresses, no user agents, no
# referrers, no analytics. The counters below are totals, and totals are not
# personal data.
_SALT = os.urandom(16)
RATE_BURST = 60          # requests a client may make back to back
RATE_PER_SEC = 10.0      # and the rate it refills at afterwards
_buckets: dict = {}
_bucket_lock = threading.Lock()
STATS = {"served": 0, "refused": 0, "limited": 0}


def _client_key(addr: str) -> str:
    return hashlib.blake2b(addr.encode("utf-8"), key=_SALT, digest_size=16).hexdigest()


def allow_request(addr: str) -> bool:
    """Token bucket. True to serve, False to answer 429."""
    now = time.monotonic()
    key = _client_key(addr)
    with _bucket_lock:
        tokens, seen = _buckets.get(key, (float(RATE_BURST), now))
        tokens = min(RATE_BURST, tokens + (now - seen) * RATE_PER_SEC)
        if tokens < 1.0:
            _buckets[key] = (tokens, now)
            return False
        _buckets[key] = (tokens - 1.0, now)
        # opportunistic sweep, so idle clients do not accumulate for ever
        if len(_buckets) > 4096:
            cutoff = now - 300
            for k in [k for k, (_, t) in _buckets.items() if t < cutoff]:
                del _buckets[k]
    return True


class VorFrameHandler(http.server.SimpleHTTPRequestHandler):
    """
    Serves the site and refuses everything else.

    SimpleHTTPRequestHandler is not a hardened server and the standard library
    says as much. It does get path traversal right - ../ and its encodings were
    tested and all return 404 - but by default it publishes the entire directory
    it is pointed at, with browsable listings. For this folder that meant .git,
    .cache, tools and tests.
    """

    def log_message(self, fmt, *args):  # noqa: A003 - keep the console readable
        pass

    def end_headers(self):
        """
        Headers a browser will act on, which cost nothing to send.

        The CSP is the substantive one: everything the app runs is its own
        script files, so 'self' is enough and there is no 'unsafe-inline'
        anywhere. That is only true because the two inline onerror attributes on
        artwork were replaced with a capture-phase listener - with those in place
        this policy would have blocked every card image's fallback.

        img-src allows data: for the favicon, which is an inline SVG in the
        page head, and the CDN because a build without --with-images points
        artwork there. With local artwork nothing off-site
        is ever requested and the extra source simply goes unused.
        """
        self.send_header("Content-Security-Policy", CSP)
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Referrer-Policy", "no-referrer")
        self.send_header("X-Frame-Options", "DENY")
        super().end_headers()

    def _reject(self):
        STATS["refused"] += 1
        self.send_error(404, "Not Found")

    def _too_many(self):
        STATS["limited"] += 1
        self.send_response(429, "Too Many Requests")
        self.send_header("Retry-After", "10")
        self.send_header("Content-Length", "0")
        self.end_headers()

    def _relative(self) -> str:
        """Path relative to the site root, normalised, or "" if it escapes."""
        path = self.path.split("?", 1)[0].split("#", 1)[0]
        path = urllib.parse.unquote(path)
        full = os.path.normpath(os.path.join(ROOT, path.lstrip("/")))
        try:
            rel = os.path.relpath(full, ROOT)
        except ValueError:                    # different drive on Windows
            return ""
        if rel.startswith(".."):
            return ""
        return rel.replace(os.sep, "/")

    def do_HEAD(self):                                    # noqa: N802
        if not allow_request(self.client_address[0]):
            return self._too_many()
        if not allowed(self._relative()):
            return self._reject()
        super().do_HEAD()

    def do_GET(self):                                     # noqa: N802
        if not allow_request(self.client_address[0]):
            return self._too_many()
        rel = self._relative()
        if rel in ("", "."):
            rel = "index.html"
            self.path = "/index.html"
        if not allowed(rel):
            return self._reject()

        # The dataset is the one request worth checking before answering: asked
        # for once per page load, and the thing that would be stale.
        if rel == "data/vorframe-data.js":
            path = os.path.join(ROOT, "data", "vorframe-data.js")
            if os.path.exists(path):
                with open(path, "rb") as fh:
                    blob = fh.read()
                tail = "\nwindow.VORFRAME_UPSTREAM = " + json.dumps(freshness()) + ";\n"
                blob += tail.encode("utf-8")
                self.send_response(200)
                self.send_header("Content-Type", "application/javascript")
                self.send_header("Content-Length", str(len(blob)))
                self.send_header("Cache-Control", "no-store")
                self.end_headers()
                STATS["served"] += 1
                self.wfile.write(blob)
                return
        STATS["served"] += 1
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
    handler = functools.partial(VorFrameHandler, directory=ROOT)

    # Threaded, because the single-threaded server could be taken down by one
    # client opening a socket and never finishing its request - measured: a
    # second client waited the full timeout. A timeout as well, so a stalled
    # connection releases its thread rather than holding it for ever.
    class Server(socketserver.ThreadingMixIn, http.server.HTTPServer):
        daemon_threads = True
        allow_reuse_address = True
        timeout = 30

    try:
        httpd = Server((host, port), handler)
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
