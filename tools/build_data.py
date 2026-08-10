#!/usr/bin/env python3
"""
VorFrame data builder.

Pulls the Prime catalogue from the WARFRAME Wiki, enriches it with item data
from the WarframeStat API, joins in the official drop tables, and writes a
single payload the static site loads with no server and no build step.

Drop data comes from Digital Extremes' own drop table first, with the
community mirror as an automatic fallback. New Primes are picked up from DE's
Public Export, so an item can appear here before the wiki has been edited.

Outputs:
    data/vorframe-data.js    -> window.VORFRAME_DATA = {...}   (used by the site)
    data/vorframe-data.json  -> same payload, for anything else

Usage:
    python tools/build_data.py               # normal refresh
    python tools/build_data.py --if-changed  # rebuild only if upstream moved
    python tools/build_data.py --check       # report staleness, write nothing
    python tools/build_data.py --offline     # rebuild from the HTTP cache only
    python tools/build_data.py --source mirror   # skip the official drop table
    python tools/build_data.py --verbose     # show join diagnostics

Standard library only - this machine has no Node/npm, so there is nothing to
install, and nothing here needs an LLM: every source is JSON or a regularly
structured HTML table, so a scheduled task can keep the site current unattended.
"""

from __future__ import annotations

import argparse
import gzip
import hashlib
import json
import os
import re
import sys
import time
import urllib.error
import urllib.request
from collections import defaultdict
from datetime import datetime, timezone

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import official  # noqa: E402  (local module, sits beside this file)

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(ROOT, "data")
CACHE_DIR = os.path.join(ROOT, ".cache")

UA = "VorFrame/1.0 (personal Prime collection tracker; contact: local user)"

WIKI_RAW = "https://wiki.warframe.com/index.php?title={title}&action=raw"
DROPS = "https://drops.warframestat.us/data/{name}"
ITEMS_API = (
    "https://api.warframestat.us/items/?language=en"
    "&only=name,imageName,vaulted,category,type,components,uniqueName,masteryReq,"
    "releaseDate,vaultDate,estimatedVaultDate,tradable,wikiaUrl"
)
VAULT_TRADER = "https://api.warframestat.us/pc/vaultTrader?language=en"
IMG_CDN = "https://cdn.warframestat.us/img/"

# Digital Extremes, first party
OFFICIAL_DROPTABLES = "https://www.warframe.com/droptables"
EXPORT_INDEX = "https://origin.warframe.com/PublicExport/index_en.txt.lzma"
EXPORT_MANIFEST = "https://content.warframe.com/PublicExport/Manifest/{file}"
# the export files worth reading: everything that can carry a Prime
EXPORT_WANTED = ["ExportWarframes_en.json", "ExportWeapons_en.json",
                 "ExportSentinels_en.json", "ExportRegions_en.json"]

STATE_FILE = "state.json"  # inside .cache — drives --if-changed

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

RELIC_RE = re.compile(r"^(Lith|Meso|Neo|Axi|Requiem|Omnia)\s+([A-Za-z0-9]+)\s+Relic\b", re.I)
TIER_ORDER = {"Lith": 0, "Meso": 1, "Neo": 2, "Axi": 3, "Requiem": 4, "Omnia": 5}
REFINEMENTS = ["Intact", "Exceptional", "Flawless", "Radiant"]

# Sections of the wiki Prime page we turn into categories, in display order.
CATEGORY_ORDER = [
    "Warframe", "Primary", "Secondary", "Melee", "Archgun", "Companion",
    "Robotic Weapon", "Archwing", "Exalted", "Extractor", "Cosmetic", "Emote",
]

# Wiki name -> WarframeStat name, where the two databases disagree.
NAME_ALIASES = {
    "Kavasa Prime Collar": "Kavasa Prime Kubrow Collar",
    "Odonata Prime": "Odonata Prime",
}


# --------------------------------------------------------------------------
# fetching
# --------------------------------------------------------------------------

def log(msg: str) -> None:
    print(f"  {msg}", flush=True)


def cache_path(key: str) -> str:
    safe = re.sub(r"[^A-Za-z0-9_.-]", "_", key)[:120]
    return os.path.join(CACHE_DIR, safe + ".gz")


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


def fetch(url: str, key: str, offline: bool = False, critical: bool = True):
    """
    GET with a small on-disk cache so reruns and --offline are cheap.

    On failure: reuse the cached copy if there is one (recorded as STALE),
    otherwise record MISSING and either abort (critical) or return None.
    """
    path = cache_path(key)
    if offline:
        if not os.path.exists(path):
            MISSING.append(key)
            if critical:
                raise SystemExit(f"--offline but nothing cached for {key}")
            return None
        with gzip.open(path, "rb") as fh:
            return fh.read()

    last_err = None
    for attempt in range(3):
        try:
            req = urllib.request.Request(url, headers={
                "User-Agent": UA,
                "Accept-Encoding": "gzip",
            })
            with urllib.request.urlopen(req, timeout=120) as resp:
                raw = resp.read()
                if resp.headers.get("Content-Encoding") == "gzip":
                    raw = gzip.decompress(raw)
            os.makedirs(CACHE_DIR, exist_ok=True)
            with gzip.open(path, "wb") as fh:
                fh.write(raw)
            return raw
        except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError, OSError) as exc:
            last_err = exc
            if attempt < 2:
                time.sleep(1.5 * (attempt + 1))

    # warm: a previous copy exists, so this is only an alert
    if os.path.exists(path):
        log(f"~ {key}: refresh failed ({last_err}) - reusing the cached copy")
        STALE.append(key)
        with gzip.open(path, "rb") as fh:
            return fh.read()

    # cold: nothing to fall back on
    MISSING.append(key)
    if critical:
        raise SystemExit(
            f"failed to fetch {key} and nothing is cached: {last_err}\n"
            f"  This is a cold build, so there is no earlier copy to fall back on."
        )
    log(f"! {key} unreachable and not cached ({last_err})")
    return None


