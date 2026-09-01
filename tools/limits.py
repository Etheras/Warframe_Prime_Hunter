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

Two decisions are in the numbers rather than in the code, both taken from
figures measured across `.cache/` on 2026-09-01:

  * **A number per source.** The spread across the 23 sources is 21,000x, from
    a 490-byte export index to a 10.4 MB item list. One limit that fits all of
    them fits none of them.
  * **An absolute cap on what is written out, never a ratio.** The worst
    expansion ratio measured here is 21.9x and the largest expansion is 10.4 MB,
    so a ratio guard is useless on its own - 40x is unremarkable and a real bomb
    is 1000x. Only the absolute number stops the case in the finding.

**Refusing is a failed fetch, not a crash.** `sources.fetch` already has a
well-worn answer for one: try the next host, then fall back to the cached copy
and record it in `meta.stale`. Oversize takes that path rather than inventing a
new one, so a ceiling set too tightly costs a stale build and a loud log line
instead of a broken build. That is the property that makes tightening these
numbers safe.

The ceilings are roughly **twice** what each source measured, at the owner's
direction (2026-09-01). Twice is deliberately less headroom than the three times
`TODO.md` proposed: it is close enough to today's figures to actually catch a
runaway, and the graceful failure above is what pays for the tightness. One
source is worth watching because of it - see `de_worldstate` below.
"""

from __future__ import annotations

import lzma
import zlib

KB = 1024
MB = 1024 * KB

# How much is decompressed, or read, before the total is checked again. Small
# enough that a bomb is caught having cost this much rather than all of it.
CHUNK = 64 * KB


class TooLarge(Exception):
    """A source sent, or expanded to, more than its ceiling allows."""


# What each source may expand to, keyed by its `.cache` name. The comment on
# each line is what it actually measured on 2026-09-01; the ceiling is that
# doubled and rounded up, so the drift between them is reviewable without
# re-measuring.
#
# The transfer is held to the same number. For a gzip response that compares a
# compressed body against an expanded ceiling, which is loose in our favour and
# never the wrong way round: a body that already exceeds the expanded limit
# while still compressed cannot possibly expand to less.
MAX_EXPANDED = {
    "api_items":                      21_000 * KB,   # 10,443,694
    "official_droptables":             9_000 * KB,   #  4,419,528
    "export_ExportManifest.json":      7_600 * KB,   #  3,780,187
    "drops_relics.json":               4_800 * KB,   #  2,385,503
    "export_ExportRecipes_en.json":    2_600 * KB,   #  1,293,754
    "drops_missionRewards.json":       2_200 * KB,   #  1,084,088
    "export_ExportResources_en.json":  2_000 * KB,   #  1,002,658
    "export_ExportWeapons_en.json":    1_250 * KB,   #    610,189
    "export_ExportWarframes_en.json":    500 * KB,   #    232,131
    # The one to watch. 130,253 today, but the worldstate carries whatever
    # events are running, so it is the only source here whose size moves with
    # something other than the size of the game. If a large event ever pushes it
    # past this, the build goes stale rather than wrong - and the log line says
    # which source and by how much, which is the signal to raise this number.
    "de_worldstate":                     280 * KB,   #    130,253
    "api_syndicatemissions":             128 * KB,   #     61,126
    "wiki_prime":                        128 * KB,   #     56,157
    "export_ExportRegions_en.json":      100 * KB,   #     49,501
    "export_ExportSentinels_en.json":     32 * KB,   #     11,675
    "api_fissures":                       24 * KB,   #     11,029
    "api_vaulttrader":                    16 * KB,   #      7,947
    "api_events":                          8 * KB,   #      2,994
    "head_droptables":                     4 * KB,   #        959
    "export_index":                        4 * KB,   #        490
}

# Anything whose exact name is not above. The two families that grow on their
# own are the per-Prime wiki pages (`wiki_Gotva_Prime`, largest measured 6,293)
# and any manifest Digital Extremes add to the export index; both get the
# family's ceiling rather than the fallback, which is what stops a new member
# arriving unbounded. Checked longest-prefix-first so `wiki_prime` above still
# wins over `wiki_`.
MAX_EXPANDED_FAMILY = (
    ("export_", 2_000 * KB),
    ("drops_",  4_800 * KB),
    ("api_",      128 * KB),
    ("wiki_",      16 * KB),
    ("head_",       4 * KB),
)

MAX_EXPANDED_DEFAULT = 2_000 * KB

# Artwork wants two ceilings rather than one, because 167 responses of 2 MB
# each is the failure a per-image cap alone waves through. Measured the same
# day: 167 files, 8.75 MB in total, largest 121,031, median 47,638.
MAX_IMAGE_BYTES = 256 * KB          # largest measured 121,031
MAX_IMAGE_TOTAL = 18_000 * KB       # 8.75 MB measured across all 167

# The 24-hour feed log, fetched back from the deployed site when a build has no
# local copy. Sized from what it is *designed* to hold rather than from what it
# holds today, because it is new and today's copy is three rows: 24 hours at the
# ten-minute cadence is 144 rows of ~138 bytes, call it 20 KB, plus a row for
# every push that also triggered a build. 48 KB is about twice a busy day.
MAX_FEED_LOG = 48 * KB


def cap_for(key: str) -> int:
    """The ceiling for one cache key: exact name, then family, then fallback."""
    if key in MAX_EXPANDED:
        return MAX_EXPANDED[key]
    for prefix, cap in MAX_EXPANDED_FAMILY:
        if key.startswith(prefix):
            return cap
    return MAX_EXPANDED_DEFAULT


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
            f"{what}: declares {int(declared):,} bytes, over its {limit:,} ceiling")

    out = bytearray()
    while True:
        piece = resp.read(CHUNK)
        if not piece:
            break
        out += piece
        if len(out) > limit:
            raise TooLarge(
                f"{what}: response is over its {limit:,} byte ceiling")
    return bytes(out)


def gunzip_capped(raw: bytes, limit: int, what: str) -> bytes:
    """
    Gunzip incrementally, stopping the moment the output crosses the limit.

    `gzip.decompress` cannot do this by construction - it expands the whole blob
    before returning anything, so the bomb has already landed by the time there
    is a length to measure. `zlib.decompressobj` takes a per-call output bound,
    which is the only shape that can stop early.
    """
    dec = zlib.decompressobj(16 + zlib.MAX_WBITS)   # 16: expect a gzip wrapper
    out = bytearray()
    pending = raw
    while pending:
        out += dec.decompress(pending, CHUNK)
        if len(out) > limit:
            raise TooLarge(f"{what}: expands past its {limit:,} byte ceiling")
        pending = dec.unconsumed_tail
    out += dec.flush()
    if len(out) > limit:
        raise TooLarge(f"{what}: expands past its {limit:,} byte ceiling")
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
            raise TooLarge(f"{what}: expands past its {limit:,} byte ceiling")
        if dec.eof or dec.needs_input or not piece:
            break
    return bytes(out)
