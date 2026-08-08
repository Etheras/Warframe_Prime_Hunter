#!/usr/bin/env python3
"""
Serve VorFrame locally and open it in the default browser.

Picks a port that actually works. Windows reserves port ranges dynamically
(Hyper-V/WSL), so a hardcoded port can start failing between one day and the
next with nothing but a traceback to explain it.
"""

from __future__ import annotations

import functools
import http.server
import os
import socket
import socketserver
import sys
import threading
import webbrowser

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PREFERRED = [8777, 8781, 8080, 8000, 5500]


def usable(port: int) -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        try:
            s.bind(("127.0.0.1", port))
            return True
        except OSError:
            return False


def pick_port() -> int:
    for p in PREFERRED:
        if usable(p):
            return p
    # nothing preferred is free — let the OS hand us one
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, fmt, *args):  # noqa: A003 - keep the console readable
        pass


def main() -> int:
    if not os.path.exists(os.path.join(ROOT, "data", "vorframe-data.js")):
        print("No data yet. Run refresh-data.cmd first (about a minute).")
        return 1

    port = pick_port()
    url = f"http://localhost:{port}"
    handler = functools.partial(QuietHandler, directory=ROOT)

    socketserver.TCPServer.allow_reuse_address = True
    try:
        httpd = socketserver.TCPServer(("127.0.0.1", port), handler)
    except OSError as exc:
        print(f"Could not start a local server: {exc}")
        return 1

    # flush explicitly: stdout is block-buffered when the console window is not
    # a terminal, which would leave the launcher window blank until it closed
    print(f"\n  VorFrame is running at  {url}\n\n"
          "  Keep this window open while you use the site.\n"
          "  Close it (or press Ctrl+C) to stop.\n", flush=True)

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
