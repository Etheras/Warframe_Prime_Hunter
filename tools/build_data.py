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
import hashlib
import json
import os
import re
import sys
from datetime import datetime, timezone

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
                     DROP_FILES, EXPORT_MANIFEST, EXPORT_WANTED, IMG_CDN, ITEMS_API,
                     MISSING, OFFICIAL_DROPTABLES, ROOT, STALE, SYNDICATE_MISSIONS,
                     VAULT_TRADER, WORLD_EVENTS, WIKI_RAW, fetch, fetch_json, head,
                     load_state, log, save_state, upstream_signature)
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
        elif "PROFIT-TAKER" in node.upper():
            # a multi-phase heist with a one-time first completion; the model
            # has no way to express either, so it is hidden until it does
            access = "unmodelled"
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
    ends: dict[str, list[str]] = {}
    now = now or datetime.now(timezone.utc)
    offering = [e for e in syndicate_missions or []
                if SYNDICATE_SECTION.get(e.get("syndicate")) and (e.get("jobs") or [])]

    for entry in _one_window(offering, now):
        sid = SYNDICATE_SECTION[entry["syndicate"]]
        for job in entry.get("jobs") or []:
            live = set(job.get("rewardPool") or [])
            levels = job.get("enemyLevels") or []
            if not live or not levels:
                continue
            for group, rotations in (pools.get(sid) or {}).items():
                # Only a bounty publishing all three letters can distinguish
                # them. A couple of tiers publish two - Level 30-40 Cambion
                # Drift is one - and there a single subset hit says nothing
                # about which letter is up, only that one of the two tables it
                # does publish happens to cover today's rewards.
                if set(rotations) != set(SEQUENCE):
                    continue
                if official.group_levels(group) != list(levels):
                    continue
                hits = [rot for rot, names in rotations.items() if live <= names]
                if len(hits) != 1:
                    continue                      # ambiguous: abstain
                fam = bounty_family(group)
                votes.setdefault(fam, {})
                votes[fam][hits[0]] = votes[fam].get(hits[0], 0) + 1
                if entry.get("expiry"):
                    ends.setdefault(fam, []).append(entry["expiry"])

    families = {}
    for fam, tally in votes.items():
        letter = max(tally, key=lambda k: (tally[k], k))
        families[fam] = {
            "letter": letter,
            # when this letter stops being the live one; the page counts down to
            # it and walks the sequence forward from there
            "windowEnd": min(ends[fam]) if ends.get(fam) else None,
            "votes": tally[letter],
            "of": sum(tally.values()),
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

    def consider(name: str, blob: str, activation, expiry) -> None:
        if not expiry or not EVENT_PATTERNS[name].search(blob):
            return
        prev = found.get(name)
        if prev is None or (prev.get("expiry") or "") < expiry:
            found[name] = {"activation": activation, "expiry": expiry}

    for ev in events or []:
        blob = " ".join(str(ev.get(k) or "") for k in
                        ("description", "tooltip", "node", "tag", "name"))
        for name in EVENT_PATTERNS:
            consider(name, blob, ev.get("activation"), ev.get("expiry"))

    for entry in syndicate_missions or []:
        # a purge arrives as its own syndicate whose tag WFCD does not map, so
        # the raw name ("GhoulEmergenceSyndicate") comes through as-is
        blob = str(entry.get("syndicate") or "")
        if not (entry.get("jobs") or []):
            continue
        for name in EVENT_PATTERNS:
            consider(name, blob, entry.get("activation"), entry.get("expiry"))

    return found


def build_bounty_meta(pools: dict, syndicate_missions, events, checked: bool,
                      now: datetime | None = None) -> dict:
    """The whole bounty block of the payload."""
    families = derive_bounty_rotation(pools, syndicate_missions, now) if checked else {}
    live = find_live_events(events, syndicate_missions) if checked else {}

    # Every bounty whose payout depends on the letter, with the letters it
    # actually publishes: a couple of tiers publish two rather than three, and
    # the page has to be able to tell "you want nothing in rotation C" apart
    # from "this bounty has no rotation C".
    groups = {}
    for sid, by_group in (pools or {}).items():
        for group, rotations in by_group.items():
            if len(rotations) >= 2:
                groups[group] = {"family": bounty_family(group),
                                 "rotations": "".join(sorted(rotations))}

    return {
        "cycleMinutes": CYCLE_MINUTES,
        "sequence": SEQUENCE,
        "checked": bool(checked),
        "families": families,
        "groups": groups,
        # every limited-time bounty we know of, with the window if it is running
        "events": {group: {"event": name, **(live.get(name) or {})}
                   for group, name in EVENT_BOUNTIES.items()},
    }


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

    # Optional on purpose: without these the planner says the bounty rotation is
    # unknown and treats the limited-time bounties as not running, which is a
    # smaller loss than refusing to publish a catalogue that is otherwise whole.
    log("api: bounties on offer + world events (live rotation, Ghoul, Plague Star)")
    syndicate_missions = fetch_json(SYNDICATE_MISSIONS, "api_syndicatemissions",
                                    off, critical=False, optional=True)
    world_events = fetch_json(WORLD_EVENTS, "api_events", off,
                              critical=False, optional=True)

    log("export: DE public item manifest")
    export_primes, node_levels, export_hash = acquire_export(off)

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

    used_relics: set[str] = set()
    out_items: list[dict] = []
    skipped_non_relic = 0
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
                # What Baro pays for a spare. A fixed game constant, published
                # per component in the item database, so it needs no guessing -
                # a duplicate Blueprint is 15 ducats whoever you ask.
                "ducats": comp.get("ducats"),
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
            # Varzia stocks the current Prime Resurgence rotation, and one Aya
            # buys one relic there. So this marks the relics an Aya can actually
            # be spent on - which is what makes an Aya drop worth anything.
            "resurgence": any(
                any(rw.startswith(n) for n in resurgence)
                for rw in (content.get("rewards") or {})
            ),
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

    payload = {
        "meta": {
            "generated": datetime.now(timezone.utc).isoformat(timespec="seconds"),
            "itemCount": len(out_items),
            "relicCount": len(relics_out),
            "farmableRelicCount": sum(1 for r in relics_out.values() if not r["vaulted"]),
            "resurgence": resurgence_window,
            # which bounty rotation is live, and which limited-time bounties
            # exist at all today. A bounty run pays one rotation - the one the
            # clock says - so without this the planner counts rewards you
            # cannot collect. See build_bounty_meta.
            "bounties": bounties,
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
                "bounties": "https://api.warframestat.us/pc/syndicateMissions + /pc/events"
                            " (live worldstate)",
                "images": ("assets/img (local copies; nothing fetched at runtime)"
                           if local_images else "https://cdn.warframestat.us/img"),
            },
        },
        "categories": categories,
        "items": out_items,
        "relics": relics_out,
        # Where Aya drops. One Aya buys one relic of your choosing at Varzia,
        # so it is worth more than a random relic - but it is a currency, not a
        # reward, hence a flat list rather than anything keyed by item.
        "aya": normalise_sources({"Aya": aya_sources}).get("Aya", []),
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
