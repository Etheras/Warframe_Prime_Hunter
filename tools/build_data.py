#!/usr/bin/env python3
"""
Warframe Prime Hunter data builder.

Pulls the Prime catalogue from the WARFRAME Wiki, enriches it with item data
from the WarframeStat API, joins in the official drop tables, and writes a
single payload the static site loads with no server and no build step.

Drop data comes from Digital Extremes' own drop table first, with the
community mirror as an automatic fallback. New Primes are picked up from DE's
Public Export, so an item can appear here before the wiki has been edited.

Outputs:
    data/prime-data.js    -> window.WFPRIME_DATA = {...}   (used by the site)
    data/prime-data.json  -> same payload, for anything else

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
import collections
import hashlib
import json
import os
import re
import sys
import time
import urllib.request
from datetime import datetime, timedelta, timezone

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# The build was one 1200-line file doing three jobs. It now orchestrates four
# modules that each do one:
#   sources    network, HTTP cache, freshness, the warm/cold STALE/MISSING policy
#   catalogue  the wiki Prime page - the only editorial source
#   relics     joining drop tables into relic contents and relic sources
#   artwork    optional local copies of item images (--with-images)
import artwork                                            # noqa: E402
import catalogue                                          # noqa: E402
import official                                           # noqa: E402
import relics as relicmod                                 # noqa: E402
import sources                                            # noqa: E402
from sources import (CACHE_DIR, DATA_DIR, DROPS, EXPORT_INDEX,       # noqa: E402
                     DROP_FILES, EXPORT_INDEX_HOSTS, EXPORT_MANIFEST, EXPORT_OPTIONAL,
                     EXPORT_WANTED,
                     DE_TEXTURES, FISSURES, IMG_CDN,
                     ITEMS_API, MISSING, OFFICIAL_DROPTABLES, ROOT, STALE, STALE_AGE, UA,
                     SYNDICATE_MISSIONS, VAULT_TRADER, WORLD_EVENTS, WORLDSTATE, WIKI_RAW,
                     fetch, fetch_json, head, load_state, log, save_state,
                     upstream_signature)
from artwork import cache_images                          # noqa: E402
from catalogue import (CATEGORY_ORDER, NAME_ALIASES,                # noqa: E402
                       NON_RELIC_CATEGORIES, REFINEMENTS, TIER_ORDER,
                       acquisition_summary, normalise_part, parse_prime_page,
                       parts_from_droptables)
from relics import (collect_relic_contents, collect_relic_sources,   # noqa: E402
                    normalise_sources, relic_key)

# --------------------------------------------------------------------------
# 3. join everything into the site payload
# --------------------------------------------------------------------------

# These two pick official-vs-mirror and gate on sanity, and the drop path
# needs relics.normalise_sources - orchestration, so they live here rather
# than in sources.py, which would have made the two modules import each other.
def acquire_drops(offline: bool, prefer: str, verbose: bool):
    """
    Returns (relic_contents, relic_sources, source_label, aya_sources,
             bounty_rotation_pools).

    DE's own drop table is tried first; the community mirror is the fallback.
    A sanity gate guards against a silent format change upstream turning the
    whole site into an empty list.
    """
    if prefer != "mirror":
        try:
            log("drops: warframe.com/droptables (official)")
            page = fetch(OFFICIAL_DROPTABLES, "official_droptables", offline).decode("utf-8", "replace")
            contents, sources, aya = official.parse_droptables(page)
            if len(contents) >= 200 and len(sources) >= 10:
                return (contents, normalise_sources(sources), "official", aya,
                        official.bounty_rotation_pools(page))
            log(f"! official drop table parsed thin ({len(contents)} relics, "
                f"{len(sources)} farmable) - falling back to the mirror")
        except Exception as exc:
            log(f"! official drop table unavailable ({exc}) - falling back to the mirror")

    payloads: dict[str, object] = {}
    for fname in ["relics.json", *DROP_FILES.keys()]:
        log(f"drops: {fname} (mirror)")
        payloads[fname] = fetch_json(DROPS.format(name=fname), f"drops_{fname}", offline)
    # the mirror splits its data differently and has no Aya table we can key on,
    # so an Aya-less build is simply one without the bonus - never an error.
    # It also yields no rotation pools, so a mirror build cannot name the live
    # bounty rotation; the planner says "unknown" rather than guessing.
    return (collect_relic_contents(payloads["relics.json"]),
            collect_relic_sources(payloads, verbose),
            "mirror", [], {})


def image_for(api: dict | None, textures: dict) -> str | None:
    """Where this item's picture lives — Digital Extremes first, WFCD if not.

    First party is preferred wherever one exists, and here one does: DE's
    `ExportManifest.json` covers all 167 of the catalogue, measured. Going
    straight to them also drops two hosts a reader's browser would otherwise
    talk to, because `cdn.warframestat.us/img/<file>` is a redirector rather
    than an origin — it answers 301 to `raw.githubusercontent.com`, and a
    content policy is enforced against every hop.

    The WFCD CDN stays as the fallback rather than being deleted: it is what
    covers a build where DE's export index could not be read, which is a real
    failure this project has already seen from a GitHub runner. Both paths write
    a whole URL, so nothing downstream has to know which one answered.
    """
    unique = (api or {}).get("uniqueName")
    tex = textures.get(unique) if unique else None
    if tex:
        return DE_TEXTURES + tex
    name = (api or {}).get("imageName")
    return (IMG_CDN + name) if name else None


def acquire_export(offline: bool):
    """DE's official manifests -> (Prime items, node levels, index hash, textures)."""
    try:
        blob = fetch(EXPORT_INDEX_HOSTS, "export_index", offline)
        index = official.decode_index(blob)
    except Exception as exc:                              # noqa: BLE001
        # Four values, because that is what the caller unpacks. This returned
        # two for as long as it has existed - the one path that gives up would
        # have raised a ValueError from the assignment instead of degrading,
        # which is precisely the moment you least want a second failure. It is
        # the count that matters rather than the number: keep the two paths
        # agreeing, and keep the test that says so.
        log(f"! public export index unavailable ({exc})")
        return [], {}, None, {"textures": {}, "nodeNames": {}, "partSpecs": {}}

    exports = {}
    for want in EXPORT_WANTED:
        tag = index.get(want)
        if not tag:
            continue
        try:
            # `critical=False`: this loop has always meant to degrade past a
            # manifest it cannot read — its `except` says so — but `fetch`
            # defaults to raising SystemExit, which derives from BaseException
            # and sails straight through `except Exception`. Cached copies hid
            # that for as long as the four manifests here were all warm; adding
            # a fifth found it, by making `--offline` fatal on the first run
            # after the list grew.
            # Three of these are enrichments and three are not. A card with no
            # picture falls back to a glyph that already exists, and a Prime with
            # no DE recipe falls back to the item API's part list — both are
            # documented, tested degradations. Missing node levels or a missing
            # Prime are wrong data, so those stay fatal on a cold miss.
            #
            # `ExportRecipes` and `ExportResources` joined this list on
            # 2026-08-27 and were NOT marked optional, which turned CI red the
            # same day: the runner restores a cache from an earlier run, that
            # cache predates the two new files by definition, and `--offline`
            # then aborted the whole build over an enrichment it is designed to
            # do without. A source whose absence has a fallback must never be
            # able to stop the build — `PROJECT.md §6`.
            raw = fetch(EXPORT_MANIFEST.format(file=f"{want}!{tag}"), f"export_{want}",
                        offline, critical=False, optional=want in EXPORT_OPTIONAL)
            if raw:
                exports[want] = official.load_export(raw)
        except Exception as exc:
            log(f"! could not read {want} ({exc})")

    # uniqueName -> textureLocation, for every item DE ship a picture of. The
    # join needs no name matching and no heuristics: `uniqueName` is already one
    # of the fields the items API is asked for by name.
    textures = {row.get("uniqueName"): row.get("textureLocation")
                for row in (exports.get("ExportManifest.json", {}).get("Manifest") or [])
                if row.get("uniqueName") and row.get("textureLocation")}

    # A named bag rather than a fifth and sixth positional value. The tuple grew
    # once for textures and would have grown again for node names a day later;
    # everything derived from these manifests goes in here from now on, so the
    # shape the caller unpacks stops moving.
    return (official.collect_prime_items(exports),
            official.node_levels(exports),
            hashlib.sha256(blob).hexdigest()[:16],
            {"textures": textures, "nodeNames": official.node_names(exports),
             "partSpecs": official.prime_part_specs(exports)})




