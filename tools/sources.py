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
import limits    # noqa: E402  (local module, sits beside this file)
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
# the export files worth reading: everything that can carry a Prime, the texture
# manifest that says where each one's artwork lives, and the two that carry what
# a Prime is BUILT from.
#
# `ExportRecipes_en.json` gives each blueprint's `ingredients[]` with an
# `ItemType` and an `ItemCount`, plus `primeSellingPrice` - the component list,
# how many of each, and what Baro pays for a spare. All three used to come from
# `api.warframestat.us/items`, and all three are DE's own numbers.
#
# `ExportResources_en.json` is what makes that tractable. An ingredient is an
# internal path - `AshPrimeHelmetComponent` - and the part a reader knows is
# *Neuroptics*, which is a rename rather than a substring. This manifest carries
# DE's own display name for it, so nothing has to be guessed or hand-mapped.
EXPORT_WANTED = ["ExportWarframes_en.json", "ExportWeapons_en.json",
                 "ExportSentinels_en.json", "ExportRegions_en.json",
                 "ExportRecipes_en.json", "ExportResources_en.json",
                 "ExportManifest.json"]

# Which of those a build may finish without. Each has a documented fallback that
# is already tested: no texture manifest means cards fall back to the glyph they
# already use, and no recipes or resources means the part list, the quantities
# and the Ducat values come from the item API as they did before 2026-08-27.
#
# The other four are not on this list on purpose. A missing node level or a
# missing Prime is wrong data rather than thinner data, and a build that quietly
# published it would be worse than one that stopped.
EXPORT_OPTIONAL = frozenset({
    "ExportManifest.json", "ExportRecipes_en.json", "ExportResources_en.json",
})

# Where DE serve the textures `ExportManifest.json` names. The manifest gives a
# `textureLocation` such as
#   /Lotus/Interface/Icons/StoreIcons/Primes/AshPrime.png!00_jy1ev7ijK8d8nQ3WuE7NYQ
# and this prefix plus that path, *including the `!00_…` suffix*, is the image.
# Stripping the suffix gives a 404: it is a content hash and part of the path,
# which is also why these answer `max-age` of about a year — the URL changes
# when the picture does, so it never needs revalidating. That makes artwork the
# politest fetch in the project, and it is first party, which the CDN below is
# not: `cdn.warframestat.us/img/<file>` answers 301 to
# `raw.githubusercontent.com/wfcd/warframe-items/...`.
DE_TEXTURES = "https://content.warframe.com/PublicExport"

# The live worldstate, first party. Carries every feed the four `/pc/*` proxy
# endpoints above serve: ActiveMissions and VoidStorms (fissures),
# SyndicateMissions and Events (bounties), PrimeVaultTraders (Resurgence).
#
# `Cache-Control: max-age=28` — DE built this to be polled, so a ten-minute build
# is well inside what they ask for. The two hosts `PROJECT.md §6` records as 404
# are `/dynamic/worldState.php` on content. and origin.warframe.com; those are
# still 404 and this is a third host nobody had tried until 2026-08-27.
WORLDSTATE = "https://api.warframe.com/cdn/worldState.php"

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


# ── honouring the freshness each source declares ──────────────────────────
#
# `PROJECT.md §2` — "Ask no more often than the source says to". A server that
# sends `Cache-Control: max-age=86400` is telling us this changes about daily,
# and asking every ten minutes anyway is 144 pointless requests a day on
# somebody's bandwidth. Their number rather than one we invent: they are the
# only party who knows it, and it updates itself when they change their mind.
#
# Stored beside the body like the validator, and for the same reasons.

def maxage_path(path: str) -> str:
    return path + ".maxage"


def read_maxage(path: str) -> float | None:
    try:
        with open(maxage_path(path), encoding="utf-8") as fh:
            return float(fh.read().strip())
    except (OSError, ValueError):
        return None


def write_maxage(path: str, header: str | None) -> None:
    """Record `max-age` from a `Cache-Control`, or forget any we held.

    `no-cache` and `no-store` are not a `max-age` of zero to us: they mean
    *revalidate*, which the conditional request already does in a header
    exchange with no body. So they leave nothing behind and the ETag path
    handles them.
    """
    seconds = None
    if header and "no-store" not in header and "no-cache" not in header:
        found = re.search(r"max-age\s*=\s*(\d+)", header)
        if found:
            seconds = int(found.group(1))
    try:
        if seconds:
            with open(maxage_path(path), "w", encoding="utf-8") as fh:
                fh.write(str(seconds))
        elif os.path.exists(maxage_path(path)):
            os.remove(maxage_path(path))
    except OSError:
        pass


