#!/usr/bin/env python3
"""
Everything that talks to the network, plus the on-disk HTTP cache.

Split out of build_data.py, which was doing fetch, join and emit in one file.
This half owns the warm/cold policy that the rest of the build depends on:

  STALE    a refresh failed but a cached copy existed, so the build continues
           with slightly older data and says so in meta.stale
  MISSING  a refresh failed with nothing cached, so the data is genuinely
           absent - fatal unless --allow-degraded, and recorded in meta.degraded

Both are module-level lists because every fetch in the build appends to them and
the emitter reads them once at the end.
"""

from __future__ import annotations

import re

import gzip
import hashlib
import json
import os
import sys
import time
import urllib.error
import urllib.request

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import official  # noqa: E402  (local module, sits beside this file)

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(ROOT, "data")
CACHE_DIR = os.path.join(ROOT, ".cache")

UA = "WarframePrimeHunter/1.0 (personal Prime collection tracker; contact: local user)"

WIKI_RAW = "https://wiki.warframe.com/index.php?title={title}&action=raw"
DROPS = "https://drops.warframestat.us/data/{name}"
ITEMS_API = (
    "https://api.warframestat.us/items/?language=en"
    "&only=name,imageName,vaulted,category,type,components,uniqueName,masteryReq,"
    "releaseDate,vaultDate,estimatedVaultDate,tradable,wikiaUrl"
)
VAULT_TRADER = "https://api.warframestat.us/pc/vaultTrader?language=en"
# The bounties on offer right now, and the world events that add temporary
# ones. Both proxy the game worldstate, the same route Prime Resurgence takes
# and for the same reason: DE's own worldState.php is 404 (PROJECT.md §6).
SYNDICATE_MISSIONS = "https://api.warframestat.us/pc/syndicateMissions?language=en"
WORLD_EVENTS = "https://api.warframestat.us/pc/events?language=en"
# Where relics can be cracked right now. Every entry carries its own expiry,
# which is what makes this safe to ship in a file: the page shows what is still
# running when you look at it and silently drops the rest, so an old build
# understates the fissure map but can never overstate it.
FISSURES = "https://api.warframestat.us/pc/fissures?language=en"
IMG_CDN = "https://cdn.warframestat.us/img/"

# Digital Extremes, first party
OFFICIAL_DROPTABLES = "https://www.warframe.com/droptables"
EXPORT_INDEX = "https://origin.warframe.com/PublicExport/index_en.txt.lzma"
EXPORT_MANIFEST = "https://content.warframe.com/PublicExport/Manifest/{file}"
# The same index, published on the host the manifests already come from. Digital
# Extremes answer a GitHub runner with 403 from origin.warframe.com and 200 from
# content.warframe.com - measured, and curl gets the same pair, so it is a
# datacenter block rather than anything about the request. One blocked host is
# not a reason for a cold build to have nothing at all.
EXPORT_INDEX_HOSTS = (
    EXPORT_INDEX,
    "https://content.warframe.com/PublicExport/index_en.txt.lzma",
)
# the export files worth reading: everything that can carry a Prime
EXPORT_WANTED = ["ExportWarframes_en.json", "ExportWeapons_en.json",
                 "ExportSentinels_en.json", "ExportRegions_en.json"]

STATE_FILE = "state.json"  # inside .cache — drives --if-changed



# --------------------------------------------------------------------------
# fetching
# --------------------------------------------------------------------------

def log(msg: str) -> None:
    print(f"  {msg}", flush=True)


def cache_path(key: str) -> str:
    safe = re.sub(r"[^A-Za-z0-9_.-]", "_", key)[:120]
    return os.path.join(CACHE_DIR, safe + ".gz")


# The validator that came with a cached body, beside the body rather than in a
# shared index: one file per key cannot be corrupted by another key's write, and
# a missing or unreadable one costs a full download rather than a wrong answer.
def etag_path(path: str) -> str:
    return path + ".etag"


def read_etag(path: str):
    if not os.path.exists(path):
        return None          # no body to validate, so nothing to ask about
    try:
        with open(etag_path(path), encoding="utf-8") as fh:
            return fh.read().strip() or None
    except OSError:
        return None


def write_etag(path: str, tag) -> None:
    try:
        if tag:
            with open(etag_path(path), "w", encoding="utf-8") as fh:
                fh.write(tag.strip())
        elif os.path.exists(etag_path(path)):
            # the source stopped sending one; a stale validator is worse than none
            os.remove(etag_path(path))
    except OSError:
        pass