def write_changelog(items: list, relics_out: dict,
                    prev_state: dict, new_state: dict) -> list:
    """
    Record what changed in availability since the last build.

    A scheduled build rewrites 1.8 MB of JSON whether or not anything moved, so
    "Frost Prime became farmable" was invisible without diffing the payload.
    This keeps a small roster of what was farmable last time, compares, and
    appends a dated entry to CHANGELOG.md when it differs.

    Only availability is tracked, because that is the part a player acts on -
    an unvaulting is worth knowing about, a rebalanced drop chance is not.
    """
    now = {i["name"]: i["flags"]["farmable"] for i in items if i.get("flags")}
    live_relics = {n for n, r in relics_out.items() if not r["vaulted"]}
    prev = prev_state.get("availability") or {}
    prev_items = prev.get("items") or {}
    prev_relics = set(prev.get("relics") or [])

    lines_out = []
    if prev_items:                       # nothing to compare on the first build
        gained = sorted(n for n, f in now.items() if f and not prev_items.get(n))
        lost = sorted(n for n, f in prev_items.items() if f and not now.get(n))
        new_items = sorted(set(now) - set(prev_items))
        r_in = sorted(live_relics - prev_relics)
        r_out = sorted(prev_relics - live_relics)
        if gained:
            lines_out.append(f"- **Unvaulted** ({len(gained)}): " + ", ".join(gained))
        if lost:
            lines_out.append(f"- **Vaulted** ({len(lost)}): " + ", ".join(lost))
        if new_items:
            lines_out.append(f"- **New to the catalogue** ({len(new_items)}): "
                         + ", ".join(new_items))
        if r_in:
            lines_out.append(f"- Relics now dropping ({len(r_in)}): " + ", ".join(r_in))
        if r_out:
            lines_out.append(f"- Relics no longer dropping ({len(r_out)}): " + ", ".join(r_out))

    if lines_out:
        path = os.path.join(ROOT, "CHANGELOG.md")
        NL = chr(10)
        header = ("# Availability changelog" + NL + NL +
                  "What became farmable, or stopped being farmable, between builds."
                  + NL + "Written by `tools/build_data.py`; nothing else edits it." + NL)
        old = ""
        if os.path.exists(path):
            with open(path, encoding="utf-8") as fh:
                old = fh.read()
            if old.startswith("# Availability"):
                old = old.split(NL, 4)[-1]
        stamp = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        with open(path, "w", encoding="utf-8") as fh:
            fh.write(header + NL + "## " + stamp + NL + NL
                     + NL.join(lines_out) + NL + NL + old.lstrip())
        log(f"changelog     {len(lines_out)} availability change(s) -> CHANGELOG.md")

    new_state["availability"] = {"items": now, "relics": sorted(live_relics)}
    return lines_out


def write_atomic(path: str, text: str) -> None:
    """
    Write `text` to `path` so a reader never sees half of it.

    Onto a temporary sibling first, then `os.replace`, which is atomic on both
    platforms this runs on when source and destination share a directory - hence
    the sibling rather than a temp dir.

    **Added for one file, deliberately.** Non-atomic writes were examined across
    the pipeline on 2026-08-26 and declined as a backlog entry (`PROJECT.md 7`):
    every other torn write here **fails loudly**, and a build that stops is a
    build somebody fixes. `data/feed-log.json` is the exception and postdates
    that decision - it is read back inside a bare `except (OSError, ValueError):
    pass`, so a torn one is silently treated as absent and the build starts a
    fresh 24-hour log, discarding the record of which source answered. Quiet
    wrong data, not a stopped build, which is the failure mode worth spending a
    helper on.

    The rest stay opportunistic: use this when touching one of them anyway,
    rather than sweeping them.
    """
    tmp = path + ".tmp"
    with open(tmp, "w", encoding="utf-8") as fh:
        fh.write(text)
        fh.flush()
        os.fsync(fh.fileno())
    os.replace(tmp, path)


def norm(s: str) -> str:
    return re.sub(r"[^a-z0-9]", "", (s or "").lower())


def slugify(s: str) -> str:
    return re.sub(r"-+", "-", re.sub(r"[^a-z0-9]+", "-", (s or "").lower())).strip("-")


def as_int(value, default=None):
    """
    An upstream number, or `default` when it is not one.

    `masteryReq`, `ducats` and `itemCount` are documented as numeric and come
    from a third-party JSON API, which is not the same thing. All three are
    interpolated into markup in the browser, and the pages trusted the type
    rather than escaping - so a string in any of them was markup, on a site
    that rebuilds from these feeds unattended twice a day.

    The browser coerces these too (`WFPrimeShared.count`). This is the half
    that matters, because it is the boundary: nothing downstream of here has
    to remember, and the payload on disk is the thing other people download.

    Strict on purpose. A numeric string would be easy to accept and would hide
    an upstream that had started sending them; dropping the value makes the
    change visible on screen instead. `bool` is refused because it is an `int`
    subclass and `True` is not a count.
    """
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        return default
    if isinstance(value, float) and not value.is_integer():
        return default
    return int(value)


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


# The rotation tag inside a vaulted relic's uniqueName:
#   /Lotus/Types/Game/Projections/T1VoidProjectionRevenantBaruukVaultASilver
#                                   ^^^^^^^^^^^^^^ this
RELIC_VAULT_TAG = re.compile(r"VoidProjection(.+?)Vault[A-Z]")


def build_varzia_relics(items_raw: list, vault_trader: dict) -> set[str]:
    """
    Which relics Varzia is actually selling, rather than which relics happen to
    hold a part of a Prime she is offering.

    Those are very different lists and we shipped the second one as the first.
    Measured 2026-08-27 against the in-game store: her shelf held six relics and
    we badged 88, because the flag was derived per-Prime - any relic carrying a
    part of an offered Prime counted, which sweeps in every historical relic
    those parts ever appeared in.

    **Digital Extremes do not publish the shelf as a list.** `PrimeVaultTraders`
    carries a `Manifest` of 22 rows - packs, Primes, cosmetics, all priced in
    Regal Aya - and an `EvergreenManifest` of Twitch cosmetics. Neither has a
    relic row, and neither does the WFCD proxy of them. Two sessions looked
    there and concluded it could not be done.

    It is published, though, in the item database, as a naming convention: a
    relic minted for a Prime Vault rotation is
    `.../T1VoidProjection<Rotation>Vault<Letter><Refinement>`, and `<Rotation>`
    is the same word DE build the pack names from - `MPVRevenantBaruukPrimeDualPack`
    against `...VoidProjectionRevenantBaruukVaultASilver`. So the shelf is the
    relics whose rotation tag appears in the packs she is currently selling.

    Deterministic, first party, and it needs no new request: the item database is
    already fetched for names, images and vault state.

    Verified against the owner's screenshot of the live store: six relics, and
    exactly the six - Lith T13, Lith A9, Meso R6, Neo P8, Axi C9, Axi B9. No
    misses and no extras.
    """
    packs = " ".join(str(row.get("uniqueName", ""))
                     for row in (vault_trader.get("inventory") or []))
    if not packs:
        return set()

    # every rotation tag the item database knows, and the relics under each
    by_tag: dict[str, set[str]] = {}
    for row in items_raw or []:
        if row.get("category") != "Relics":
            continue
        m = RELIC_VAULT_TAG.search(str(row.get("uniqueName", "")))
        if not m:
            continue
        # "Lith T13 Exceptional" -> "Lith T13": one shelf entry, four refinements
        name = " ".join(str(row.get("name", "")).split()[:2])
        if name:
            by_tag.setdefault(m.group(1), set()).add(name)

    live = {tag for tag in by_tag if tag in packs}
    # `EmberRhino` is a substring of `EmberRhinos`, and both are real rotations.
    # Keep only the longest match so a past rotation cannot ride in on a current
    # one's pack name.
    live = {t for t in live if not any(t != o and t in o for o in live)}

    return {name for tag in live for name in by_tag[tag]}


# --------------------------------------------------------------------------
# bounties: which rotation is live, and which limited-time ones exist today
# --------------------------------------------------------------------------

# Which drop-table section each syndicate hands out bounties from. Anything not
# named here (Nightwave, the six old star-chart syndicates) offers no bounties.
SYNDICATE_SECTION = {
    "Ostrons": "cetusRewards",
    "Solaris United": "solarisRewards",
    "Entrati": "deimosRewards",
    "The Holdfasts": "zarimanRewards",
    "Cavia": "entratiLabRewards",
    "The Hex": "hexRewards",
}

# Bounties that only exist while an event is running, and the event to look for
# in the worldstate. Both are Cetus events, and between them they carry 28 of
# the 30 relic-bearing bounty rows outside the Isolation Vaults - so ranking
# them as permanent sends you to a bounty board that has no such bounty on it.
EVENT_BOUNTIES = {
    "Level 15 - 25 Ghoul Bounty": "Ghoul Purge",
    "Level 40 - 50 Ghoul Bounty": "Ghoul Purge",
    "Level 15 - 25 Plague Star": "Plague Star",
}
EVENT_PATTERNS = {
    "Ghoul Purge": re.compile(r"ghoul", re.I),
    "Plague Star": re.compile(r"plague\s*star", re.I),
}

# DE tag every world event with a stable machine identifier - `HeatFissure` is
# Thermia Fractures, `WaterFight` is Dog Days - and a tag is a far better key
# than a keyword scan over prose DE can reword at any time.
#
# **Empty on purpose, and it is not an oversight.** Neither of the two events
# that carry relics has run since this project existed, so their tags have never
# been seen. Guessing one would be worse than scanning: a wrong tag matches
# nothing and looks like the event is not running, which is exactly the failure
# the scan was written loosely to avoid.
#
# So the scan stays as the way in, and the build *records* the tag of whatever
# it matched - see `find_live_events`. The first time a Ghoul Purge runs, its
# tag lands in the payload and in the build log, and it can be added here as a
# fact rather than a guess.
EVENT_TAGS: dict[str, str] = {}

CYCLE_MINUTES = 150       # one full day/night of the landscape
SEQUENCE = "ABC"