def still_fresh(path: str) -> bool:
    """Is the cached copy still inside the window the source declared?

    False whenever anything is missing or unreadable — a lost sidecar costs one
    request, and asking is always the safe direction.
    """
    if not os.path.exists(path):
        return False
    window = read_maxage(path)
    if not window:
        return False
    try:
        return (time.time() - os.path.getmtime(path)) < window
    except OSError:
        return False


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


def stale_if_older(key: str, path: str, max_age: float | None) -> None:
    """Mark a reused copy stale when it is older than the document can plausibly be.

    Some documents cannot legitimately go unchanged. Void Fissures turn over
    every hour or two, so a fissure list that has not moved in three hours is
    evidence of a broken feed rather than of a quiet evening — and a `304` from
    a CDN in front of a failing origin says exactly that, in the voice of good
    news. `fetch` trusts a 304 and returns the cached bytes without rewriting the
    file, so nothing anywhere gets newer and no alert is raised.

    Measured on 2026-08-27: `.cache/api_fissures.gz` had an mtime of 2026-08-24,
    so no successful `200` had arrived in three days, and every build in between
    reported nothing stale and published an empty fissure list. `PROJECT.md` says
    zero fissures is normal rather than a fault, which is what made it invisible.
    """
    if not max_age or not os.path.exists(path):
        return
    age = time.time() - os.path.getmtime(path)
    if age <= max_age:
        return
    log(f"~ {key}: upstream says unchanged, but this copy is "
        f"{int(age // 3600)}h old and {key} cannot be — treating it as stale")
    STALE.append(key)
    STALE_AGE[key] = os.path.getmtime(path)


