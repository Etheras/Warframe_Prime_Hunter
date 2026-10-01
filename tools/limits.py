#!/usr/bin/env python3
"""
Ceilings on what a remote source is allowed to cost us, and the primitives that
enforce them.

Every remote read in this pipeline used to take whatever the other end sent:
`resp.read()` with no maximum, `gzip.decompress` over the whole body, and the
result written straight into `.cache/`. HTTPS and a fixed host list make a
hostile response unlikely; they do not make the bytes trustworthy, and the
realistic case was never a hostile CDN. It is a broken one - a truncated
gateway, an error page served with the wrong type, a decompression bomb from a
host that has itself been compromised - landing on an unattended scheduled
build, where the cost is memory, disk, or a run that never finishes.

**A download may be five times the copy it replaces** - the owner's rule since
2026-10-01, and `cap_for` below. It is a guard against a maliciously or
brokenly huge body, not against a game that keeps growing: nobody measures a
source by hand, and the allowance grows with the source. Two edges complete it:

  * **A floor of 1 MB**, so a small or empty copy is never the baseline that
    throttles the next one. Baro's manifest is 279 bytes while he is away and
    6,219 on a visit - 22x - and every live feed's size moves with what is
    running in the game. The largest of them, the raw worldstate, is ~200 KB.
  * **A 256 MB backstop where there is nothing to compare with** - no copy
    held (a fresh clone, a cold CI cache, a manifest DE add), or one that is
    empty. The largest real source is the item list at 38.5 MB.

Until then each source had its own number at roughly twice what it measured,
and that table failed in exactly the way the rule above cannot: a source
outgrew its ceiling (the item list went 16.7 MB -> 38.5 MB in three weeks, 2.3x)
and every build refused it for about twenty days. `PROJECT.md §7`, *A download
may be five times the copy it replaces*, has the rest.

The cap is on what is written out, never on the compression ratio. A ratio
guard is useless on its own - 21.9x is the worst expansion measured here and
unremarkable, and a real bomb is 1000x - so the absolute number is what stops
it, checked as it expands.

**Refusing is a failed fetch, not a crash.** `sources.fetch` already has a
well-worn answer for one: try the next host, then fall back to the cached copy
and record it in `meta.stale`. Oversize takes that path rather than inventing a
new one, so the build carries on and the site publishes. **And then the run
fails**, since 2026-10-02: a size refusal is treated as a possible attack,
`sources.REFUSED` keeps everything known about the response, and the workflow's
`alarm` job fails the run after the deploy so the owner is emailed. A source
that genuinely grew more than five times in one step is let through, once, by
`--accept-growth` - the accepted body is then the next baseline.
"""

from __future__ import annotations

import lzma
import zlib

KB = 1024
MB = 1024 * KB

# How much is decompressed, or read, before the total is checked again. Small
# enough that a bomb is caught having cost this much rather than all of it.
CHUNK = 64 * KB

# How much of a refused body is kept for the record of it: enough to tell an
# error page from JSON from binary, and no more.
SAMPLE = 256


class Refused(Exception):
    """
    A body this build will not accept, for any reason.

    Callers catch this rather than either subclass: every one of them answers a
    refused body the same way, by treating it as a failed fetch - next host,
    then the cached copy, then `STALE`. The split below is for the log line and
    for saying which happened, not for branching on.
    """


class TooLarge(Refused):
    """
    A source sent, or expanded to, more than its ceiling allows.

    Carries what is known at the moment of refusal, because since 2026-10-02 a
    size refusal is treated as a possible attack and fails the run, and the
    record of it is the only evidence anyone will have: the body is never kept.

      stage  where it was caught - "declared" (Content-Length, nothing read),
             "transfer" (the bytes on the wire) or "expanded" (decompressing)
      seen   the bytes counted when it stopped, or the size declared
      limit  the ceiling it went over
      head   the first `SAMPLE` bytes, when any were read - raw, untrusted,
             and for a person to look at, never to parse
    """

    def __init__(self, message: str, *, stage: str | None = None,
                 seen: int | None = None, limit: int | None = None,
                 head: bytes = b""):
        super().__init__(message)
        self.stage, self.seen, self.limit = stage, seen, limit
        self.head = bytes(head[:SAMPLE])


class Malformed(Refused):
    """
    A compressed body that does not decode to a whole document.

    Separate from `TooLarge` because it means the opposite thing about the
    sender: too large is a source that grew, malformed is a transfer that broke.
    Both are refused, and refusing is the same cheap operation either way.
    """


# What a download may expand to, from the size of the copy it replaces. The
# header has the rule and why; these are its three numbers, and none of them is
# a measurement of any source.
#
# The transfer is held to the same number. For a gzip response that compares a
# compressed body against an expanded ceiling, which is loose in our favour and
# never the wrong way round: a body that already exceeds the expanded limit
# while still compressed cannot possibly expand to less.
GROWTH = 5                    # times the copy held
FLOOR = 1 * MB                # never less than this, whatever was held
BACKSTOP = 256 * MB           # when nothing is held to compare with

# Artwork wants two ceilings rather than one, because 167 responses of 2 MB
# each is the failure a per-image cap alone waves through. Measured 2026-09-01:
# 167 files, 8.75 MB in total, largest 121,031, median 47,638. Fixed numbers
# rather than the five-times rule, by the owner's choice on 2026-10-01: an
# image is fetched only when none is held, so there is never a copy to compare
# with, and the per-run budget is what a per-image backstop cannot be.
MAX_IMAGE_BYTES = 256 * KB          # largest measured 121,031
MAX_IMAGE_TOTAL = 18_000 * KB       # 8.75 MB measured across all 167