# --------------------------------------------------------------------------
# what can actually be run
# --------------------------------------------------------------------------
#
# The planner answers "where do I go next", so a source belongs in it only if
# it can be entered today. Three kinds cannot, and each is tagged rather than
# deleted - the collection view still wants to say where a relic comes from.
#
# Quest missions. All eight share one identical reward table, and "Sunkiller"
# is a New War music track rather than a node: these are quest stages, played
# once, and cannot be ground. Named explicitly because DE files them in
# keyRewards alongside genuinely repeatable key-gated missions (Jordas Golem,
# Mutalist Alad V, Orokin Derelict), which stay.
QUEST_MISSIONS = frozenset({
    "Another Betrayer", "Family Reunion", "Hot Mess", "Recover The Orokin Archive",
    "Sunkiller", "Table For Two", "The Aftermath", "Time's Up",
})

# Enemies that only exist while an event runs. The Hemocyte appears solely in
# the final stage of the Plague Star bounty - "a total of four spawning during
# the final stage" - so it rides the window the bounty already rides.
EVENT_ENEMIES = {"Hemocyte": "Plague Star"}


def tag_access(relic_sources: dict, aya_sources: list) -> dict:
    """Mark every row that is not a place you can decide to go, and say why."""
    counts: dict[str, int] = {}

    def tag(row: dict) -> None:
        node = str(row.get("node") or "")
        access = None
        if row.get("kind") == "key" and node in QUEST_MISSIONS:
            access = "quest"
        elif node in EVENT_ENEMIES:
            access = "event:" + EVENT_ENEMIES[node]
        # Profit-Taker was tagged "unmodelled" here until 2026-08-14, on two
        # beliefs that both turned out to be wrong: that its four phases were
        # not independent, and that Phase 3's first/subsequent split could not
        # be expressed. The wiki says each phase is freely replayable once the
        # heist has been done in sequence, and DE's own table gives the "First
        # Completion" section a Gravimag and no relics at all - so there is no
        # "once ever" to express, because the thing that happens once is not
        # something this app tracks. Each phase is a single fixed table with no
        # rotation, which is the flat case the model has always handled.
        #
        # What it does have is a standing gate, Solaris United Rank 5, and that
        # is a demand badge rather than a reason to hide it - the same call
        # already made for Railjack. See rotation.js.
        if access:
            row["access"] = access
            counts[access] = counts.get(access, 0) + 1

    for rows in (relic_sources or {}).values():
        for row in rows:
            tag(row)
    for row in aya_sources or []:
        tag(row)
    return counts


def bounty_family(group: str) -> str:
    """
    Which clock a bounty's rotation letter runs on.

    The wiki says every bounty everywhere shares one letter. Our own reading of
    the worldstate says otherwise: at 2026-08-11T21:00Z the standard bounties of
    Cetus, Fortuna and the Cambion Drift were all on C while every Isolation
    Vault chamber was on B - same 150-minute period, same changeover instant,
    one step apart. So the two are derived separately and neither is assumed
    from the other.
    """
    return "vault" if "Isolation Vault" in group else "standard"


def _instant(value) -> datetime | None:
    """Parse a worldstate timestamp. They are ISO-8601 UTC with a Z suffix."""
    try:
        return datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except (TypeError, ValueError):
        return None


def _is_live(entry: dict, now: datetime) -> bool:
    start, end = _instant(entry.get("activation")), _instant(entry.get("expiry"))
    return bool(end and end > now and (not start or start <= now))


def _one_window(entries: list, now: datetime) -> list:
    """
    Narrow a worldstate reading to a single bounty window.

    Two things make this necessary, and they pull in opposite directions.

    Minutes before a changeover the worldstate carries the *next* set as well.
    Counting both halves the vote: read at 21:53 against a window ending 21:55,
    the standard bounties came back 16 for C and 16 for A, and the vaults 6 for
    B and 6 for C. The tie went to the wrong letter for the vaults, a whole
    window out. So a live window always wins.

    But a cached reading has no live window at all - every entry expired while
    it sat on disk - and that is the normal case for `--offline` and for a build
    that kept going after the API was unreachable. Discarding it would throw
    away a perfectly good anchor: the cycle is unbroken, so the most recently
    finished window still names the letter correctly once the page walks it
    forward. So fall back to the latest window we have rather than to nothing.
    """
    live = [e for e in entries if _is_live(e, now)]
    if live:
        return live
    ends = [_instant(e.get("expiry")) for e in entries]
    past = [t for t in ends if t and t <= now]
    if not past:
        return []
    latest = max(past)
    return [e for e in entries if _instant(e.get("expiry")) == latest]


def derive_bounty_rotation(pools: dict, syndicate_missions: list,
                           now: datetime | None = None) -> dict:
    """
    Name the rotation letter that is live right now, per family.

    DE publishes what each letter pays; the worldstate publishes what the
    bounties on offer pay. Matching one against the other names the letter,
    which is otherwise unknowable - the period (150 minutes) is documented but
    the phase is not, and a countdown labelled with the wrong letter is worse
    than no countdown at all.

    A job votes only when exactly one rotation of its bounty contains every
    reward it is currently offering. Ties abstain: several Cambion Drift tiers
    pay the same handful of resources in all three rotations and genuinely
    carry no information. In the reading above 20 jobs voted and none dissented.

    All the voters come from one window - see `_one_window` - which may be the
    live one or, on a cached reading, the last one there was. Either anchors the
    sequence; the page walks it forward from `windowEnd`.
    """
    votes: dict[str, dict[str, int]] = {}
    labels: dict[str, dict[str, int]] = {}
    ends: dict[str, list[str]] = {}
    now = now or datetime.now(timezone.utc)
    offering = [e for e in syndicate_missions or []
                if SYNDICATE_SECTION.get(e.get("syndicate")) and (e.get("jobs") or [])]

    for entry in _one_window(offering, now):
        sid = SYNDICATE_SECTION[entry["syndicate"]]
        for job in entry.get("jobs") or []:
            live = set(job.get("rewardPool") or [])
            levels = job.get("enemyLevels") or []
            label = official.rotation_letter(job.get("uniqueName"))
            if not levels:
                continue
            for group, rotations in (pools.get(sid) or {}).items():
                # The family comes from the levels and nothing else, which is
                # why it is settled before either method runs: the label states
                # the table and says nothing about whether this is a vault
                # bounty, and Deimos offers both at once.
                if official.group_levels(group) != list(levels):
                    continue
                fam = bounty_family(group)

                # Only a bounty publishing all three letters can name one, and
                # that gate is the *label's* too, not just the vote's. Level
                # 100-100 and Level 40-60 Cambion Drift publish table A alone,
                # so their path says `TableA` every hour of every day and means
                # only "this tier has one table" — read as a rotation letter it
                # is a confident answer to a question that was never asked. That
                # is five of twenty-one jobs on the reading this was written
                # against, enough to have swung a family had the split been
                # closer.
                if set(rotations) != set(SEQUENCE):
                    continue

                # Primary: the letter DE print on the job.
                if label:
                    labels.setdefault(fam, {})
                    labels[fam][label] = labels[fam].get(label, 0) + 1
                    if entry.get("expiry"):
                        ends.setdefault(fam, []).append(entry["expiry"])

                # Cross-check: match what is on offer against what each letter
                # pays. A single subset hit on a tier publishing two tables says
                # nothing about which letter is up, only that one of the two
                # happens to cover today's rewards - so ties abstain.
                if not live:
                    continue
                hits = [rot for rot, names in rotations.items() if live <= names]
                if len(hits) != 1:
                    continue                      # ambiguous: abstain
                votes.setdefault(fam, {})
                votes[fam][hits[0]] = votes[fam].get(hits[0], 0) + 1
                if not label and entry.get("expiry"):
                    ends.setdefault(fam, []).append(entry["expiry"])

    def top(tally):
        return max(tally, key=lambda k: (tally[k], k)) if tally else None

    families = {}
    for fam in sorted(set(labels) | set(votes)):
        label_tally, vote_tally = labels.get(fam) or {}, votes.get(fam) or {}
        from_label, from_vote = top(label_tally), top(vote_tally)
        letter = from_label or from_vote
        if letter is None:
            continue
        tally = label_tally if from_label else vote_tally
        families[fam] = {
            "letter": letter,
            # when this letter stops being the live one; the page counts down to
            # it and walks the sequence forward from there
            "windowEnd": min(ends[fam]) if ends.get(fam) else None,
            "votes": tally[letter],
            "of": sum(tally.values()),
            # Which method answered, and whether the other agreed. Two
            # independent readings that agree is worth more than either alone;
            # the interesting case is the day they stop agreeing, and that is
            # what the page raises a banner about rather than quietly averaging.
            "from": "label" if from_label else "vote",
            # Two cross-checks, because which one is available depends on where
            # the feed came from. The WFCD proxy resolves each job's reward table
            # into names, so the vote can run and check the label against a
            # genuinely independent reading. DE publish the table path and no
            # names, so on first-party data the vote has nothing to work from —
            # and resolving the path back into a pool would be circular, since
            # the pool would be derived from the letter it is meant to check.
            #
            # What remains on DE data is still a real check: the jobs in one
            # window should all name the same letter. A renamed table or a
            # changed sequence moves most of them at once, which fails a
            # majority; a single odd job does not, and there is one — see the
            # Cambion Drift entry in `TODO.md`. Majority rather than unanimity
            # for exactly that reason, and no invented fraction beyond it.
            "crossCheck": (
                {"vote": from_vote, "agrees": from_vote == from_label}
                if from_label and from_vote else
                {"agreed": tally.get(letter, 0), "of": sum(tally.values()),
                 "agrees": tally.get(letter, 0) * 2 > sum(tally.values())}
                if from_label else None),
        }
    return families