# A failed fetch means two very different things, and they are tracked apart:
#
#   STALE   - the refresh failed but a previous copy exists, so the build
#             continues on slightly older data. An alert, not an error.
#   MISSING - the refresh failed and there is nothing cached. Whatever that
#             source contributes is simply absent, which is critical for a
#             cold build (a CI runner always starts cold).
#
STALE: list[str] = []
MISSING: list[str] = []
# key -> mtime of the copy that was reused, so the page can say how far behind
# it actually is rather than only that it is behind.
STALE_AGE: dict[str, float] = {}


def fetch(url: str, key: str, offline: bool = False, critical: bool = True,
          optional: bool = False):
    """
    GET with a small on-disk cache so reruns and --offline are cheap.

    On failure: reuse the cached copy if there is one (recorded as STALE),
    otherwise record MISSING and either abort (critical) or return None.

    `optional` marks a source the dataset is *better* for having rather than
    incomplete without. A cold miss on one of those returns None and says so,
    but is deliberately not recorded in MISSING, because MISSING aborts the
    build - and refusing to publish a whole catalogue because an enrichment
    source was briefly unreachable is the wrong trade.

    That distinction was missing when the bounty rotation was added, and it
    took CI down: api.warframestat.us did not answer the runner, both new keys
    landed in MISSING, and a build that had every relic and every item in hand
    aborted rather than publish without a countdown.

    `url` may be several, for a document published on more than one host. They
    are tried in order on every attempt, and the cache is only consulted once
    all of them have failed - so a host that starts refusing us is routed around
    rather than papered over with a copy from yesterday.
    """
    path = cache_path(key)
    if offline:
        if not os.path.exists(path):
            if not optional:
                MISSING.append(key)
            if critical and not optional:
                raise SystemExit(f"--offline but nothing cached for {key}")
            return None
        with gzip.open(path, "rb") as fh:
            return fh.read()

    urls = [url] if isinstance(url, str) else list(url)
    last_err = None
    prior = read_etag(path)
    for attempt in range(3):
        for one in urls:
            try:
                headers = {"User-Agent": UA, "Accept-Encoding": "gzip"}
                # Ask only for what we do not already hold. The fissure list is
                # polled every ten minutes and changes every hour or two, so most
                # of those requests should cost a header exchange and no body -
                # api.warframestat.us answers 304 with zero bytes, and sits behind
                # a CDN that declares max-age=120 of its own.
                if prior:
                    headers["If-None-Match"] = prior
                req = urllib.request.Request(one, headers=headers)
                with urllib.request.urlopen(req, timeout=120) as resp:
                    raw = resp.read()
                    if resp.headers.get("Content-Encoding") == "gzip":
                        raw = gzip.decompress(raw)
                    tag = resp.headers.get("ETag")
                os.makedirs(CACHE_DIR, exist_ok=True)
                with gzip.open(path, "wb") as fh:
                    fh.write(raw)
                write_etag(path, tag)
                return raw
            except urllib.error.HTTPError as exc:
                # 304 is a success: the server has confirmed what we hold is
                # current. Only reachable when a body was cached, since the
                # header is only sent then.
                if exc.code == 304:
                    with gzip.open(path, "rb") as fh:
                        return fh.read()
                last_err = exc
            except (urllib.error.URLError, TimeoutError, OSError) as exc:
                last_err = exc
        if attempt < 2:
            time.sleep(1.5 * (attempt + 1))

    # warm: a previous copy exists, so this is only an alert
    if os.path.exists(path):
        age = time.time() - os.path.getmtime(path)
        log(f"~ {key}: refresh failed ({last_err}) - reusing the cached copy"
            f" ({int(age // 60)} min old)")
        STALE.append(key)
        # How old the copy is, not merely that there is one. The banner reading
        # this said "an earlier copy is being shown" whether the copy was ten
        # minutes or ten days behind, which is the difference between "ignore
        # this" and "do not trust the fissure list".
        STALE_AGE[key] = os.path.getmtime(path)
        with gzip.open(path, "rb") as fh:
            return fh.read()

    # cold: nothing to fall back on
    if optional:
        log(f"~ {key}: unreachable and not cached - continuing without it")
        return None
    MISSING.append(key)
    if critical:
        raise SystemExit(
            f"failed to fetch {key} and nothing is cached: {last_err}\n"
            f"  This is a cold build, so there is no earlier copy to fall back on."
        )
    log(f"! {key} unreachable and not cached ({last_err})")
    return None