def fetch_json(url: str, key: str, offline: bool = False, critical: bool = True):
    raw = fetch(url, key, offline, critical)
    if raw is None:
        return None
    try:
        return json.loads(raw.decode("utf-8"))
    except (ValueError, UnicodeDecodeError) as exc:
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
            fetch(EXPORT_INDEX, "export_index", offline)).hexdigest()[:16]
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

def acquire_drops(offline: bool, prefer: str, verbose: bool):
    """
    Returns (relic_contents, relic_sources, source_label).

    DE's own drop table is tried first; the community mirror is the fallback.
    A sanity gate guards against a silent format change upstream turning the
    whole site into an empty list.
    """
    if prefer != "mirror":
        try:
            log("drops: warframe.com/droptables (official)")
            page = fetch(OFFICIAL_DROPTABLES, "official_droptables", offline).decode("utf-8", "replace")
            contents, sources = official.parse_droptables(page)
            if len(contents) >= 200 and len(sources) >= 10:
                return contents, normalise_sources(sources), "official"
            log(f"! official drop table parsed thin ({len(contents)} relics, "
                f"{len(sources)} farmable) - falling back to the mirror")
        except Exception as exc:
            log(f"! official drop table unavailable ({exc}) - falling back to the mirror")

    payloads: dict[str, object] = {}
    for fname in ["relics.json", *DROP_FILES.keys()]:
        log(f"drops: {fname} (mirror)")
        payloads[fname] = fetch_json(DROPS.format(name=fname), f"drops_{fname}", offline)
    return (collect_relic_contents(payloads["relics.json"]),
            collect_relic_sources(payloads, verbose),
            "mirror")


def acquire_export(offline: bool):
    """DE's official item manifest -> (list of Prime items, index hash)."""
    try:
        blob = fetch(EXPORT_INDEX, "export_index", offline)
        index = official.decode_index(blob)
    except Exception as exc:
        log(f"! public export index unavailable ({exc})")
        return [], None

    exports = {}
    for want in EXPORT_WANTED:
        tag = index.get(want)
        if not tag:
            continue
        try:
            raw = fetch(EXPORT_MANIFEST.format(file=f"{want}!{tag}"), f"export_{want}", offline)
            exports[want] = official.load_export(raw)
        except Exception as exc:
            log(f"! could not read {want} ({exc})")

    return (official.collect_prime_items(exports),
            official.node_levels(exports),
            hashlib.sha256(blob).hexdigest()[:16])


_WIKI_MARKUP = [
    (re.compile(r"\{\{(?:Resource|Weapon|WF|Companion|Icon)\|([^|}]+)(?:\|[^}]*)?\}\}"), r"\1"),
    (re.compile(r"\[\[[^\]|]+\|([^\]]+)\]\]"), r"\1"),
    (re.compile(r"\[\[([^\]]+)\]\]"), r"\1"),
    (re.compile(r"'''?"), ""),
    (re.compile(r"<[^>]+>"), ""),
    (re.compile(r"\{\{[^}]*\}\}"), ""),
]


def acquisition_summary(wikitext: str) -> str | None:
    """
    A one-line answer to "where does this actually come from?", for the handful
    of Primes the wiki marks with a bare (S) and no explanation.

    Reads either the {{Acquisition|...}} template or an ==Acquisition== section,
    strips wiki markup and keeps the first sentence or two.
    """
    if not wikitext:
        return None
    m = re.search(r"\{\{Acquisition\|(.+?)\}\}\s*$", wikitext, re.S | re.M)
    body = m.group(1) if m else None
    if body is None:
        m = re.search(r"^==\s*Acquisition\s*==\s*\n(.+?)(?=\n==[^=]|\Z)", wikitext, re.S | re.M)
        body = m.group(1) if m else None
    if not body:
        return None

    text = body.split("\n\n")[0]
    for pat, rep in _WIKI_MARKUP:
        text = pat.sub(rep, text)
    text = re.sub(r"\s+", " ", text).strip(" *:\n")

    # first two sentences is plenty for a tooltip
    parts = re.split(r"(?<=\.)\s+", text)
    out = " ".join(parts[:2]).strip()
    return (out[:320].rstrip() + "…") if len(out) > 320 else (out or None)