def find_live_events(events: list, syndicate_missions: list) -> dict:
    """
    {event name: {activation, expiry}} for the ones the worldstate is carrying.

    Deliberately a keyword scan across both endpoints rather than a match on
    one known field. Neither event was running while this was written, so the
    exact shape DE gives them could not be observed, and a scan that looks in
    several places degrades to "not running" instead of to a crash. The window
    is emitted rather than a boolean so the page can expire it against its own
    clock - a build from three days ago still knows a purge ends tomorrow.
    """
    found: dict[str, dict] = {}

    def consider(name: str, blob: str, activation, expiry, tag=None, node=None) -> None:
        """
        `tag` is matched first where one is known, because it is a machine
        identifier and the blob is prose. Where none is known - which is both of
        our events, since neither has run yet - the scan decides and the tag is
        recorded anyway, so the first sighting turns a guess into a fact.
        """
        known = EVENT_TAGS.get(str(tag or ""))
        if known and known != name:
            return                       # DE named it, and named something else
        if not known and not EVENT_PATTERNS[name].search(blob):
            return
        if not expiry:
            return
        prev = found.get(name)
        if prev is None or (prev.get("expiry") or "") < expiry:
            row = {"activation": activation, "expiry": expiry}
            if tag:
                row["tag"] = str(tag)
            if node:
                row["node"] = str(node)
            found[name] = row

    for ev in events or []:
        blob = " ".join(str(ev.get(k) or "") for k in
                        ("description", "tooltip", "node", "tag", "name"))
        for name in EVENT_PATTERNS:
            consider(name, blob, ev.get("activation"), ev.get("expiry"),
                     ev.get("tag"), ev.get("node"))

    for entry in syndicate_missions or []:
        # a purge arrives as its own syndicate whose tag WFCD does not map, so
        # the raw name ("GhoulEmergenceSyndicate") comes through as-is
        blob = str(entry.get("syndicate") or "")
        if not (entry.get("jobs") or []):
            continue
        for name in EVENT_PATTERNS:
            consider(name, blob, entry.get("activation"), entry.get("expiry"))

    return found


_TIER_TABLE = re.compile(r"Tier(\w+?)Table(\w+?)Rewards")


def read_bounty_jobs(pools: dict, syndicate_missions, now: datetime | None = None) -> dict:
    """
    What the worldstate says about each bounty on offer, keyed by our own group
    names. `{group: {"letter": "A", "stages": 4, "minMR": 2}}`.

    This said `"type": "..."` until 2026-08-27 and was wrong for as long as it
    said it: the field was read here and never copied into the group row below,
    so no build has ever emitted one. Checked rather than assumed - 0 of 24
    groups carried a `type` in the live payload while 20 of 23 DE jobs carried a
    `jobType`.

    Two facts come out of this that nothing else can supply, and one that only
    confirms what we already knew:

      * **the rotation letter, per tier.** DE put it in each job's uniqueName -
        `…TierDTableARewards` - and Table<Y> IS the letter. Until now it was
        derived by matching today's reward pool against DE's static table, which
        works but only for a bounty publishing all three letters, and produces
        one answer for a whole family. The worldstate publishes it per tier, and
        the tiers genuinely disagree: read on 2026-08-24, every Ostron and
        Solaris tier was on C while three of the six Cambion Drift tiers were on
        A. One of those, `Level 30 - 40`, publishes only rotations A and B - so
        the family answer was naming a letter that bounty does not have.
      * **the stage count.** `standingStages` has one entry per stage, and its
        length is 3, 4 or 5 by tier - not the four `objectivesOf` assumed.
      * `enemyLevels`, which is the same answer as the group's own name and is
        used here only to join the two together.

    **The join needs all three parts of its key.** Section and levels alone are
    ambiguous: on the Cambion Drift, `Cleanse the Land` and `Isolation Vault
    Chamber B` are both fought at 30-40 under the same syndicate. The vault
    jobs carry a `VaultBounty` prefix in the uniqueName, which is what tells
    them apart - and which family a group belongs to we already know.
    """
    if not syndicate_missions:
        return {"jobs": {}, "windowEnd": None}

    live = {}
    ends = []
    for entry in _one_window(
            [e for e in syndicate_missions
             if SYNDICATE_SECTION.get(e.get("syndicate")) and (e.get("jobs") or [])],
            now or datetime.now(timezone.utc)):
        sid = SYNDICATE_SECTION[entry["syndicate"]]
        if entry.get("expiry"):
            ends.append(entry["expiry"])
        for job in entry.get("jobs") or []:
            name = job.get("uniqueName") or ""
            m = _TIER_TABLE.search(name)
            levels = job.get("enemyLevels") or []
            if not m or not levels:
                continue          # Narmer bounties carry no tier at all
            key = (sid, tuple(levels), "VaultBounty" in name)
            live[key] = {
                "letter": m.group(2).upper(),
                "stages": len(job.get("standingStages") or []) or None,
                "minMR": job.get("minMR"),
                # No `type`. It was carried here and dropped again three lines
                # below, where the group row copies `letter`, `stages` and
                # `minMR` and nothing else - so it never reached the payload and
                # the docstring above said it did. DE publish `jobType` as a
                # path identifier (`VenusHelpingJobResource`), not a name; the
                # readable version is WFCD's own mapping table, which needs the
                # owner's approval and a licence read before it could be used at
                # all. See `TODO.md`.
            }

    out = {}
    for sid, by_group in (pools or {}).items():
        for group in by_group:
            levels = official.group_levels(group)
            if not levels:
                continue
            rec = live.get((sid, tuple(levels), bounty_family(group) == "vault"))
            if rec:
                out[group] = dict(rec)
    # The board turns over for everybody at once, so this is one instant rather
    # than one per family. Carried separately from `families` because a
    # published letter needs an anchor to be walked forward from, and it should
    # not depend on the reward-matching having also succeeded.
    return {"jobs": out, "windowEnd": min(ends) if ends else None}


def build_bounty_meta(pools: dict, syndicate_missions, events, checked: bool,
                      now: datetime | None = None) -> dict:
    """The whole bounty block of the payload."""
    families = derive_bounty_rotation(pools, syndicate_missions, now) if checked else {}
    live = find_live_events(events, syndicate_missions) if checked else {}

    # Every bounty whose payout depends on the letter, with the letters it
    # actually publishes: a couple of tiers publish two rather than three, and
    # the page has to be able to tell "you want nothing in rotation C" apart
    # from "this bounty has no rotation C".
    read = (read_bounty_jobs(pools, syndicate_missions, now) if checked
            else {"jobs": {}, "windowEnd": None})
    jobs = read["jobs"]

    groups = {}
    for sid, by_group in (pools or {}).items():
        for group, rotations in by_group.items():
            if len(rotations) >= 2:
                row = {"family": bounty_family(group),
                       "rotations": "".join(sorted(rotations))}
                job = jobs.get(group)
                if job:
                    # The letter DE published for THIS tier, which outranks the
                    # family answer derived from reward matching - see
                    # read_bounty_jobs. Kept beside the family rather than
                    # replacing it, because a build that cannot reach the
                    # worldstate still has the derived one to fall back on.
                    if job.get("letter"):
                        row["letter"] = job["letter"]
                    if job.get("stages"):
                        row["stages"] = job["stages"]
                    if job.get("minMR"):
                        row["minMR"] = job["minMR"]
                groups[group] = row

    # How far each published letter is from the derived family answer. Two
    # independent methods disagreeing is worth saying out loud rather than
    # silently preferring one of them.
    checked_letters = [(g, r["letter"], families.get(r["family"], {}).get("letter"))
                       for g, r in groups.items() if r.get("letter")]
    disagreed = [g for g, pub, fam in checked_letters if fam and pub != fam]

    return {
        "cycleMinutes": CYCLE_MINUTES,
        "sequence": SEQUENCE,
        "checked": bool(checked),
        "families": families,
        "windowEnd": read["windowEnd"],
        "published": len(checked_letters),
        "disagreed": sorted(disagreed),
        "groups": groups,
        # every limited-time bounty we know of, with the window if it is running
        "events": {group: {"event": name, **(live.get(name) or {})}
                   for group, name in EVENT_BOUNTIES.items()},
    }


# --------------------------------------------------------------------------
# where relics can be cracked right now
# --------------------------------------------------------------------------
#
# Requiem is left out. Those fissures take Requiem relics, which come from Kuva
# Liches and carry no Prime parts, so a Requiem fissure is not somewhere this app
# can send anyone. Omnia stays, and is the one tier that fits anything: the wiki
# is explicit that it opens "Lith, Meso, Neo and Axi Relics (but not Requiem)",
# so it fits whatever you are holding.
#
# This list marks the ranking, it never scores it. A fissure moves every hour or
# two while the ranking is built from drop tables that move every few months, so
# letting it into the score would reshuffle the list hourly for a reason that
# has expired by the time anyone reads it.
FISSURE_TIERS = ("Lith", "Meso", "Neo", "Axi", "Omnia")