def fetch(url: str, key: str, offline: bool = False, critical: bool = True,
          optional: bool = False, max_age: float | None = None,
          readonly: bool = False):
    """
    GET with a small on-disk cache so reruns and --offline are cheap.

    `readonly` reads the cache but never writes it — no body, no `.etag`, no
    `.maxage`, and no entry in `STALE` or `MISSING`. It exists for one caller:
    `tools/serve.py`, which checks upstream freshness while serving a page and
    was writing into the cache **the build reads from**, underneath a build that
    might have been reading it. Narrowing that to one background thread fixed
    the stampede; this removes the write altogether, which is what the finding
    actually asked for.

    Everything a read-only caller *should* still do, it still does: it honours
    the freshness window the source declared, and it sends the `If-None-Match`
    it already holds, so the polite conditional request is unchanged. It simply
    does not keep what comes back. The builder owns the cache; a prober does not
    get to warm it, and does not get to age it either.

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

    # Inside the window the source itself declared, so do not ask again. This is
    # the whole of "Ask no more often than the source says to" — the drop table
    # says `max-age=86400` and was being asked every ten minutes.
    if still_fresh(path):
        with gzip.open(path, "rb") as fh:
            return fh.read()

    urls = [url] if isinstance(url, str) else list(url)
    last_err = None
    prior = read_etag(path)
    ceiling = limits.cap_for(key)
    # A host that answered with more than this key is allowed does not get
    # asked again: it will send the same oversized body, and requesting it
    # three times over is exactly what "ask no more often than the source says
    # to" exists to prevent. Other hosts publishing the same document are still
    # tried, which is the case this loop was built for.
    refused = set()
    for attempt in range(3):
        for one in urls:
            if one in refused:
                continue
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
                    # Both bounded by what this key is allowed to be. The read
                    # stops mid-transfer and the gunzip stops mid-stream, so
                    # neither an enormous body nor a small one that expands to
                    # an enormous one is ever held whole. tools/limits.py has
                    # the ceilings and what they were measured against.
                    raw = limits.read_capped(resp, ceiling, key)
                    if resp.headers.get("Content-Encoding") == "gzip":
                        raw = limits.gunzip_capped(raw, ceiling, key)
                    tag = resp.headers.get("ETag")
                    freshness = resp.headers.get("Cache-Control")
                if readonly:
                    return raw            # answered, and deliberately not kept
                os.makedirs(CACHE_DIR, exist_ok=True)
                with gzip.open(path, "wb") as fh:
                    fh.write(raw)
                write_etag(path, tag)
                write_maxage(path, freshness)
                return raw
            except limits.Refused as exc:
                # Both refusals, and both the same answer. Too large is not an
                # error to retry - the same host will send the same body - and
                # a body that did not decode whole is not one to keep. Either
                # way it is a failed fetch, which this function already knows
                # how to answer: next host, then the cached copy, then STALE.
                log(f"! {exc} - refused, falling through")
                refused.add(one)
                last_err = exc
            except urllib.error.HTTPError as exc:
                # 304 is a success: the server has confirmed what we hold is
                # current. Only reachable when a body was cached, since the
                # header is only sent then.
                if exc.code == 304:
                    # Confirmed current by the server — unless the document is
                    # one that cannot be this old and still be current. Skipped
                    # for a prober, which must not write `STALE` either: this is
                    # the last of the three places `fetch` records something
                    # about the build.
                    if not readonly:
                        stale_if_older(key, path, max_age)
                    with gzip.open(path, "rb") as fh:
                        return fh.read()
                last_err = exc
            except (urllib.error.URLError, TimeoutError, OSError) as exc:
                last_err = exc
        if len(refused) == len(urls):
            break                 # every host has already sent too much
        if attempt < 2:
            time.sleep(1.5 * (attempt + 1))

    # warm: a previous copy exists, so this is only an alert
    if os.path.exists(path):
        if readonly:
            # A prober's failed refresh is not the build's staleness. Recording
            # it here would put a source in `meta.stale` because a page was
            # being served, which is a claim about the payload that the payload
            # has no part in.
            with gzip.open(path, "rb") as fh:
                return fh.read()
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
    if readonly:
        # And never fatal. A prober that cannot reach a source has learnt
        # something about the source, not about this build — the caller reads
        # `None` as "no fingerprint" and says nothing to the page. This also
        # takes `SystemExit` off the path serve.py runs on, which is the
        # exception that froze its single-flight flag once already.
        return None
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
               optional: bool = False, max_age: float | None = None,
               readonly: bool = False):
    raw = fetch(url, key, offline, critical, optional, max_age, readonly)
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


def head_cached(url: str, key: str, readonly: bool = False) -> dict:
    """`head`, but not more often than the source says to.

    The drop table is the case this exists for. It declares `max-age=86400` —
    about daily, which matches a page whose `Last-Modified` moves every month or
    two — and `--if-changed` was sending it a HEAD every ten minutes, 144 times
    inside a window Digital Extremes had already answered.

    Cheap as a HEAD is, that is still asking somebody the same question 143 times
    after they answered it. The reply is kept beside the body like any other, and
    re-asked when their own window expires.
    """
    path = cache_path(key)
    if still_fresh(path):
        try:
            with gzip.open(path, "rb") as fh:
                return json.loads(fh.read().decode("utf-8"))
        except (OSError, ValueError):
            pass                                  # unreadable: just ask again
    headers = head(url)
    if headers and not readonly:      # `readonly`: see fetch's docstring
        try:
            os.makedirs(CACHE_DIR, exist_ok=True)
            with gzip.open(path, "wb") as fh:
                fh.write(json.dumps(headers).encode("utf-8"))
            write_maxage(path, headers.get("cache-control"))
        except OSError:
            pass
    return headers


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


def upstream_signature(offline: bool = False, readonly: bool = False) -> dict:
    """
    A small fingerprint of every upstream that matters, cheap enough to poll
    on a schedule: the export index is ~500 bytes, the drop table is a HEAD,
    and the trader window is a short JSON document.

    `readonly` is for `tools/serve.py`, the one caller that is not a build. It
    asks the same three questions in the same polite way and keeps none of the
    answers — see `fetch`. The two build callers leave it off, because filling
    the cache is the whole point when it is a build asking.
    """
    sig: dict = {}
    try:
        sig["exportIndex"] = hashlib.sha256(
            fetch(EXPORT_INDEX_HOSTS, "export_index", offline,
                  readonly=readonly)).hexdigest()[:16]
    except Exception:
        pass

    h = head_cached(OFFICIAL_DROPTABLES, "head_droptables", readonly=readonly)
    sig["droptables"] = h.get("last-modified") or h.get("etag") or "?"

    # First party, and the same document the build itself reads. This asked the
    # WFCD proxy until 2026-08-27, which meant every ten-minute freshness check
    # spent three attempts and two sleeps failing against an endpoint that had
    # been 404 for three days — a fingerprint that cost more than the rebuild it
    # was meant to avoid.
    try:
        doc = fetch_json(WORLDSTATE, "de_worldstate", offline,
                         critical=False, optional=True, readonly=readonly)
        trader = ((doc or {}).get("PrimeVaultTraders") or [{}])[0]
        expiry = ((trader.get("Expiry") or {}).get("$date") or {}).get("$numberLong")
        sig["resurgence"] = str(expiry or "?")
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