def normalise_part(name: str) -> str:
    """
    One canonical spelling for a part, whichever source described it.

    The item API says "Chassis"; the drop table says "Chassis Blueprint". Saved
    progress is keyed on these names, so if they can change between builds a
    player's ticks silently disappear. The bare main "Blueprint" keeps its name -
    only the redundant suffix goes.
    """
    n = re.sub(r"\s+", " ", (name or "")).strip()
    if n != "Blueprint" and n.endswith(" Blueprint"):
        n = n[: -len(" Blueprint")].strip()
    return n or "Blueprint"


def parts_from_droptables(item_name: str, relic_contents: dict) -> list[dict]:
    """
    Work out an item's parts straight from the drop table, for anything the
    item API does not know about yet (a Prime that shipped hours ago).

    Reward names are always "<Item Name> <Part>", so the prefix is unambiguous.
    """
    prefix = item_name + " "
    by_part: dict[str, dict] = {}
    for relic, rec in relic_contents.items():
        for reward, slot in (rec.get("rewards") or {}).items():
            if not reward.startswith(prefix):
                continue
            part = normalise_part(reward[len(prefix):])
            entry = by_part.setdefault(part, {"name": part, "itemCount": None, "relics": []})
            entry["relics"].append({
                "relic": relic,
                "rarity": slot.get("rarity"),
                "chances": slot.get("chances") or {},
            })
    for entry in by_part.values():
        entry["relics"].sort(key=lambda r: (TIER_ORDER.get(r["relic"].split()[0], 9), r["relic"]))
    return [by_part[k] for k in sorted(by_part)]


# --------------------------------------------------------------------------
# 1. the wiki Prime page -> catalogue (categories + availability markers)
# --------------------------------------------------------------------------

def parse_prime_page(text: str) -> list[dict]:
    """
    Read the galleries under ==Primes==. Each line looks roughly like:

        AshPrimeIcon.png|link=Ash_Prime|{{WF|Ash Prime|icon=0}} ([[Prime Vault|V]])|alt=Ash Prime (V)

    Field order varies between sections, so every field is matched by name and
    the availability markers are read from the wiki links rather than the alt
    text (Gara's "([[Prime Vault|V, ]][[Prime Resurgence|R]])" breaks naive
    paren parsing).
    """
    # The wiki uses non-breaking spaces inside {{WF}} output ("Ash\xa0Prime"),
    # which silently breaks every downstream name comparison.
    body = text.replace("\xa0", " ").replace("​", "")
    body = re.sub(r"<!--.*?-->", "", body, flags=re.S)

    m_start = re.search(r"^==\s*Primes\s*==\s*$", body, re.M)
    if not m_start:
        raise SystemExit("could not find the ==Primes== section on the wiki page")
    m_end = re.search(r"^==\s*Prime Related\s*==\s*$", body[m_start.end():], re.M)
    body = body[m_start.end():m_start.end() + (m_end.start() if m_end else len(body))]

    items: list[dict] = []
    seen: set[tuple[str, str]] = set()
    category = None

    for line in body.splitlines():
        stripped = line.strip()

        # exactly three '=' - the ==== sub-headers belong to other sections
        if stripped.startswith("===") and stripped.endswith("===") and not stripped.startswith("===="):
            category = stripped.strip("=").strip()
            continue
        if not category or "|" not in stripped:
            continue
        if stripped.startswith(("<gallery", "</gallery", "*", "!", "|-", "{|", "|}")):
            continue
        # gallery rows start with an image file name
        if not re.match(r"^(File:)?[^|]+\.(png|jpg|jpeg|gif)\b", stripped, re.I):
            continue

        parts = stripped.split("|")
        image_file = parts[0].strip()
        if image_file.lower().startswith("file:"):
            image_file = image_file[5:].strip()

        link = None
        alt = None
        for field in parts[1:]:
            f = field.strip()
            if f.lower().startswith("link="):
                link = f[5:].strip()
            elif f.lower().startswith("alt="):
                alt = f[4:].strip()

        # availability markers, read from the wiki links in the raw row
        flags = {
            "vaulted": bool(re.search(r"\[\[Prime Vault\|V", stripped)),
            "resurgenceWiki": bool(re.search(r"\[\[Prime Resurgence\|R\]\]", stripped)),
            "permanent": bool(re.search(r"Never Vaulted\|P\]\]", stripped)),
            "baro": bool(re.search(r"\[\[Baro Ki'?Teer\|B\]\]", stripped)),
            "special": bool(re.search(r"\{\{Tooltip\|S\|", stripped)),
            "founder": bool(re.search(r"\{\{Tooltip\|1\|Founder", stripped)),
        }

        # plain wikilink, used by the Cosmetic gallery: "[[Abbera Prime Syandana]]"
        # or "[[Emotes|Interalpha Prime Narta]]"
        wikilink = re.search(r"\[\[([^\]\[|]+?)(?:\|([^\]\[]+?))?\]\]", stripped)

        name = None
        if alt:
            # "Ash Prime (V)" / "Gara Prime (V, R)" / "Excalibur Prime1"
            name = re.sub(r"\s*\([^)]*\)\s*$", "", alt).strip()
            name = re.sub(r"\d+$", "", name).strip()
        if not name:
            tmpl = re.search(r"\{\{(?:WF|Weapon|Companion|Archwing)\|([^|}]+)", stripped)
            if tmpl:
                name = tmpl.group(1).strip()
        if not name and wikilink:
            # prefer the visible label over the page title
            name = (wikilink.group(2) or wikilink.group(1)).strip()
        if not name and link:
            name = link.replace("_", " ").strip()
        if not name:
            continue
        if not link and wikilink:
            link = wikilink.group(1).strip()
        name = re.sub(r"\s+", " ", name).strip()

        key = (category, name)
        if key in seen:
            continue
        seen.add(key)

        items.append({
            "name": name,
            "category": category,
            "wikiPage": (link or name).split("#")[0].strip().replace(" ", "_"),
            "wikiImage": image_file,
            "wikiFlags": flags,
        })

    return items