def build_fissures(raw, now: datetime) -> list:
    """
    The fissures still running, each carrying the moment it ends.

    Expiry is the whole point. A build is hours old by the time anyone reads it,
    so the page cannot be handed a list of fissures and told to trust it - it is
    handed the end time of each and drops the ones that have passed. That makes
    the list wrong only ever by omission, which is the safe direction: it can
    stop marking a node that is in fact still a fissure, but it cannot send
    anybody to one that stopped being one two hours ago.
    """
    out = []
    for entry in raw or []:
        tier = str(entry.get("tier") or "")
        if tier not in FISSURE_TIERS or not _is_live(entry, now):
            continue
        node = str(entry.get("node") or "").strip()
        if not node:
            continue
        out.append({
            "node": node,
            "tier": tier,
            # `mode` (the worldstate's missionType) used to be emitted here and
            # nothing ever read it - free-form third-party text sitting in the
            # shipped payload one template edit away from a sink, while `tier`
            # two lines up is refused unless it matches one of five literals.
            # If a badge ever wants to say "a Lith Defense fissure is running
            # here", bring it back through the same allowlist rather than
            # straight off the wire.
            "ends": _instant(entry.get("expiry")).isoformat(timespec="seconds"),
            # Steel Path, and the Railjack ones, which are their own missions
            # with their own tables rather than an overlay on a normal node
            "hard": bool(entry.get("isHard")),
            "storm": bool(entry.get("isStorm")),
        })
    order = {t: i for i, t in enumerate(FISSURE_TIERS)}
    out.sort(key=lambda f: (order[f["tier"]], f["hard"], f["storm"], f["ends"]))
    return out


# How old DE's worldstate may be, by its own `Time` stamp, and still count as a
# live first-party answer.
#
# Not invented: DE declare `Cache-Control: max-age=23` on it, and a successful
# fetch on 2026-08-28 returned a document 36 seconds old. The scheduled refresh
# runs every ten minutes. So fifteen leaves room for a slow build, a clock a
# little out, and a refresh that ran late, while still being far below the hour
# or two a fissure lasts — which is the thing this protects.
#
# It is a *detector*, not a request throttle. `still_fresh` honours DE's 23
# seconds and is what stops us asking too often; this decides whether what came
# back can be believed.
WORLDSTATE_MAX_AGE = 15 * 60


# How long the feed log keeps a build. One entry per build, and the ten-minute
# cron means about 144 a day — a few kilobytes, which is why this is a sidecar
# file rather than something the 2MB payload carries.
FEED_LOG_HOURS = 24

# Where a runner finds the log it is continuing. A fresh checkout has no `data/`
# and the ten-minute build writes no cache, so the previously **published** copy
# is the only place a CI build's own history survives. Overridable so a fork
# publishing elsewhere is not silently reading this one's numbers.
PUBLISHED_FEED_LOG = os.environ.get(
    "PRIMEHUNTER_FEED_LOG",
    "https://etheras.github.io/Warframe_Prime_Hunter/data/feed-log.json")


def read_feed_log(published_url: str | None) -> list:
    """
    The rolling record of which source answered, from wherever it survived.

    It cannot live in `.cache`: the ten-minute build restores that read-only and
    never writes one — deliberately, since saving it 144 times a day would evict
    everything else the repo keeps — so a cached log would miss 143 runs in 144.
    It lives in `data/feed-log.json`, deployed beside the payload, and each build
    picks up where the last one left off.

    Locally that is the copy on disk. On a runner the checkout has no `data/`, so
    the previously **published** file is fetched instead, which is the only place
    a CI build's own history exists. Best effort by design: a missing or
    unreachable log starts a new one rather than failing a build over
    bookkeeping.
    """
    local = os.path.join(DATA_DIR, "feed-log.json")
    if os.path.exists(local):
        try:
            with open(local, encoding="utf-8") as fh:
                rows = json.load(fh)
            if isinstance(rows, list):
                return rows
        except (OSError, ValueError):
            pass
    if not published_url:
        return []
    try:
        req = urllib.request.Request(published_url, headers={"User-Agent": UA})
        with urllib.request.urlopen(req, timeout=20) as resp:
            rows = json.loads(resp.read().decode("utf-8"))
        return rows if isinstance(rows, list) else []
    except Exception as exc:                    # noqa: BLE001 - never fatal
        log(f"  feed log: no previous copy ({exc})")
        return []


def trim_feed_log(rows: list, now: datetime) -> list:
    """The last `FEED_LOG_HOURS`, oldest first, and nothing that cannot be dated."""
    cutoff = now - timedelta(hours=FEED_LOG_HOURS)
    out = []
    for row in rows:
        if not isinstance(row, dict) or not row.get("at"):
            continue
        try:
            at = datetime.fromisoformat(str(row["at"]).replace("Z", "+00:00"))
        except ValueError:
            continue
        if at.tzinfo is None:
            at = at.replace(tzinfo=timezone.utc)
        if at >= cutoff:
            out.append(row)
    return sorted(out, key=lambda r: r["at"])


def from_chain(what, de_fresh, proxy, de_cached):
    """
    One live feed, from the best source that answers.

    **Digital Extremes, then WFCD, then our own cached copy. Always, in that
    order.** Owner's decision, 2026-08-28. A step is taken when the one before it
    errors or comes back empty, and nothing about the feed or the circumstances
    reorders it.

    Returns `(value, "worldstate" | "proxy" | "cache" | None)` so the caller can
    say which answered without deciding anything itself. It exists as one
    function rather than three copies because the guarantee is the *order*: three
    copies can be edited to disagree, and the disagreement would be invisible
    until the day a fallback was needed.

    The bug it fixes: `fetch` answers a failed refresh by handing back cached
    bytes, so a 403 from DE produced a *usable* worldstate and the proxy was
    never asked at all. The published site served 69-minute-old fissures while a
    fresh copy of the same document sat one request away. Hence `de_fresh` is
    given the worldstate only when it was really refreshed — a reused copy is not
    a first-party answer, it is the last resort wearing a first-party name.

    An exception from the proxy is a miss, exactly as an empty answer is: this
    is the fallback path, and a fallback that can raise is not a fallback.
    """
    value = de_fresh()
    if value:
        return value, "worldstate"
    try:
        value = proxy() or None
    except SystemExit:                        # `fetch` aborts a cold critical miss
        log(f"  proxy: {what} unavailable")
        value = None
    except Exception as exc:                  # noqa: BLE001 - any failure is a miss
        log(f"  proxy: {what} failed ({exc})")
        value = None
    if value:
        return value, "proxy"
    value = de_cached()
    if value:
        return value, "cache"
    return None, None