# The 24-hour feed log, fetched back from the deployed site when a build has no
# local copy. Sized from what it is *designed* to hold rather than from what it
# holds today, because it is new and today's copy is three rows: 24 hours at the
# ten-minute cadence is 144 rows of ~138 bytes, call it 20 KB, plus a row for
# every push that also triggered a build. 48 KB is about twice a busy day.
# Fixed for the image budget's reason: it is fetched only when none is held.
MAX_FEED_LOG = 48 * KB


def cap_for(held: int | None) -> int:
    """
    The ceiling for a download, from the size of the copy it would replace:
    five times that, never under the floor, and the backstop when `held` is
    None - nothing held, or nothing in it (`sources.held_size` decides which).
    """
    if held is None:
        return BACKSTOP
    return max(GROWTH * held, FLOOR)


def read_capped(resp, limit: int, what: str) -> bytes:
    """
    Read a response body, refusing *past* the limit rather than after it.

    `Content-Length` is checked first when the server sends one, so an oversized
    body is usually refused without being transferred at all. It is only an
    optimisation: a chunked response declares nothing, and a lying one declares
    whatever it likes, so the running total below is what actually enforces this.
    """
    declared = None
    headers = getattr(resp, "headers", None)
    if headers is not None:
        declared = headers.get("Content-Length")
    if declared and declared.strip().isdigit() and int(declared) > limit:
        raise TooLarge(
            f"{what}: declares {int(declared):,} bytes, over its {limit:,} ceiling",
            stage="declared", seen=int(declared), limit=limit)

    out = bytearray()
    while True:
        piece = resp.read(CHUNK)
        if not piece:
            break
        out += piece
        if len(out) > limit:
            raise TooLarge(
                f"{what}: response is over its {limit:,} byte ceiling",
                stage="transfer", seen=len(out), limit=limit, head=out[:SAMPLE])
    return bytes(out)


def gunzip_capped(raw: bytes, limit: int, what: str) -> bytes:
    """
    Gunzip incrementally, stopping the moment the output crosses the limit.

    `gzip.decompress` cannot do this by construction - it expands the whole blob
    before returning anything, so the bomb has already landed by the time there
    is a length to measure. `zlib.decompressobj` takes a per-call output bound,
    which is the only shape that can stop early.

    **Two things a raw `decompressobj` does not do that `gzip.decompress` did**,
    both found on 2026-09-02 by running the two against the same bodies rather
    than by reading either. They are the cost of dropping to the lower-level API
    and neither is announced by it.

    A decompressor that runs out of input part-way through a member simply
    stops. So a **truncated** download returned the bytes it had managed and
    looked exactly like a complete document - `gzip.decompress` raised
    `EOFError` on it, this returned 271 bytes of a 514-byte body. `dec.eof` is
    the fact, and it was never asked for. The ceilings exist to make a bad body
    safe, and this was the one path where moving to them made a bad body
    *quieter*.

    And a gzip body may hold **more than one member**: `gzip.decompress`
    concatenates them all, while one decompressobj finishes at the first and
    leaves the remainder in `unused_data`. So the loop is per member now.
    Trailing zero padding ends it, which is what the stdlib tolerates; trailing
    bytes that are not a member are `Malformed`, which is what the stdlib calls
    `BadGzipFile`. Both were measured against `gzip.decompress` first, so this
    matches an observed contract rather than an assumed one.
    """
    out = bytearray()
    data = raw
    while data:
        dec = zlib.decompressobj(16 + zlib.MAX_WBITS)  # 16: expect a gzip wrapper
        pending = data
        try:
            while pending:
                out += dec.decompress(pending, CHUNK)
                if len(out) > limit:
                    raise TooLarge(f"{what}: expands past its {limit:,} byte ceiling",
                                   stage="expanded", seen=len(out), limit=limit,
                                   head=out[:SAMPLE])
                pending = dec.unconsumed_tail
            out += dec.flush()
        except zlib.error as exc:
            # Not a gzip member at all. Reached only for the second member
            # onwards, since the first would have failed on the header.
            raise Malformed(f"{what}: not a gzip stream ({exc})") from exc
        if len(out) > limit:
            raise TooLarge(f"{what}: expands past its {limit:,} byte ceiling",
                           stage="expanded", seen=len(out), limit=limit,
                           head=out[:SAMPLE])
        if not dec.eof:
            raise Malformed(
                f"{what}: gzip stream ends part-way through a member, so the "
                f"{len(out):,} bytes decoded are a fragment rather than a document")
        data = dec.unused_data
        if data and not data.strip(b"\0"):
            break                       # trailing padding, as the stdlib allows
    return bytes(out)


def unlzma_capped(blob: bytes, limit: int, what: str,
                  fmt: int = lzma.FORMAT_ALONE) -> bytes:
    """
    The same, for the LZMA-alone stream Digital Extremes publish their export
    index as. `LZMADecompressor.decompress` takes the same output bound.

    A stream that runs out of input before its end marker returns what it had:
    that is a truncated download, and the caller reads it as an unparseable
    source, which is a path the build already handles.
    """
    dec = lzma.LZMADecompressor(format=fmt)
    out = bytearray()
    data = blob
    while True:
        piece = dec.decompress(data, CHUNK)
        data = b""
        out += piece
        if len(out) > limit:
            raise TooLarge(f"{what}: expands past its {limit:,} byte ceiling",
                           stage="expanded", seen=len(out), limit=limit,
                           head=out[:SAMPLE])
        if dec.eof or dec.needs_input or not piece:
            break
    return bytes(out)