# --------------------------------------------------------------------------
# 2. drop tables -> relic contents and relic sources
# --------------------------------------------------------------------------

def normalise_sources(sources: dict[str, list]) -> dict[str, list]:
    """
    Collapse duplicate rows and put the best drop first.

    One node can list the same relic several times (bounty stages, repeated
    rotation entries), and neither source path emits rows in a useful order.
    Both paths run through here so the site never shows a 1.84% node above an
    11.06% one.

    Every row is kept. There used to be a `sources[:40]` cap here, which threw
    away 68% of all rows and made the planner blind to real farms: Sedna/Kappa
    publishes 25 rows, we stored 14, and its whole rotation C -- seven Axi
    relics at 10.20% plus the Gauss component blueprints -- vanished because
    those relics are listed at 90-odd nodes and Kappa fell below the fortieth.
    Caught by a player running the node and getting rewards the app said were
    not there. The UI already shows the top few and hides the rest, so trimming
    the data as well only removed information the ranking needed.
    """
    out: dict[str, list] = {}
    for relic, rows in sources.items():
        best: dict[tuple, dict] = {}
        for row in rows:
            k = (row.get("kind"), row.get("planet"), row.get("node"),
                 row.get("mode"), row.get("rotation"))
            cur = best.get(k)
            if cur is None or (row.get("chance") or 0) > (cur.get("chance") or 0):
                best[k] = row
        out[relic] = sorted(
            best.values(),
            key=lambda s: (-(s.get("chance") or 0), s.get("planet") or "", s.get("node") or ""),
        )
    return out


def relic_key(item_name: str) -> str | None:
    """'Lith A12 Relic' -> 'Lith A12'. Returns None for non-relic rewards."""
    m = RELIC_RE.match(item_name.strip())
    if not m:
        return None
    return f"{m.group(1).title()} {m.group(2).upper()}"


def collect_relic_sources(payloads: dict[str, object], verbose: bool) -> dict[str, list[dict]]:
    """Walk every drop table and record where each relic can be farmed."""
    sources: dict[str, list[dict]] = defaultdict(list)

    def add(relic: str, entry: dict) -> None:
        sources[relic].append(entry)

    def rotations(rewards) -> list[tuple[str | None, list]]:
        """rewards is either {rotation: [...]} or a bare list."""
        if isinstance(rewards, dict):
            return [(str(k), v) for k, v in rewards.items() if isinstance(v, list)]
        if isinstance(rewards, list):
            return [(None, rewards)]
        return []

    # star chart missions: planet -> node -> {gameMode, rewards}
    mission_data = payloads.get("missionRewards.json") or {}
    for planet, nodes in (mission_data.get("missionRewards") or {}).items():
        if not isinstance(nodes, dict):
            continue
        for node, info in nodes.items():
            if not isinstance(info, dict):
                continue
            mode = info.get("gameMode") or "Mission"
            is_event = bool(info.get("isEvent"))
            for rot, rewards in rotations(info.get("rewards")):
                for r in rewards:
                    relic = relic_key(r.get("itemName", ""))
                    if not relic:
                        continue
                    add(relic, {
                        "kind": "mission",
                        "planet": planet,
                        "node": node,
                        "mode": mode,
                        "rotation": rot,
                        "chance": r.get("chance"),
                        "rarity": r.get("rarity"),
                        "event": is_event,
                    })

    # bounties: [{bountyLevel, rewards: {A/B/C: [...]}}]
    for fname, kind in DROP_FILES.items():
        if not kind.startswith("bounty:"):
            continue
        where = kind.split(":", 1)[1]
        payload = payloads.get(fname) or {}
        root_key = next(iter(payload), None)
        for tier in (payload.get(root_key) or []):
            if not isinstance(tier, dict):
                continue
            level = tier.get("bountyLevel") or ""
            for rot, rewards in rotations(tier.get("rewards")):
                for r in rewards:
                    relic = relic_key(r.get("itemName", ""))
                    if not relic:
                        continue
                    add(relic, {
                        "kind": "bounty",
                        "planet": where,
                        "node": f"Bounty {level}".strip(),
                        "mode": "Bounty",
                        "rotation": rot,
                        "chance": r.get("chance"),
                        "rarity": r.get("rarity"),
                    })

    # keys / special missions: [{keyName, rewards}]
    for entry in ((payloads.get("keyRewards.json") or {}).get("keyRewards") or []):
        if not isinstance(entry, dict):
            continue
        name = entry.get("keyName") or "Key"
        for rot, rewards in rotations(entry.get("rewards")):
            for r in rewards:
                relic = relic_key(r.get("itemName", ""))
                if not relic:
                    continue
                add(relic, {
                    "kind": "key",
                    "planet": "Keys & Special",
                    "node": name,
                    "mode": "Key",
                    "rotation": rot,
                    "chance": r.get("chance"),
                    "rarity": r.get("rarity"),
                })

    # transient / rotating objectives: [{objectiveName, rewards: [...]}]
    for entry in ((payloads.get("transientRewards.json") or {}).get("transientRewards") or []):
        if not isinstance(entry, dict):
            continue
        name = entry.get("objectiveName") or "Special"
        for rot, rewards in rotations(entry.get("rewards")):
            for r in rewards:
                relic = relic_key(r.get("itemName", ""))
                if not relic:
                    continue
                add(relic, {
                    "kind": "transient",
                    "planet": "Rotating / Event",
                    "node": name,
                    "mode": "Special",
                    "rotation": rot,
                    "chance": r.get("chance"),
                    "rarity": r.get("rarity"),
                })

    sources = normalise_sources(sources)

    if verbose:
        log(f"relic sources: {len(sources)} relics have at least one farmable location")
    return dict(sources)


