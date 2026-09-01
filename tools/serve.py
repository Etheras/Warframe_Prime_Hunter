#!/usr/bin/env python3
"""
Serve Warframe Prime Hunter and open it in the default browser.

    python tools/serve.py                    # this machine
    python tools/serve.py --port 8777        # pin the port

Picks a port that actually works. Windows reserves port ranges dynamically
(Hyper-V/WSL), so a hardcoded port can start failing between one day and the
next with nothing but a traceback to explain it.

**Loopback only, and it refuses to be anything else.** The owner's decision,
2026-09-01. This used to take `--host 0.0.0.0` and there were two launchers for
it, so the site could be opened on a phone on the same Wi-Fi — genuinely useful
while playing, and the thing that made it defensible was a paragraph nobody
reads at the moment they need it.

What that mode actually offered: no encryption, so anyone on the network could
rewrite the page and the data in flight, CSP included, after which the
collection in `localStorage` is same-origin and readable. No login, and
Backup/Import sits on the page, so anyone who could reach the port could read
and overwrite the collection. And the whole folder was readable, `.cache` and
all. The blast radius was one browser's tracker rather than an identity, which
is why it was Medium rather than High — but "Medium, on a network you trust" is
a judgement the reader had to make correctly every time, and the value on the
other side of it was a convenience.

So the mode is gone rather than documented better. `README.md` has a short
notice for anyone who wants to host this somewhere: it is a folder of static
files, so a real web server can serve it, and that is a different job from this
script with different answers about TLS and access.
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


# Upstream freshness: whether Digital Extremes have moved on since this build.
#
# The answer is planted on the data file as it is served, and the page reads it
# from there. Nothing is fetched from the browser to DE - see the CORS note
# below for why that is not merely a preference.
#
# **Serve first, then refresh.** Until 2026-09-01 the request for the data file
# blocked while the check ran, argued as a deliberate trade: a slow first load
# beats quietly serving data you have no reason to trust. The argument was about
# *one* check and the code did *n* of them. `freshness()` took the lock, found
# no cached answer, released the lock and only then went upstream - so every
# request arriving before the first check finished started its own, and three
# tabs opened together made three sets of the same three upstream requests, each
# writing the same `.cache/*.gz` bodies underneath a build that might be reading
# them. The hourly throttle worked perfectly from the second check onwards and
# did nothing at all about the first.
#
# So `freshness()` never blocks now. It answers with what is known, starts one
# background check if none is running, and marks the answer `checking` so the
# page knows to ask again. Two things follow:
#
#   * **The stampede is gone by construction**, not by a lock held longer. The
#     `running` flag is set under the lock before the thread starts, so a second
#     request finds it set and starts nothing. Asking DE three times because
#     three tabs opened at once is precisely what "ask no more often than the
#     source says to" exists to prevent.
#   * **The page learns the answer late**, which it could not before. `freshness`
#     is served again from `upstream.json`, and `shared.js` polls that only while
#     `checking` is true, then redraws the banner in place.
#
# The first load is now fast and briefly says nothing about upstream, where
# before it was slow and said something. That is the trade being made, and it is
# only defensible because the banner corrects itself within a second or two - a
# page that never asked again would be strictly worse than the blocking version.
#
# It could not be done from the page anyway: warframe.com and the artwork CDN
# send no CORS headers, so a cross-origin fetch fails outright and a no-cors one
# comes back opaque with unreadable headers. Having every visitor contact the
# CDN would also undo the point of holding artwork locally.
#
# Verification only, in the sense that nothing is rebuilt - but this said "three
# HEAD requests, no downloads" until 2026-08-26 and both halves were wrong.
# `sources.upstream_signature` makes one HEAD (the drop table) and two GETs (the
# export index, ~500 bytes, and the vault trader window), and both GETs go
# through `fetch`, which writes the body to `.cache/*.gz` with an `.etag`
# sidecar. So serving a page writes to the cache the build reads from. That is
# harmless - it is the same conditional fetch the build would make, and it
# leaves the cache warmer - but a comment that says "no downloads" is how
# nobody notices.
#
# Throttled to once an hour, failures included, so a reload does not hammer DE
# and a blackholed network costs one slow load per hour per process rather than
# one per request.
FRESHNESS_TTL = 3600
# `running` is the single-flight flag and is the whole of the fix: it is raised
# under the lock by whoever starts the check, so nobody else starts one.
_freshness: dict = {"checked": 0.0, "stamp": 0.0, "body": None, "running": False}
_freshness_lock = threading.Lock()


def state_stamp() -> float:
    """
    When the file this check compares against was last written.

    The hour is there to spare Digital Extremes, not to make you wait: it is a
    ceiling on how often we ask them, and nothing else. Refreshing the data
    answers the same question far better than another HEAD request would, so an
    answer from before the rebuild is not merely old, it is about a copy of the
    site that no longer exists.

    Without this the banner outlived the fix that cleared it - refresh-data
    finishes, the data on disk is current, and the page keeps saying it is behind
    for whatever was left of the hour. Reloading did not help, because the
    server, not the browser, was the one holding the old answer.
    """
    try:
        import sources
        return os.path.getmtime(os.path.join(sources.CACHE_DIR, sources.STATE_FILE))
    except Exception:                                     # noqa: BLE001
        return 0.0                                        # no state yet: check


def _check_upstream(stamp: float) -> None:
    """
    The check itself, on a background thread and never on a request's.

    Exactly one of these runs at a time; `freshness()` guarantees it by raising
    `running` under the lock before starting the thread.

    **`finally` is what lowers it, and it has to be `finally`.** This said so in
    prose and did not do it, for the few hours between the serve-then-refresh
    change and this note. A flag left raised means `freshness()` never starts
    another check, so the banner is frozen for the life of the process and the
    page polls twelve times into a state that cannot change.

    The path is real rather than theoretical. `sources.fetch` raises
    **`SystemExit`** on a cold miss with nothing cached, `upstream_signature`
    catches `except Exception` — which does not catch `SystemExit`, a
    `BaseException` — and neither did the handler below. A fresh clone with no
    `.cache`, served while offline, reached it on the first page load.

    So the catch is `BaseException`: this is a background thread whose only job
    is to publish an answer, and there is no exception it may exit without
    publishing one.
    """
    # Bound before the try, so the `finally` below cannot reach for a name that
    # was never assigned. It is the answer a check that dies without saying
    # anything should leave behind.
    body = {"ok": False, "stale": False, "error": "the check did not finish"}
    try:
        import sources
        # Read-only: this asks the same three questions and keeps none of the
        # answers. Serving a page wrote to `.cache/` — the builder's cache —
        # until 2026-09-01, underneath a build that might have been reading it.
        sig = sources.upstream_signature(False, readonly=True)
        prev = (sources.load_state() or {}).get("signature") or {}
        moved = sorted(k for k in set(sig) | set(prev) if sig.get(k) != prev.get(k))
        body = {"ok": True, "stale": bool(moved), "moved": moved,
                "checkedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())}
    except BaseException as exc:                          # noqa: BLE001
        # upstream unreachable is not the page's problem - say nothing rather
        # than cry stale, which would be wrong and unactionable. SystemExit is
        # in here on purpose: a cold `fetch` raises it, and a server thread must
        # not take the answer down with it.
        body = {"ok": False, "stale": False, "error": str(exc)[:120]}
    finally:
        with _freshness_lock:
            _freshness["checked"] = time.time()
            _freshness["stamp"] = stamp
            _freshness["body"] = body
            _freshness["running"] = False


def freshness() -> dict:
    """
    What is known about upstream right now. Never blocks, never goes upstream.

    Three answers, and the page distinguishes them: a body with `checking`
    absent is settled; `checking: true` on a body means the last answer is being
    refreshed behind this response; `checking: true` with `ok: null` means
    nothing is known yet, which is the state a cold first load gets.
    """
    stamp = state_stamp()
    with _freshness_lock:
        age = time.time() - _freshness["checked"]
        settled = (_freshness["body"] is not None and age < FRESHNESS_TTL
                   and _freshness["stamp"] == stamp)
        if settled:
            return _freshness["body"]
        known = _freshness["body"]
        start = not _freshness["running"]
        if start:
            # Raised here, inside the lock, so the request that arrives a
            # microsecond later finds it up and starts nothing.
            _freshness["running"] = True
    if start:
        threading.Thread(target=_check_upstream, args=(stamp,),
                         daemon=True).start()
    # What we have, plus the fact that a better answer is coming. `known` is a
    # previous check that has aged out of the TTL: still worth showing, and far
    # better than a blank while the refresh runs.
    if known is not None:
        return dict(known, checking=True)
    return {"ok": None, "stale": False, "checking": True}


# Exactly what the site asks for, and nothing else. The pages request nine
# files plus artwork; serving the containing folder handed out a great deal
# more.
#
# An allowlist rather than a blocklist, deliberately: a blocklist has to predict
# what is worth hiding, and the thing that made this urgent -- a whole .git
# directory, pack files and all, from which a private repository can be
# reconstructed -- was not on anyone's list of things to think about.
ALLOWED_FILES = frozenset({
    "index.html", "plan.html",
    "assets/styles.css", "assets/shared.js", "assets/rotation.js", "assets/model.js",
    "assets/app.js", "assets/plan.js",
    "data/prime-data.js",
    # The fissure list on its own, re-read by an open page every ten minutes.
    # Same origin and nothing else: this is what keeps `connect-src 'self'` a
    # true statement about the site rather than a formality.
    "data/fissures.json",
    # The upstream-freshness answer on its own. **Generated, not a file on
    # disk** - `do_GET` answers it before the file machinery is reached - and it
    # is listed here anyway so that this set stays the single answer to "what
    # does this server hand out". A page polls it only while the first check is
    # still running; see the serve-first-then-refresh note above.
    "upstream.json",
})
ALLOWED_DIRS = ("assets/img/",)          # artwork, named from the item data

# No 'unsafe-inline' and no 'unsafe-eval': the app is four script files of its
# own -- three shared modules, then whichever page you are on -- and one
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
        with open(os.path.join(ROOT, "data", "prime-data.js"), encoding="utf-8") as fh:
            payload = fh.read()
            # First party, and the ordinary case since 2026-08-27: DE's own
            # texture manifest covers all 167 of the catalogue, so this is
            # normally the only remote host the policy needs to name at all.
            if "content.warframe.com" in payload:
                img += " https://content.warframe.com"
            if "cdn.warframestat.us" in payload:
                # Both hosts, because the CDN is a redirector, not an origin:
                # cdn.warframestat.us/img/AshPrime.png answers 301 to
                # raw.githubusercontent.com/wfcd/warframe-items/.../AshPrime.png,
                # and a policy is enforced against every hop of a redirect, not
                # just the URL in the markup. Naming only the CDN blocked all
                # 167 images on a build without local artwork - measured, and
                # the violation reports the *pre-redirect* URL, so the console
                # says cdn.warframestat.us was refused while the policy plainly
                # allows it. That is why this stood: the error names the one
                # host the policy already permits.
                img += " https://cdn.warframestat.us https://raw.githubusercontent.com"
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


# The one exception, and it is one file wide.
#
# A mockup is a single file with an inline <style> and an inline <script> --
# that is the whole point of a scratchpad you overwrite in place -- so the
# policy above blocks both, the page sits on "Loading..." forever, and the
# reason appears only in the console. That made the documented way to show a
# proposal against real data (PROJECT.md section 2) silently produce a blank
# page, for the audience least likely to suspect the tooling.
#
# Relaxing it *here* rather than in build_csp keeps the blast radius at exactly
# one file: gitignored, never tracked, never part of the site, and already
# refused to any non-loopback peer by `allowed()`. Everything else in the policy
# is kept -- default-src 'none', connect-src 'self', frame-ancestors 'none' --
# so a mockup still cannot reach off-site or be framed. The app's own pages
# never see this header, so "the site has no inline anything" stays a true
# statement the browser enforces.
def build_local_csp() -> str:
    return (CSP
            .replace("script-src 'self'", "script-src 'self' 'unsafe-inline'")
            .replace("style-src 'self'", "style-src 'self' 'unsafe-inline'"))


CSP_LOCAL_ONLY = build_local_csp()


# Served to this machine and to nothing else, whatever the server is bound to.
#
# temp_mockup.html is a scratchpad for showing a proposed change against real
# data before building it (PROJECT.md §2). It is unreviewed and it is not part
# of the site, so "it is gitignored" was never enough on its own.
#
# **Kept as defence in depth after the LAN mode went**, 2026-09-01. The server
# now refuses to bind anything but loopback, so in practice every peer is this
# machine and this check can no longer fire. It stays because it costs one
# comparison and because it is the check that is true of the *request* rather
# than of the socket: it survives a reverse proxy, a port forward, and whatever
# the next person does with `--host`. The tests exercise it with fabricated peer
# addresses for the same reason.
LOCAL_ONLY_FILES = frozenset({"temp_mockup.html"})
LOOPBACK = ("127.", "::1", "localhost", "::ffff:127.")


def is_loopback(peer: str | None) -> bool:
    p = str(peer or "")
    return p == "::1" or any(p.startswith(pre) for pre in LOOPBACK)


def allowed(rel: str, peer: str | None = None) -> bool:
    if rel in LOCAL_ONLY_FILES:
        return is_loopback(peer)
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

# How many connections may be in flight at once, counted at accept.
#
# The token bucket above and the handler's 30-second timeout are both real and
# both act too late for this particular shape: the bucket runs inside `do_GET`,
# *after* a complete request line and headers have been parsed, so a connection
# that never sends them is never counted at all; and the timeout bounds how long
# each thread lives, not how many there are. A client opening connections and
# saying nothing meets neither. The review opened 80 at once and all 80 were
# accepted.
#
# 64 is chosen against what the site actually does. It speaks HTTP/1.0, so every
# request is its own connection — a cold page load is nine files plus up to 167
# images — but browsers cap themselves at around six concurrent connections per
# host, so even several tabs at once stay far below this. It is a ceiling on
# absurdity rather than a budget anyone should feel.
#
# **Largely moot, and built anyway.** The server binds loopback only since
# 2026-09-01, so the only thing that can open 64 stalled connections is a
# process already on this machine, which has easier things to do. This is a
# property of the code rather than a live exposure, and it matters again the
# moment these files sit behind something that does listen more widely — which
# `README.md` explains how to do.
MAX_CONNECTIONS = 64


class SiteServer(socketserver.ThreadingMixIn, http.server.HTTPServer):
    """
    Threaded, because a single-threaded server is taken down by one client
    opening a socket and never finishing its request — measured: a second client
    waited the full timeout.

    At module level rather than inside `main`, so the suite can stand one up on
    port 0 and actually open sockets at it. A connection ceiling is not a thing
    that can be checked by reading a parser.

    `timeout` here is inherited noise and is left only because `handle_request`
    reads it. It is **not** what releases a stalled connection — that is the
    handler's own `timeout`, set on `SiteHandler`. This comment claimed
    otherwise until 2026-08-26: `BaseServer.serve_forever` says "Ignores
    self.timeout" in its own docstring, so for the whole life of this server the
    class attribute did nothing at all.
    """

    daemon_threads = True
    allow_reuse_address = True
    timeout = 30
    # A slightly deeper listen backlog than the stdlib's 5, so an ordinary burst
    # — a cold page load opening its images — waits in the kernel rather than
    # meeting the ceiling. The queue absorbs bursts; the semaphore stops floods.
    # They are different jobs and both are wanted.
    request_queue_size = 32
    max_connections = MAX_CONNECTIONS

    def __init__(self, *a, **kw):
        # Per instance, not per class: the suite builds several, and a shared
        # semaphore would leak slots between them.
        self._slots = threading.BoundedSemaphore(self.max_connections)
        super().__init__(*a, **kw)

    def process_request(self, request, client_address):
        """
        Counted at **accept** — before a thread exists and before a single byte
        has been read — which is the whole point. Every other protection in this
        file runs after a request has been parsed, so none of them sees a client
        that opens a socket and then says nothing.
        """
        if not self._slots.acquire(blocking=False):
            # Refused on the accept thread rather than by spawning one more to
            # say no with, and written straight to the socket for the same
            # reason: building a handler is the work being declined.
            STATS["limited"] += 1
            try:
                request.sendall(
                    b"HTTP/1.0 503 Service Unavailable\r\n"
                    b"Retry-After: 5\r\n"
                    b"Content-Length: 0\r\n"
                    b"Connection: close\r\n\r\n")
            except OSError:
                pass              # already gone, which is the usual case here
            self.shutdown_request(request)
            return
        super().process_request(request, client_address)

    def process_request_thread(self, request, client_address):
        # `finally`, because a slot never released is a slot gone for the life
        # of the process, and 64 of those is a server that accepts nothing. The
        # same lesson as the freshness flag a few hundred lines up.
        try:
            super().process_request_thread(request, client_address)
        finally:
            self._slots.release()
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


class SiteHandler(http.server.SimpleHTTPRequestHandler):
    """
    Serves the site and refuses everything else.

    SimpleHTTPRequestHandler is not a hardened server and the standard library
    says as much. By default it publishes the entire directory it is pointed at,
    with browsable listings. For this folder that meant .git, .cache, tools and
    tests.

    This docstring used to add that the stdlib "does get path traversal right -
    ../ and its encodings were tested and all return 404". Every clause of that
    was true and the conclusion drawn from it was not: `../` and `%2e%2e%2f` do
    fail closed, and testing the two forms somebody thought of said nothing
    about the one nobody did. See `translate_path` below for what got through.
    """

    # The one timeout that reaches an accepted socket. `StreamRequestHandler.setup`
    # does `self.connection.settimeout(self.timeout)`, so it has to live on the
    # handler; the same name on the server class is a different attribute for a
    # different purpose, and setting it there - which is what this server did
    # until 2026-08-26 - leaves `gettimeout()` as None on every connection. A
    # LAN peer could then hold a thread by starting a request line and never
    # finishing it, which is exactly what the server comment promised was
    # handled. 30s is generous for a request from the next room.
    timeout = 30

    def log_message(self, fmt, *args):  # noqa: A003 - keep the console readable
        pass

    def translate_path(self, path):
        """
        The file to open, from the same string the allowlist approved.

        This was the standard library's version until 2026-08-26, which made it
        a second, independent path computation - and on Windows the two
        disagreed. `_relative` uses `os.path.normpath`, which is `ntpath` here:
        it treats a backslash as a separator and *resolves* `..` across it. The
        stdlib splits on `/` alone and then *drops* any component containing a
        backslash. So one segment, `..%5c..%5cindex.html`, was three components
        to the gate and one discarded component to the opener:

            GET /.git/config/..%5c..%5cindex.html
              _relative()  -> "index.html"        -> allowed
              stdlib       -> <ROOT>\\.git\\config -> served

        which is the exposure the allowlist exists to remove. The server binds
        loopback only now, so the reader is the person at the keyboard — but a
        path traversal is not made safe by the audience, and this is one of the
        properties that has to survive somebody putting the folder behind a real
        web server.

        There is no careful fix for two parsers that have to agree; there is one
        parser. `allowed()` and `open()` are given the same string, so a URL that
        reaches this method can only name a file the allowlist already passed.
        """
        rel = self._relative()
        if rel in ("", "."):
            # do_GET and do_HEAD refuse these before we get here; if that ever
            # stops being true, resolve to something that cannot exist rather
            # than to ROOT, which would be a directory and would list it.
            return os.path.join(ROOT, ".refused")
        return os.path.join(ROOT, rel.replace("/", os.sep))

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

        Exactly one file gets a looser policy -- see CSP_LOCAL_ONLY. The test is
        repeated here rather than trusted from `allowed()`, because end_headers
        also runs on error responses: the peer check has to hold on this line
        whatever path reached it.
        """
        rel = self._relative()
        local_only = (rel in LOCAL_ONLY_FILES
                      and is_loopback(self.client_address[0]))
        self.send_header("Content-Security-Policy",
                         CSP_LOCAL_ONLY if local_only else CSP)
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Referrer-Policy", "no-referrer")
        self.send_header("X-Frame-Options", "DENY")
        # This is a development server, and it sent `Last-Modified` with no
        # `Cache-Control` -- so browsers applied heuristic freshness and served
        # styles.css and the asset scripts from cache without revalidating, for
        # minutes after an edit. That is the whole reason STYLE.md 8 documents a
        # cache-bust incantation, and it has cost more than one session an hour
        # of chasing a change that had in fact applied. Nothing served here is
        # worth caching: it is localhost, the files are small, and being wrong
        # about which build you are looking at is expensive. The published site
        # is unaffected -- GitHub Pages sends its own headers and never sees
        # this file.
        self.send_header("Cache-Control", "no-store, must-revalidate")
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

    def _upstream_body(self) -> bytes:
        """
        The freshness answer on its own, for the poll.

        `owner` is stamped per request for the same reason it is on the data
        file: it is the one part of this that differs between peers, and the
        page cannot work it out for itself.
        """
        return json.dumps(dict(freshness(),
                               owner=is_loopback(self.client_address[0]))
                          ).encode("utf-8")

    def _serve_upstream(self, body: bool = True) -> None:
        blob = self._upstream_body()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(blob)))
        self.end_headers()
        STATS["served"] += 1
        if body:
            self.wfile.write(blob)

    def do_HEAD(self):                                    # noqa: N802
        if not allow_request(self.client_address[0]):
            return self._too_many()
        rel = self._relative()
        if not allowed(rel, self.client_address[0]):
            return self._reject()
        if rel == "upstream.json":
            # Generated rather than read, so it has to be answered here too -
            # the file server underneath would 404 a name with nothing on disk.
            return self._serve_upstream(body=False)
        super().do_HEAD()

    def do_GET(self):                                     # noqa: N802
        if not allow_request(self.client_address[0]):
            return self._too_many()
        rel = self._relative()
        if rel in ("", "."):
            rel = "index.html"
            self.path = "/index.html"
        if not allowed(rel, self.client_address[0]):
            return self._reject()

        if rel == "upstream.json":
            return self._serve_upstream()

        # The dataset carries the answer as it stands when the page loads, which
        # on a cold start is "a check is running". `freshness()` does not block
        # for it any more; the page polls upstream.json until it settles.
        if rel == "data/prime-data.js":
            path = os.path.join(ROOT, "data", "prime-data.js")
            if os.path.exists(path):
                with open(path, "rb") as fh:
                    blob = fh.read()
                # `owner` is per-request and must not go in the cached body:
                # freshness() is shared by every peer, and this is the one part
                # of the payload that differs between them. The page cannot work
                # this out for itself - it only knows the URL it was opened
                # with, which says nothing about who is at the other end.
                payload = dict(freshness(),
                               owner=is_loopback(self.client_address[0]))
                tail = "\nwindow.WFPRIME_UPSTREAM = " + json.dumps(payload) + ";\n"
                blob += tail.encode("utf-8")
                self.send_response(200)
                self.send_header("Content-Type", "application/javascript")
                self.send_header("Content-Length", str(len(blob)))
                # Cache-Control comes from end_headers now, which sends no-store
                # on every response. This line sent a second one and the browser
                # saw them merged.
                self.end_headers()
                STATS["served"] += 1
                self.wfile.write(blob)
                return
        STATS["served"] += 1
        super().do_GET()