def fetch_json(url: str, key: str, offline: bool = False, critical: bool = True,
               optional: bool = False):
    raw = fetch(url, key, offline, critical, optional)
    if raw is None:
        return None
    try:
        return json.loads(raw.decode("utf-8"))
    except (ValueError, UnicodeDecodeError) as exc:
        if optional:
            log(f"~ {key} returned unparseable data ({exc}) - continuing without it")
            return None
        MISSING.append(key)
        if critical:
            raise SystemExit(f"{key} returned unparseable data: {exc}")
        log(f"! {key} returned unparseable data ({exc})")
        return None


def head(url: str) -> dict:
    """Cheap freshness probe — returns {} rather than raising."""
    try:
        req = urllib.request.Request(url, method="HEAD", headers={"User-Agent": UA})
        with urllib.request.urlopen(req, timeout=30) as resp:
            return {k.lower(): v for k, v in resp.headers.items()}
    except Exception:
        return {}


def load_state() -> dict:
    try:
        with open(os.path.join(CACHE_DIR, STATE_FILE), encoding="utf-8") as fh:
            return json.load(fh)
    except Exception:
        return {}


def save_state(state: dict) -> None:
    os.makedirs(CACHE_DIR, exist_ok=True)
    with open(os.path.join(CACHE_DIR, STATE_FILE), "w", encoding="utf-8") as fh:
        json.dump(state, fh, indent=1)


def upstream_signature(offline: bool = False) -> dict:
    """
    A small fingerprint of every upstream that matters, cheap enough to poll
    on a schedule: the export index is ~500 bytes, the drop table is a HEAD,
    and the trader window is a short JSON document.
    """
    sig: dict = {}
    try:
        sig["exportIndex"] = hashlib.sha256(
            fetch(EXPORT_INDEX_HOSTS, "export_index", offline)).hexdigest()[:16]
    except Exception:
        pass

    h = head(OFFICIAL_DROPTABLES)
    sig["droptables"] = h.get("last-modified") or h.get("etag") or "?"

    try:
        vt = fetch_json(VAULT_TRADER, "api_vaulttrader", offline)
        sig["resurgence"] = str(vt.get("expiry") or "?")
    except Exception:
        pass

    return sig


# ── drop data, official first ────────────────────────────────────────────


# Drop-table files that can contain Void Relics, and how to read each one.
DROP_FILES = {
    "missionRewards.json": "missions",
    "keyRewards.json": "keys",
    "transientRewards.json": "transient",
    "cetusBountyRewards.json": "bounty:Cetus (Plains of Eidolon)",
    "solarisBountyRewards.json": "bounty:Fortuna (Orb Vallis)",
    "deimosRewards.json": "bounty:Necralisk (Cambion Drift)",
    "zarimanRewards.json": "bounty:Chrysalith (Zariman)",
    "entratiLabRewards.json": "bounty:Entrati Labs (Deimos)",
    "hexRewards.json": "bounty:Hex (Hollvania)",
}


def prune_cache(live_keys: set[str]) -> int:
    """
    Drop cache entries nothing can ask for any more.

    Most keys are fixed - one per upstream - so they overwrite themselves and
    never accumulate. The exception is `wiki_<Item>`, one file per Prime whose
    acquisition note we look up: when an item leaves the catalogue its cache
    file has nothing left to serve and would sit there for good.

    Only that family is pruned. In particular the `drops_*` mirror files are
    left alone even on a run that used DE directly: they are the fallback that
    keeps a build working when warframe.com is unreachable, so a successful
    official run not touching them is exactly when they matter most.
    """
    if not os.path.isdir(CACHE_DIR):
        return 0
    dropped = 0
    for fname in os.listdir(CACHE_DIR):
        if not fname.startswith("wiki_") or not fname.endswith(".gz"):
            continue
        key = fname[:-3]
        if key == "wiki_prime" or key in live_keys:
            continue
        try:
            os.remove(os.path.join(CACHE_DIR, fname))
            # its validator goes with it, or the next fetch of a key that
            # happened to reuse the name would send a header for a body we no
            # longer hold and take a 304 it cannot answer
            if os.path.exists(os.path.join(CACHE_DIR, fname + ".etag")):
                os.remove(os.path.join(CACHE_DIR, fname + ".etag"))
            dropped += 1
        except OSError:
            pass
    if dropped:
        log(f"cache: pruned {dropped} wiki page(s) for items no longer listed")
    return dropped