def main() -> int:
    ap = argparse.ArgumentParser(description="Build the Warframe Prime Hunter data payload.")
    ap.add_argument("--offline", action="store_true", help="rebuild from the HTTP cache only")
    ap.add_argument("--verbose", action="store_true", help="print join diagnostics")
    ap.add_argument("--source", choices=["official", "mirror"], default="official",
                    help="drop data source (default: official, mirror is the fallback)")
    ap.add_argument("--if-changed", action="store_true",
                    help="exit without rebuilding when no upstream has moved")
    ap.add_argument("--check", action="store_true",
                    help="report whether upstream changed, then exit; writes nothing")
    ap.add_argument("--with-images", action="store_true",
                    help="download item artwork into assets/img/ so the site needs "
                         "no CDN (about 14 MB). Only needed once - after that the "
                         "folder is kept up to date automatically")
    ap.add_argument("--no-images", action="store_true",
                    help="ignore assets/img/ this run and point the site at the CDN")
    ap.add_argument("--refresh-images", action="store_true",
                    help="also re-check artwork already on disk against the CDN "
                         "(adds about a minute; only needed if DE repaints an item)")
    ap.add_argument("--allow-degraded", action="store_true",
                    help="publish even if a source was unreachable with nothing cached "
                         "(default: refuse, so a cold failure never silently thins the site)")
    args = ap.parse_args()
    off = args.offline

    print("Warframe Prime Hunter data build")
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
            # This used to stop here, and for the heavy sources it still does:
            # everything below now comes out of the HTTP cache, which takes well
            # under a second and touches nobody's servers.
            #
            # It no longer stops entirely, because one source has certainly moved
            # - the fissure list always has, it turns over every hour or two -
            # and it is small enough to fetch on any schedule. So a scheduled run
            # that finds nothing new still costs one small request and a local
            # rebuild, and comes back with somewhere to crack relics tonight.
            log(f"no upstream changes since {state.get('built')} - "
                f"rebuilding from cache, with a fresh fissure list")
            off = True
        else:
            log("upstream changed: " + (", ".join(sorted(moved)) or "first run"))

    # ---- fetch -----------------------------------------------------------
    # Neither of these is fatal: the catalogue can be rebuilt from DE's export
    # and parts can be reconstructed from the drop table.
    log("wiki: Prime page")
    wiki_blob = fetch(WIKI_RAW.format(title="Prime"), "wiki_prime", off, critical=False)
    prime_wikitext = wiki_blob.decode("utf-8", "replace") if wiki_blob else None

    log("api: item database (name, image, vault state, components)")
    items_raw = fetch_json(ITEMS_API, "api_items", off, critical=False) or []

    # One document, several feeds. DE publish the whole worldstate in one place
    # and it is `max-age=28`, so it is fetched once here and read by everything
    # below that used to have its own endpoint on the proxy.
    log("worldstate: Digital Extremes' live worldstate")
    worldstate = fetch_json(WORLDSTATE, "de_worldstate", args.offline,
                            critical=False, optional=True, max_age=3 * 3600)

    # ── the source chain, and it is the same for every live feed ──────
    #
    # **Digital Extremes, then WFCD, then our own cached copy. Always, in that
    # order.** Owner's decision, 2026-08-28. Each step is taken when the one
    # before it errors or comes back empty; nothing about the feed or the
    # circumstances changes the order.
    #
    # The bug it fixes: `fetch` answers a failed refresh by handing back the
    # cached bytes, so a 403 from DE produced a *usable* worldstate and the
    # proxy was never asked. The published site served 69-minute-old fissures
    # while a fresh copy of the same document sat unused one request away. DE
    # sit behind Akamai, which refuses datacentre address ranges, so CI draws a
    # 403 intermittently and there is nothing to change about the request — see
    # `TODO.md`. This is the part that was ours to fix.
    #
    # So a reused copy is deliberately NOT treated as a first-party answer: the
    # feeds ask the proxy first and fall back to it only if that fails too.
    #
    # Staleness is judged on the **content**, not only on the transport. `fetch`
    # knows whether the request failed; it cannot know that an edge served a
    # stale object behind a `200`, and DE sit behind Akamai where that shape is
    # not hypothetical. So DE's own `Time` stamp is read as well: measured
    # 2026-08-28, a healthy answer is **36 seconds** old against a declared
    # `Cache-Control: max-age=23`, so an hour-old document has been through
    # something whatever the status code said.
    ws_age = official.worldstate_age(worldstate or {})
    ws_too_old = ws_age is not None and ws_age > WORLDSTATE_MAX_AGE
    ws_stale = "de_worldstate" in STALE or ws_too_old
    ws_fresh = {} if ws_stale else (worldstate or {})
    ws_cached = worldstate or {}
    if ws_too_old:
        log(f"~ worldstate: Digital Extremes stamped it {int(ws_age // 60)} min ago,"
            f" which is past the {WORLDSTATE_MAX_AGE // 60} min it can be and still"
            f" be live — treating it as a cached copy")
        if "de_worldstate" not in STALE:
            STALE.append("de_worldstate")
            STALE_AGE.setdefault("de_worldstate", time.time() - ws_age)
    if ws_stale:
        log("  worldstate: the copy is reused, so the proxy is asked before it")
    # Set only when a feed actually falls back to the cached copy. Without it
    # the banner would report staleness the payload does not contain — the
    # proxy having answered means the data IS current, whatever `fetch` had to
    # do to discover that.
    fell_back_to_cache = False
    # Which source actually answered each live feed, carried on the payload.
    #
    # The build log has said this since the chain shipped, and a log nobody reads
    # is not monitoring: the 403 only happens on the runner, so the one place the
    # answer matters is the published artefact, and that is where this puts it.
    # `curl …/data/prime-data.js | head` now says whether the deployed site is on
    # first-party data, without anyone opening a CI log.
    feed_source: dict[str, str] = {}

    log("api: Varzia / vault trader (live Prime Resurgence rotation)")
    vault_trader, src = from_chain(
        "vault trader",
        lambda: official.vault_trader_from_worldstate(ws_fresh),
        lambda: fetch_json(VAULT_TRADER, "api_vaulttrader", off,
                           critical=False, optional=True),
        lambda: official.vault_trader_from_worldstate(ws_cached))
    feed_source["vaultTrader"] = src or "none"
    if src == "worldstate":
        log(f"  worldstate: Varzia is selling {len(vault_trader['inventory'])} packs")
    elif src == "proxy":
        log("  proxy: Varzia read from WFCD")
    elif src == "cache":
        fell_back_to_cache = True
        log("  cache: Varzia from our copy of DE's worldstate")
    else:
        log("! vault trader unavailable - Resurgence flags will be empty")
        vault_trader = {}

    # Optional on purpose: without these the planner says the bounty rotation is
    # unknown and treats the limited-time bounties as not running, which is a
    # smaller loss than refusing to publish a catalogue that is otherwise whole.
    log("api: bounties on offer + world events (live rotation, Ghoul, Plague Star)")
    # The boards decide which source answers; the events then come from that same
    # source, so a build cannot mix bounties from one hour with events from
    # another and present them as one board.
    syndicate_missions, src = from_chain(
        "bounty boards",
        lambda: official.syndicate_missions_from_worldstate(ws_fresh),
        lambda: fetch_json(SYNDICATE_MISSIONS, "api_syndicatemissions",
                           off, critical=False, optional=True),
        lambda: official.syndicate_missions_from_worldstate(ws_cached))
    feed_source["bounties"] = src or "none"
    if src == "worldstate":
        world_events = official.events_from_worldstate(ws_fresh)
        jobs = sum(len(s["jobs"]) for s in syndicate_missions)
        log(f"  worldstate: {jobs} bounties across {len(syndicate_missions)} boards"
            f" (DE publish this window and the next), {len(world_events)} live event(s)")
    elif src == "proxy":
        world_events = fetch_json(WORLD_EVENTS, "api_events", off,
                                  critical=False, optional=True) or []
        log(f"  proxy: {len(syndicate_missions)} boards read from WFCD")
    elif src == "cache":
        fell_back_to_cache = True
        world_events = official.events_from_worldstate(ws_cached)
        log("  cache: bounty boards from our copy of DE's worldstate")
    else:
        syndicate_missions, world_events = [], []
        log("  bounty boards unavailable - the rotation will read unknown")

    # Fetched live even when everything else is coming from the cache, because
    # this is the one source where a cached copy is worth nothing: every entry
    # in it will have expired. `args.offline` rather than `off` for exactly that
    # reason - only an explicit --offline settles for yesterday's fissures.
    # `max_age`: a fissure lasts an hour or two, so a list that has not changed
    # in three is a broken feed rather than a quiet evening. Without it a `304`
    # from a CDN sitting in front of a failing origin reads as good news, and
    # this shipped a three-day-old empty list for three days without a word —
    # `stale_if_older` carries the measurement.
    log("export: DE public item manifest")
    export_primes, node_levels, export_hash, export_extra = acquire_export(off)
    textures = export_extra.get("textures") or {}
    # What each Prime is built from, in DE's own numbers. Empty when the export
    # index could not be read, which falls the parts back to the item API rather
    # than emptying them - the same safe direction the rest of this file takes.
    de_part_specs = export_extra.get("partSpecs") or {}
    log(f"  parts: DE publish a recipe for {len(de_part_specs)} of "
        f"{len(export_primes)} Primes")

    # Normalised here rather than beside the fetch, because naming a node needs
    # DE's region export and that arrives on the line above. First party first:
    # the worldstate is DE's own, and the proxy is asked only if it gave us
    # nothing usable.
    def named_fissures(doc):
        """DE's rows, minus the ones there is no name for."""
        rows = official.fissures_from_worldstate(doc, export_extra.get("nodeNames") or {})
        return [f for f in rows if f.get("node")], len(rows)

    # The proxy normalises the same document and can name the Proxima nodes DE's
    # export omits. Asked before the cached copy, never after it: every entry in
    # an hour-old fissure list is closer to expiring than the list admits, and
    # this is the feed where that costs the most.
    fissures_raw, src = from_chain(
        "fissures",
        lambda: named_fissures(ws_fresh)[0],
        lambda: fetch_json(FISSURES, "api_fissures", args.offline,
                           critical=False, optional=True, max_age=3 * 3600),
        lambda: named_fissures(ws_cached)[0])
    feed_source["fissures"] = src or "none"
    if src == "worldstate":
        # Storms are dropped rather than mourned: DE publish no CrewBattleNode
        # row in their region export, so there is no name to give them. Say how
        # many went, because a shorter list with no explanation is how a broken
        # feed looks exactly like a quiet evening.
        lost = named_fissures(ws_fresh)[1] - len(fissures_raw)
        log(f"  worldstate: {len(fissures_raw)} fissures from Digital Extremes"
            + (f", {lost} Railjack storm(s) unnamed and dropped" if lost else ""))
    elif src == "proxy":
        log(f"  proxy: {len(fissures_raw)} fissures read from WFCD")
    elif src == "cache":
        fell_back_to_cache = True
        log(f"  cache: {len(fissures_raw)} fissures from our copy of DE's worldstate")
    else:
        fissures_raw = []
        log("  fissures unavailable - the list will be empty")

    # The banner reports what reached the payload, not what `fetch` had to try.
    # If DE refused and the proxy answered, the live feeds ARE current and
    # saying otherwise would be a second wrong claim in the other direction —
    # readers would be told to distrust data that is fine. The reused copy is
    # only news when something was actually built from it.
    #
    # `not args.offline` matters: with no network the proxy is served from cache
    # too, so "the proxy answered" is not evidence of anything being current. An
    # offline build that cleared this would claim freshness it cannot have —
    # which is the same wrong-in-the-other-direction mistake, made by the code
    # that exists to prevent it.
    log("  feeds: " + ", ".join(f"{k} from {v}" for k, v in sorted(feed_source.items())))

    # ── the rolling record ────────────────────────────────────────────
    # `meta.feeds` says what happened on THIS build and is overwritten by the
    # next one, so it answers "is the site on first-party data right now" and
    # cannot answer "how often does DE actually reply". The owner asked for the
    # second, which needs a history, so one entry is appended per build and the
    # last 24 hours are kept.
    #
    # `de` is what Digital Extremes did, separately from what the site ended up
    # using: a 403 that the proxy covered leaves the payload current and is still
    # a refusal, and conflating those is how the first "intermittent" reading
    # went wrong.
    #
    # `offline` is its own outcome and not `ok`. An `--offline` build never asks
    # DE, so counting it as a reply would inflate the very number this log exists
    # to answer — and locally that is most builds. It stays in the record rather
    # than being dropped, because "no request was made" is different news from
    # "no build ran".
    de_outcome = ("offline" if args.offline
                  else "stale" if ws_too_old
                  else "refused" if "de_worldstate" in STALE
                  else "ok")
    built_at = datetime.now(timezone.utc)
    feed_log = trim_feed_log(read_feed_log(PUBLISHED_FEED_LOG), built_at)
    feed_log.append({
        "at": built_at.replace(microsecond=0).isoformat().replace("+00:00", "Z"),
        "de": de_outcome,
        "used": dict(sorted(feed_source.items())),
        "full": not args.if_changed,
    })
    tally = collections.Counter(r.get("de") for r in feed_log)
    log(f"  feed log: {len(feed_log)} build(s) in {FEED_LOG_HOURS}h — "
        + ", ".join(f"{n} {k}" for k, n in sorted(tally.items())))
    if ws_stale and not fell_back_to_cache and not args.offline:
        while "de_worldstate" in STALE:
            STALE.remove("de_worldstate")
        STALE_AGE.pop("de_worldstate", None)
        log("  worldstate: DE refused, the proxy answered — the feeds are current")

    relic_contents, relic_sources, drop_source, aya_sources, rotation_pools = \
        acquire_drops(off, args.source, args.verbose)

    # Tag what cannot be entered today, so the planner can leave it out while
    # the collection view still says where a relic comes from.
    access = tag_access(relic_sources, aya_sources)
    if access:
        log("access: " + ", ".join(f"{n} row(s) {k}" for k, n in sorted(access.items())))

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

    varzia_relics = build_varzia_relics(items_raw, vault_trader)
    if varzia_relics:
        log(f"  shelf: {len(varzia_relics)} relics — {', '.join(sorted(varzia_relics))}")
    else:
        # Said out loud rather than quietly falling back to the per-Prime guess
        # that produced 88 of them. No shelf means the crack list is empty and
        # these Primes answer as trade-only, which is true and is not a silent
        # wrong claim - see PROJECT.md.
        log("  shelf: EMPTY — no relic rotation tag matched Varzia's packs. "
            "Either DE renamed the convention or the item database is stale; "
            "Prime Resurgence relics will not be offered this build.")

    bounties = build_bounty_meta(rotation_pools, syndicate_missions, world_events,
                                 checked=bool(rotation_pools and syndicate_missions))
    if bounties["families"]:
        for fam, f in sorted(bounties["families"].items()):
            log(f"bounties: {fam} on rotation {f['letter']} "
                f"({f['votes']}/{f['of']} bounties agree, until {f['windowEnd']})")
    else:
        log("! bounties: the live rotation could not be read - the planner will "
            "say so rather than guess")
    running = sorted({e["event"] for e in bounties["events"].values() if e.get("expiry")})
    log(f"bounties: limited-time events running - {', '.join(running) or 'none'}")
    # Said out loud because it is the one fact about these events nobody has
    # been able to observe: add it to EVENT_TAGS and the keyword scan stops
    # being how they are found.
    for e in bounties["events"].values():
        if e.get("expiry") and e.get("tag") and e["tag"] not in EVENT_TAGS:
            log(f"bounties: ! {e['event']} is running and DE tag it '{e['tag']}' "
                f"- add that to EVENT_TAGS in tools/build_data.py")

    if bounties.get("published"):
        log(f"bounties: DE publish the letter for {bounties['published']} of "
            f"{len(bounties['groups'])} tiers"
            + (f"; {len(bounties['disagreed'])} disagree with the derived family "
               f"answer ({', '.join(bounties['disagreed'])})"
               if bounties.get("disagreed") else "; all agree with the derived answer"))

    used_relics: set[str] = set()
    out_items: list[dict] = []
    skipped_non_relic = 0
    unmatched: list[str] = []
    seen_ids: set[str] = set()
    # Which catalogue Prime a component name refers to, if it refers to one at
    # all - see the sub-item fold below. Built once rather than per component.
    catalog_by_norm = {norm(n): n for n in catalog_names}

    for entry in catalog:
        name = entry["name"]
        api = by_name.get(norm(NAME_ALIASES.get(name, name))) or by_name.get(norm(name))
        if api is None:
            unmatched.append(name)

        # components -> relics
        #
        # The component list, the quantities and the ducat values are Digital
        # Extremes' own, from `ExportRecipes_en.json` and `ExportResources_en.json`
        # — see `official.prime_part_specs`. What still comes from the item API
        # is each component's `drops`, which is the relic link and is a separate
        # question from what a Prime is made of.
        #
        # Verified across the whole catalogue before it was switched over, not
        # spot-checked: 583 parts, every name, count and ducat value agreeing
        # with what the item API had been supplying, and no disagreements. So
        # this changes where the numbers come from and, on today's data, nothing
        # about what they are.
        #
        # Six Primes have no DE recipe and only one of them has parts — Kavasa
        # Prime Collar, which DE publish nothing about in any manifest. It keeps
        # the item API's list, which is the documented precedence rather than an
        # exception to it: first party for what DE publish, WFCD for what they
        # do not.
        wfcd_components = (api or {}).get("components") or []
        components = wfcd_components
        spec = de_part_specs.get(name)
        if spec:
            # `drops` borrowed from the matching item-API component, through the
            # same `normalise_part` funnel both spellings already go through —
            # the drop table says "Chassis Blueprint" where the API says
            # "Chassis", and a third spelling from DE has to meet the same fate
            # rather than route around it.
            drops_by_part = {}
            for comp in wfcd_components:
                drops_by_part.setdefault(normalise_part(comp.get("name")),
                                         comp.get("drops") or [])
            components = [{
                "name": p["name"],
                "itemCount": p["itemCount"],
                "ducats": p["ducats"],
                "drops": drops_by_part.get(normalise_part(p["name"]), []),
            } for p in spec]

        parts = []
        for comp in components:
            part_name = normalise_part(comp.get("name"))

            # A component that is itself a Prime in the catalogue is a whole
            # weapon, not a part of one: Aklex Prime is built from two Lex
            # Primes. DE publish that as the SAME component twice, one each,
            # and saved progress is keyed on the part name - so two entries
            # called "Lex Prime" share one slot, and the tracker cannot record
            # that you have one of the two. Three clicks completed a four-part
            # item. Fold the copies into one requirement and keep the count,
            # which the store already handles (Ivara Prime needs two of some
            # of hers).
            #
            # Its "drops" are dropped with it, and that is the other half of
            # the bug. DE list the union of every relic dropping any Lex Prime
            # PART - 130 of them - and none of those relics drops a built
            # weapon, so no odds can be attached to any of them (the lookup
            # below searches for "Aklex Prime …" and the relic pays "Lex Prime
            # Barrel"). Carried through, that union made Aklex Prime the only
            # item in the payload flagged farmable on eight relics it could do
            # nothing with, and its card offered nowhere to farm.
            sub = catalog_by_norm.get(norm(part_name))
            if sub and norm(sub) != norm(name):
                prev = next((p for p in parts if p["name"] == part_name), None)
                if prev:
                    prev["itemCount"] = ((prev["itemCount"] or 1)
                                         + (as_int(comp.get("itemCount"), 1) or 1))
                    continue
                parts.append({
                    "name": part_name,
                    "itemCount": as_int(comp.get("itemCount"), 1) or 1,
                    "ducats": as_int(comp.get("ducats")),
                    # the catalogue name to send the reader to. Names, not ids:
                    # an id is minted further down this loop and the sub-item
                    # may not have reached it yet, while names are the
                    # catalogue's own key.
                    "builtFrom": sub,
                    "relics": [],
                })
                continue

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
                "name": part_name,
                "itemCount": as_int(comp.get("itemCount")),
                # What Baro pays for a spare. A fixed game constant, published
                # per component in the item database, so it needs no guessing -
                # a duplicate Blueprint is 15 ducats whoever you ask. Which is
                # exactly why it was trusted to be a number and was not one.
                "ducats": as_int(comp.get("ducats")),
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

        # nothing here can come from a relic - see NON_RELIC_CATEGORIES

        if entry["category"] in NON_RELIC_CATEGORIES:

            skipped_non_relic += 1

            continue


        wf = entry["wikiFlags"]
        image = image_for(api, textures)
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
            "image": image,
            "wikiUrl": "https://wiki.warframe.com/w/" + entry["wikiPage"],
            "masteryReq": as_int((api or {}).get("masteryReq")),
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
    wiki_keys: set[str] = set()
    for it in out_items:
        if not it["flags"]["special"]:
            continue
        page = it["wikiUrl"].rsplit("/", 1)[-1]
        wiki_keys.add(f"wiki_{page}")
        blob = fetch(WIKI_RAW.format(title=page), f"wiki_{page}", off, critical=False)
        if blob:
            summary = acquisition_summary(blob.decode("utf-8", "replace").replace("\xa0", " "))
            if summary:
                it["acquisition"] = summary
    # a Prime that leaves the catalogue leaves its wiki page cached behind it
    sources.prune_cache(wiki_keys)

    if aya_sources:
        log(f"aya            {len(aya_sources)} drop rows across "
            f"{len({(a['planet'], a['node']) for a in aya_sources})} nodes")
    if skipped_non_relic:
        log(f"skipped        {skipped_non_relic} non-relic entries "
            f"({', '.join(sorted(NON_RELIC_CATEGORIES))})")
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
        """
        Tag sources with the enemy levels they are fought at, where they exist.

        Two routes, because DE publish them two ways. Star-chart nodes are in
        the public export, joined on planet and node name. Bounties are not in
        the export at all - and do not need to be, because DE put the levels in
        the name: `Level 20 - 40 Cetus Bounty` is a bounty fought at 20-40.

        All 13 bounty nodes carried `lvl: null` until 2026-08-24, so a bounty
        lost every level tie-break in the ranking by default - it sorted as
        `Infinity` against real numbers. The worldstate publishes `enemyLevels`
        per tier too, which is the same answer down a second route; the name is
        used because it needs no network and works on a mirror build.
        """
        out = []
        for s0 in srcs:
            row = dict(s0)
            if row.get("kind") == "mission":
                planet = re.sub(r"^Event:\s*", "", row.get("planet") or "").strip()
                lv = node_levels.get(f"{planet}/{row.get('node')}")
                if lv:
                    row["lvl"] = lv
            elif row.get("kind") == "bounty":
                lv = official.group_levels(row.get("node") or "")
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
            # Varzia stocks the current Prime Resurgence rotation, and one Aya
            # buys one relic there. So this marks the relics an Aya can actually
            # be spent on - which is what makes an Aya drop worth anything.
            #
            # Her shelf, read off DE's own relic naming - see
            # `build_varzia_relics`. This was a per-Prime guess until
            # 2026-08-27: any relic holding a part of an offered Prime counted,
            # which marked 88 where she was selling 6.
            "resurgence": rname in varzia_relics,
        }

    categories = []
    for cat in CATEGORY_ORDER:
        count = sum(1 for i in out_items if i["category"] == cat)
        if count:
            categories.append({"name": cat, "count": count})
    for cat in sorted({i["category"] for i in out_items} - set(CATEGORY_ORDER)):
        categories.append({"name": cat, "count": sum(1 for i in out_items if i["category"] == cat)})

    # Opt in once with --with-images; after that the folder's existence is the
    # switch, so forgetting the flag cannot silently send the site back to the
    # CDN while 14 MB of local copies sit unused.
    want_images = (not args.no_images
                   and (args.with_images or artwork.have_local_images()))
    local_images = (cache_images(out_items, off, verify=args.refresh_images)
                    if want_images else 0)

    # Every distinct place the artwork on THIS payload is actually loaded from,
    # read off the items after `cache_images` has repointed whatever it took
    # local. `image_for` chooses per item - DE's content.warframe.com wherever
    # their texture manifest answered, WFCD's CDN where it did not - so a build
    # can genuinely use both, and the privacy sentence on the page is only
    # honest if it is derived from this rather than from which host was
    # preferred. Origin only: a path would name every file the reader loaded.
    image_hosts = sorted({
        "/".join(url.split("/")[:3]) if url.startswith("http") else "assets/img"
        for url in (str(it.get("image") or "") for it in out_items) if url
    })

    payload = {
        "meta": {
            "generated": datetime.now(timezone.utc).isoformat(timespec="seconds"),
            "itemCount": len(out_items),
            "relicCount": len(relics_out),
            "farmableRelicCount": sum(1 for r in relics_out.values() if not r["vaulted"]),
            "resurgence": resurgence_window,
            # Baro Ki'Teer's visit window. The collection view opens its Baro
            # filter only while he is actually on a relay, and it decides that
            # against its own clock rather than one frozen at build time.
            "baro": official.void_trader_from_worldstate(worldstate or {}),
            # which bounty rotation is live, and which limited-time bounties
            # exist at all today. A bounty run pays one rotation - the one the
            # clock says - so without this the planner counts rewards you
            # cannot collect. See build_bounty_meta.
            "bounties": bounties,
            "refinements": REFINEMENTS,
            "dropSource": drop_source,
            "newCount": len(fresh) if prime_wikitext else 0,
            # Which source answered each live feed: "worldstate" (Digital
            # Extremes), "proxy" (WFCD), "cache" (our copy of DE's worldstate),
            # or "none". The chain is DE -> WFCD -> cache and this is the record
            # of where it stopped.
            #
            # On the payload rather than only in the build log, because the
            # failure it reports happens on the GitHub runner and nowhere else —
            # DE 403 a datacentre address and answer this machine normally, so a
            # local build can never observe it. The deployed artefact is the only
            # place the answer is true of the site people read, and a log nobody
            # opens is not monitoring.
            "feeds": feed_source,
            # refresh failed but an older copy was reused — data is slightly behind
            "stale": sorted(set(STALE)),
            # When the oldest of those reused copies was actually written. The
            # banner said "an earlier copy is being shown" for a copy ten minutes
            # behind and for one ten days behind, which are not the same news.
            # Absent when nothing was reused.
            "staleSince": (
                datetime.fromtimestamp(min(STALE_AGE.values()), timezone.utc)
                .isoformat(timespec="seconds")
                if STALE_AGE else None
            ),
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
                "bounties": "https://api.warframestat.us/pc/syndicateMissions + /pc/events"
                            " (live worldstate)",
                "fissures": "https://api.warframestat.us/pc/fissures (live worldstate)",
                # What the artwork URLs on this payload ACTUALLY point at,
                # derived from the items after `cache_images` has had its say
                # rather than from which host was preferred. The old field was a
                # single string chosen by whether artwork is local, so it said
                # `cdn.warframestat.us` for every remote build - including the
                # normal one where DE answered for all 167 - and the site's own
                # privacy sentence named a host it never contacts. A build can
                # use both, and this is the field that can say so.
                "images": (", ".join(image_hosts) if image_hosts else "none"),
                "imageHosts": image_hosts,
            },
        },
        "categories": categories,
        "items": out_items,
        "relics": relics_out,
        # Where Aya drops. One Aya buys one relic of your choosing at Varzia,
        # so it is worth more than a random relic - but it is a currency, not a
        # reward, hence a flat list rather than anything keyed by item.
        "aya": normalise_sources({"Aya": aya_sources}).get("Aya", []),
        # Each carries its own end time, so the page can drop the ones that have
        # closed since the build. Shown, never scored - see build_fissures.
        "fissures": build_fissures(fissures_raw, datetime.now(timezone.utc)),
    }

    os.makedirs(DATA_DIR, exist_ok=True)
    json_path = os.path.join(DATA_DIR, "prime-data.json")
    js_path = os.path.join(DATA_DIR, "prime-data.js")

    blob = json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
    with open(json_path, "w", encoding="utf-8") as fh:
        fh.write(blob)
    with open(js_path, "w", encoding="utf-8") as fh:
        fh.write("/* generated by tools/build_data.py - do not edit by hand */\n")
        fh.write("window.WFPRIME_DATA = ")
        fh.write(blob)
        fh.write(";\n")

    # ---- the same fissures, on their own ---------------------------------
    # Ten kilobytes beside a 1.9 MB payload, and the only part of it with an
    # hour to live. An open page re-reads this every ten minutes and leaves the
    # catalogue alone, so a tab left open learns about a fissure that opened
    # after it loaded without downloading the other 99.5% again.
    #
    # Same origin, always: the page fetches this file from wherever it was
    # served, never api.warframestat.us. That keeps `connect-src 'self'` intact
    # and keeps the reader's address out of a third party's logs - the refresh
    # is the scheduled build's job, and this file is how its answer arrives.
    with open(os.path.join(DATA_DIR, "fissures.json"), "w", encoding="utf-8") as fh:
        json.dump({"generated": payload["meta"]["generated"],
                   "fissures": payload["fissures"]},
                  fh, ensure_ascii=False, separators=(",", ":"))

    # The rolling record of which source answered, one entry per build. A sidecar
    # rather than a field on the payload: 144 builds a day is a few kilobytes,
    # and the next build has to read it back — cheaply, without pulling 2MB to
    # find out what happened yesterday.
    # Atomically, because this is the one write here whose torn form is silent:
    # `read_feed_log` swallows OSError and ValueError, so half a file reads as
    # no file and the 24-hour record starts over. See `write_atomic`.
    write_atomic(os.path.join(DATA_DIR, "feed-log.json"),
                 json.dumps(feed_log, ensure_ascii=False, separators=(",", ":")))

    # remember what upstream looked like, so --if-changed can skip next time
    new_state = {
        "built": payload["meta"]["generated"],
        "signature": upstream_signature(off) if not off else (state.get("signature") or {}),
        "exportHash": export_hash,
        "dropSource": drop_source,
    }
    # compares against the roster the *last* build left behind
    write_changelog(out_items, relics_out, state, new_state)
    save_state(new_state)

    # ---- report ----------------------------------------------------------
    print("-" * 60)
    wf_count = sum(1 for i in out_items if i["category"] == "Warframe")
    with_farm = sum(1 for i in out_items if i["flags"]["farmable"])
    log(f"items          {len(out_items)}  ({wf_count} Warframes)")
    log(f"relics kept    {len(relics_out)}  ({payload['meta']['farmableRelicCount']} farmable)")
    log(f"farmable items {with_farm}")
    log(f"resurgence     {sum(1 for i in out_items if i['flags']['resurgence'])}")
    fis = payload["fissures"]
    log(f"fissures       {len(fis)} running"
        + (f", next closes {min(f['ends'] for f in fis)[11:16]}Z" if fis
           else " (none, or unreachable)"))
    log(f"wrote          data/prime-data.js  ({len(blob)/1024/1024:.2f} MB)")

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