def main() -> int:
    ap = argparse.ArgumentParser(description="Serve Warframe Prime Hunter locally.")
    ap.add_argument("--host", default="127.0.0.1",
                    help="interface to bind — loopback only (127.0.0.1, ::1 or "
                         "localhost). Anything else is refused; see README.")
    ap.add_argument("--port", type=int, default=None,
                    help="port to use (default: the first one that works)")
    ap.add_argument("--no-browser", action="store_true",
                    help="do not open a browser window")
    args = ap.parse_args()

    if not os.path.exists(os.path.join(ROOT, "data", "prime-data.js")):
        print("No data yet. Run refresh-data.cmd first (about a minute).")
        return 1

    host = args.host
    # Loopback or nothing. Enforced here rather than left to which launcher
    # somebody double-clicked, because the launchers are the part that is easy
    # to copy from an old checkout - and a refusal that explains itself is worth
    # more than a flag that silently no longer exists.
    if not is_loopback(host):
        print(f"Refusing to bind {host}: this server is loopback-only.")
        print()
        print("  It has no encryption and no login, and the page's own")
        print("  Backup/Import would let anyone who can reach the port read and")
        print("  overwrite the collection. Serving it to a network was removed")
        print("  on purpose rather than documented better.")
        print()
        print("  To host this somewhere, see 'Hosting it somewhere else' in")
        print("  README.md - it is a folder of static files and a real web")
        print("  server can serve it, with TLS and access control that this")
        print("  script does not pretend to offer.")
        return 1
    if args.port:
        port = args.port                      # asked for explicitly: honour it
    else:
        port = pick_port(host)
    url = f"http://localhost:{port}"
    handler = functools.partial(SiteHandler, directory=ROOT)

    # Threading, the connection ceiling and the timeout that releases a stalled
    # socket all live on `SiteServer` above, which is where their reasoning is.
    try:
        httpd = SiteServer((host, port), handler)
    except OSError as exc:
        print(f"Could not start a server on {host}:{port} — {exc}")
        return 1

    # flush explicitly: stdout is block-buffered when the console window is not
    # a terminal, which would leave the launcher window blank until it closed
    lines = ["", f"  Warframe Prime Hunter is running at  {url}",
             "", "  This machine only - nothing else on the network can reach it."]
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