def collect_relic_contents(relics_payload: dict) -> dict[str, dict]:
    """
    relics.json lists one entry per relic per refinement state. Fold those into
    one record per relic: the reward list plus the chance at each refinement.
    """
    out: dict[str, dict] = {}
    for entry in (relics_payload.get("relics") or []):
        tier = entry.get("tier")
        code = entry.get("relicName")
        state = entry.get("state") or "Intact"
        if not tier or not code:
            continue
        name = f"{tier} {code}"
        rec = out.setdefault(name, {"tier": tier, "code": code, "rewards": {}})
        for r in entry.get("rewards") or []:
            item = r.get("itemName")
            if not item:
                continue
            slot = rec["rewards"].setdefault(item, {"rarity": r.get("rarity"), "chances": {}})
            slot["chances"][state] = r.get("chance")

    # same correction as the official path: the published rarity words are
    # chance-relative and shift with refinement, so derive the slot rarity
    for rec in out.values():
        for slot in rec["rewards"].values():
            derived = official.rarity_from_intact((slot.get("chances") or {}).get("Intact"))
            if derived:
                slot["rarity"] = derived
    return out


# --------------------------------------------------------------------------
# 3. join everything into the site payload
# --------------------------------------------------------------------------

def norm(s: str) -> str:
    return re.sub(r"[^a-z0-9]", "", (s or "").lower())


def slugify(s: str) -> str:
    return re.sub(r"-+", "-", re.sub(r"[^a-z0-9]+", "-", (s or "").lower())).strip("-")


def build_resurgence_set(vault_trader: dict, catalog_names: list[str]) -> tuple[set[str], dict]:
    """
    Varzia's live inventory is the only trustworthy Prime Resurgence signal -
    the wiki's (R) markers on the Prime page are stale.

    Inventory names are mangled ("Prime Tatsu Weapon", "Phantasma Prime
    Shotgun"), so match on uniqueName instead: the path always contains the
    item's base word next to "Prime" in one order or the other.
    """
    inv = vault_trader.get("inventory") or []
    blobs = []
    for row in inv:
        blobs.append(norm(row.get("uniqueName", "")) + " " + norm(row.get("item", "")))
    haystack = " ".join(blobs)

    active: set[str] = set()
    for name in catalog_names:
        if not name.endswith(" Prime") and " Prime" not in name:
            continue
        base = norm(name.replace(" Prime", "").replace("Prime ", ""))
        if len(base) < 3:
            continue
        if (base + "prime") in haystack or ("prime" + base) in haystack:
            active.add(name)

    window = {
        "activation": vault_trader.get("activation"),
        "expiry": vault_trader.get("expiry"),
        "character": vault_trader.get("character"),
        "location": vault_trader.get("location"),
    }
    return active, window


def main() -> int:
    ap = argparse.ArgumentParser(description="Build the VorFrame data payload.")
    ap.add_argument("--offline", action="store_true", help="rebuild from the HTTP cache only")
    ap.add_argument("--verbose", action="store_true", help="print join diagnostics")
    ap.add_argument("--source", choices=["official", "mirror"], default="official",
                    help="drop data source (default: official, mirror is the fallback)")
    ap.add_argument("--if-changed", action="store_true",
                    help="exit without rebuilding when no upstream has moved")
    ap.add_argument("--check", action="store_true",
                    help="report whether upstream changed, then exit; writes nothing")
    ap.add_argument("--allow-degraded", action="store_true",
                    help="publish even if a source was unreachable with nothing cached "
                         "(default: refuse, so a cold failure never silently thins the site)")
    args = ap.parse_args()
    off = args.offline

    print("VorFrame data build")
    print("-" * 60)

    # ---- freshness gate --------------------------------------------------
    state = load_state()
    if args.check or args.if_changed:
        sig = upstream_signature(off)
        prev = state.get("signature") or {}
        moved = [k for k in set(sig) | set(prev) if sig.get(k) != prev.get(k)]
        if args.check:
            for k in sorted(set(sig) | set(prev)):
                flag = "CHANGED" if k in moved else "same"
                log(f"{k:12} {flag:8} {prev.get(k, '-')} -> {sig.get(k, '-')}")
            print("-" * 60)
            print("stale - a rebuild would pick up changes" if moved else "up to date")
            return 0 if moved else 2
        if not moved and state.get("built"):
            log(f"no upstream changes since {state.get('built')} - nothing to do")
            print("-" * 60)
            return 0
        log("upstream changed: " + (", ".join(sorted(moved)) or "first run"))

    # ---- fetch -----------------------------------------------------------
    # Neither of these is fatal: the catalogue can be rebuilt from DE's export
    # and parts can be reconstructed from the drop table.
    log("wiki: Prime page")
    wiki_blob = fetch(WIKI_RAW.format(title="Prime"), "wiki_prime", off, critical=False)
    prime_wikitext = wiki_blob.decode("utf-8", "replace") if wiki_blob else None

    log("api: item database (name, image, vault state, components)")
    items_raw = fetch_json(ITEMS_API, "api_items", off, critical=False) or []

    log("api: Varzia / vault trader (live Prime Resurgence rotation)")
    try:
        vault_trader = fetch_json(VAULT_TRADER, "api_vaulttrader", off)
    except SystemExit:
        log("! vault trader unavailable - Resurgence flags will be empty")
        vault_trader = {}

    log("export: DE public item manifest")
    export_primes, node_levels, export_hash = acquire_export(off)

    relic_contents, relic_sources, drop_source = acquire_drops(off, args.source, args.verbose)

    # ---- transform -------------------------------------------------------
    print("-" * 60)
    if prime_wikitext:
        catalog = parse_prime_page(prime_wikitext)
        log(f"catalogue: {len(catalog)} entries across "
            f"{len(set(c['category'] for c in catalog))} sections")
    else:
        catalog = []
        log("! wiki unavailable - rebuilding the catalogue from DE's export alone")

    if not catalog and not export_primes:
        raise SystemExit(
            "no catalogue available: both the wiki and DE's public export failed.\n"
            "  Nothing can be built from the drop table alone - try again later."
        )

    # A source that failed with nothing cached leaves a real hole in the output.
    # On a warm run the cache papers over it; on a cold run (every CI run) it
    # does not, so refuse to publish a thinner site by accident.
    if MISSING and not args.allow_degraded:
        raise SystemExit(
            "cold build: no data at all for " + ", ".join(sorted(set(MISSING))) + "\n"
            "  Nothing was cached to fall back on, so the result would be missing\n"
            "  items or artwork. The previous build (if any) has been left alone.\n"
            "  Re-run when the source is reachable, or pass --allow-degraded to\n"
            "  publish an explicitly incomplete build."
        )

    # Primes DE already ships that the wiki page has not listed yet
    known = {norm(c["name"]) for c in catalog}
    fresh = [p for p in export_primes if norm(p["name"]) not in known]
    for p in fresh:
        catalog.append({
            "name": p["name"],
            "category": p["category"],
            "wikiPage": p["name"].replace(" ", "_"),
            "wikiImage": None,
            "wikiFlags": {"vaulted": False, "resurgenceWiki": False, "permanent": False,
                          "baro": False, "special": False, "founder": False},
            # only genuinely "new" if we had a wiki page to compare against
            "fromExport": bool(prime_wikitext),
        })
    if fresh and prime_wikitext:
        log(f"export: +{len(fresh)} Prime(s) not yet on the wiki page: "
            + ", ".join(p["name"] for p in fresh[:6])
            + (" …" if len(fresh) > 6 else ""))
    elif fresh:
        log(f"export: catalogue rebuilt from {len(fresh)} Primes in DE's item data")

    log(f"drops: using the {drop_source} source")
    log(f"relics: {len(relic_contents)} known, {len(relic_sources)} currently farmable")

    by_name: dict[str, dict] = {}
    for it in items_raw:
        n = it.get("name")
        if n:
            by_name.setdefault(norm(n), it)

    catalog_names = [c["name"] for c in catalog]
    resurgence, resurgence_window = build_resurgence_set(vault_trader, catalog_names)
    log(f"resurgence: {len(resurgence)} items live at Varzia "
        f"({resurgence_window.get('activation', '?')[:10]} -> {resurgence_window.get('expiry', '?')[:10]})")

    used_relics: set[str] = set()
    out_items: list[dict] = []
    unmatched: list[str] = []
    seen_ids: set[str] = set()

    for entry in catalog:
        name = entry["name"]
        api = by_name.get(norm(NAME_ALIASES.get(name, name))) or by_name.get(norm(name))
        if api is None:
            unmatched.append(name)

        # components -> relics
        parts = []
        for comp in ((api or {}).get("components") or []):
            drops = comp.get("drops") or []
            rel_map: dict[str, dict] = {}
            for d in drops:
                loc = d.get("location") or ""
                rk = relic_key(loc if loc.endswith("Relic") else re.sub(r"\s*\([^)]*\)\s*$", "", loc))
                if not rk:
                    continue
                cur = rel_map.setdefault(rk, {"relic": rk, "rarity": d.get("rarity")})
                if d.get("rarity"):
                    cur["rarity"] = d["rarity"]
            if not rel_map:
                continue
            part_relics = sorted(
                rel_map.values(),
                key=lambda r: (TIER_ORDER.get(r["relic"].split()[0], 9), r["relic"]),
            )
            for r in part_relics:
                used_relics.add(r["relic"])
                content = relic_contents.get(r["relic"], {})
                # exact per-refinement odds for this part inside this relic
                want = None
                for item_name, slot in (content.get("rewards") or {}).items():
                    if norm(item_name).startswith(norm(name)) and norm(comp.get("name") or "") in norm(item_name):
                        want = slot
                        break
                if want is None:
                    for item_name, slot in (content.get("rewards") or {}).items():
                        if norm(item_name).startswith(norm(name)):
                            want = slot
                            break
                if want:
                    r["rarity"] = want.get("rarity") or r.get("rarity")
                    r["chances"] = want.get("chances") or {}
                r["farmable"] = r["relic"] in relic_sources

            parts.append({
                "name": normalise_part(comp.get("name")),
                "itemCount": comp.get("itemCount"),
                "relics": part_relics,
            })

        # Nothing from the item API? Derive the parts from the drop table
        # directly. This is what makes a Prime released hours ago still show
        # its relics, and it also covers anything the API has not indexed.
        if not parts:
            parts = parts_from_droptables(name, relic_contents)
            for p in parts:
                for r in p["relics"]:
                    used_relics.add(r["relic"])
                    r["farmable"] = r["relic"] in relic_sources

        item_relics = sorted(
            {r["relic"] for p in parts for r in p["relics"]},
            key=lambda x: (TIER_ORDER.get(x.split()[0], 9), x),
        )
        farmable_relics = [r for r in item_relics if r in relic_sources]

        wf = entry["wikiFlags"]
        image = (api or {}).get("imageName")
        base_id = slugify(f"{entry['category']}-{name}")
        item_id = base_id
        n = 2
        while item_id in seen_ids:
            item_id = f"{base_id}-{n}"
            n += 1
        seen_ids.add(item_id)

        out_items.append({
            "id": item_id,
            "name": name,
            "category": entry["category"],
            "type": (api or {}).get("type"),
            "image": (IMG_CDN + image) if image else None,
            "wikiUrl": "https://wiki.warframe.com/w/" + entry["wikiPage"],
            "masteryReq": (api or {}).get("masteryReq"),
            "tradable": (api or {}).get("tradable"),
            "releaseDate": (api or {}).get("releaseDate"),
            "vaultDate": (api or {}).get("vaultDate"),
            "flags": {
                # api "vaulted" is game data; the wiki marker is the fallback
                "vaulted": bool((api or {}).get("vaulted", wf["vaulted"])),
                "resurgence": name in resurgence,
                "permanent": wf["permanent"],
                "baro": wf["baro"],
                "special": wf["special"],
                "founder": wf["founder"],
                # the honest signal: can a relic for this be farmed right now?
                "farmable": bool(farmable_relics),
            },
            "parts": parts,
            "relics": item_relics,
            "farmableRelics": farmable_relics,
            # present in DE's export but not yet on the wiki Prime page
            "isNew": bool(entry.get("fromExport")),
        })

    # ---- explain the "special" Primes -----------------------------------
    # The wiki marks these with a bare (S) and no reason, so fetch the reason.
    for it in out_items:
        if not it["flags"]["special"]:
            continue
        page = it["wikiUrl"].rsplit("/", 1)[-1]
        blob = fetch(WIKI_RAW.format(title=page), f"wiki_{page}", off, critical=False)
        if blob:
            summary = acquisition_summary(blob.decode("utf-8", "replace").replace("\xa0", " "))
            if summary:
                it["acquisition"] = summary
    named = sum(1 for i in out_items if i.get("acquisition"))
    if named:
        log(f"special: read the acquisition route for {named} item(s)")

    # ---- which Primes are next in line for the vault --------------------
    # Vaulting runs on a fixed cadence: every Prime Access release vaults the
    # frame from seven releases earlier, on the same day. Verified against all
    # 41 vaulted Warframes in the current data. So the oldest still-farmable
    # frames are the ones about to go, along with the weapons released with them.
    frames = sorted(
        (i for i in out_items
         if i["category"] == "Warframe" and i["flags"]["farmable"]
         and not i["flags"]["permanent"] and i.get("releaseDate")),
        key=lambda i: i["releaseDate"],
    )
    at_risk_dates = {i["releaseDate"][:10] for i in frames[:2]}
    for it in out_items:
        it["vaultSoon"] = bool(
            it["flags"]["farmable"] and not it["flags"]["permanent"]
            and (it.get("releaseDate") or "")[:10] in at_risk_dates)
    if at_risk_dates:
        log(f"vault watch: {sum(1 for i in out_items if i['vaultSoon'])} items in the "
            f"{len(at_risk_dates)} oldest farmable release(s) — "
            + ", ".join(i["name"] for i in frames[:2]))

    out_items.sort(key=lambda i: (
        CATEGORY_ORDER.index(i["category"]) if i["category"] in CATEGORY_ORDER else 99,
        i["name"],
    ))

    # trim the relic table to relics actually referenced by a catalogue item
    def with_levels(srcs):
        """Tag star-chart sources with DE's enemy levels, where they exist."""
        out = []
        for s0 in srcs:
            row = dict(s0)
            if row.get("kind") == "mission":
                planet = re.sub(r"^Event:\s*", "", row.get("planet") or "").strip()
                lv = node_levels.get(f"{planet}/{row.get('node')}")
                if lv:
                    row["lvl"] = lv
            out.append(row)
        return out

    relics_out = {}
    for rname in sorted(used_relics, key=lambda x: (TIER_ORDER.get(x.split()[0], 9), x)):
        content = relic_contents.get(rname, {})
        srcs = with_levels(relic_sources.get(rname, []))
        relics_out[rname] = {
            "tier": content.get("tier") or rname.split()[0],
            "code": content.get("code") or rname.split()[-1],
            "vaulted": not srcs,
            "rewards": [
                dict(
                    item=re.sub(r"^\d+\s*X\s+", "", k),
                    qty=int(re.match(r"^(\d+)\s*X\s+", k).group(1)) if re.match(r"^\d+\s*X\s+", k) else 1,
                    rarity=v.get("rarity"), chances=v.get("chances"),
                )
                for k, v in sorted((content.get("rewards") or {}).items())
            ],
            "sources": srcs,
            "sourceCount": len(srcs),
        }

    categories = []
    for cat in CATEGORY_ORDER:
        count = sum(1 for i in out_items if i["category"] == cat)
        if count:
            categories.append({"name": cat, "count": count})
    for cat in sorted({i["category"] for i in out_items} - set(CATEGORY_ORDER)):
        categories.append({"name": cat, "count": sum(1 for i in out_items if i["category"] == cat)})

    payload = {
        "meta": {
            "generated": datetime.now(timezone.utc).isoformat(timespec="seconds"),
            "itemCount": len(out_items),
            "relicCount": len(relics_out),
            "farmableRelicCount": sum(1 for r in relics_out.values() if not r["vaulted"]),
            "resurgence": resurgence_window,
            "refinements": REFINEMENTS,
            "dropSource": drop_source,
            "newCount": len(fresh) if prime_wikitext else 0,
            # refresh failed but an older copy was reused — data is slightly behind
            "stale": sorted(set(STALE)),
            # refresh failed with nothing cached — this data is genuinely absent
            "degraded": sorted(set(MISSING)),
            "sources": {
                "catalogue": "https://wiki.warframe.com/w/Prime",
                "newItems": "https://origin.warframe.com/PublicExport (Digital Extremes, official)",
                "items": "https://api.warframestat.us/items",
                "drops": (OFFICIAL_DROPTABLES + " (Digital Extremes, official)"
                          if drop_source == "official"
                          else "https://drops.warframestat.us/data (community mirror)"),
                "resurgence": "https://api.warframestat.us/pc/vaultTrader (live worldstate)",
                "images": "https://cdn.warframestat.us/img",
            },
        },
        "categories": categories,
        "items": out_items,
        "relics": relics_out,
    }

    os.makedirs(DATA_DIR, exist_ok=True)
    json_path = os.path.join(DATA_DIR, "vorframe-data.json")
    js_path = os.path.join(DATA_DIR, "vorframe-data.js")

    blob = json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
    with open(json_path, "w", encoding="utf-8") as fh:
        fh.write(blob)
    with open(js_path, "w", encoding="utf-8") as fh:
        fh.write("/* generated by tools/build_data.py - do not edit by hand */\n")
        fh.write("window.VORFRAME_DATA = ")
        fh.write(blob)
        fh.write(";\n")

    # remember what upstream looked like, so --if-changed can skip next time
    save_state({
        "built": payload["meta"]["generated"],
        "signature": upstream_signature(off) if not off else (state.get("signature") or {}),
        "exportHash": export_hash,
        "dropSource": drop_source,
    })

    # ---- report ----------------------------------------------------------
    print("-" * 60)
    wf_count = sum(1 for i in out_items if i["category"] == "Warframe")
    with_farm = sum(1 for i in out_items if i["flags"]["farmable"])
    log(f"items          {len(out_items)}  ({wf_count} Warframes)")
    log(f"relics kept    {len(relics_out)}  ({payload['meta']['farmableRelicCount']} farmable)")
    log(f"farmable items {with_farm}")
    log(f"resurgence     {sum(1 for i in out_items if i['flags']['resurgence'])}")
    log(f"wrote          data/vorframe-data.js  ({len(blob)/1024/1024:.2f} MB)")

    if STALE:
        log(f"~ ALERT    reused cached data for: {', '.join(sorted(set(STALE)))}")
    if MISSING:
        log(f"! DEGRADED built with no data at all for: {', '.join(sorted(set(MISSING)))}")

    if unmatched:
        log(f"note: {len(unmatched)} catalogue entries had no item-database match "
            f"(cosmetics/emotes mostly)")
        if args.verbose:
            for u in unmatched:
                print(f"      - {u}")

    no_parts = [i["name"] for i in out_items
                if i["category"] == "Warframe" and not i["parts"]]
    if no_parts:
        log(f"note: {len(no_parts)} Warframes resolved no relic parts: {', '.join(no_parts)}")

    print("-" * 60)
    print("done - open index.html")
    return 0


if __name__ == "__main__":
    sys.exit(main())
