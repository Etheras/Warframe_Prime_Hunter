#!/usr/bin/env python3
"""
Prime Hunter's test suite. Standard library only, like everything else here.

    python tests/test_build.py            # everything that needs no network
    python tests/test_build.py --online   # adds the real clone-and-build test

Three kinds of test live here.

*Unit tests* exercise the parsers and the join against fixtures held in this
file, so they run in about a second and need nothing external.

*Integration tests* run the actual pipeline. The important one clones the repo
into a temporary directory and builds from scratch, because that is the path a
new user takes and the one nothing else covers -- every other check runs against
a working tree that already has a warm cache. It needs the network, so it only
runs with --online.

*Browser tests* cover the JavaScript, which is where the rotation model lives
and which nothing checked until two of its bugs reached a browser. They are in
tests/test_assets.mjs and run under Node's own test runner, folded into the
output here so there is still one command to run. Node is optional -- Prime Hunter
itself never needs it -- so they are skipped where it is not installed.

Every test here exists because of a bug that actually happened. The comment on
each says which.
"""

from __future__ import annotations

import collections
import datetime
import functools
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import time
import traceback
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "tools"))

import build_data  # noqa: E402
import catalogue  # noqa: E402
import guard_shell_writes  # noqa: E402
import limits  # noqa: E402
import official  # noqa: E402
import relics  # noqa: E402
import sources  # noqa: E402

# Read and close, rather than relying on the garbage collector to get round to
# it. `python -X dev` reports every one of these as a ResourceWarning, and a
# test suite that leaks handles is a poor advert for the code it checks.
def read_text(path: str) -> str:
    with open(path, encoding="utf-8") as fh:
        return fh.read()


def read_bytes(path: str) -> bytes:
    with open(path, "rb") as fh:
        return fh.read()


def read_json(path: str):
    with open(path, encoding="utf-8") as fh:
        return json.load(fh)


FAILURES: list[tuple[str, str]] = []
PASSED = 0


def check(name: str, got, want, why: str = "") -> None:
    global PASSED
    if got == want:
        PASSED += 1
        print(f"  ok   {name}")
    else:
        FAILURES.append((name, f"got {got!r}, wanted {want!r}" + (f"\n       {why}" if why else "")))
        print(f"  FAIL {name}: got {got!r}, wanted {want!r}")


def check_true(name: str, cond, why: str = "") -> None:
    check(name, bool(cond), True, why)


# ─────────────────────────────────────────────────────────────────────────────
# parsers
# ─────────────────────────────────────────────────────────────────────────────

def test_rarity_from_intact() -> None:
    """
    DE's own rarity words are relative to the refinement shown, so every reward
    came back "Uncommon" when we trusted them. Rarity is derived from the
    unrefined chance instead.
    """
    check("rarity: 25.33% is Common", official.rarity_from_intact(25.33), "Common")
    check("rarity: 11% is Uncommon", official.rarity_from_intact(11.0), "Uncommon")
    check("rarity: 2% is Rare", official.rarity_from_intact(2.0), "Rare")
    check("rarity: 20% boundary is Common", official.rarity_from_intact(20.0), "Common")
    check("rarity: 6% boundary is Uncommon", official.rarity_from_intact(6.0), "Uncommon")


def test_split_rate() -> None:
    """
    DE writes "Ultra Rare (0.10%)" as well as the four standard words. Enumerating
    the words missed it and produced 79 null chances that rendered as "null%".
    The parser takes the number wherever it appears.
    """
    for cell, want in [
        ("Uncommon (14.29%)", 14.29),
        ("Ultra Rare (0.10%)", 0.10),
        ("Rare (7.84%)", 7.84),
        ("Common (25.33%)", 25.33),
    ]:
        got = official._split_rate(cell)[1]
        check(f"rate from {cell!r}", got, want)


def test_normalise_part() -> None:
    """
    The two source paths disagree: one says "Chassis", the other "Chassis
    Blueprint". Saved progress is keyed on these names, so they must agree --
    but a part genuinely called "Blueprint" must not be stripped to nothing.
    """
    check("part: trailing Blueprint stripped",
          catalogue.normalise_part("Chassis Blueprint"), "Chassis")
    check("part: bare Blueprint survives",
          catalogue.normalise_part("Blueprint"), "Blueprint")
    check("part: whitespace collapsed",
          catalogue.normalise_part("  Neuroptics   Blueprint "), "Neuroptics")
    check("part: empty falls back", catalogue.normalise_part(""), "Blueprint")


def test_relic_key() -> None:
    """Relic names arrive with and without the trailing 'Relic', and with tier casing."""
    check("relic: full name", relics.relic_key("Meso D8 Relic"), "Meso D8")
    check("relic: tier casing", relics.relic_key("axi v14 relic"), "Axi V14")
    check("relic: not a relic", relics.relic_key("Forma Blueprint"), None)
    # the " Relic" suffix is required on purpose - callers strip parentheses but
    # keep the word, so a bare name must not be mistaken for a relic
    check("relic: bare name rejected", relics.relic_key("Axi V14"), None)


def test_parse_prime_page() -> None:
    """
    Two real bugs: non-breaking spaces made "Ash\\xa0Prime" unmatchable, and the
    section boundary "== Prime Related==" has a leading space, so a plain find()
    missed it and leaked Mods and Fish into the catalogue (325 entries, not 189).
    """
    page = (
        "==Primes==\n"
        "===Warframes===\n"
        "<gallery>\n"
        # a non-breaking space inside {{WF}} output, exactly as the wiki emits it
        "AshPrimeIcon.png|link=Ash_Prime|{{WF|Ash Prime|icon=0}} "
        "([[Prime Vault|V]])|alt=Ash Prime (V)\n"
        "MagPrimeIcon.png|link=Mag_Prime|{{WF|Mag Prime|icon=0}}|alt=Mag Prime\n"
        "</gallery>\n"
        # note the leading space: a plain find() misses this and leaks Mods in
        "== Prime Related==\n"
        "===Mods===\n"
        "<gallery>\n"
        "PrimedContinuity.png|link=Primed_Continuity|{{M|Primed Continuity}}\n"
        "</gallery>\n"
    )
    entries = catalogue.parse_prime_page(page)
    names = [e["name"] for e in entries]
    check_true("prime page: nbsp normalised", "Ash Prime" in names,
               "a non-breaking space must not survive into an item name")
    check_true("prime page: Mag parsed", "Mag Prime" in names)
    check_true("prime page: section boundary respected",
               "Primed Continuity" not in names,
               "'== Prime Related==' has a leading space; find() missed it")


def test_normalise_sources() -> None:
    """
    Neo C7 once listed a 1.84% node above an 11.06% one, because neither source
    path emitted rows in a useful order and duplicates were never collapsed.
    """
    rows = {
        "Meso D8": [
            {"kind": "mission", "planet": "Mars", "node": "Olympus",
             "mode": "Disruption", "rotation": "A", "chance": 1.84},
            {"kind": "mission", "planet": "Sedna", "node": "Kappa",
             "mode": "Disruption", "rotation": "A", "chance": 11.06},
            # exact duplicate at a lower rate: must collapse to the better one
            {"kind": "mission", "planet": "Sedna", "node": "Kappa",
             "mode": "Disruption", "rotation": "A", "chance": 4.00},
        ]
    }
    out = relics.normalise_sources(rows)["Meso D8"]
    check("sources: duplicates collapsed", len(out), 2)
    check("sources: best first", out[0]["chance"], 11.06)
    check("sources: kept the higher duplicate",
          [r["chance"] for r in out], [11.06, 1.84])


def test_no_source_cap() -> None:
    """
    A sources[:40] cap silently dropped 68% of all rows. Sedna/Kappa publishes 25
    and we stored 14, losing its whole rotation C -- found only because a player
    ran the node and got rewards the app said were not there.
    """
    rows = {"Axi S20": [
        {"kind": "mission", "planet": f"P{i}", "node": f"N{i}", "mode": "Defense",
         "rotation": "C", "chance": 10.2 - i * 0.01} for i in range(90)
    ]}
    out = relics.normalise_sources(rows)["Axi S20"]
    check("sources: nothing is capped", len(out), 90,
          "the 40-row cap made the planner blind to real farms")


# ─────────────────────────────────────────────────────────────────────────────
# bounties: the live rotation, and the ones that only exist sometimes
# ─────────────────────────────────────────────────────────────────────────────

# One bounty tier as DE publishes it: the rotation is the outer heading and
# every stage sits inside it, so a run pays the stages of ONE letter. Trimmed
# to two stages and three rewards each; the real page has five of each.
_BOUNTY_PAGE = """
<h3 id="cetusRewards">Cetus</h3>
<table>
<tr><th>Level 5 - 15 Cetus Bounty</th></tr>
<tr><th>Rotation A</th></tr>
<tr><th>Stage 1</th></tr>
<tr><td>Redirection</td><td>Uncommon (20.00%)</td></tr>
<tr><td>100X Oxium</td><td>Uncommon (20.00%)</td></tr>
<tr><th>Final Stage</th></tr>
<tr><td>Point Blank</td><td>Uncommon (30.56%)</td></tr>
<tr><th>Rotation B</th></tr>
<tr><th>Stage 1</th></tr>
<tr><td>Pressure Point</td><td>Uncommon (20.00%)</td></tr>
<tr><td>100X Cryotic</td><td>Uncommon (20.00%)</td></tr>
<tr><th>Final Stage</th></tr>
<tr><td>Stretch</td><td>Uncommon (30.56%)</td></tr>
<tr><th>Rotation C</th></tr>
<tr><th>Stage 1</th></tr>
<tr><td>Vitality</td><td>Uncommon (20.00%)</td></tr>
<tr><td>200X Plastids</td><td>Uncommon (20.00%)</td></tr>
<tr><th>Final Stage</th></tr>
<tr><td>Intensify</td><td>Uncommon (30.56%)</td></tr>
<tr><th>Level 15 - 25 Ghoul Bounty</th></tr>
<tr><th>Rotation A</th></tr>
<tr><th>Stage 1</th></tr>
<tr><td>Neo C7 Relic</td><td>Uncommon (18.45%)</td></tr>
<h3 id="solarisRewards">Fortuna</h3>
<table>
<tr><th>Level 40 - 60 PROFIT-TAKER - PHASE 3</th></tr>
<tr><th>First Completion</th></tr>
<tr><th>Final Stage</th></tr>
<tr><td>Gravimag</td><td>Very Common (100.00%)</td></tr>
<tr><th>Subsequent Completions</th></tr>
<tr><th>Final Stage</th></tr>
<tr><td>Meso D8 Relic</td><td>Uncommon (15.00%)</td></tr>
<h3 id="deimosRewards">Deimos</h3>
"""


def test_bounty_rotation_pools() -> None:
    """
    The stage headings nest INSIDE the rotation heading. Reading them as
    siblings would file "Final Stage" as a bounty of its own - the bug that
    put 61 rows under a phantom node of that name - and would leave each
    rotation holding only its first stage.
    """
    pools = official.bounty_rotation_pools(_BOUNTY_PAGE)["cetusRewards"]
    tier = pools["Level 5 - 15 Cetus Bounty"]
    check("bounty pools: three rotations", sorted(tier), ["A", "B", "C"])
    check("bounty pools: every stage folded into its rotation",
          sorted(tier["A"]), ["100X Oxium", "Point Blank", "Redirection"])
    check("bounty pools: rotations do not bleed into each other",
          "Vitality" in tier["A"], False)
    check("bounty pools: a single-rotation bounty stays single",
          sorted(pools["Level 15 - 25 Ghoul Bounty"]), ["A"])
    check("bounty levels parsed", official.group_levels("Level 15 - 25 Ghoul Bounty"),
          [15, 25])

    # Profit-Taker Phase 3 nests one level deeper than the rest: its table splits
    # into "First Completion" (a Gravimag, once ever) and "Subsequent
    # Completions" (everything after, and the only half carrying relics). Both
    # read as bounties in their own right, so the planner offered a node called
    # "Subsequent Completions" - which is not a place you can go.
    _, sources, _ = official.parse_droptables(_BOUNTY_PAGE)
    bounty_nodes = {row["node"] for rows in sources.values() for row in rows
                    if row["kind"] == "bounty"}
    check("no bounty is named after one of its own sub-headings",
          sorted(n for n in bounty_nodes
                 if n in ("First Completion", "Subsequent Completions", "Final Stage")), [])
    check("Profit-Taker relics land on the phase they belong to",
          "Level 40 - 60 PROFIT-TAKER - PHASE 3" in bounty_nodes, True)


# 21:00Z sits inside the window below, so the fixtures do not rot with the clock
_NOW = datetime.datetime(2026, 8, 11, 21, 0, tzinfo=datetime.timezone.utc)


def _syndicate(jobs, activation="2026-08-11T19:25:24.467Z",
               expiry="2026-08-11T21:55:23.341Z"):
    return [{"syndicate": "Ostrons", "activation": activation,
             "expiry": expiry, "jobs": jobs}]


def test_derive_bounty_rotation() -> None:
    """
    The period (150 minutes) is documented; the phase is not. It is recovered by
    matching what the worldstate says is on offer against what DE's table says
    each letter pays - the only route to it that needs no in-game observation.
    """
    pools = official.bounty_rotation_pools(_BOUNTY_PAGE)

    live = _syndicate([{"type": "Reclaim the Stolen Artifact", "enemyLevels": [5, 15],
                        "rewardPool": ["Vitality", "200X Plastids"]}])
    fams = build_data.derive_bounty_rotation(pools, live, _NOW)
    check("rotation: named from the live reward pool", fams["standard"]["letter"], "C")
    check("rotation: window carried through", fams["standard"]["windowEnd"],
          "2026-08-11T21:55:23.341Z")

    # Minutes before a changeover the worldstate carries the NEXT set as well.
    # Counting it halves the vote and, on a tie, can land a whole window out.
    upcoming = _syndicate([{"type": "x", "enemyLevels": [5, 15],
                            "rewardPool": ["Redirection", "100X Oxium"]}],
                          activation="2026-08-11T21:55:23.341Z",
                          expiry="2026-08-12T00:25:23.341Z")
    fams = build_data.derive_bounty_rotation(pools, live + upcoming, _NOW)
    check("rotation: the next window does not vote", fams["standard"]["letter"], "C")
    check("rotation: and does not dilute the count", fams["standard"]["of"], 1)

    # A cached reading has no live window at all - everything in it expired
    # while it sat on disk, which is the normal case for --offline and for a
    # build that carried on after the API was unreachable. The letter is still
    # derivable: the cycle is unbroken, so the last window we have anchors it
    # and the page walks it forward. Dropping it left the planner saying
    # "rotation unknown" on every bounty after one offline rebuild.
    stale = build_data.derive_bounty_rotation(
        pools, live, _NOW + datetime.timedelta(days=2))
    check("rotation: a cached window still anchors the sequence",
          stale["standard"]["letter"], "C")
    check("rotation: and keeps its own window end",
          stale["standard"]["windowEnd"], "2026-08-11T21:55:23.341Z")

    # a pool that fits more than one rotation says nothing, and must not vote
    tie = _syndicate([{"type": "x", "enemyLevels": [5, 15], "rewardPool": []}])
    check("rotation: an empty pool abstains",
          build_data.derive_bounty_rotation(pools, tie, _NOW), {})

    # the Ghoul tier publishes one letter, so a match against it is not evidence
    ghoul = _syndicate([{"type": "x", "enemyLevels": [15, 25],
                         "rewardPool": ["Neo C7 Relic"]}])
    check("rotation: a bounty with one rotation cannot vote",
          build_data.derive_bounty_rotation(pools, ghoul, _NOW), {})

    # Level 30-40 Cambion Drift publishes A and B only: a hit there is ambiguous
    partial = dict(pools)
    partial["cetusRewards"] = dict(pools["cetusRewards"])
    partial["cetusRewards"]["Level 5 - 15 Cetus Bounty"] = {
        "A": {"Redirection"}, "B": {"Pressure Point"}}
    check("rotation: a two-rotation bounty cannot vote",
          build_data.derive_bounty_rotation(
              partial, _syndicate([{"type": "x", "enemyLevels": [5, 15],
                                    "rewardPool": ["Redirection"]}]), _NOW), {})


def test_bounty_family_split() -> None:
    """
    Read at 2026-08-11T21:00Z the standard bounties were on C while every
    Isolation Vault was on B. One letter for everything - which is what the
    wiki says - would have been wrong for six bounty tiers.
    """
    check("family: vaults run their own clock",
          build_data.bounty_family("Level 30 - 40 Isolation Vault"), "vault")
    check("family: arcana vaults too",
          build_data.bounty_family("Level 50 - 60 Arcana Isolation Vault"), "vault")
    check("family: everything else is one clock",
          build_data.bounty_family("Level 5 - 15 Cetus Bounty"), "standard")


def test_live_event_bounties() -> None:
    """
    Plague Star carries 26 relics and only exists a few weeks a year; the Ghoul
    tiers only exist during a purge. Ranking them as permanent sends you to a
    bounty board that has no such bounty on it.
    """
    events = [{"description": "Operation: Plague Star", "node": "Cetus (Earth)",
               "activation": "2026-08-01T00:00:00Z", "expiry": "2026-08-20T00:00:00Z"},
              {"description": "Thermia Fractures", "node": "Orb Vallis (Venus)",
               "activation": "2026-08-01T00:00:00Z", "expiry": "2026-08-24T00:00:00Z"}]
    found = build_data.find_live_events(events, [])
    check("events: Plague Star found", "Plague Star" in found, True)
    check("events: unrelated events ignored", "Ghoul Purge" in found, False)

    # a purge arrives as a syndicate whose tag WFCD does not map
    purge = [{"syndicate": "GhoulEmergenceSyndicate", "jobs": [{"type": "Ghoul Bounty"}],
              "activation": "2026-08-10T00:00:00Z", "expiry": "2026-08-17T00:00:00Z"}]
    check("events: a purge found on the syndicate list",
          build_data.find_live_events([], purge)["Ghoul Purge"]["expiry"],
          "2026-08-17T00:00:00Z")

    meta = build_data.build_bounty_meta(
        official.bounty_rotation_pools(_BOUNTY_PAGE), [], events, True, _NOW)
    star = meta["events"]["Level 15 - 25 Plague Star"]
    check("events: window emitted, not a boolean", star.get("expiry"),
          "2026-08-20T00:00:00Z")
    check("events: a bounty nobody is running has no window",
          meta["events"]["Level 15 - 25 Ghoul Bounty"].get("expiry"), None)
    check("events: single-rotation bounties are not clocked",
          "Level 15 - 25 Ghoul Bounty" in meta["groups"], False)
    check("events: the clocked ones carry their letters",
          meta["groups"]["Level 5 - 15 Cetus Bounty"],
          {"family": "standard", "rotations": "ABC"})


def test_only_fissures_worth_going_to_are_shipped() -> None:
    """
    The build ships the fissures that were running when it ran, and the page
    filters them again by their own expiry. This is the first of those two
    passes, and it is also where the entries that could never be useful are
    dropped: a Requiem fissure takes Requiem relics, which come from Kuva Liches
    and hold no Prime parts, so it is somewhere this app must never send anyone.
    """
    def raw(**kw):
        base = {"tier": "Lith", "node": "Lith (Earth)", "missionType": "Defense",
                "activation": "2026-08-11T20:00:00Z", "expiry": "2026-08-11T22:00:00Z",
                "isHard": False, "isStorm": False}
        base.update(kw)
        return base

    got = build_data.build_fissures([
        raw(tier="Requiem", node="Requiem (Earth)"),
        raw(node="Closed (Earth)", expiry="2026-08-11T20:30:00Z"),
        raw(node="Later (Mars)", tier="Axi"),
        raw(node="", tier="Meso"),
        raw(node="Omni (Lua)", tier="Omnia"),
        raw(node="Up (Earth)"),
    ], _NOW)
    nodes = [f["node"] for f in got]

    check("fissures: Requiem is not somewhere to send anyone",
          [n for n in nodes if "Requiem" in n], [])
    check("fissures: one that closed before the build is not shipped",
          [n for n in nodes if "Closed" in n], [])
    check("fissures: a nameless node is dropped rather than shown blank",
          len(nodes), 3)
    check("fissures: tier order, so two builds an hour apart diff cleanly",
          nodes, ["Up (Earth)", "Later (Mars)", "Omni (Lua)"])
    check("fissures: the end time travels with each one",
          got[0]["ends"], "2026-08-11T22:00:00+00:00",
          "without it the page cannot tell a live fissure from a dead one")
    check("fissures: the two gates are carried, not inferred later",
          (got[0]["hard"], got[0]["storm"]), (False, False))

    check("fissures: an unreachable feed is an unmarked ranking, not a crash",
          build_data.build_fissures(None, _NOW), [])


# ─────────────────────────────────────────────────────────────────────────────
# the built dataset, if one is present
# ─────────────────────────────────────────────────────────────────────────────

def test_built_payload() -> None:
    path = os.path.join(ROOT, "data", "prime-data.json")
    if not os.path.exists(path):
        print("  skip built payload (run tools/build_data.py first)")
        return
    D = read_json(path)

    check_true("payload: has items", len(D["items"]) > 100)
    check_true("payload: has relics", len(D["relics"]) > 500)

    # every source row must be complete enough to rank
    bad = [s for r in D["relics"].values() for s in r.get("sources", [])
           if s.get("chance") is None]
    check("payload: no null drop chances", len(bad), 0,
          "DE's 'Ultra Rare' once produced 79 of these")

    # sources sorted best-first per relic
    unsorted = [n for n, r in D["relics"].items()
                if [s["chance"] for s in r.get("sources", [])]
                != sorted((s["chance"] for s in r.get("sources", [])), reverse=True)]
    check("payload: sources sorted best-first", len(unsorted), 0)

    # nothing at a round number that would suggest a cap
    capped = [n for n, r in D["relics"].items() if len(r.get("sources", [])) == 40]
    check("payload: no relic sits at exactly 40 sources", len(capped), 0,
          "that was the signature of the cap bug")

    # the catalogue is relic-focused
    cats = {i["category"] for i in D["items"]}
    leaked = cats & catalogue.NON_RELIC_CATEGORIES
    check("payload: no non-relic categories", leaked, set())

    # Everything left should come from a relic, except the Primes that never
    # did: Founder exclusives, Baro stock, and quest/craft rewards. Those keep
    # their own status and are shown as unobtainable rather than farmable.
    orphans = [i["name"] for i in D["items"]
               if not i.get("parts")
               and not (i.get("flags") or {}).get("founder")
               and not (i.get("flags") or {}).get("baro")
               and not (i.get("flags") or {}).get("special")]
    check("payload: partless items are all Founder/Baro/special", orphans, [])

    # Aya is a currency, not a relic, and used to be discarded by the parser
    aya = D.get("aya")
    check_true("payload: Aya drop rows present", isinstance(aya, list) and len(aya) > 10,
               "one Aya buys one relic at Varzia, so where it drops matters")
    check("payload: no null Aya chances",
          [a for a in (aya or []) if a.get("chance") is None], [])
    check_true("payload: relics flag what Aya can buy",
               any(r.get("resurgence") for r in D["relics"].values()),
               "Aya is only worth something if we know which relics it buys")
    # Ayatan sculptures and stars are Maroo's treasures, nothing to do with Aya
    check("payload: Aya rows are Aya only",
          [a for a in (aya or []) if "ayatan" in str(a.get("item", "")).lower()], [])

    # the image cache is sticky: once the folder exists the payload must use it,
    # or you end up with 8 MB on disk and a site still hotlinking the CDN
    import artwork as art
    if art.have_local_images():
        local = [i for i in D["items"] if (i.get("image") or "").startswith("assets/img/")]
        withimg = [i for i in D["items"] if i.get("image")]
        check("payload: local artwork is actually used", len(local), len(withimg),
              "assets/img/ exists, so every item should point at it")
        # and nothing on disk should be unreferenced
        used = {os.path.basename(i["image"]) for i in local}
        ondisk = {f for f in os.listdir(art.IMG_DIR)
                  if os.path.isfile(os.path.join(art.IMG_DIR, f))}
        check("payload: no orphaned image files", sorted(ondisk - used), [],
              "dropping a category once left 110 orphans and 5.7 MB behind")

    # ducats are a fixed game value, published per component - not a guess
    parts = [p for i in D["items"] for p in (i.get("parts") or [])]
    withd = [p for p in parts if p.get("ducats")]
    # Which source answered each live feed.
    feeds = D["meta"].get("feeds") or {}
    check("payload: every live feed says where it came from",
          sorted(feeds), ["bounties", "fissures", "vaultTrader"],
          "the 403 only happens on the runner, so the artefact is the only place "
          "the answer is true of the site people read")
    check("payload: and names a source the chain can actually return",
          sorted({v for v in feeds.values()} - {"worldstate", "proxy", "cache", "none"}),
          [])

    check_true("payload: ducat values present", len(withd) > len(parts) * 0.9,
               "Baro's price per spare part; deterministic, so it should be near-total")
    check("payload: ducats are the known values",
          sorted({p["ducats"] for p in withd}), [15, 25, 45, 65, 100])

    # Every number that reaches markup is a number, not merely documented as
    # one. The items API is third-party JSON and these three are interpolated
    # into innerHTML in the browser, so the type was doing the job esc() does.
    numeric = [("masteryReq", i.get("masteryReq")) for i in D["items"]]
    numeric += [(f, p.get(f)) for p in parts for f in ("itemCount", "ducats")]
    check("payload: every count is an int or absent",
          sorted({f"{f}={v!r}" for f, v in numeric
                  if v is not None and not isinstance(v, int)})[:5], [],
          "a string here is markup, on a site that rebuilds unattended twice a day")

    # part names must be normalised, since saved progress is keyed on them
    raw = [p["name"] for i in D["items"] for p in (i.get("parts") or [])
           if p["name"] != "Blueprint" and p["name"].endswith(" Blueprint")]
    check("payload: part names normalised", raw, [])

    # ...and unique within an item, which is the assumption the line above
    # actually rests on. Saved progress is keyed on the name, so two parts of
    # one item sharing a name share one counter. DE list the sub-weapon of an
    # akimbo twice - "Lex Prime", "Lex Prime", one each - and that made three
    # clicks complete a four-part item, one tick move the counter from 0/4 to
    # 2/4, and Aklex Prime read as collected while you held one of the two Lex
    # Primes it needs.
    dupes = sorted(
        f"{i['name']}: {p['name']}"
        for i in D["items"]
        for n, p in enumerate(i.get("parts") or [])
        if any(q["name"] == p["name"] for q in (i.get("parts") or [])[:n])
    )
    check("payload: no item has two parts with the same name", dupes, [])

    # What DE publish about each bounty on offer, which until 2026-08-24 was
    # fetched, cached and thrown away. Two of these are corrections rather than
    # additions: the letter was derived per family and the families disagree,
    # and every bounty was costed at four stages when the real number is 3, 4
    # or 5. Both are only visible if the join to our own group names works, so
    # that is what is asserted.
    bounties = D["meta"]["bounties"]
    groups = bounties.get("groups") or {}
    if bounties.get("checked") and groups:
        named = {g: r for g, r in groups.items() if r.get("letter")}
        check_true("bounties: DE's own letter is read for most tiers",
                   len(named) >= len(groups) * 0.75,
                   f"{len(named)} of {len(groups)} — the Narmer tiers publish none, "
                   f"but a wider gap than that means the join has broken")
        check("bounties: every published letter is one of the three",
              sorted({r["letter"] for r in named.values()} - set("ABC")), [])
        check_true("bounties: an anchor to walk those letters forward from",
                   bool(bounties.get("windowEnd")),
                   "a letter with no window is a letter that can never turn over")

        staged = {g: r["stages"] for g, r in groups.items() if r.get("stages")}
        check_true("bounties: stage counts are read too", len(staged) >= len(named) * 0.9)
        check("bounties: and they are the three shapes DE actually ships",
              sorted(set(staged.values())), [3, 4, 5],
              "four for everything was the assumption this replaced")

        # The vault chambers share their levels with a standard bounty on the
        # same landscape, so a join on section and levels alone silently gives
        # one of them the other's letter.
        vaults = {g: r for g, r in named.items() if r["family"] == "vault"}
        check_true("bounties: the Isolation Vaults joined to their own jobs",
                   len(vaults) >= 3,
                   "Cleanse the Land and Isolation Vault Chamber B are both "
                   "fought at 30-40 under Entrati; only the uniqueName tells them apart")

    # The one part of the payload with an hour to live, published on its own so
    # an open page can re-read it without pulling the other 1.9 MB down again.
    side = os.path.join(ROOT, "data", "fissures.json")
    check_true("payload: the fissure list is also written on its own",
               os.path.exists(side))
    if os.path.exists(side):
        with open(side, encoding="utf-8") as fh:
            alone = json.load(fh)
        check("payload: and it is the same list, not a second answer",
              alone.get("fissures"), D.get("fissures"),
              "two files disagreeing about the fissures is worse than one stale one")
        check_true("payload: it says when it was built, so staleness is visible",
                   bool(alone.get("generated")))
        check_true("payload: and it is small enough to poll every ten minutes",
                   os.path.getsize(side) < 200 * 1024,
                   f"{os.path.getsize(side)} bytes is not a ten-minute request")

    # Named subjects, not "everything carrying builtFrom": that flag is written
    # by the code under test, so selecting on it would let a fold that stopped
    # happening pass by finding nothing at all (PROJECT.md section 2).
    akimbos = {"Aklex Prime": "Lex Prime", "Akbronco Prime": "Bronco Prime",
               "Akmagnus Prime": "Magnus Prime", "Akvasto Prime": "Vasto Prime"}
    by_item = {i["name"]: i for i in D["items"]}
    check("payload: the akimbos and their sub-weapons are all catalogued",
          sorted(n for n in list(akimbos) + list(akimbos.values()) if n not in by_item), [])

    # One entry, two wanted, and no relics of its own - DE hang the union of
    # every relic dropping any Lex Prime PART on that component, 130 of them,
    # and none of them drops a built weapon. Carried through, that union was
    # what made Aklex Prime the only item flagged farmable on relics its card
    # could then find nowhere to farm.
    folded = []
    for parent, sub in sorted(akimbos.items()):
        got = [p for p in (by_item.get(parent) or {}).get("parts") or []
               if p["name"] == sub]
        one = got[0] if len(got) == 1 else {}
        folded.append(f"{parent}: {len(got)} entry, need {one.get('itemCount')}, "
                      f"{len(one.get('relics') or [])} relics, from {one.get('builtFrom')}")
    check("payload: an akimbo needs one entry for two of its sub-weapon, with no relics",
          folded,
          [f"{p}: 1 entry, need 2, 0 relics, from {s}" for p, s in sorted(akimbos.items())])


# ─────────────────────────────────────────────────────────────────────────────
# integration
# ─────────────────────────────────────────────────────────────────────────────

def _tree_state(*paths: str) -> dict[str, str]:
    """Size and mtime of everything under `paths`, for "did we put it back?"."""
    import hashlib                                          # noqa: PLC0415
    out: dict[str, str] = {}
    for path in paths:
        if os.path.isfile(path):
            with open(path, "rb") as fh:
                out[os.path.basename(path)] = hashlib.sha256(fh.read()).hexdigest()[:16]
        elif os.path.isdir(path):
            for entry in sorted(os.listdir(path)):
                full = os.path.join(path, entry)
                if os.path.isfile(full):
                    with open(full, "rb") as fh:
                        out[entry] = hashlib.sha256(fh.read()).hexdigest()[:16]
    return out


def test_offline_build() -> None:
    """
    A rebuild from the warm cache must succeed and be deterministic. This is the
    path --if-changed takes on every scheduled run.

    **It writes the repository's real `data/`, so it puts it back.** Until
    2026-08-27 it did not, and that was not a tidiness problem: an offline build
    reads every source from the cache without marking anything stale — correctly,
    because `--offline` asks for exactly that — so `meta.stale` comes back `[]`
    and `meta.staleSince` `null` however the network is really doing. Every full
    test run therefore replaced a payload that knew it was behind with one that
    said it was fresh, and the staleness banner went quiet. That cost two wrong
    readings in one afternoon: a build stamped `stale: []` was taken as evidence
    the API was healthy, and later a rebuilt payload with no stale markers was
    read as an outage having ended. It had not; the suite had run in between.

    It also caught a mutation test out on the day this was written. A deliberate
    one-character change to `official.py` was made, the suite run, the change
    reverted — and the suite then failed against a `data/` that had been rebuilt
    from the mutated source and left behind. The failure looked like the revert
    not working.

    Snapshot-and-restore rather than building into a temp directory: this test's
    whole point is that the real command, run the real way, works and is
    deterministic, and `DATA_DIR` is derived from the tool's own location rather
    than from the working directory, so there is nowhere else to point it without
    inventing a flag for the tests' benefit.
    """
    if not os.path.isdir(os.path.join(ROOT, ".cache")):
        print("  skip offline build (no warm cache)")
        return

    data_dir = os.path.join(ROOT, "data")
    changelog = os.path.join(ROOT, "CHANGELOG.md")   # appended to on a change
    before = _tree_state(data_dir, changelog)
    keep = tempfile.mkdtemp(prefix="primehunter-data-")
    try:
        if os.path.isdir(data_dir):
            shutil.copytree(data_dir, os.path.join(keep, "data"))
        if os.path.isfile(changelog):
            shutil.copy2(changelog, os.path.join(keep, "CHANGELOG.md"))

        r = subprocess.run([sys.executable, "tools/build_data.py", "--offline"],
                           cwd=ROOT, capture_output=True, text=True)
        check("offline build: exits 0", r.returncode, 0, r.stderr[-400:])

        first = read_json(os.path.join(data_dir, "prime-data.json"))
        subprocess.run([sys.executable, "tools/build_data.py", "--offline"],
                       cwd=ROOT, capture_output=True, text=True)
        second = read_json(os.path.join(data_dir, "prime-data.json"))
        for d in (first, second):
            d["meta"].pop("generated", None)
            # The fissure list is filtered against the clock by design, so a
            # fissure closing between these two builds is the feature working,
            # not the build being non-deterministic. Left in, it would fail about
            # one run in two hundred and look like a real fault every time.
            d.pop("fissures", None)
        check("offline build: deterministic", first == second,  True,
              "two builds from the same cache must agree")
    finally:
        # `finally`, because a failed assertion above must not leave the owner's
        # freshness markers overwritten — that is the whole defect.
        saved = os.path.join(keep, "data")
        if os.path.isdir(saved):
            shutil.rmtree(data_dir, ignore_errors=True)
            shutil.copytree(saved, data_dir)
        saved_log = os.path.join(keep, "CHANGELOG.md")
        if os.path.isfile(saved_log):
            shutil.copy2(saved_log, changelog)
        shutil.rmtree(keep, ignore_errors=True)

    # Every file that existed before must be byte-identical after. Files that did
    # NOT exist before are allowed to exist now, and that is not a loophole — it
    # is the case CI runs in. A fresh checkout has no `data/` at all (it is
    # generated and gitignored), the suite runs before the build step, and
    # leaving a built payload behind there destroys no freshness markers because
    # there were none. Deleting it instead would break the ordering the entry
    # warned about: `test_built_payload` and the bundle checks read `data/` and
    # benefit from it existing.
    #
    # Asserted rather than assumed: a restore that quietly did nothing would
    # leave exactly the state this test exists to prevent, and look like a pass.
    after = _tree_state(data_dir, changelog)
    check("offline build: leaves data/ as it found it",
          {name: after.get(name) for name in before}, before,
          "the freshness markers this run overwrote were not put back")


def test_parts_are_digital_extremes_own_numbers() -> None:
    """
    Every part, quantity and ducat value in the payload has to be the one DE
    publish — checked across the whole catalogue, never spot-checked.

    That is the caution the entry this came from insisted on, and it was earned:
    the artwork change once reported 166 of 167 on a first pass and the miss
    turned out to be in the probe. So this walks all of them and names any
    disagreement rather than counting agreements.

    It is also the check that would catch the switch silently reverting. The
    part list, `itemCount` and `ducats` came from `api.warframestat.us/items`
    until 2026-08-27; if `partSpecs` ever arrives empty the parts fall back to
    that API, which is the right behaviour and completely invisible — the
    numbers agree today. This fails instead.
    """
    import gzip
    sys.path.insert(0, os.path.join(ROOT, "tools"))
    import official                                        # noqa: PLC0415

    want = ["ExportWarframes_en.json", "ExportWeapons_en.json",
            "ExportSentinels_en.json", "ExportRecipes_en.json",
            "ExportResources_en.json"]
    paths = {n: os.path.join(ROOT, ".cache", f"export_{n}.gz") for n in want}
    if not all(os.path.exists(p) for p in paths.values()):
        print("  skip first-party parts (no warm export cache)")
        return
    data_js = os.path.join(ROOT, "data", "prime-data.json")
    if not os.path.exists(data_js):
        print("  skip first-party parts (run tools/build_data.py first)")
        return

    exports = {}
    for name, path in paths.items():
        with gzip.open(path, "rb") as fh:
            exports[name] = official.load_export(fh.read())
    specs = official.prime_part_specs(exports)
    check_true("parts: DE publish a recipe for most of the catalogue",
               len(specs) > 100, f"only {len(specs)} — the manifests changed shape")

    D = read_json(data_js)
    disagreed, covered, uncovered = [], 0, []
    for item in D["items"]:
        ours = item.get("parts") or []
        spec = specs.get(item["name"])
        if spec is None:
            if ours:
                uncovered.append(item["name"])
            continue
        de = {p["name"]: p for p in spec}
        for p in ours:
            got = de.get(p["name"])
            if not got:
                disagreed.append(f"{item['name']}/{p['name']}: DE has {sorted(de)}")
            elif (got["itemCount"] or 1) != (p.get("itemCount") or 1):
                disagreed.append(f"{item['name']}/{p['name']}: count "
                                 f"{p.get('itemCount')} vs DE {got['itemCount']}")
            elif not got["sub"] and got["ducats"] != p.get("ducats"):
                disagreed.append(f"{item['name']}/{p['name']}: ducats "
                                 f"{p.get('ducats')} vs DE {got['ducats']}")
            else:
                covered += 1

    check("parts: every one agrees with DE's own manifests", disagreed[:6], [])
    check_true("parts: and nearly all of them come from there",
               covered > 500, f"only {covered} parts matched a DE recipe")
    # Named rather than counted: DE publish no recipe for Kavasa Prime Collar in
    # any manifest, so it keeps the item API's list. That is the documented
    # precedence — first party for what DE publish, WFCD for what they do not —
    # and a second name appearing here means the join has started missing.
    check("parts: only the items DE do not publish fall back",
          sorted(uncovered), ["Kavasa Prime Collar"])


def test_the_scheduled_task_can_actually_be_registered() -> None:
    """
    Register the task for real, read it back, and remove it.

    This exists because the hourly trigger shipped broken. It was built with
    -RepetitionDuration ([TimeSpan]::MaxValue), which is what every example
    recommends, and it was "verified" by constructing the trigger object under
    both PowerShell editions and printing it. That proved nothing:
    New-ScheduledTaskTrigger will hand back any object you ask for, and the
    schema that rejects P99999999DT23H59M59S is only consulted by
    Register-ScheduledTask. The owner found out by running it.

    So this drives the real script through the real cmdlet under a throwaway
    name. A static check on the source could pin the one spelling that failed;
    only this can catch the next spelling that fails.

    The empty duration is asserted as hard as the exit code, because the two
    failure modes are opposite and equally bad: a duration the schema rejects
    stops the task existing, and a duration it accepts stops the task repeating
    once that long has passed - quietly, months later.
    """
    if os.name != "nt":
        print("  skip task registration (Scheduled Tasks are a Windows feature)")
        return
    shell = shutil.which("pwsh") or shutil.which("powershell")
    if not shell:
        print("  skip task registration (no PowerShell on PATH)")
        return

    script = os.path.join(ROOT, "tools", "schedule.ps1")
    probe = "Warframe Prime Hunter test probe (auto-removed)"
    run = lambda *extra: subprocess.run(                          # noqa: E731
        [shell, "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", script,
         "-TaskName", probe, *extra],
        cwd=ROOT, capture_output=True, text=True, timeout=120)
    read = lambda: subprocess.run(                                # noqa: E731
        [shell, "-NoProfile", "-Command",
         f"$t = Get-ScheduledTask -TaskName '{probe}' -ErrorAction SilentlyContinue; "
         "if ($null -eq $t) { 'ABSENT' } else "
         "{ \"$($t.Triggers[0].Repetition.Interval)|$($t.Triggers[0].Repetition.Duration)\" }"],
        cwd=ROOT, capture_output=True, text=True, timeout=120).stdout.strip()

    try:
        made = run()
        check("schedule: registering the task exits 0", made.returncode, 0,
              (made.stderr or made.stdout)[-400:])
        interval, _, duration = read().partition("|")
        check("schedule: it repeats every ten minutes, as the default says",
              interval, "PT10M",
              "the fissure list is the reason for the cadence; it lasts an hour or two")
        check("schedule: with no duration, which is how it means indefinitely",
              duration, "",
              "a bounded duration registers fine and then stops refreshing")

        half = run("-EveryMinutes", "30")
        check("schedule: -EveryMinutes reaches the trigger", half.returncode, 0,
              (half.stderr or half.stdout)[-400:])
        check("schedule: and is what gets stored", read().partition("|")[0], "PT30M")

        # kept working rather than kept around: anyone who set the old cadence
        # should get it, and the conversion is the only thing that could rot
        eight = run("-EveryHours", "8")
        check("schedule: -EveryHours still reaches the trigger", eight.returncode, 0,
              (eight.stderr or eight.stdout)[-400:])
        check("schedule: and converts to minutes on the way",
              read().partition("|")[0], "PT8H")

        gone = run("-Remove")
        check("schedule: -Remove exits 0", gone.returncode, 0, gone.stderr[-300:])
        check("schedule: -Remove actually removes it", read(), "ABSENT")
    finally:
        # belt and braces: a failed assertion above must not leave a task behind
        subprocess.run([shell, "-NoProfile", "-Command",
                        f"Unregister-ScheduledTask -TaskName '{probe}' -Confirm:$false "
                        "-ErrorAction SilentlyContinue"],
                       cwd=ROOT, capture_output=True, text=True, timeout=120)


def test_a_blocked_host_is_routed_around() -> None:
    """
    Digital Extremes publish the export index on two hosts, and answer a GitHub
    runner with 403 from one of them and 200 from the other. Measured, and curl
    gets the same pair, so it is a datacenter block rather than anything about
    the request.

    A second host must be *tried*, not merely fallen back to: reaching for the
    cache first would keep serving a copy from yesterday while a host that works
    sits unasked, which is how this stayed invisible until the cache went.

    file:// throughout - the question is whether the loop moves on, and that
    does not need anybody's server to answer it.
    """
    import sources
    tmp = tempfile.mkdtemp(prefix="primehunter-hosts-")
    url = lambda p: "file:///" + p.replace(os.sep, "/").lstrip("/")   # noqa: E731
    good = os.path.join(tmp, "index.bin")
    with open(good, "wb") as fh:
        fh.write(b"the real document")
    dead, alive = url(os.path.join(tmp, "nothing-here.bin")), url(good)

    real_cache = sources.CACHE_DIR
    stale, missing = list(sources.STALE), list(sources.MISSING)
    try:
        sources.CACHE_DIR = os.path.join(tmp, "cache")
        check("fetch: the second host answers when the first refuses",
              sources.fetch((dead, alive), "probe_a"), b"the real document")
        check("fetch: routing around a blocked host is not a stale read",
              (sources.STALE, sources.MISSING), ([], []),
              "it is a working answer from a working host, not yesterday's copy")
        check("fetch: one host is still just a string",
              sources.fetch(alive, "probe_b"), b"the real document")

        # and the cold policy is untouched: every host failing is still fatal
        try:
            sources.fetch((dead, dead), "probe_c")
            check_true("fetch: all hosts down is fatal on a cold build", False)
        except SystemExit:
            check_true("fetch: all hosts down is fatal on a cold build", True)
    finally:
        sources.CACHE_DIR = real_cache
        sources.STALE[:], sources.MISSING[:] = stale, missing
        shutil.rmtree(tmp, ignore_errors=True)


def test_a_source_cannot_send_more_than_its_ceiling() -> None:
    """
    Every remote read used to take whatever the other end sent. The realistic
    case is not a hostile CDN but a broken one - a truncated gateway, an error
    page with the wrong type, a decompression bomb from a host that has itself
    been compromised - landing on an unattended scheduled build.

    Three properties, and the middle one is the whole point: refusing has to be
    an ordinary *failed fetch*, because that is the path this pipeline already
    handles well. A ceiling set too tightly should then cost a stale build and a
    loud line, never a broken one.

      1. the decompressors stop mid-stream rather than after expanding it all
      2. an oversized response falls through to the cached copy and says STALE
      3. every source in `.cache` is inside its own ceiling, comfortably

    The bomb is built here rather than committed: a file that expands to 64 MB
    is not something to keep in a repository, and `gzip.compress` makes one in
    a fraction of a second.
    """
    import gzip as gziplib
    import lzma as lzmalib

    # ---- 1. the primitives -------------------------------------------------
    plain = b"\0" * (64 * 1024 * 1024)
    bomb = gziplib.compress(plain, 9)
    check_true("ceiling: the test's own bomb is a bomb",
               len(plain) // max(len(bomb), 1) > 100,
               f"{len(bomb):,} -> {len(plain):,} is not much of a bomb")

    started = time.time()
    try:
        limits.gunzip_capped(bomb, 1 * limits.MB, "bomb")
        check_true("ceiling: a gzip bomb is refused", False,
                   "it expanded 64 MB into memory instead")
    except limits.TooLarge:
        check_true("ceiling: a gzip bomb is refused", True)
    # It must stop *early*. Expanding it all and then measuring would pass the
    # assertion above while doing the exact thing the ceiling exists to prevent,
    # and wall clock is the only thing that tells the two apart from here.
    check_true("ceiling: and it stops early rather than expanding it first",
               time.time() - started < 5.0,
               f"took {time.time() - started:.1f}s, so it expanded the lot")

    body = b'{"real":"document"}' * 4000
    check("ceiling: a legitimate body round-trips byte for byte",
          limits.gunzip_capped(gziplib.compress(body), 1 * limits.MB, "ok"), body)
    check("ceiling: a body exactly at the ceiling is allowed",
          limits.gunzip_capped(gziplib.compress(b"x" * 1000), 1000, "exact"),
          b"x" * 1000)
    try:
        limits.gunzip_capped(gziplib.compress(b"x" * 1001), 1000, "over")
        check_true("ceiling: one byte over is refused", False)
    except limits.TooLarge:
        check_true("ceiling: one byte over is refused", True)

    # The export index is LZMA, and decode_index blanks the one header field
    # that would otherwise bound the output - so this decompressor needs the
    # ceiling more than the gzip one does, not less.
    lz = lzmalib.compress(b"\0" * (32 * 1024 * 1024), format=lzmalib.FORMAT_ALONE)
    started = time.time()
    try:
        limits.unlzma_capped(lz, 4 * limits.KB, "export_index")
        check_true("ceiling: an LZMA bomb is refused", False)
    except limits.TooLarge:
        check_true("ceiling: an LZMA bomb is refused", True)
    check_true("ceiling: and that one stops early too",
               time.time() - started < 5.0,
               f"took {time.time() - started:.1f}s")

    index = b"ExportWarframes_en.json!abc123\n" * 8
    check("ceiling: a real export index still decodes",
          limits.unlzma_capped(lzmalib.compress(index, format=lzmalib.FORMAT_ALONE),
                               4 * limits.KB, "export_index"), index)

    # ---- 2. end to end: oversize is a failed fetch --------------------------
    #
    # file:// throughout, like the blocked-host test above: the question is what
    # `fetch` does with a body it will not accept, and that needs nobody's
    # server to answer. It also has no Cache-Control, so no `.maxage` sidecar is
    # written and every call here really re-requests.
    tmp = tempfile.mkdtemp(prefix="primehunter-ceiling-")
    url = lambda p: "file:///" + p.replace(os.sep, "/").lstrip("/")   # noqa: E731
    doc = os.path.join(tmp, "feed.json")
    real_cache = sources.CACHE_DIR
    stale, missing = list(sources.STALE), list(sources.MISSING)
    try:
        sources.CACHE_DIR = os.path.join(tmp, "cache")
        # `api_events` has the smallest ceiling of any live feed, 8 KB.
        cap = limits.cap_for("api_events")
        with open(doc, "wb") as fh:
            fh.write(b"a small honest answer")
        check("ceiling: a body inside the ceiling is fetched normally",
              sources.fetch(url(doc), "api_events"), b"a small honest answer")
        check("ceiling: and nothing about it is stale",
              (list(sources.STALE), list(sources.MISSING)), ([], []))

        # the same source, now answering with far more than it is allowed
        with open(doc, "wb") as fh:
            fh.write(b"z" * (cap * 4))
        # Truncated for the *message*, not for the assertion: the cached body is
        # 21 bytes, so [:64] of a correct answer is the whole of it and any
        # wrong answer still differs. Without this a regression prints 32 KB of
        # 'z' into the run, which is how a failure stops being readable.
        got = sources.fetch(url(doc), "api_events")
        check("ceiling: an oversized answer falls back to the cached copy",
              got[:64] if got else got, b"a small honest answer",
              "it must not return the oversized body, and must not be fatal")
        check("ceiling: and the build is told the data is stale",
              sources.STALE, ["api_events"],
              "silently reusing yesterday's copy is how this stays invisible")

        cached = os.path.join(sources.CACHE_DIR, "api_events.gz")
        with gziplib.open(cached, "rb") as fh:
            check("ceiling: the oversized body never reached the cache",
                  fh.read()[:64], b"a small honest answer",
                  "the cache is what the next offline build reads")

        # cold - nothing to fall back on - is fatal, exactly like any other
        # source that cannot be fetched. Oversize invents no new outcome.
        sources.STALE[:], sources.MISSING[:] = [], []
        try:
            sources.fetch(url(doc), "api_fissures", critical=True)
            check_true("ceiling: oversized and uncached is fatal, as any cold "
                       "failure is", False)
        except SystemExit:
            check_true("ceiling: oversized and uncached is fatal, as any cold "
                       "failure is", True)
    finally:
        sources.CACHE_DIR = real_cache
        sources.STALE[:], sources.MISSING[:] = stale, missing
        shutil.rmtree(tmp, ignore_errors=True)

    # ---- 3. the ceilings still fit the real data ---------------------------
    #
    # The canary. These are roughly twice what each source measured on
    # 2026-09-01, which is deliberately little headroom, so this is what tells
    # somebody a source has grown *before* a build starts going stale over it.
    cache = os.path.join(ROOT, ".cache")
    if not os.path.isdir(cache):
        print("  skip ceiling headroom (no cache yet)")
        return
    tight = []
    for name in sorted(os.listdir(cache)):
        if not name.endswith(".gz"):
            continue
        key = name[:-len(".gz")]
        with gziplib.open(os.path.join(cache, name), "rb") as fh:
            size = len(fh.read())
        room = size / limits.cap_for(key)
        if room > 0.75:
            tight.append(f"{key} at {room:.0%} of its ceiling ({size:,})")
    check("ceiling: every cached source still fits well inside its own", tight, [],
          "raise the number in tools/limits.py, and move its measured comment "
          "with it - a source at 100% goes stale rather than wrong, but it "
          "goes stale every single build")


def test_what_the_build_writes_is_what_the_site_ships() -> None:
    """
    Every file the build puts in `data/` and the browser reads has to be copied
    into `_site` by the workflow, or it is built and then thrown away.

    Not hypothetical. `data/feed-log.json` shipped on 2026-08-27 and was left out
    of the *Assemble the site* step, so the published copy 404ed for four days.
    That is worse than a missing file: the log continues from the deployed one,
    so every CI run read a 404, started a new log, and wrote a single entry —
    the history never accumulated at all, and the failure looked exactly like
    "the feature works, DE just always refuse".

    `prime-data.json` is deliberately not required: it is the same payload as the
    `.js` in a form nothing on the site loads.
    """
    workflow = os.path.join(ROOT, ".github", "workflows", "publish.yml")
    if not os.path.exists(workflow):
        print("  skip site assembly (no workflow checked out)")
        return
    yml = read_text(workflow)
    src = read_text(os.path.join(ROOT, "tools", "build_data.py"))

    written = set(re.findall(r'DATA_DIR,\s*"([^"]+\.json|[^"]+\.js)"', src))
    check_true("site: the build writes the files this test knows about",
               {"fissures.json", "feed-log.json", "prime-data.js"} <= written,
               f"found {sorted(written)} — the pattern that finds them has drifted")

    missing = [name for name in sorted(written - {"prime-data.json"})
               if f"data/{name}" not in yml]
    check("site: every file the build writes is copied into _site", missing, [],
          "built and then thrown away — the browser fetches these by name")


def test_the_feed_log_keeps_a_day_and_survives_a_runner() -> None:
    """
    `meta.feeds` says what happened on **this** build and is overwritten by the
    next, so it answers *"is the site on first-party data right now"* and cannot
    answer *"how often does DE actually reply"*. The owner asked for the second,
    which needs a history.

    It cannot live in `.cache`: the ten-minute build restores that read-only and
    never writes one — deliberately, since saving it 144 times a day would evict
    everything else — so a cached log would miss 143 runs in 144. It is a sidecar
    beside the payload, and each build continues the last one's.
    """
    now = datetime.datetime(2026, 8, 28, 12, 0, tzinfo=datetime.timezone.utc)
    ago = lambda h: (now - datetime.timedelta(hours=h)).isoformat().replace("+00:00", "Z")

    rows = [
        {"at": ago(30), "de": "ok"},          # older than the window
        {"at": ago(23), "de": "refused"},
        {"at": ago(1), "de": "ok"},
        {"at": ago(12), "de": "stale"},       # out of order on purpose
        {"at": "not a date", "de": "ok"},     # unparseable
        "nonsense",                            # not even a row
        {"de": "ok"},                          # undated
    ]
    kept = build_data.trim_feed_log(rows, now)
    check("feed log: only the last day is kept", len(kept), 3,
          "24 hours is the window, and 30 hours ago is not in it")
    check("feed log: oldest first, whatever order they arrived in",
          [r["de"] for r in kept], ["refused", "stale", "ok"])
    check("feed log: a row that cannot be dated is dropped, not guessed at",
          [r for r in kept if not r.get("at")], [])

    # An empty or unreadable source starts a new log rather than failing a build
    # over bookkeeping. The runner has no `data/` and may have no published copy.
    check("feed log: nothing to continue is not an error",
          build_data.trim_feed_log([], now), [])
    # An unreachable published copy must not raise. It returns a list either way:
    # `[]` on a runner with no `data/`, or the local file when there is one —
    # which is why this asserts the type and not the contents.
    check_true("feed log: an unreachable published copy is not an error",
               isinstance(build_data.read_feed_log("http://127.0.0.1:9/none.json"), list),
               "a build must not fail because it could not read its own statistics")

    # The vocabulary. `offline` is separate from `ok` on purpose: an --offline
    # build never asks DE, so counting it as a reply would inflate the exact
    # number this log exists to answer.
    src = read_text(os.path.join(ROOT, "tools", "build_data.py"))
    for word in ('"offline" if args.offline', '"refused" if "de_worldstate" in STALE'):
        check_true(f"feed log: outcome {word.split()[0]} is recorded", word in src,
                   "an outcome that collapses into another cannot be counted apart")


def test_the_worldstate_is_judged_on_its_own_timestamp() -> None:
    """
    Staleness is a fact about the **content**, not only about the transport.

    Everything else this project knows about freshness comes from the request —
    did it fail, how old is the file we wrote — and none of that can see an edge
    cache serving a stale object behind a `200`. DE sit behind Akamai, so that
    shape is not hypothetical. They stamp every worldstate with `Time`, so it can
    be asked directly.

    Measured 2026-08-28 for the threshold: a successful fetch returned a document
    36 seconds old against a declared `Cache-Control: max-age=23`, and the
    scheduled refresh runs every ten minutes — so fifteen leaves room for a slow
    build and a clock a little out while staying far below the hour or two a
    fissure lasts.
    """
    now = 1_787_861_317 + 3600            # an hour after the stamped document
    stamped = {"Time": 1_787_861_317}

    check("worldstate age: read from DE's own stamp",
          official.worldstate_age(stamped, now), 3600.0)
    check("worldstate age: seconds old is seconds old",
          official.worldstate_age({"Time": now - 36}, now), 36.0)
    check("worldstate age: a document from the future is not negative",
          official.worldstate_age({"Time": now + 500}, now), 0.0)

    for doc, why in (({}, "no Time at all"), ({"Time": None}, "a null Time"),
                     ({"Time": "1787861317"}, "a string Time"),
                     ({"Time": 0}, "a zero Time")):
        check(f"worldstate age: {why} means unknown, not fresh",
              official.worldstate_age(doc, now), None,
              "None sends the caller to its other tests rather than asserting youth")

    # And the threshold the build compares it against is the measured one.
    check_true("worldstate age: the limit is minutes, not hours",
               60 <= build_data.WORLDSTATE_MAX_AGE <= 30 * 60,
               f"got {build_data.WORLDSTATE_MAX_AGE}s — a fissure lasts an hour or two, "
               "so a limit near that protects nothing")


def test_a_live_feed_asks_de_then_wfcd_then_its_own_cache() -> None:
    """
    **Digital Extremes, then WFCD, then our own cached copy. Always, in that
    order.** The owner's decision of 2026-08-28, and the order is the whole of
    what `from_chain` guarantees — so it is asserted here rather than trusted to
    three call sites that could be edited apart.

    What it fixes: `fetch` answers a failed refresh by handing back cached bytes,
    so a 403 from DE produced a *usable* worldstate and the proxy was never
    asked. The deployed site published 69-minute-old fissures while a fresh copy
    of the same document sat one request away. DE sit behind Akamai, which
    refuses datacentre address ranges, so CI draws that 403 intermittently and
    there is nothing to change about the request — the fallback order was ours.
    """
    called = []

    def chain(de, proxy, cached):
        called.clear()
        return build_data.from_chain(
            "test feed",
            lambda: called.append("de") or de,
            lambda: called.append("proxy") or proxy,
            lambda: called.append("cache") or cached)

    value, src = chain("DE", "WFCD", "old")
    check("chain: first party wins", (value, src), ("DE", "worldstate"))
    check("chain: and nothing else is asked", called, ["de"],
          "asking the proxy when DE answered spends somebody else's bandwidth")

    value, src = chain(None, "WFCD", "old")
    check("chain: an empty first party falls to the proxy", (value, src), ("WFCD", "proxy"))
    check("chain: in that order", called, ["de", "proxy"])

    value, src = chain(None, None, "old")
    check("chain: the cache is last, not second", (value, src), ("old", "cache"))
    check("chain: and only after both", called, ["de", "proxy", "cache"])

    value, src = chain(None, None, None)
    check("chain: nothing anywhere is not an answer", (value, src), (None, None))

    # An empty list is a miss, not an answer: the proxy returning `[]` for the
    # fissures has to fall through to the cache rather than publish an empty
    # evening. This is the shape the feeds actually return.
    value, src = chain([], [], ["something"])
    check("chain: an empty list is a miss", (value, src), (["something"], "cache"))

    # The middle link must not be able to abort the build. `fetch` raises
    # SystemExit on a cold critical miss, and a fallback that can raise is not a
    # fallback.
    def boom():
        raise SystemExit(2)

    def blow_up():
        raise RuntimeError("connection reset")

    for fail, label in ((boom, "SystemExit"), (blow_up, "an exception")):
        got, where = build_data.from_chain(
            "test feed", lambda: None, fail, lambda: "old")
        check(f"chain: {label} from the proxy is a miss, not a crash",
              (got, where), ("old", "cache"))


def test_fissures_read_from_the_first_party_worldstate() -> None:
    """
    DE publish the worldstate at api.warframe.com/cdn/worldState.php and we read
    the fissures straight from it. The output has to be the shape the WFCD proxy
    produced, to the letter, because `build_fissures` consumes it either way and
    the two must stay interchangeable — whichever is the fallback for the other.

    The node format is the one that matters and is easiest to get subtly wrong:
    `"Charybdis (Sedna)"`, name then system in brackets. Both pages and the
    payload already speak it, and a second spelling would be a second thing to
    keep in step.

    Frozen inputs rather than the live document: what is asserted is the
    mapping, and a test that fetched the worldstate would assert the weather.
    """
    regions = {"ExportRegions_en.json": {"ExportRegions": [
        {"uniqueName": "SolNode196", "name": "Charybdis", "systemName": "Sedna"},
        {"uniqueName": "SolNode1", "name": "Galatea", "systemName": "Neptune"},
        {"uniqueName": "SolNodeNoSystem", "name": "Somewhere", "systemName": ""},
    ]}}
    names = official.node_names(regions)
    check("worldstate: a node id becomes name and system",
          names.get("SolNode196"), "Charybdis (Sedna)")
    check("worldstate: no system means no empty brackets",
          names.get("SolNodeNoSystem"), "Somewhere")
    check("worldstate: Proxima is absent and stays absent",
          names.get("CrewBattleNode522"), None,
          "DE ship no CrewBattleNode rows; inventing one would be worse than none")

    # 2026-08-27T07:30:25.511Z — checked three ways rather than eyeballed, after
    # a first draft of this test asserted a time four hours out and the parser
    # turned out to be the one telling the truth.
    ms = 1787815825511
    doc = {
        "ActiveMissions": [
            {"Node": "SolNode196", "Modifier": "VoidT4",
             "Expiry": {"$date": {"$numberLong": str(ms)}}, "Hard": True},
            {"Node": "SolNode1", "Modifier": "VoidT1",
             "Expiry": {"$date": {"$numberLong": str(ms)}}},
            # unusable, and each for its own reason
            {"Node": "SolNode1", "Modifier": "VoidT9",
             "Expiry": {"$date": {"$numberLong": str(ms)}}},
            {"Node": "SolNode1", "Modifier": "VoidT1"},
        ],
        "VoidStorms": [
            {"Node": "CrewBattleNode522", "ActiveMissionTier": "VoidT1",
             "Expiry": {"$date": {"$numberLong": str(ms)}}},
        ],
    }
    got = official.fissures_from_worldstate(doc, names)
    check("worldstate: an unknown tier and a missing expiry are both dropped",
          len(got), 3, "two of the four ActiveMissions are unusable")
    check("worldstate: a star-chart fissure comes out in the proxy's shape",
          got[0], {"node": "Charybdis (Sedna)", "tier": "Axi",
                   "expiry": "2026-08-27T07:30:25.511Z",
                   "isHard": True, "isStorm": False})
    check("worldstate: Hard is a flag by absence, not a false",
          got[1]["isHard"], False)
    check("worldstate: a storm is a storm, and unnamed",
          (got[2]["isStorm"], got[2]["node"], got[2]["tier"]), (True, None, "Lith"))

    # ...and the build drops the unnamed one rather than shipping an id.
    live = build_data.build_fissures(
        got, datetime.datetime(2026, 8, 27, 6, 0, tzinfo=datetime.timezone.utc))
    check("worldstate: only named fissures reach the payload",
          sorted(f["node"] for f in live), ["Charybdis (Sedna)", "Galatea (Neptune)"])


def test_bounties_and_events_read_from_the_first_party_worldstate() -> None:
    """
    The last two feeds off the WFCD proxy.

    Two traps, both of which would have produced a confident wrong answer:

    **DE publish two windows at once** — the one running and the one after it —
    as separate rows per syndicate. Merging them would average two different
    rotation letters into nonsense; they are passed through as they came, and
    `_one_window` upstream picks.

    **`Goals`, not `Events`.** DE's `Events` is the news feed: Discord invites,
    patch-note links, image URLs. The in-game events this project wants — the
    Ghoul Purge, Plague Star — are `Goals`. Reading the field whose name matches
    would have returned an empty list and looked fine.
    """
    ms = 1787815825511
    when = {"$date": {"$numberLong": str(ms)}}
    doc = {
        "SyndicateMissions": [
            {"Tag": "CetusSyndicate", "Activation": when, "Expiry": when, "Jobs": [
                {"jobType": "/Lotus/Types/Gameplay/Eidolon/Jobs/ReclamationBountyCap",
                 "rewards": "/x/TierATableCRewards", "masteryReq": 2,
                 "minEnemyLevel": 5, "maxEnemyLevel": 15, "xpAmounts": [1, 2, 3]},
            ]},
            {"Tag": "CetusSyndicate", "Activation": when, "Expiry": when, "Jobs": [
                {"jobType": "/x/Other", "rewards": "/x/TierATableARewards",
                 "minEnemyLevel": 5, "maxEnemyLevel": 15, "xpAmounts": [1, 2]},
            ]},
            {"Tag": "ArbitersSyndicate", "Activation": when, "Expiry": when, "Jobs": []},
            {"Tag": "NotASyndicateWeKnow", "Activation": when, "Expiry": when,
             "Jobs": [{"rewards": "/x/TierATableARewards"}]},
        ],
        "Events": [{"Messages": [{"Message": "/Lotus/Language/CommunityMessages/JoinDiscord"}]}],
        "Goals": [{"Tag": "GhoulEmergence", "Node": "EventNode1",
                   "Desc": "/Lotus/Language/Alerts/GhoulEmergence",
                   "Activation": when, "Expiry": when}],
    }

    boards = official.syndicate_missions_from_worldstate(doc)
    check("bounties: both windows come through, not one merged board", len(boards), 2,
          "DE publish this window and the next; averaging them averages two letters")
    check("bounties: a syndicate we have no section for is left out",
          [b["syndicate"] for b in boards], ["Ostrons", "Ostrons"])
    job = boards[0]["jobs"][0]
    check("bounties: the reward path carries across as the uniqueName the letter is read from",
          job["uniqueName"], "/x/TierATableCRewards")
    check("bounties: levels become the pair the family match needs",
          job["enemyLevels"], [5, 15])
    check("bounties: xpAmounts is standingStages under another name",
          len(job["standingStages"]), 3,
          "its length is the stage count a bounty is costed by")
    check("bounties: and no rewardPool is invented", job["rewardPool"], [],
          "DE publish a table path, not names; a made-up pool would poison the vote")

    events = official.events_from_worldstate(doc)
    check("events: Goals are the events, and Events are the news", len(events), 1)
    check("events: with the tag find_live_events actually matches on",
          events[0]["tag"], "GhoulEmergence")
    check("events: and a window", events[0]["expiry"], "2026-08-27T07:30:25.511Z")


def test_the_rotation_letter_is_read_then_cross_checked() -> None:
    """
    The letter Digital Extremes print on each bounty is the primary reading, and
    matching the rewards on offer against their own tables is the cross-check.
    Two independent methods; the day they disagree, the page says so.

    The gate below is the part that matters and the part I nearly shipped
    without. A tier that publishes only table A says `TableA` every hour of every
    day, because that is its only table — read as a rotation letter it is a
    confident answer to a question nobody asked. Level 100-100 and Level 40-60
    Cambion Drift are exactly that, and on the reading this was written against
    they were five of twenty-one jobs: enough to swing a family had the rest been
    closer. So the label is only believed from a tier publishing all three,
    which is the same gate the vote already applied.
    """
    check("rotation: the letter is the Table, never the Tier",
          official.rotation_letter(
              "/Lotus/Types/Game/MissionDecks/EidolonJobMissionRewards/TierATableCRewards"),
          "C", "Tier is the level bracket; reading it instead is the obvious slip")
    check("rotation: anything outside A/B/C is refused",
          [official.rotation_letter(p) for p in
           ("/x/TierATableZRewards", "/x/TableCRewardsExtra", "", None, "/x/TierC")],
          [None, None, None, None, None],
          "a stray letter would reach the countdown the page draws")


def test_resurgence_reads_from_the_first_party_worldstate() -> None:
    """
    Varzia's stock, from DE's own worldstate rather than the WFCD proxy.

    `build_resurgence_set` matches on `uniqueName` with a substring test, and
    DE's `ItemType` is the very path the proxy was republishing — so the two
    routes were checked against each other on live data the day this landed and
    produced the same five Primes. What is asserted here is the mapping and the
    two decisions inside it.
    """
    ms = 1787815825511                       # 2026-08-27T07:30:25.511Z
    doc = {"PrimeVaultTraders": [{
        "Node": "TradeHUB1",
        "Activation": {"$date": {"$numberLong": str(ms)}},
        "Expiry": {"$date": {"$numberLong": str(ms)}},
        "Manifest": [
            {"ItemType": "/Lotus/Types/StoreItems/Packages/MegaPrimeVault/MPVRevenantPrimeSinglePack",
             "PrimePrice": 6},
            {"ItemType": ""},                       # dropped
        ],
        "EvergreenManifest": [
            {"ItemType": "/Lotus/StoreItems/Weapons/Tenno/Rifle/BratonPrime", "PrimePrice": 1},
        ],
    }]}
    got = official.vault_trader_from_worldstate(doc)
    check("resurgence: the rotating stock comes across", len(got["inventory"]), 1,
          "an entry with no ItemType is dropped rather than shipped empty")
    check("resurgence: as a uniqueName the matcher already understands",
          got["inventory"][0]["uniqueName"],
          "/Lotus/Types/StoreItems/Packages/MegaPrimeVault/MPVRevenantPrimeSinglePack")
    check("resurgence: and the window DE publish", got["expiry"], "2026-08-27T07:30:25.511Z")

    # The evergreen 82 are on sale permanently, so folding them in would flag a
    # third of the catalogue as "back this rotation" and mean nothing.
    check("resurgence: the evergreen stock is deliberately not in it",
          [r for r in got["inventory"] if "Braton" in r["uniqueName"]], [])

    # And the matcher gets what it needs out of it, end to end.
    active, window = build_data.build_resurgence_set(got, ["Revenant Prime", "Braton Prime"])
    check("resurgence: a pack name still identifies its Prime",
          sorted(active), ["Revenant Prime"])
    check("resurgence: character and location are left absent, not invented",
          (window["character"], window["location"]), (None, None),
          "the drawer writes Varzia itself and defaults the place")

    check("resurgence: no trader in the document is None, not an empty shell",
          official.vault_trader_from_worldstate({"PrimeVaultTraders": []}), None,
          "None is what makes the caller fall back to the proxy")


def test_artwork_prefers_digital_extremes() -> None:
    """
    Artwork is first party since 2026-08-27. DE's `ExportManifest.json` gives a
    `textureLocation` per `uniqueName` and covers all 167 of the catalogue, so
    the WFCD CDN is the fallback rather than the source — which also drops two
    hosts from the runtime, since `cdn.warframestat.us/img/*` is a redirector
    that answers 301 to `raw.githubusercontent.com`.

    The filename gate matters more here than it did. A CDN URL ended in a bare
    filename; a DE one is a path full of separators with a `!00_<hash>` suffix,
    and that string is used to open a file for writing.
    """
    import artwork
    from sources import DE_TEXTURES, IMG_CDN

    tex = "/Lotus/Interface/Icons/StoreIcons/Primes/AshPrime.png!00_jy1ev7ijK8d8nQ3WuE7NYQ"
    api = {"uniqueName": "/Lotus/Powersuits/Ninja/AshPrime", "imageName": "AshPrime.png"}

    check("artwork: Digital Extremes first when they have it",
          build_data.image_for(api, {api["uniqueName"]: tex}), DE_TEXTURES + tex)
    check("artwork: WFCD when DE's manifest has no row for it",
          build_data.image_for(api, {}), IMG_CDN + "AshPrime.png")
    check("artwork: nothing at all is None, not a broken URL",
          build_data.image_for({}, {}), None)
    check("artwork: and a missing item record does not raise",
          build_data.image_for(None, {}), None)

    # Both shapes reduce to the same local file, which is why an existing
    # assets/img/ folder survives the switch instead of re-downloading.
    check("artwork: a DE url and a CDN url name the same local file",
          (artwork.local_name(DE_TEXTURES + tex), artwork.local_name(IMG_CDN + "AshPrime.png")),
          ("AshPrime.png", "AshPrime.png"),
          "the content hash is part of the path upstream and no part of it here")

    # The gates still hold on the shape that now carries separators.
    for hostile in (DE_TEXTURES + "/Lotus/x/../../../../Windows/Temp/evil.png!00_x",
                    DE_TEXTURES + "/Lotus/x/C:\\Windows\\Temp\\evil.png!00_x",
                    DE_TEXTURES + "/Lotus/x/..!00_x",
                    "https://example.invalid/AshPrime.png"):
        got = artwork.local_name(hostile)
        check_true(f"artwork: refused {hostile[-34:]!r}",
                   got in (None, "evil.png"),
                   "a path may collapse to a basename, but must never escape assets/img")
    check("artwork: traversal collapses rather than escaping",
          artwork.local_name(DE_TEXTURES + "/a/../../etc/passwd!00_x"), "passwd")


def test_a_source_is_not_asked_inside_its_own_window() -> None:
    """
    `PROJECT.md §2` — "Ask no more often than the source says to". A cached copy
    inside the `max-age` its source declared is served without a request at all.

    The drop table is why this exists: it says `max-age=86400`, which matches a
    page whose `Last-Modified` moves every month or two, and `--if-changed` was
    sending it a HEAD every ten minutes — 144 times inside a window Digital
    Extremes had already answered. Measured after: two back-to-back freshness
    probes cost three requests and then one.

    `no-cache` is deliberately not a `max-age` of zero. It means *revalidate*,
    which the conditional request already does in a header exchange with no body,
    so it must leave no window behind or the ETag path would be skipped.
    """
    import sources
    tmp = tempfile.mkdtemp(prefix="primehunter-maxage-")
    try:
        path = os.path.join(tmp, "probe.gz")
        with open(path, "wb") as fh:
            fh.write(b"body")

        sources.write_maxage(path, "public, max-age=86400")
        check("freshness: a max-age is remembered", sources.read_maxage(path), 86400.0)
        check_true("freshness: and a copy inside it is not re-asked for",
                   sources.still_fresh(path))

        old = time.time() - 90000                      # older than the window
        os.utime(path, (old, old))
        check_true("freshness: a copy past it is asked for again",
                   not sources.still_fresh(path))

        for header in ("no-cache", "no-store, max-age=600", None, "public"):
            sources.write_maxage(path, header)
            check(f"freshness: {header!r} leaves no window", sources.read_maxage(path), None,
                  "no-cache means revalidate, which the ETag already does")

        # A missing sidecar costs one request, never a wrong answer.
        sources.write_maxage(path, "max-age=86400")
        os.remove(sources.maxage_path(path))
        check_true("freshness: a lost sidecar means ask, not assume",
                   not sources.still_fresh(path))
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


def test_an_impossible_304_is_treated_as_stale() -> None:
    """
    A `304` says the server has confirmed what we hold is current, and `fetch`
    duly returns the cached bytes without rewriting the file. For most sources
    that is right. For the fissure list it is not: a fissure lasts an hour or
    two, so an unchanged list is only possible for a short while, and a CDN in
    front of a failing origin will answer 304 indefinitely.

    Measured 2026-08-27: `.cache/api_fissures.gz` had an mtime three days old,
    so no successful 200 had arrived in three days — and every build in between
    reported nothing stale and published an empty fissure list. Zero fissures is
    documented as normal rather than a fault, so nothing on the page said a word.

    Exercised through the age check rather than through a real 304, because what
    is being asserted is the policy: a copy older than the document can be gets
    recorded as stale, and one that is not does not.
    """
    import sources
    tmp = tempfile.mkdtemp(prefix="primehunter-304-")
    stale, ages = list(sources.STALE), dict(sources.STALE_AGE)
    try:
        path = os.path.join(tmp, "api_fissures.gz")
        with open(path, "wb") as fh:
            fh.write(b"yesterday's fissures")

        # Fresh enough to believe: a fissure list can genuinely be unchanged.
        os.utime(path, (time.time() - 600, time.time() - 600))
        sources.STALE.clear(); sources.STALE_AGE.clear()
        sources.stale_if_older("api_fissures", path, 3 * 3600)
        check("fetch: a recent unchanged copy is not an alert", sources.STALE, [],
              "ten minutes without a new fissure is an ordinary evening")

        # Older than any fissure lives: the feed is broken, whatever it says.
        old = time.time() - 3 * 24 * 3600
        os.utime(path, (old, old))
        sources.stale_if_older("api_fissures", path, 3 * 3600)
        check("fetch: a copy older than the document can be is stale",
              sources.STALE, ["api_fissures"],
              "a 304 from a CDN in front of a dead origin is not a confirmation")
        check_true("fetch: and it records when that copy was written",
                   sources.STALE_AGE.get("api_fissures") == old)

        # No policy given, no opinion offered — every other source is unchanged.
        sources.STALE.clear(); sources.STALE_AGE.clear()
        sources.stale_if_older("api_items", path, None)
        check("fetch: a source with no lifetime keeps the old behaviour",
              sources.STALE, [])
    finally:
        sources.STALE[:] = stale
        sources.STALE_AGE.clear(); sources.STALE_AGE.update(ages)
        shutil.rmtree(tmp, ignore_errors=True)


def test_an_unreadable_export_index_degrades_instead_of_crashing() -> None:
    """
    `acquire_export` has always had a hand-written giving-up path, and that path
    returned two values where the caller unpacks three. So the one moment it was
    written for - the export being unreadable - would have raised a ValueError
    from the assignment rather than degrading, and the build would have died
    with a message about tuple sizes instead of about Digital Extremes.

    Never fired, because DE's index has never been reachable-but-corrupt. This
    is what it does now.
    """
    real = build_data.fetch
    try:
        build_data.fetch = lambda *a, **k: b"not an lzma stream at all"
        got = build_data.acquire_export(False)
        # Four since 2026-08-27, when the texture manifest joined the tuple. The
        # number is not the point and never was: the two paths have to agree, and
        # this is what says so out loud when one of them grows.
        check("export: gives up with the four values the caller unpacks", len(got), 4)
        primes, levels, digest, extra = got              # the line that used to raise
        check("export: and they are empty rather than wrong",
              (primes, levels, digest), ([], {}, None))
        # The fourth is a named bag so the tuple stops growing — but it must
        # still carry every key the caller reads, or the giving-up path trades a
        # ValueError for a KeyError and nothing is gained.
        # `partSpecs` joined the bag on 2026-08-27, when the part list, the
        # quantities and the ducat values moved to DE's own manifests. It is
        # named here on purpose: an empty one falls the parts back to the item
        # API, and a MISSING one would be a KeyError on the giving-up path,
        # which is exactly what this check exists to prevent.
        check("export: and the bag has the keys the caller reads, empty",
              extra, {"textures": {}, "nodeNames": {}, "partSpecs": {}})
    finally:
        build_data.fetch = real


def test_cold_failure_is_fatal() -> None:
    """
    The warm/cold policy: a refresh that fails with nothing cached is critical,
    because the alternative is silently publishing a site with most of the game
    missing. It must exit non-zero unless --allow-degraded is passed.
    """
    tmp = tempfile.mkdtemp(prefix="primehunter-cold-")
    try:
        for d in ("tools", "data"):
            os.makedirs(os.path.join(tmp, d), exist_ok=True)
        for f in os.listdir(os.path.join(ROOT, "tools")):
            if f.endswith(".py"):
                shutil.copy(os.path.join(ROOT, "tools", f), os.path.join(tmp, "tools", f))
        # no .cache and no network: every fetch is a cold miss
        env = dict(os.environ, PRIMEHUNTER_TEST_NO_NETWORK="1",
                   http_proxy="http://127.0.0.1:9", https_proxy="http://127.0.0.1:9")
        r = subprocess.run([sys.executable, "tools/build_data.py", "--offline"],
                           cwd=tmp, capture_output=True, text=True, env=env, timeout=180)
        check_true("cold build: refuses to write a thin site", r.returncode != 0,
                   "a cold failure must not silently produce a partial dataset")
        wrote = os.path.exists(os.path.join(tmp, "data", "prime-data.js"))
        check("cold build: writes no data file", wrote, False)
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


def test_clone_and_build(online: bool) -> None:
    """
    The new-user path: clone the repo, run the build, get a working site. Nothing
    else covers it, because every other test runs in a tree that already has a
    warm cache and a built dataset.
    """
    if not online:
        print("  skip clone-and-build (needs --online)")
        return
    tmp = tempfile.mkdtemp(prefix="primehunter-clone-")
    try:
        r = subprocess.run(["git", "clone", "--depth", "1", ROOT, tmp],
                           capture_output=True, text=True, timeout=300)
        check("clone: succeeds", r.returncode, 0, r.stderr[-300:])

        # a fresh clone must not carry the dataset -- it is gitignored on purpose
        check("clone: ships no dataset",
              os.path.exists(os.path.join(tmp, "data", "prime-data.js")), False,
              "DE's data is rebuilt on demand, never committed")
        check("clone: ships no artwork",
              os.path.isdir(os.path.join(tmp, "assets", "img")), False)

        r = subprocess.run([sys.executable, "tools/build_data.py"],
                           cwd=tmp, capture_output=True, text=True, timeout=900)
        check("clone: build succeeds", r.returncode, 0, r.stdout[-600:] + r.stderr[-600:])

        built = os.path.join(tmp, "data", "prime-data.json")
        check_true("clone: dataset written", os.path.exists(built))
        if os.path.exists(built):
            D = read_json(built)
            check_true("clone: catalogue is populated", len(D["items"]) > 100)
            check_true("clone: relics are populated", len(D["relics"]) > 500)
            check("clone: no degraded sources", D["meta"].get("degraded"), [])
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


def test_unreachable_sources_are_tagged() -> None:
    """
    The planner answers "where do I go next", so a source belongs in it only if
    it can be entered today. A mockup ranked `Hemocyte` **first** - eleven live
    relics, top of the list - and it appears only in the final stage of the
    Plague Star bounty, an event last run years ago.

    Three kinds cannot be entered, and each is tagged rather than deleted,
    because the collection view still wants to say where a relic comes from.
    """
    rows = {
        "Meso D8": [
            {"kind": "key", "planet": "Keys & Special", "node": "Sunkiller",
             "mode": "Key", "rotation": "C", "chance": 2.0},
            {"kind": "key", "planet": "Keys & Special", "node": "Jordas Golem Assassinate",
             "mode": "Key", "rotation": "C", "chance": 2.0},
            {"kind": "enemy", "planet": "Enemy drops", "node": "Hemocyte",
             "mode": "Enemy", "rotation": None, "chance": 12.9},
            {"kind": "bounty", "planet": "Fortuna (Orb Vallis)",
             "node": "Level 40 - 60 PROFIT-TAKER - PHASE 1", "mode": "Bounty",
             "rotation": None, "chance": 12.5},
            {"kind": "mission", "planet": "Void", "node": "Ukko",
             "mode": "Capture", "rotation": None, "chance": 10.0},
        ]
    }
    counts = build_data.tag_access(rows, [])
    got = {r["node"]: r.get("access") for r in rows["Meso D8"]}
    check("quest missions are tagged", got["Sunkiller"], "quest")
    check("a repeatable key mission is not", got["Jordas Golem Assassinate"], None,
          "Jordas needs a crafted key but can be run as often as you like")
    check("an event-only enemy rides its event", got["Hemocyte"], "event:Plague Star")
    # Profit-Taker was tagged "unmodelled" here until 2026-08-14, on the belief
    # that its phases were not independent and that Phase 3's first/subsequent
    # split could not be expressed. Both were wrong: the wiki says each phase is
    # freely replayable after one sequential clear, and the "First Completion"
    # table carries a Gravimag and no relics, so there is no "once ever" to
    # express. It is permanent content with a standing gate, which is a badge
    # rather than a reason to hide it.
    check("Profit-Taker is a place you can go",
          got["Level 40 - 60 PROFIT-TAKER - PHASE 1"], None)
    check("an ordinary node is left alone", got["Ukko"], None)
    check("and the build can report what it tagged", counts,
          {"quest": 1, "event:Plague Star": 1})

    # the same tagging reaches the Aya rows, which are scored the same way
    aya = [{"kind": "enemy", "node": "Hemocyte", "mode": "Enemy", "chance": 1.0}]
    build_data.tag_access({}, aya)
    check("Aya rows are tagged too", aya[0].get("access"), "event:Plague Star")

    # and it holds against the built payload rather than only a fixture
    payload = os.path.join(ROOT, "data", "prime-data.json")
    if os.path.exists(payload):
        D = read_json(payload)
        live = [s for r in D["relics"].values() for s in (r.get("sources") or [])
                if not r.get("vaulted")]
        check("no live quest mission is left untagged",
              sorted({s["node"] for s in live
                      if s["node"] in build_data.QUEST_MISSIONS and not s.get("access")}), [])
        check("Hemocyte is tagged in the real data",
              sorted({s.get("access") for s in live if s["node"] == "Hemocyte"}),
              ["event:Plague Star"])


def test_an_optional_source_cannot_fail_the_build() -> None:
    """
    A cold miss on a source the dataset merely benefits from must not abort a
    build that has the catalogue, the relics and the drop tables in hand.

    This is the bug that took CI red. The bounty rotation added two worldstate
    fetches; api.warframestat.us did not answer the runner, both landed in
    MISSING, and MISSING aborts. A whole publish was refused because a
    countdown was unavailable.

    Checked against sources.fetch directly rather than by running a build,
    because the interesting case is the one where the network is down - which a
    test cannot arrange, but an unroutable host can.
    """
    before_missing = list(sources.MISSING)
    unreachable = "https://primehunter.invalid./nothing"

    got = sources.fetch(unreachable, "test_optional_source", optional=True)
    check("optional source: a cold miss returns nothing", got, None)
    check("optional source: and is not counted as missing",
          [k for k in sources.MISSING if k not in before_missing], [],
          "MISSING aborts the build, so an enrichment source must stay out of it")

    # the same miss on a source the dataset genuinely needs is still fatal
    try:
        sources.fetch(unreachable, "test_required_source", critical=True)
        check_true("required source: a cold miss still aborts", False)
    except SystemExit:
        check_true("required source: a cold miss still aborts", True)
    finally:
        sources.MISSING[:] = before_missing

    # and the two that caused it are actually declared optional at the call
    # site, not merely importable that way
    build = read_text(os.path.join(ROOT, "tools", "build_data.py"))
    not_optional = []
    for key in ("SYNDICATE_MISSIONS", "WORLD_EVENTS"):
        call = re.search(r"fetch_json\(\s*" + key + r"\b[^)]*\)", build, re.S)
        if not call or "optional=True" not in call.group(0):
            not_optional.append(key)
    check("the worldstate fetches are declared optional", not_optional, [],
          "without it an unreachable worldstate aborts the whole build")


def test_no_writer_leaves_orphans() -> None:
    """
    Every writer must either overwrite a fixed name or prune what it no longer
    references. assets/img/ once kept 110 files and 5.7 MB for items that had
    left the catalogue, and nothing noticed.
    """
    import artwork as art
    D_path = os.path.join(ROOT, "data", "prime-data.json")
    if not os.path.exists(D_path):
        print("  skip orphan check (no dataset)")
        return
    D = read_json(D_path)

    if art.have_local_images():
        used = {os.path.basename(i["image"]) for i in D["items"]
                if (i.get("image") or "").startswith("assets/img/")}
        ondisk = {f for f in os.listdir(art.IMG_DIR)
                  if os.path.isfile(os.path.join(art.IMG_DIR, f))}
        check("orphans: no unused artwork", sorted(ondisk - used), [])

    cache = os.path.join(ROOT, ".cache")
    if os.path.isdir(cache):
        # wiki_<Item> entries are the only cache family that can orphan
        pages = {f[len("wiki_"):-3] for f in os.listdir(cache)
                 if f.startswith("wiki_") and f.endswith(".gz")} - {"prime"}
        known = {i["wikiUrl"].rsplit("/", 1)[-1] for i in D["items"]}
        check("orphans: no stale wiki cache", sorted(pages - known), [],
              "a Prime leaving the catalogue used to leave its page cached")


def test_launchers_are_runnable() -> None:
    """
    Launchers break in opposite ways on the two platforms, and neither failure
    is visible while editing. cmd.exe cannot parse an LF-only batch file and
    reads them in the OEM codepage rather than UTF-8; a shell script with CRLF
    fails to start at all on macOS and Linux. Both bit at once: refresh-data.cmd was
    written with LF endings and em dashes, and every REM line came back as
    "'M' is not recognized as an internal or external command".

    Nothing about editing these files makes the problem visible - they look
    perfect in an editor - so it has to be checked rather than remembered.
    """
    import glob
    for path in sorted(glob.glob(os.path.join(ROOT, "*.cmd"))):
        name = os.path.basename(path)
        raw = read_bytes(path)
        lf = raw.count(b"\n")
        crlf = raw.count(b"\r\n")
        check(f"{name}: every line ends CRLF", lf, crlf,
              "cmd.exe mis-parses LF-only batch files")
        bad = sorted({b for b in raw if b > 127})
        check(f"{name}: pure ASCII", [hex(b) for b in bad], [],
              "cmd.exe reads these in the OEM codepage, not UTF-8")

    # Shell scripts are the exact mirror: a CRLF one dies on Linux with
    # "bad interpreter: /usr/bin/env bash^M", which names the file rather than
    # the problem and is a genuinely baffling first thing to hit.
    shells = (sorted(glob.glob(os.path.join(ROOT, "*.sh")))
              + sorted(glob.glob(os.path.join(ROOT, "tools", "*.sh"))))
    for path in shells:
        name = os.path.basename(path)
        raw = read_bytes(path)
        check(f"{name}: no CR anywhere", raw.count(b"\r"), 0,
              "a CRLF shell script will not run on macOS or Linux")
        check_true(f"{name}: has a shebang", raw.startswith(b"#!"))
        # git tracks the execute bit, and a scheduler script that has to be
        # invoked as `bash x.sh` is one nobody will invoke the documented way
        mode = subprocess.run(["git", "ls-files", "-s", "--", path],
                              cwd=ROOT, capture_output=True, text=True).stdout.split()
        if mode:
            check(f"{name}: committed executable", mode[0], "100755")

    # PowerShell must run under both Windows PowerShell 5.1 and pwsh 7+. These
    # are the constructs that quietly split them; each is a real trap rather
    # than a hypothetical one.
    for path in sorted(glob.glob(os.path.join(ROOT, "tools", "*.ps1"))):
        name = os.path.basename(path)
        text = read_text(path)
        raw = read_bytes(path)
        check(f"{name}: CRLF endings", raw.count(b"\r" + b"\n"),
              raw.count(b"\n"),
              "5.1 is happiest with CRLF, and reads BOM-less files as ANSI")
        check(f"{name}: pure ASCII", [hex(b) for b in sorted({b for b in raw if b > 127})], [])
        check_true(f"{name}: declares a minimum version", "#Requires -Version" in text)
        # $IsWindows does not exist before 6.0, so reading it directly is an
        # error under Set-StrictMode on 5.1 rather than simply false
        naked = re.findall(r"(?<!Name )(?<!-Name )" + re.escape("$IsWindows"), text)
        guarded = "Get-Variable -Name IsWindows" in text
        check_true(f"{name}: $IsWindows is guarded for 5.1", not naked or guarded,
                   "reading it unguarded throws under strict mode on 5.1")
        # strip comments first - the script's own docstring names these
        # operators to explain why they are avoided, which is not a use of them
        code = re.sub(r"<#.*?#>", "", text, flags=re.S)
        code = re.sub(r"^\s*#.*$", "", code, flags=re.M)
        for bad, why in ((" ?? ", "null-coalescing is 7.0+"),
                         (" ? ", "ternary is 7.0+"),
                         ("-Parallel", "ForEach-Object -Parallel is 7.0+")):
            check(f"{name}: no {bad.strip()}", bad in code, False, why)


def test_runs_on_the_other_platform() -> None:
    """
    Everything here is developed on Windows and has to work on macOS and Linux,
    where none of these failures can be seen while writing the code. They are
    all silent locally and fatal elsewhere, which is the worst combination.

    Each check is one property asserted over every file it applies to, and names
    every offender when it fails. Asserting per file and per pattern instead
    turned eight properties into eighty-nine lines of "ok", which made the suite
    look three times broader than it is and buried the interesting failures.
    """
    import glob

    tools = sorted(glob.glob(os.path.join(ROOT, "tools", "*.py")))
    pys = tools + sorted(glob.glob(os.path.join(ROOT, "tests", "*.py")))
    launchers = sorted(glob.glob(os.path.join(ROOT, "*.sh")) +
                       glob.glob(os.path.join(ROOT, "*.cmd")))

    # 1. A launcher without its opposite number is a feature that only half the
    #    users have. Both are meant to do exactly the same thing.
    cmds = {os.path.splitext(os.path.basename(p))[0]
            for p in glob.glob(os.path.join(ROOT, "*.cmd"))}
    shs = {os.path.splitext(os.path.basename(p))[0]
           for p in glob.glob(os.path.join(ROOT, "*.sh"))}
    check("launchers: every .cmd has a .sh, and back", sorted(cmds ^ shs), [])

    # 2. Case. NTFS does not care, ext4 does: a link written as Assets/App.js
    #    works on the machine it was written on and 404s on the server.
    #
    #    The dataset is generated and gitignored, so a fresh checkout has not
    #    got one yet - which is exactly the state CI runs the tests in, and
    #    this check duly failed there on its first run. Absence is only a
    #    problem for files that are supposed to be committed.
    GENERATED = {"data/prime-data.js"}
    miscased, absent, seen = [], [], 0
    for page in ("index.html", "plan.html"):
        markup = read_text(os.path.join(ROOT, page))
        for ref in re.findall(r'(?:src|href)="(?!data:|https?:|#)([^"]+)"', markup):
            if "${" in ref:
                continue
            seen += 1
            target = os.path.join(ROOT, *ref.split("/"))
            if not os.path.exists(target):
                if ref not in GENERATED:
                    absent.append(page + " -> " + ref)
                continue
            # os.path.exists is case-insensitive on Windows, so ask the
            # directory what it actually calls the file
            if os.path.basename(ref) not in os.listdir(os.path.dirname(target)):
                miscased.append(page + " -> " + ref)
    check_true("pages: reference their assets at all", seen >= 8)
    check("pages: every committed reference is present", absent, [])
    check("pages: every local reference is spelled the way the disk spells it",
          miscased, [],
          "a case mismatch is invisible on Windows and fatal on Linux")

    # 3. Backslashes in a URL are not a path separator, they are a character.
    backslashed = [os.path.basename(p)
                   for p in sorted(glob.glob(os.path.join(ROOT, "assets", "*.js")))
                   if re.search(r'(?:src|href)\s*=\s*["\'][^"\']*\\\\', read_text(p))]
    check("assets: no backslash paths in emitted URLs", backslashed, [])

    # 4. Python floor. README promises 3.8, and every annotation in the tools is
    #    written in the 3.10 style, which only parses there because of the
    #    __future__ import. Losing that line is a syntax error for anyone on an
    #    older interpreter and no error at all here.
    modern = re.compile(r"->\s*[\w.\[\]]+\s*\|\s*None|:\s*(?:dict|list|set|tuple)\[")
    check("python: 3.10-style hints keep their __future__ import",
          [os.path.basename(p) for p in pys
           if modern.search(read_text(p))
           and "from __future__ import annotations" not in read_text(p)], [],
          "without it they are a syntax error on the 3.8 the README promises")

    # 5. Constructs newer than the floor, which fail at runtime rather than at
    #    import and so survive every check that only compiles the file.
    TOO_NEW = ((r"\.removeprefix\(", "str.removeprefix is 3.9+"),
               (r"\.removesuffix\(", "str.removesuffix is 3.9+"),
               (r"\bfunctools\.cache\b", "functools.cache is 3.9+"),
               (r"\bzoneinfo\b", "zoneinfo is 3.9+"),
               (r"^\s*match\s+.+:\s*$", "match statements are 3.10+"))
    check("python: nothing newer than the 3.8 floor",
          [os.path.basename(p) + ": " + why
           for p in tools for pattern, why in TOO_NEW
           if re.search(pattern, read_text(p), re.M)], [])

    # fromisoformat only learned to read a trailing Z in 3.11, and the
    # worldstate writes nothing else, so the Z has to be replaced by hand
    build = read_text(os.path.join(ROOT, "tools", "build_data.py"))
    check("python: fromisoformat never sees a bare Z",
          [m.group(1) for m in re.finditer(r"fromisoformat\((.{0,60})", build)
           if "replace(" not in m.group(1)], [],
          "a bare Z only parses on 3.11+")

    # 6. Absolute paths from whichever machine last touched the file. tests/ is
    #    exempt: it is where Node is looked for by force.
    check("scripts: no absolute local paths",
          [os.path.basename(p) for p in tools + launchers
           if re.search(r"[\"'][A-Za-z]:[\\/]{1,2}Users[\\/]{1,2}", read_text(p))], [])

    # 7. Artwork filenames come from DE's item data and are written to disk. A
    #    colon or a question mark in one is legal on Linux and unopenable on
    #    Windows, so the whole cache would fail there and nowhere else.
    #
    #    This check used to call os.path.basename INSIDE the filter, before
    #    searching for an illegal character - so "../app.js" was tested as
    #    "app.js" and passed, and a filename that walked out of assets/img/
    #    could not be seen by the one test looking at filenames. The property is
    #    now the stronger one it should always have been: the name must be a
    #    plain leaf, which is also what artwork.local_name enforces.
    payload = os.path.join(ROOT, "data", "prime-data.json")
    if os.path.exists(payload):
        illegal = re.compile(r'[<>:"|?*\\/]')
        names = [str(i["image"]).rsplit("/", 1)[-1] if "/" in str(i["image"])
                 else str(i["image"])
                 for i in read_json(payload)["items"] if i.get("image")]
        check("artwork: every filename is legal on Windows",
              [n for n in names if illegal.search(n)][:5], [])

    # 8. And the derivation itself, which is where the traversal lived: the
    #    filename is third-party text from the items API and it lands in a path
    #    that gets opened for writing. Named payloads rather than generated
    #    ones, so a reader can see exactly what is being refused.
    sys.path.insert(0, os.path.join(ROOT, "tools"))
    import artwork

    hostile = ("../app.js", "..%5c..%5cserve.cmd", "../../serve.cmd",
               r"..\..\.git\hooks\pre-commit", r"C:\Windows\Temp\x.png",
               "/Windows/x.png", "sub/nested.png", ".", "..", "",
               "a b.png", "x:stream.png", "\u00e9.png")
    check("artwork: a hostile filename is refused",
          [n for n in hostile
           if artwork.local_name(artwork.IMG_CDN + n) is not None], [],
          "os.path.join gives away the whole disk to a name with a drive on it")

    check("artwork: an ordinary filename survives",
          [artwork.local_name(artwork.IMG_CDN + n)
           for n in ("AshPrime.png", "Braton_Prime.png", "a-b.1.png")],
          ["AshPrime.png", "Braton_Prime.png", "a-b.1.png"],
          "a rule that refuses real artwork is a broken build, not a safe one")

    check("artwork: a query string is dropped, not treated as a name",
          artwork.local_name(artwork.IMG_CDN + "AshPrime.png?v=2"), "AshPrime.png")

    check("artwork: another host is not ours to cache",
          artwork.local_name("https://example.invalid/img/AshPrime.png"), None)

    # 9. The other boundary sanitiser, for the same reason: three fields the
    #    pages interpolate into markup are documented as numeric and arrive as
    #    third-party JSON, which does not make them numeric.
    hostile_nums = ('<img src=x onerror=alert(1)>', "3", "", None, True, False,
                    [], {}, 1.5, float("nan"), float("inf"), "1e3")
    check("as_int: nothing but a whole number survives",
          [repr(v) for v in hostile_nums if build_data.as_int(v) is not None], [],
          "a string here reaches innerHTML through a template literal")

    check("as_int: real values pass through",
          [build_data.as_int(v) for v in (0, 1, 15, 100, 2.0, -3)],
          [0, 1, 15, 100, 2, -3])

    check("as_int: the fallback is used, not invented",
          (build_data.as_int(None, 1), build_data.as_int("x", 1),
           build_data.as_int(0, 1)),
          (1, 1, 0),
          "a real zero must not be replaced by the default")


def test_a_pre_refined_relic_reward_keeps_its_refinement() -> None:
    """
    DE names a refinement on a relic *reward* row only when the relic arrives
    already refined -- "Lith Q3 Relic (Radiant)" against the usual "Lith Q3
    Relic". Eighty rows do, every one Radiant, across eleven nodes: Elite
    Sanctuary Onslaught, the six Void Storms and the four Profit-Taker phases.

    It used to be parsed off and dropped, which made those nodes look like they
    handed over an ordinary Intact relic. Refining one costs 100 Void Traces and
    moves a blocked rare from ~50 expected openings to ~10, so the difference is
    not cosmetic in either direction: it is a gain when the plan wanted Radiant
    and a loss when the plan wanted the common.

    The relic *contents* tables name a refinement on every row and always did --
    that is what a relic holds at each quality, a different question -- so this
    checks the reward rows only.
    """
    page = """
<h3 id="missionRewards">Missions</h3>
<table>
<tr><th>Sanctuary/Elite Sanctuary Onslaught (Sanctuary Onslaught)</th></tr>
<tr><th>Rotation A</th></tr>
<tr><td>Lith Q3 Relic (Radiant)</td><td>Rare (7.04%)</td></tr>
<tr><td>Meso D8 Relic</td><td>Rare (7.04%)</td></tr>
<tr><th>Earth/Cambria (Defense)</th></tr>
<tr><th>Rotation A</th></tr>
<tr><td>Lith Q3 Relic</td><td>Uncommon (11.06%)</td></tr>
</table>
"""
    _, sources, _ = official.parse_droptables(page)
    rows = {(r["node"], r.get("refinement")) for rows_ in sources.values() for r in rows_}

    check("a pre-refined reward keeps the refinement DE named",
          ("Elite Sanctuary Onslaught", "Radiant") in rows, True,
          "100 Void Traces of refinement given away unrecorded")
    check("an ordinary reward names no refinement",
          ("Cambria", None) in rows, True,
          "a field carried on every row to say the usual thing is noise")
    check("the relic is still the same relic",
          sorted(sources), ["Lith Q3", "Meso D8"],
          "the refinement must not leak into the relic's name")

    # ...and against the real table, if this checkout has been built. Eleven
    # nodes, eighty rows, every one Radiant. A new one appearing is worth
    # knowing about rather than absorbing silently.
    built = os.path.join(ROOT, "data", "prime-data.json")
    if os.path.exists(built):
        with open(built, encoding="utf-8") as fh:
            payload = json.load(fh)
        live = [s for rec in payload["relics"].values()
                for s in rec.get("sources") or [] if s.get("refinement")]
        check("every pre-refined reward in the real table is Radiant",
              sorted({s["refinement"] for s in live}), ["Radiant"])
        odd = sorted({s["node"] for s in live
                      if not ("Onslaught" in s["node"] or "Void Storm" in s["node"]
                              or "PROFIT-TAKER" in s["node"])})
        check("only Onslaught, Void Storms and Profit-Taker pre-refine", odd, [],
              "a new node hands out refined relics - worth pricing deliberately")


def test_no_source_file_carries_a_control_byte() -> None:
    """
    A regex reached the browser as `/^Faceoff\\x08/i` — a shell heredoc turned
    the word boundary `\\b` into a literal backspace byte. It matched nothing,
    threw nothing, and simply never showed the badge it was written for.

    That failure mode is the reason this exists: an escape mangled on its way
    through a shell into a file is invisible in an editor, survives every syntax
    check, and only shows up as behaviour that quietly does not happen. Tab,
    newline and carriage return are the only control characters a source file
    has any business containing.
    """
    import glob
    allowed = {0x09, 0x0A, 0x0D}
    offenders = []
    for path in sorted(glob.glob(os.path.join(ROOT, "assets", "*.js")) +
                       glob.glob(os.path.join(ROOT, "assets", "*.css")) +
                       glob.glob(os.path.join(ROOT, "tools", "*.py")) +
                       glob.glob(os.path.join(ROOT, "tests", "*.py")) +
                       glob.glob(os.path.join(ROOT, "tests", "*.mjs")) +
                       glob.glob(os.path.join(ROOT, "*.html"))):
        for byte in read_bytes(path):
            if byte < 0x20 and byte not in allowed:
                offenders.append(f"{os.path.basename(path)}: 0x{byte:02x}")
                break
    check("no source file carries a stray control byte", offenders, [],
          "an escape mangled through a shell is invisible in an editor")


def test_the_guard_refuses_shell_writes_to_source() -> None:
    """
    The test above finds the damage; `tools/guard_shell_writes.py` refuses the
    path that causes it, as a PreToolUse hook on the shell tools. A guard that
    over-blocks gets switched off within the hour, so both directions matter:
    it has to stop a heredoc writing `assets/rotation.js` and stay out of the
    way of the dozens of ordinary reads, builds and greps that touch the same
    files. `README.md` has the wiring; the hook itself is machine-local.
    """
    refuse = [
        "cat > assets/rotation.js <<'EOF'\nconst x = 1;\nEOF",
        "echo hi >> tools/build_data.py",
        "sed -i s/a/b/ assets/styles.css",
        "python -c \"open('tests/test_build.py','w').write(1)\"",
        "cat header.txt > index.html",
        "Set-Content -Path assets/model.js -Value $x",
        # A program on STDIN rather than on the command line. Missed until
        # 2026-09-01 over a single `\b` in INLINE_PROGRAM, and it is the form an
        # assistant reaches for the moment a script outruns one line — so it was
        # both the widest hole and the likeliest one to be used. Three writes
        # went through it the day it was found; one mangled `\d` and `\/` in a
        # regex on the way in and failed on an assertion by luck.
        "python - <<'PY'\nopen('assets/plan.js','w').write('x')\nPY",
        "python3 - <<'EOF'\nimport io\nio.open('tests/test_pages.mjs','w').write(s)\nEOF",
        "node - <<'JS'\nwriteFileSync('assets/shared.js', out)\nJS",
        "python < patch.py   # writes open('tools/serve.py','w')",
    ]
    allow = [
        "python tests/test_build.py",
        "node --check assets/rotation.js",
        "sed -n 1,20p assets/plan.js",
        "grep -n foo assets/*.js 2>/dev/null",
        "cp assets/app.js /tmp/app.bak",
        "python tools/build_data.py > /tmp/build.log 2>&1",
        "python tools/build_data.py --offline",
        "git commit -m 'message'",
        # The other half of widening INLINE_PROGRAM, and the half that decides
        # whether the guard survives contact with daily use. A stdin program
        # that only READS is the common case by far — every probe in
        # `CLAUDE.md` is one — and a guard that prompts on those gets switched
        # off within the week. `WRITES` is what has to carry that weight.
        "python - <<'PY'\nimport json\nprint(json.load(open('data/prime-data.json'))['meta'])\nPY",
        "python - <<'PY'\nprint(open('assets/plan.js').read().count('relicTier'))\nPY",
        "node - <<'JS'\nconsole.log(readFileSync('assets/model.js','utf8').length)\nJS",
        # Writing, but to somewhere the guard deliberately does not cover:
        # generated output, and the scratchpad.
        "python - <<'PY'\nopen('data/feed-log.json','w').write(x)\nPY",
        "python - <<'PY'\nopen('/tmp/scratchpad/probe.mjs','w').write(src)\nPY",
    ]
    check("guard: refuses every shell write to a source file",
          [c for c in refuse if not guard_shell_writes.blocked(c)], [],
          "a write that slips past the guard is the bug class coming back")
    check("guard: leaves ordinary shell work alone",
          [c for c in allow if guard_shell_writes.blocked(c)], [],
          "over-blocking is how a guard gets switched off")


def test_markup_is_xml_well_formed() -> None:
    """
    The pages are served as HTML5 and always will be, but they are held to XML
    well-formedness anyway.

    Not for security -- XHTML prevents no attack. For unambiguity: HTML5 parsers
    silently repair unclosed tags, bare boolean attributes and stray entities,
    so a genuine mistake looks fine until a different parser disagrees. Checking
    it here catches the same class of error XHTML would, at the cost of a red
    test rather than a blank page in front of a user.
    """
    import xml.etree.ElementTree as ET
    for name in ("index.html", "plan.html"):
        src = re.sub(r"<!doctype html>", "", read_text(os.path.join(ROOT, name)),
                     flags=re.I)
        try:
            ET.fromstring(src)
            check_true(f"{name}: well-formed as XML", True)
        except ET.ParseError as exc:
            check(f"{name}: well-formed as XML", str(exc), "",
                  "unclosed tag, bare boolean attribute, or a non-XML entity")


def test_server_serves_only_the_site() -> None:
    """
    The server used to publish its whole directory with browsable listings. In
    this folder that meant .git -- pack files and all, from which a private
    repository can be reconstructed -- plus .cache, tools and tests.

    An allowlist rather than a blocklist: a blocklist has to predict what is
    worth hiding, and .git was on nobody's list until it was checked.
    """
    sys.path.insert(0, os.path.join(ROOT, "tools"))
    import serve

    # Both directions in one assertion each, naming whatever went wrong: a
    # per-path check told us nothing extra and turned two properties into
    # twenty-one lines of output.
    wanted = ("index.html", "plan.html", "assets/app.js", "assets/plan.js",
              "assets/rotation.js", "assets/shared.js", "assets/model.js",
              "assets/styles.css", "data/prime-data.js", "data/fissures.json",
              # Generated rather than a file on disk, and on the allowlist all
              # the same so this set stays the one answer to what is served.
              "upstream.json",
              "assets/img/AshPrime.png")
    check("serves every file the pages ask for",
          [p for p in wanted if not serve.allowed(p)], [])

    forbidden = (".git/config", ".git/HEAD", ".git/objects/info/packs",
                 ".cache/api_items.gz", ".cache/state.json", "tools/serve.py",
                 "tests/test_build.py", ".gitignore", "PROJECT.md",
                 "dist/warframe-prime-hunter.html", "assets/img/sub/nested.png")
    check("serves nothing else", [p for p in forbidden if serve.allowed(p)], [],
          "an allowlist that leaks is worse than none, because it is trusted")

    # temp_mockup.html is a local scratchpad for showing a proposed change
    # against real data (PROJECT.md §2). It is unreviewed and is not part of the
    # site, so it is local-only by peer address rather than by anyone
    # remembering which launcher they used.
    #
    # The server refuses to bind anything but loopback since 2026-09-01, so a
    # non-loopback peer can no longer arrive - and these keep asserting the rule
    # anyway, with fabricated addresses. The check is about the request rather
    # than the socket, so it is the one that still holds if these files are ever
    # put behind something that does listen more widely.
    check("mockup: served to this machine",
          [p for p in ("127.0.0.1", "::1", "::ffff:127.0.0.1")
           if not serve.allowed("temp_mockup.html", p)], [])
    check("mockup: refused to everyone else",
          [p for p in ("192.168.1.169", "10.0.0.4", "203.0.113.9", "", None)
           if serve.allowed("temp_mockup.html", p)], [],
          "a LAN guest must never reach an unreviewed local page")
    # Who is reading is the server's answer to give, since it is the only party
    # that can see the peer. The page used to guess from location.hostname and
    # got your own LAN address wrong - warned about something you could fix,
    # and not told how.
    check("owner: this machine is the owner, however it spells itself",
          [p for p in ("127.0.0.1", "::1", "::ffff:127.0.0.1", "localhost")
           if not serve.is_loopback(p)], [])
    check("owner: everyone else is a guest",
          [p for p in ("192.168.1.169", "203.0.113.9", "10.0.0.4", "", None)
           if serve.is_loopback(p)], [],
          "a guest told to double-click a file they do not have is noise")

    check("mockup: a real page is not caught by the local-only rule",
          serve.allowed("index.html", "192.168.1.169"), True,
          "the local-only rule must not have narrowed the site itself")

    # Loopback or nothing, the owner's decision of 2026-09-01. The LAN mode and
    # its two launchers are gone; this is what stops them coming back by way of
    # a flag somebody copies out of an old checkout, and it is checked on the
    # parser rather than by binding a socket, which a test should not do.
    check("serve: loopback is accepted, however it is spelled",
          [h for h in ("127.0.0.1", "localhost", "::1") if not serve.is_loopback(h)], [])
    check("serve: every other interface is refused",
          [h for h in ("0.0.0.0", "192.168.1.50", "::", "10.0.0.4")
           if serve.is_loopback(h)], [],
          "binding these is what the LAN mode was, and it was removed on purpose")

    # A stalled connection is released by the HANDLER's timeout, because that is
    # the one StreamRequestHandler.setup puts on the accepted socket. The same
    # name on the server class is a different attribute, and serve_forever says
    # in its own docstring that it ignores it - so for a long time the server
    # had the value, the comment claimed the protection, and no socket had one.
    check_true("a stalled connection is released, and by the attribute that can do it",
               isinstance(serve.SiteHandler.timeout, (int, float))
               and serve.SiteHandler.timeout > 0,
               "Server.timeout is not a socket timeout; SiteHandler.timeout is")

    # Everything above asks `allowed()` about a path that is already clean, which
    # is the wrong question: the allowlist is enforced on the path the server
    # works out, and the bytes come from the path the standard library works out.
    # Those were two different computations, and on Windows they disagreed --
    # `ntpath.normpath` resolves `..` across a backslash, while the stdlib's
    # `translate_path` drops any component containing one. So
    # `/.git/config/..%5c..%5cindex.html` was approved as `index.html` and served
    # `.git/config`. No test could see it, because none of them sent a request
    # path; they all sent the answer.
    #
    # The property is not "these URLs are refused" -- that is a blocklist, and it
    # only ever knows the tricks somebody thought of. It is that the file opened
    # is the file that was approved, whatever the URL looked like.
    # A bare instance is enough and keeps the test off the network: `_relative`
    # reads only `self.path`, and `translate_path` only that and `self.directory`
    # -- which `serve.main` supplies the same way, via functools.partial.
    probe = object.__new__(serve.SiteHandler)
    probe.directory = ROOT

    def opened(url: str, peer: str = "192.168.1.50"):
        """(rel approved, absolute path that would be opened) or None if refused."""
        probe.path = url
        rel = probe._relative()
        if not serve.allowed(rel, peer):
            return None
        return rel, probe.translate_path(url)

    hostile = (
        "/.git/config/..%5c..%5cindex.html",
        "/tools/serve.py/..%5c..%5cindex.html",
        "/.claude/settings.local.json/..%5c..%5cindex.html",
        "/.cache/state.json/q%5c..%5c..%5c..%5cindex.html",
        "/PROJECT.md/..%5cindex.html",
        "/tools/..%5cindex.html/",
        "/temp_mockup.html/..%5cindex.html",
        # the forms that already failed closed, kept so a fix cannot regress them
        "/../tools/serve.py", "/%2e%2e%2ftools/serve.py",
        "/%252e%252e%252ftools/serve.py", "/C:/Windows/win.ini",
    )
    check("allowlist: the file opened is the file that was approved",
          [u for u in hostile + tuple("/" + w for w in wanted)
           if (r := opened(u)) is not None
           and r[1] != os.path.join(ROOT, r[0].replace("/", os.sep))],
          [],
          "a gate on one path and an open() on another is not a gate")

    # and it can never reach GitHub in the first place
    ignored = subprocess.run(["git", "check-ignore", "temp_mockup.html"],
                             cwd=ROOT, capture_output=True, text=True)
    check("mockup: gitignored, so it cannot be published", ignored.returncode, 0,
          "it holds whatever half-formed idea was last drafted")
    workflow = read_text(os.path.join(ROOT, ".github", "workflows", "publish.yml"))
    check("mockup: the published site never copies it",
          "temp_mockup" in workflow, False)

    # Rate limiting that keeps nothing. The address is hashed with a salt made
    # at start-up and held in memory, so a bucket cannot be tied to a person,
    # correlated across restarts, or found on disk afterwards.
    key = serve._client_key("203.0.113.9")
    check_true("rate limit: key is not the address", "203.0.113.9" not in key)
    check("rate limit: key is a fixed-width digest", len(key), 32)
    check_true("rate limit: salt is per-process and in memory",
               isinstance(serve._SALT, bytes) and len(serve._SALT) == 16)
    allowed = sum(1 for _ in range(serve.RATE_BURST + 30)
                  if serve.allow_request("198.51.100.77"))
    check_true("rate limit: a burst is capped", allowed <= serve.RATE_BURST)
    check_true("rate limit: other clients unaffected", serve.allow_request("198.51.100.78"))
    src = read_text(os.path.join(ROOT, "tools", "serve.py"))
    check_true("rate limit: nothing about a client is written to disk",
               "open(" not in src.split("def allow_request")[1].split("def ")[0])
    check_true("no request logging", "def log_message" in src and "pass" in src)

    # the policy is only worth setting if the app can live inside it
    check_true("CSP has no unsafe-inline", "unsafe-inline" not in serve.CSP)

    # The CDN is a redirector, not an origin: cdn.warframestat.us/img/X.png
    # answers 301 to raw.githubusercontent.com/wfcd/warframe-items/.../X.png,
    # and a policy is checked against every hop. Naming only the CDN blocked
    # all 167 images on a build without local artwork - and the violation names
    # the *pre-redirect* URL, so the console accused the one host the policy
    # already allowed, which is why it went unnoticed. Asserted on the pair
    # because allowing one without the other is the broken state.
    # The pages carry their own policy, because GitHub Pages sends no response
    # headers and the deployed copy would otherwise have none at all. Asserted
    # on the tag rather than on a substring: "Content-Security-Policy" appears
    # in this repo as prose in comments too, so counting the string finds
    # matches that are not policies.
    meta_re = re.compile(
        r'<meta http-equiv="Content-Security-Policy" content="([^"]*)"\s*/?>')
    metas = {}
    for page in ("index.html", "plan.html"):
        found = meta_re.findall(read_text(os.path.join(ROOT, page)))
        check(f"{page}: exactly one CSP meta tag", len(found), 1,
              "two policies would both apply, as their intersection")
        metas[page] = found[0] if found else ""

    check("the two pages carry the identical policy",
          metas["index.html"] == metas["plan.html"], True,
          "worded differently they are two policies to keep in step")

    page_csp = metas["index.html"]
    check_true("page CSP: no unsafe-inline", "unsafe-inline" not in page_csp)
    check_true("page CSP: scripts are same-origin only",
               "script-src 'self';" in page_csp + ";")
    # frame-ancestors is IGNORED when delivered by meta and Chromium logs that
    # as a console error - so writing it in would fail the page tests while
    # protecting nothing. Framing is serve.py's header locally, and cannot be
    # fixed on Pages at all.
    check_true("page CSP: no frame-ancestors, which meta cannot deliver",
               "frame-ancestors" not in page_csp,
               "it is ignored via meta and logged as an error")
    # The deployed build has no local artwork, so both CDN hosts must be here.
    for host in ("https://cdn.warframestat.us", "https://raw.githubusercontent.com"):
        check_true(f"page CSP: allows {host}", host in page_csp,
                   "the CDN 301s to the second; a policy is checked at every hop")

    # ...and the standalone, where every script is inline, gets the relaxation
    # and nothing else. sub-string checks would pass on a policy that had been
    # widened elsewhere, so this compares directive by directive.
    import bundle as bundle_for_csp
    relaxed = bundle_for_csp.standalone_csp(page_csp)
    strict_d = {d.split()[0]: d for d in page_csp.split(";") if d.strip()}
    loose_d = {d.split()[0]: d for d in relaxed.split(";") if d.strip()}
    check("standalone CSP: the same directives, no more",
          sorted(loose_d), sorted(strict_d))
    check("standalone CSP: only script-src and style-src are relaxed",
          sorted(k for k in strict_d if strict_d[k] != loose_d[k]),
          ["script-src", "style-src"])
    check("standalone CSP: the relaxation is exactly 'unsafe-inline'",
          [k for k in ("script-src", "style-src")
           if loose_d[k] != strict_d[k] + " 'unsafe-inline'"], [])

    img = next((p.strip() for p in serve.build_csp().split(";")
                if p.strip().startswith("img-src")), "")
    check("CSP: the CDN and its redirect target stand or fall together",
          ("cdn.warframestat.us" in img, "raw.githubusercontent.com" in img),
          ("cdn.warframestat.us" in img,) * 2,
          "allowing one without the other is the broken state, whichever build this is")
    check_true("CSP has no unsafe-eval", "unsafe-eval" not in serve.CSP)
    check_true("CSP denies framing", "frame-ancestors 'none'" in serve.CSP)

    # ── the one inline exception, and it has to stay one file wide ──────────
    # A mockup is a single file with an inline <style> and an inline <script>,
    # which is exactly what the policy above blocks - so the documented way to
    # show a proposal against real data produced a blank page (PROJECT.md §2).
    # The relaxation is scoped to the file that was already local-only by peer
    # address, asserted directly above. Both halves are checked here rather
    # than trusted, because a security exception that widens quietly - one more
    # filename, one more directive - is the failure mode that would not show up
    # on screen. Every directive is compared by name, so a policy that gains or
    # loses one fails rather than passing on a substring.
    def directives(policy: str) -> dict:
        out = {}
        for part in policy.split(";"):
            name, _, value = part.strip().partition(" ")
            if name:
                out[name] = value.strip()
        return out

    strict, loose = directives(serve.CSP), directives(serve.CSP_LOCAL_ONLY)
    check("mockup CSP: the carve-out is one file wide",
          sorted(serve.LOCAL_ONLY_FILES), ["temp_mockup.html"],
          "every name in this set is served 'unsafe-inline'")
    check("mockup CSP: the same directives, no more", sorted(loose), sorted(strict))
    check("mockup CSP: only script-src and style-src are relaxed",
          sorted(k for k in strict if strict[k] != loose.get(k)),
          ["script-src", "style-src"],
          "anything else differing means the exception has widened")
    check("mockup CSP: the relaxation is exactly 'unsafe-inline'",
          [k for k in ("script-src", "style-src")
           if loose[k] != strict[k] + " 'unsafe-inline'"], [])
    check_true("mockup CSP: still no unsafe-eval",
               "unsafe-eval" not in serve.CSP_LOCAL_ONLY)
    check_true("mockup CSP: still denies framing",
               loose.get("frame-ancestors") == "'none'")
    check_true("mockup CSP: still default-src 'none'",
               loose.get("default-src") == "'none'")
    check_true("mockup CSP: a mockup still cannot reach off-site",
               loose.get("connect-src") == "'self'")
    # With artwork local the CDN is not merely unused, it is disallowed - so a
    # visitor's address cannot reach a third party even by accident.
    import artwork as art
    if art.have_local_images():
        payload = read_text(os.path.join(ROOT, "data", "prime-data.js"))
        if "cdn.warframestat.us" not in payload:
            check("CSP forbids the CDN when artwork is local",
                  "cdn.warframestat.us" in serve.build_csp(), False)

    # Inline handlers and style attributes are exactly what that policy blocks,
    # so a single one anywhere makes the CSP unshippable. Two assertions over
    # every file, naming the offenders.
    import glob
    pages = [os.path.join(ROOT, n) for n in ("index.html", "plan.html")]
    scripts = sorted(glob.glob(os.path.join(ROOT, "assets", "*.js")))
    check("markup and scripts carry no inline styles",
          [os.path.basename(p) for p in pages + scripts if 'style="' in read_text(p)], [])
    check("scripts emit no inline event handlers",
          [os.path.basename(p) for p in scripts
           if re.search(r'\son(?:error|click|load|change)="', read_text(p))], [],
          "the two artwork onerror attributes are why this exists")


def test_serving_a_page_starts_one_upstream_check_not_one_each() -> None:
    """
    `freshness()` used to take the lock, find no cached answer, **release the
    lock**, and only then go upstream. So every request arriving before the
    first check finished started its own: three tabs opened together made three
    sets of the same three upstream requests, each writing the same
    `.cache/*.gz` bodies and `.etag` sidecars underneath a build that might be
    reading them. The hourly throttle worked perfectly from the second check
    onwards and did nothing whatever about the first.

    Two properties, and holding the lock across the check - the smaller fix this
    replaced - would give the second without the first:

      * no request waits for an upstream check, ever
      * twelve simultaneous requests cause one check, not twelve

    The check is stalled on an event rather than on a sleep, so the window this
    races in is held open deliberately instead of being hoped for.
    """
    sys.path.insert(0, os.path.join(ROOT, "tools"))
    import threading
    import serve

    calls = []
    entered = threading.Event()
    release = threading.Event()

    # `readonly` because serve.py asks for the read-only signature; a stub that
    # does not accept it raises TypeError, which the worker catches and turns
    # into an error body — so the test would see zero checks and blame the
    # single-flight flag.
    def stalled_signature(offline=False, readonly=False):
        calls.append(offline)
        entered.set()
        release.wait(20)
        return {"exportIndex": "0123456789abcdef"}

    real_signature = sources.upstream_signature
    saved = dict(serve._freshness)
    try:
        sources.upstream_signature = stalled_signature
        serve._freshness.update(checked=0.0, stamp=0.0, body=None, running=False)

        answers, waits = [], []
        def ask() -> None:
            began = time.time()
            answers.append(serve.freshness())
            waits.append(time.time() - began)

        askers = [threading.Thread(target=ask) for _ in range(12)]
        for t in askers:
            t.start()
        for t in askers:
            t.join(20)

        check("freshness: every request is answered", len(answers), 12)
        check_true("freshness: and not one of them waits for the check",
                   waits and max(waits) < 2.0,
                   f"slowest was {max(waits) if waits else 0:.1f}s, and the "
                   f"check has not even returned yet - it is blocking again")
        check("freshness: each says an answer is still coming",
              [a for a in answers if not a.get("checking")], [],
              "without this the page has no reason to ask again, and the "
              "banner never learns anything")

        check_true("freshness: the check actually started", entered.wait(10))
        check("freshness: twelve requests, one check", len(calls), 1,
              "asking DE once per open tab is exactly what the hourly "
              "throttle never covered")

        release.set()
        for _ in range(200):                  # the worker publishes and lowers it
            if not serve._freshness["running"]:
                break
            time.sleep(0.05)
        settled = serve.freshness()
        check_true("freshness: the answer settles once the check returns",
                   settled.get("ok") is True and not settled.get("checking"),
                   f"still {settled}")
        check("freshness: and a settled answer is not re-checked", len(calls), 1,
              "the TTL is what makes a reload free")
    finally:
        release.set()
        sources.upstream_signature = real_signature
        serve._freshness.update(saved)


def test_the_server_caps_connections_not_just_requests() -> None:
    """
    Two protections already existed and both act too late for this shape. The
    token bucket runs inside `do_GET` — *after* a request line and headers have
    been parsed — so a client that opens a socket and says nothing is never
    counted; and the handler's 30-second timeout bounds how long each thread
    lives, not how many there are. The first review opened 80 partial requests
    and all 80 were accepted.

    `SiteServer` counts at **accept** now, before a thread exists and before a
    byte is read. Three properties, and the third is the one that makes this
    safe to ship: the ceiling holds, the excess is told to go away rather than
    left hanging, and **slots come back** — a semaphore that leaks is a server
    that ends up accepting nothing at all, which is a worse outage than the one
    being prevented.

    Real sockets on port 0, because a connection ceiling is not a thing that can
    be checked by reading a parser. A small `max_connections` keeps it quick and
    keeps Windows out of its socket-buffer trouble.
    """
    sys.path.insert(0, os.path.join(ROOT, "tools"))
    import socket
    import threading as thr
    import serve

    class Tiny(serve.SiteServer):
        max_connections = 4

    handler = functools.partial(serve.SiteHandler, directory=ROOT)
    httpd = Tiny(("127.0.0.1", 0), handler)
    port = httpd.server_address[1]
    thr.Thread(target=httpd.serve_forever, daemon=True).start()

    held, refused = [], 0
    try:
        # Open more than the ceiling and send nothing at all — the exact shape
        # neither existing protection can see.
        for _ in range(Tiny.max_connections + 4):
            s = socket.create_connection(("127.0.0.1", port), timeout=5)
            held.append(s)

        # The ones past the ceiling are answered and closed rather than parked.
        for s in held:
            s.settimeout(1.5)
            try:
                first = s.recv(64)
            except (socket.timeout, TimeoutError):
                first = b""       # accepted and waiting for a request: correct
            if first.startswith(b"HTTP/1.0 503"):
                refused += 1
        check_true("connections: the ones past the ceiling are refused",
                   refused >= 1,
                   f"opened {len(held)} against a ceiling of "
                   f"{Tiny.max_connections} and none was turned away")
        check_true("connections: and refusing says so with a status, not silence",
                   refused >= 1)

        # Now let them all go, and check the ceiling was a ceiling rather than a
        # one-way door. This is the assertion that catches a leaked semaphore.
        for s in held:
            s.close()
        held.clear()
        deadline = time.time() + 10
        body = None
        while time.time() < deadline:
            try:
                with urllib.request.urlopen(
                        f"http://127.0.0.1:{port}/index.html", timeout=3) as r:
                    body = r.status
                break
            except Exception:                              # noqa: BLE001
                time.sleep(0.2)
        check("connections: an ordinary request works again afterwards", body, 200,
              "slots are not coming back - the semaphore leaks, and this server "
              "will refuse everything once it has seen enough connections")
    finally:
        for s in held:
            try:
                s.close()
            except OSError:
                pass
        httpd.shutdown()
        httpd.server_close()


def test_our_invented_buckets_each_still_behave_as_one_thing() -> None:
    """
    `Bounty`, `Key`, `Special` and `Enemy` are **our** names, one per droptable
    section, not Digital Extremes' mission types. DE's own type is the
    parenthesised word in `Planet/Node (Type)`, and these four have no such row
    behind them — confirmed 2026-09-02 by parsing the `Missions:` section, where
    `Key` and `Special` have zero nodes.

    A bucket that is not a mission type is only a problem when its members stop
    behaving alike, because `objectivesOf` keys off the name and hands back one
    unit for all of them. That has cost something once: the four Profit-Taker
    phases were charged four bounty stages each until 2026-08-24, because a
    heist and a bounty share a bucket.

    Every case is handled today. **Nothing was holding them handled**, which is
    what this is for — each assertion is a fact the model quietly relies on, and
    each would fail silently in the ranking rather than loudly here.
    """
    payload = os.path.join(ROOT, "data", "prime-data.json")
    if not os.path.exists(payload):
        print("  skip bucket invariants (no dataset yet)")
        return
    with open(payload, encoding="utf-8") as fh:
        data = json.load(fh)

    srcs = [s for r in data["relics"].values() for s in (r.get("sources") or [])]
    check_true("buckets: the payload has sources to check", len(srcs) > 100)

    # `Key` — an extra key-gated objective on an existing mission, and nobody
    # runs one for its own sake. It must never rank as a destination, which the
    # model decides from `access` rather than from the bucket name.
    keys = [s for s in srcs if s.get("mode") == "Key"]
    check_true("buckets: Key sources exist to assert about", bool(keys))
    stray = sorted({s.get("access") for s in keys} - {"quest"})
    check("buckets: every Key source is quest-gated, so none is a destination",
          stray, [],
          "notADestination reads `access`, so a Key row without it would be "
          "ranked as somewhere to go - and they carry 22 relics each")

    # `Enemy` — the Hemocyte, which spawns inside a bounty already listed. It is
    # a second row for a trip you are already making, not a place.
    enemies = [s for s in srcs if s.get("kind") == "enemy"]
    if enemies:
        modes = sorted({s.get("mode") for s in enemies})
        check("buckets: Enemy is its own kind, not a mission type worn by others",
              modes, ["Enemy"],
              "the badge that says an enemy is not a destination keys on kind")

    # `Bounty` carries two units — stages for a bounty, one run for a heist —
    # and DE give no field to tell them apart: the phases are filed as ordinary
    # bounty groups named `Level 40 - 60 PROFIT-TAKER - PHASE 1`. The name is
    # the only signal there is, which is why `isHeist` matches on it. Checked
    # 2026-09-02 against DE's own tables rather than assumed.
    bounty_nodes = {s.get("node") or "" for s in srcs if s.get("kind") == "bounty"}
    heists = {n for n in bounty_nodes if "PROFIT-TAKER" in n.upper()}
    check_true("buckets: the heist rows are still findable by name",
               bool(heists),
               "isHeist matches /PROFIT-TAKER/ on the node; if DE rename these, "
               "four phases go back to being charged four stages each")
    # and they are the only bounty rows with no rotation, which is the property
    # that made them visible in the first place
    rotted = {n for n in heists
              if any(s.get("rotation") for s in srcs
                     if (s.get("node") or "") == n)}
    check("buckets: and they remain the rotation-less ones", sorted(rotted), [],
          "a heist gaining a rotation would mean DE have restructured them")


def test_the_ci_probe_asks_about_the_source_that_refuses() -> None:
    """
    *Probe the data sources* exists to record which upstreams answer a datacentre
    IP, because that is not always the same set that answer a home connection.

    It curled five URLs and **not** DE's worldstate — the document all four live
    feeds come from, and the one whose answer decides first-party against the
    WFCD proxy. So the probe was silent about the only source that routinely
    refuses, which is the source the question is always about. Measured
    2026-09-01 across eighteen builds: one reached DE, seventeen took the proxy.

    Asserted from `sources.py`'s own constants rather than from a copy of the
    URLs, so a host that moves cannot leave the probe quietly asking the old one.
    """
    workflow = os.path.join(ROOT, ".github", "workflows", "publish.yml")
    if not os.path.exists(workflow):
        print("  skip probe check (no workflow checked out)")
        return
    yml = read_text(workflow)
    probe = re.search(r"(?s)Probe the data sources.*?\bdone\b", yml)
    check_true("probe: the step is still findable", bool(probe),
               "the step was renamed or restructured; this test names it")
    body = probe.group(0) if probe else ""

    # The two first-party documents a build cannot do without, by constant.
    check_true("probe: it asks DE's worldstate", sources.WORLDSTATE in body,
               "the feeds' first-party source, and the one that 403s a runner - "
               "a probe that skips it records everything except the answer")
    check_true("probe: it asks the official drop tables",
               sources.OFFICIAL_DROPTABLES in body)

    # And it must stay a probe: no body is fetched, only a status code.
    check_true("probe: it reads a status code and no body",
               "-o /dev/null" in body and "%{http_code}" in body,
               "downloading six documents to find out whether they answer is a "
               "different thing from asking whether they answer")


def test_serving_a_page_never_writes_the_builders_cache() -> None:
    """
    `sources.upstream_signature` makes one HEAD and two GETs, and both GETs went
    through `fetch`, which writes the body to `.cache/*.gz` with `.etag` and
    `.maxage` sidecars. So **serving a page wrote to the cache the build reads
    from**, underneath a build that might have been reading it. Serve-then-refresh
    narrowed that from every request at once to one background thread; it did not
    remove it, and `serve.py`'s own comment had flagged it since 2026-08-26 as
    the thing nobody notices.

    `readonly` removes it. The properties are: the bytes still come back, and
    nothing on disk moves — not the body, not either sidecar, and not the
    module-level `STALE`/`MISSING` lists, which are the build's bookkeeping and
    have no business being touched because somebody loaded a page.

    file:// throughout, like the two `fetch` tests above: what is being asked is
    what the function writes, and that needs nobody's server.
    """
    tmp = tempfile.mkdtemp(prefix="primehunter-readonly-")
    url = lambda p: "file:///" + p.replace(os.sep, "/").lstrip("/")   # noqa: E731
    doc = os.path.join(tmp, "doc.json")
    real_cache = sources.CACHE_DIR
    stale, missing = list(sources.STALE), list(sources.MISSING)
    try:
        sources.CACHE_DIR = os.path.join(tmp, "cache")
        with open(doc, "wb") as fh:
            fh.write(b'{"live":true}')

        # cold and read-only: the answer arrives, and nothing is kept
        got = sources.fetch(url(doc), "api_events", readonly=True)
        check("readonly: the body still comes back", got, b'{"live":true}')
        left = sorted(os.listdir(sources.CACHE_DIR)) \
            if os.path.isdir(sources.CACHE_DIR) else []
        check("readonly: and nothing at all is written", left, [],
              "a prober that warms the cache is still writing to it")
        check("readonly: the build's bookkeeping is untouched",
              (list(sources.STALE), list(sources.MISSING)), ([], []),
              "a page being served must not put a source in meta.stale")

        # unreachable and read-only is not fatal, however critical the caller
        # says it is. This is the SystemExit that froze serve.py's flag.
        gone = sources.fetch(url(os.path.join(tmp, "nope.json")), "api_fissures",
                             critical=True, readonly=True)
        check("readonly: an unreachable source is not fatal", gone, None,
              "a prober must not be able to stop anything")

        # the ordinary path still writes, or the cache would never fill at all
        sources.fetch(url(doc), "api_events")
        wrote = sorted(f for f in os.listdir(sources.CACHE_DIR))
        check_true("readonly: a normal fetch still writes the cache",
                   "api_events.gz" in wrote, f"found {wrote}")
    finally:
        sources.CACHE_DIR = real_cache
        sources.STALE[:], sources.MISSING[:] = stale, missing
        shutil.rmtree(tmp, ignore_errors=True)

    # and the server is the caller that asks for it
    src = read_text(os.path.join(ROOT, "tools", "serve.py"))
    check_true("readonly: serve.py asks for the read-only signature",
               re.search(r"upstream_signature\([^)]*readonly=True", src) is not None,
               "the mode exists for exactly one caller; if it stops asking, it "
               "is writing the builder's cache again")


def test_a_check_that_dies_still_lowers_the_flag() -> None:
    """
    The single-flight flag is what stops a stampede, and a flag left raised is
    what stops everything else: `freshness()` starts a check only when nothing
    is running, so a worker that exits without lowering it freezes the banner
    for the life of the process. The page then polls twelve times into a state
    that cannot change.

    **`SystemExit` is the one that gets there**, and it is not hypothetical.
    `sources.fetch` raises it on a cold miss with nothing cached — a fresh clone
    with no `.cache`, served while offline — and `upstream_signature` catches
    `except Exception`, which does not catch a `BaseException`. The worker's own
    handler did not either, for a few hours on 2026-09-01, while its docstring
    said `finally` lowered the flag "whatever happens". It had no `finally`.

    So both are asserted: the flag comes down, and the page is told something
    rather than being left on a `checking` answer forever.
    """
    sys.path.insert(0, os.path.join(ROOT, "tools"))
    import serve

    real_signature = sources.upstream_signature
    saved = dict(serve._freshness)
    try:
        for label, boom in (("SystemExit", SystemExit("cold build, nothing cached")),
                            ("KeyboardInterrupt", KeyboardInterrupt()),
                            ("ValueError", ValueError("ordinary failure"))):
            def explode(offline=False, readonly=False, _b=boom):
                raise _b
            sources.upstream_signature = explode
            serve._freshness.update(checked=0.0, stamp=0.0, body=None, running=False)

            serve._check_upstream(1234.0)
            check(f"freshness: a check that dies on {label} lowers the flag",
                  serve._freshness["running"], False,
                  "a raised flag means no check ever starts again")
            check_true(f"freshness: and {label} leaves an answer behind",
                       (serve._freshness["body"] or {}).get("ok") is False,
                       "a page left on `checking` forever polls and gives up")

        # and the flag being down is what lets the next check actually run
        calls = []
        sources.upstream_signature = \
            lambda offline=False, readonly=False: (calls.append(1), {"x": "1"})[1]
        serve._freshness.update(checked=0.0, stamp=0.0, body=None, running=False)
        serve._check_upstream(1234.0)
        check("freshness: a later check still runs after a dead one", len(calls), 1)
    finally:
        sources.upstream_signature = real_signature
        serve._freshness.update(saved)


def test_the_wiki_can_still_be_built_from_the_docs() -> None:
    """
    The GitHub wiki is generated from README.md, PROJECT.md and TODO.md, and it
    names the sections it wants by their headings. Headings get reworded, and
    the failure that matters is the quiet one: a published page that silently
    loses half its content and nobody notices for months, which is the exact
    shape of every documentation bug this project has already had.

    So a rename breaks the suite in front of whoever renamed it, rather than
    breaking a page nobody is looking at. `--check` writes nothing.

    The pages themselves are asserted for the two properties that make a
    generated wiki safe: it says it is generated, and it says edits are lost.
    Without those, someone eventually edits a page on github.com and their work
    is overwritten by the next build with no warning.
    """
    tool = os.path.join(ROOT, "tools", "wiki.py")
    checked = subprocess.run([sys.executable, tool, "--check"],
                             cwd=ROOT, capture_output=True, text=True, timeout=120)
    check("wiki: every section it names still exists", checked.returncode, 0,
          (checked.stdout + checked.stderr)[-600:])

    built = subprocess.run([sys.executable, tool],
                           cwd=ROOT, capture_output=True, text=True, timeout=120)
    check("wiki: it builds", built.returncode, 0, (built.stdout + built.stderr)[-400:])

    out = os.path.join(ROOT, "dist", "wiki")
    pages = sorted(f for f in os.listdir(out)) if os.path.isdir(out) else []
    check_true("wiki: a sidebar and a footer are part of it",
               "_Sidebar.md" in pages and "_Footer.md" in pages,
               "without a sidebar the wiki has no navigation at all")
    check_true("wiki: Home is the landing page GitHub looks for", "Home.md" in pages)

    unmarked = []
    for name in pages:
        if name.startswith("_"):
            continue
        body = read_text(os.path.join(out, name))
        if "generated" not in body.lower() or "overwritten" not in body.lower():
            unmarked.append(name)
    check("wiki: every page says it is generated and will be overwritten",
          unmarked, [],
          "a page that does not say so invites an edit that the next build eats")

    # A repo-relative link works in the repository and 404s on the wiki, which
    # is a different host path entirely. They are rewritten to github.com, so
    # none should survive.
    relative = []
    for name in pages:
        for label, target in re.findall(r"\[([^\]]*)\]\(([^)]+)\)",
                                        read_text(os.path.join(out, name))):
            if target.startswith(("http://", "https://", "#")):
                continue
            if target.endswith(".md") and "/" not in target:
                continue                      # a link to another wiki page
            if target.startswith(("README.md", "PROJECT.md", "TODO.md", "STYLE.md",
                                  "NOTICE.md", "LICENSE", "assets/", "tools/",
                                  "tests/", "data/")):
                relative.append(f"{name}: {target}")
    check("wiki: no link points at a path only the repository has", relative, [])


def test_the_wiki_token_is_confined_to_the_job_that_pushes() -> None:
    """
    `contents: write` is what GitHub requires to push to the .wiki.git
    repository behind the wiki tab, and it cannot be scoped any narrower than
    that. So the only two things left to control are how long it exists and
    what runs while it does.

    Until 2026-09-01 it was declared at workflow level, which is the floor for
    every job: the job that fetches from half a dozen third-party endpoints and
    builds a dataset out of what they return held a token that could write this
    repository for its whole run. It never used that token - the push clones
    the wiki with its own credential in the URL - so the grant bought nothing
    and was carried through the one step where somebody else's bytes are
    parsed.

    Asserted here by property rather than by wording, because the wording is
    what drifts: the floor is read-only, exactly one job raises it, and that
    job neither checks this repository out nor runs anything that reaches an
    upstream. The same split is already on publish.yml and is checked too, so
    the two cannot come apart without this saying so.
    """
    path = os.path.join(ROOT, ".github", "workflows", "wiki.yml")
    if not os.path.exists(path):
        print("  skip wiki permissions (no workflow checked out)")
        return
    yml = read_text(path)

    floor = re.search(r"(?m)^permissions:\n((?:^[ \t]+\S.*\n)+)", yml)
    check_true("wiki job: the workflow declares a permissions floor", bool(floor),
               "with none declared GitHub picks one, and the default is generous")
    check("wiki job: and the floor is read-only",
          floor.group(1).strip() if floor else "", "contents: read",
          "a floor of `write` hands it to every job, which is the arrangement "
          "this test exists to stop coming back")

    # Split the jobs apart on their own indentation. A job name is the only
    # thing in this file at exactly two spaces followed by nothing.
    body = yml.split("\njobs:\n", 1)[1] if "\njobs:\n" in yml else ""
    jobs: dict = {}
    current = None
    for line in body.splitlines():
        named = re.match(r"^  ([A-Za-z][\w-]*):\s*$", line)
        if named:
            current = named.group(1)
            jobs[current] = []
        elif current is not None:
            jobs[current].append(line)
    jobs = {name: "\n".join(lines) for name, lines in jobs.items()}
    check("wiki job: the work is split in two", len(jobs), 2,
          f"jobs found: {sorted(jobs) or 'none - the parse above has drifted'}")

    writers = sorted(k for k, v in jobs.items()
                     if re.search(r"(?m)^\s+contents:\s*write\b", v))
    check("wiki job: exactly one job raises the floor", len(writers), 1,
          f"raised in {writers or 'no job'} - one is the whole point")
    pusher = jobs[writers[0]] if writers else ""
    builder = "\n".join(v for k, v in jobs.items() if k not in writers)

    check_true("wiki job: the writing job does not check this repository out",
               "actions/checkout@" not in pusher,
               "it wants the generated pages, not the source they came from")
    # On what it runs, not on what it mentions: the commit message this job
    # writes names tools/wiki.py, and reading that as "it runs the build" is a
    # false positive this test has already produced once.
    invokes = re.findall(r"(?m)^\s*(?:run:\s*)?(python\d?\s+tools/\S+)", pusher)
    check("wiki job: the writing job runs no build", invokes, [],
          "parsing an upstream's bytes while holding a repo-writing token is "
          "exactly the arrangement the split removed")
    check_true("wiki job: the writing job installs no toolchain",
               "setup-python@" not in pusher,
               "nothing it does needs one, and each install is another supply chain")

    check_true("wiki job: the job that builds declares no permissions of its own",
               not re.search(r"(?m)^\s+permissions:", builder),
               "it should inherit the read-only floor rather than restate it, so "
               "that raising the floor cannot silently raise this too")
    check_true("wiki job: the pages reach the pusher as an artifact",
               "upload-artifact@" in builder and "download-artifact@" in pusher,
               "with no handover between them the split cannot work at all")
    check_true("wiki job: an empty page set fails rather than emptying the wiki",
               "if-no-files-found: error" in builder,
               "the push replaces the wiki wholesale, so uploading nothing would "
               "delete every page instead of failing")

    # The repository policy requires SHA pins, so a tag here cannot be pushed
    # at all - but it can be written, and the error it earns is worth naming.
    unpinned = [u for u in re.findall(r"(?m)^\s+uses:\s*(\S+)", yml)
                if not re.search(r"@[0-9a-f]{40}$", u)]
    check("wiki job: every action is pinned to a SHA", unpinned, [],
          "a tag is mutable, and this repository refuses one")

    site = read_text(os.path.join(ROOT, ".github", "workflows", "publish.yml"))
    check_true("site job: the pattern this copies is still on publish.yml",
               bool(re.search(r"(?m)^permissions:\n\s+contents: read", site)),
               "wiki.yml copies a shape that lives next door; if it moves, "
               "the reason given in wiki.yml's own comments stops being true")


def test_the_schedulers_outpace_the_banner_they_prevent() -> None:
    """
    Four numbers describe the refresh cadence, and this asked all four to be the
    **same integer** until 2026-09-01. That made it an obstacle rather than a
    guard: the owner set the CI cron to 15 minutes for a few days, to measure how
    often DE answer without leaning on WFCD, and the suite went red. Nothing was
    wrong. The numbers had simply stopped matching.

    **Equality is the right shape for exactly one of the four pairs**, and the
    rewrite is mostly about telling them apart:

    * `schedule.ps1` and `schedule.sh` are **one job written twice**, because
      Windows has Task Scheduler and everything else has cron. A number changed
      on the platform in front of you and left alone on the other is invisible,
      and there is no reason they should ever differ. That one stays an equality.
    * The CI cron, the local job and the page's poll are **three independent
      schedulers with different constraints** — GitHub's cron is best-effort with
      a five-minute floor and a deployment budget, a Windows task runs on a
      machine that may be asleep, the page poll costs one request to our own
      origin. Requiring them to agree to the minute guards nothing.

    **What is worth guarding is response time, not agreement**: how long a change
    at the source takes to reach a reader's screen. That is a sum —
    `build interval + page poll` — and the rule is a ceiling on it.

    The ceiling has to come from evidence or it is no better than the equality it
    replaces. A fissure's shortest observed life is **60 minutes** (measured
    2026-08-27, median 88), and a fissure nobody can see is the failure this
    cadence exists to prevent, so the ceiling is **half of that**. Today's 10 + 10
    sits at 20 with room to spare, and the owner's 15 + 10 would have passed
    without a word.
    """
    # Half the shortest fissure life measured on 2026-08-27. See the docstring:
    # this is the one number here that is a judgement, so it is named once.
    DISCOVERY_CEILING_MIN = 30

    ps = read_text(os.path.join(ROOT, "tools", "schedule.ps1"))
    sh = read_text(os.path.join(ROOT, "tools", "schedule.sh"))
    shared = read_text(os.path.join(ROOT, "assets", "shared.js"))

    win = re.search(r"\$EveryMinutes\s*=\s*(\d+)", ps)
    nix = re.search(r"(?m)^EVERY_MIN=(\d+)", sh)
    check_true("schedule: the Windows default is findable", bool(win))
    check_true("schedule: the cron default is findable", bool(nix))
    mins = int(win.group(1)) if win else 0
    check("schedule: both platforms refresh on the same clock",
          int(nix.group(1)) if nix else -1, mins,
          "a default changed on one platform and not the other is invisible")

    # the banner the whole thing exists to prevent, read from where it is set
    days = re.search(r"days\s*>=\s*(\d+)", shared)
    check_true("schedule: the banner's patience is findable", bool(days))
    check_true("schedule: three refreshes fit inside the banner's patience, twice over",
               0 < mins * 3 <= int(days.group(1)) * 24 * 60,
               f"refreshing every {mins} min against a banner at {days.group(1)} days "
               f"leaves no room for a failed run")

    # And the reason the cadence is what it is, rather than merely consistent.
    # A fissure lasts an hour or two and the pages only show ones that have not
    # expired, so the refresh has to be a small fraction of that or the badges
    # are mostly absent. Read from the page, which is what actually re-reads it.
    poll = re.search(r"FISSURE_REFRESH_MS\s*=\s*(\d+)\s*\*\s*60\s*\*\s*1000", shared)
    check_true("schedule: the page's own fissure poll is findable", bool(poll))
    polled = int(poll.group(1)) if poll else -1
    # Its own rule, and a looser one, because it is the only scheduler here that
    # costs nobody anything: it reads four kilobytes from our own origin. A page
    # polling faster than the site rebuilds is redundant rather than wrong, so
    # what is asserted is that it cannot be the reason a reader waits.
    check_true("schedule: the page poll cannot be what makes a reader wait",
               0 < polled <= DISCOVERY_CEILING_MIN,
               f"polling every {polled} min against a {DISCOVERY_CEILING_MIN} min "
               f"ceiling means the page is the slow part")
    check_true("schedule: the local job is well inside a fissure's life",
               0 < mins <= DISCOVERY_CEILING_MIN,
               "a fissure runs an hour or two; refreshing slower than that shows none")

    # The third scheduler, and the one that reaches anybody who is not running
    # this locally. Same job, same reason, and it drifts the same way if nobody
    # checks: the published site rebuilt once a day always shows no fissures.
    flow = read_text(os.path.join(ROOT, ".github", "workflows", "publish.yml"))
    crons = re.findall(r'- cron: "(.+?)"', flow)
    step = re.search(r"(?m)^\s*- cron: \"\*/(\d+) \* \* \* \*\"", flow)
    check_true("schedule: the published site has a short-interval refresh too",
               bool(step), f"crons found: {crons}")
    ci = int(step.group(1)) if step else -1

    # The sum, which is the thing a reader actually experiences. Two of them,
    # because there are two audiences: the deployed site and somebody running
    # this locally, and each has its own build interval feeding the same poll.
    check_true("schedule: a change upstream reaches a deployed reader in time",
               0 < ci + polled <= DISCOVERY_CEILING_MIN,
               f"CI every {ci} min plus a {polled} min page poll is "
               f"{ci + polled} min worst case, against a ceiling of "
               f"{DISCOVERY_CEILING_MIN} — half the shortest fissure life")
    check_true("schedule: and reaches a local reader in time too",
               0 < mins + polled <= DISCOVERY_CEILING_MIN,
               f"local job every {mins} min plus a {polled} min poll is "
               f"{mins + polled} min worst case")
    check_true("schedule: the daily full build is still there",
               any(not c.startswith("*/") for c in crons),
               "the ten-minute run takes its heavy sources from the cache, so "
               "something has to fill that cache")
    # The whole point of the short run is that it does NOT re-download the wiki,
    # the drop tables and DE's export 144 times a day.
    check_true("schedule: the short run rebuilds from cache rather than refetching",
               "--if-changed" in flow,
               "without this the ten-minute cron is a full fetch of every upstream")
    check_true("schedule: and never writes a cache entry of its own",
               "actions/cache/restore@" in flow,
               "actions/cache saves whenever its key missed, which this key always does")
    check_true("publish: the site carries the fissure list on its own",
               "cp data/fissures.json" in flow,
               "the page re-reads that file; without it there is nothing to re-read")


def test_a_refresh_clears_the_stale_banner() -> None:
    """
    Refreshing the data must retire the banner that told you to refresh it.

    It did not. The upstream check is throttled to an hour so a page reload does
    not hammer Digital Extremes, and that cached answer outlived the rebuild it
    was complaining about: refresh-data finished, the data on disk was current,
    and the page went on saying it was behind for the rest of the hour. Reloading
    could not help, because the stale answer was held by the server.

    Two properties, because either alone would pass a broken fix: the stamp has
    to track the file, and the cache has to act on the stamp.

    Since 2026-09-01 the check runs on a background thread and `freshness()`
    returns before it finishes, so every read below settles first. The
    properties are unchanged - that a read *triggers* a check, that a reload
    inside the hour does not, and that a rebuild re-checks whatever the clock
    says - and only the moment the answer is readable has moved.
    """
    sys.path.insert(0, os.path.join(ROOT, "tools"))
    import serve
    import sources

    # 1. The stamp is the state file's write time, measured here rather than
    #    asked of the code under test. A stamp that always answered the same
    #    thing would sail through part 2 untouched.
    #
    #    A cold checkout has no state file at all - CI runs the suite before the
    #    build, and its cache does not always survive - so that half is only
    #    asserted when there is a file to assert it about. The absent case is
    #    checked either way, below, by pointing the module at a folder that
    #    certainly is not there.
    state = os.path.join(sources.CACHE_DIR, sources.STATE_FILE)
    if os.path.exists(state):
        check("freshness: the stamp is when the state file was written",
              serve.state_stamp(), os.path.getmtime(state))
    else:
        print("  skip freshness stamp value (no state file - nothing built yet)")

    real_cache = sources.CACHE_DIR
    try:
        sources.CACHE_DIR = os.path.join(ROOT, ".cache-that-is-not-there")
        check("freshness: no state file means check, not trust",
              serve.state_stamp(), 0.0,
              "a first run must not be handed a cached answer it never made")
    finally:
        sources.CACHE_DIR = real_cache

    # 2. The cache is keyed on that stamp. Both upstreams are stubbed, so this
    #    asks only whether a check was made - and touches neither the network
    #    nor the real cache.
    calls = []
    real_sig, real_state, real_stamp = (sources.upstream_signature,
                                        sources.load_state, serve.state_stamp)
    was = dict(serve._freshness)
    stamps = [1000.0]
    signature = {"drops": "a"}
    stored = {"signature": {"drops": "b"}}          # behind: the banner is up
    try:
        sources.upstream_signature = \
            lambda offline=False, readonly=False: (calls.append(1), signature)[1]
        sources.load_state = lambda: stored
        serve.state_stamp = lambda: stamps[0]
        serve._freshness.update({"checked": 0.0, "stamp": 0.0, "body": None,
                                 "running": False})

        def settled() -> dict:
            """Ask, then wait for the background check to publish its answer."""
            body = serve.freshness()
            for _ in range(200):
                if not serve._freshness["running"]:
                    break
                time.sleep(0.05)
            return serve.freshness() if body.get("checking") else body

        check("freshness: the first read checks upstream",
              (settled()["stale"], len(calls)), (True, 1))
        check("freshness: a reload within the hour does not ask again",
              (settled()["stale"], len(calls)), (True, 1),
              "the throttle exists to spare DE, and must still hold")

        stored = {"signature": dict(signature)}     # refresh-data has just run
        stamps[0] = 2000.0
        check("freshness: a rebuild is re-checked at once, hour or no hour",
              (settled()["stale"], len(calls)), (False, 2),
              "the banner used to outlive the refresh that cleared it")
    finally:
        sources.upstream_signature, sources.load_state = real_sig, real_state
        serve.state_stamp = real_stamp
        serve._freshness.update(was)


def find_node() -> str | None:
    """
    Node, if this machine has it.

    Looked for rather than assumed. It is not required to run Prime Hunter - the
    site is plain files and opens from file:// - so the browser tests are a
    bonus that runs where Node happens to exist and is skipped where it does
    not, the same bargain --online makes. The explicit paths are there because
    a freshly installed Node is not on the PATH of a shell that was already
    open, which is exactly when someone will try to run this.
    """
    found = shutil.which("node")
    if found:
        return found
    for path in (r"C:\Program Files\nodejs\node.exe",
                 r"C:\Program Files (x86)\nodejs\node.exe",
                 os.path.expandvars(r"%LOCALAPPDATA%\Programs\nodejs\node.exe"),
                 "/usr/local/bin/node", "/usr/bin/node", "/opt/homebrew/bin/node"):
        if os.path.exists(path):
            return path
    return None


def _tap_failure(lines: list[str], at: int) -> str:
    """
    The assertion behind a `not ok`, out of TAP's diagnostic block.

    The runner used to report only the test name, which is why the page-test
    flake of 2026-08-27 could be observed twice and diagnosed neither time:
    both failing tests carry a dozen assertions each and the output said which
    test, never which claim. Node writes the reason directly underneath —

        not ok 12 - the drawer can show more than its eight best places
          ---
          location: '/…/tests/test_pages.mjs:1932:3'
          failureType: 'testCodeFailure'
          error: |-
            expanding has to show every place it counted

    — and this reads it back out. Best effort by design: a shape it does not
    recognise costs nothing, because the caller already reports the failure.

    **The `location` is where `test()` was called, not where the assertion
    failed.** Every test in `test_pages.mjs` goes through the `page_test`
    wrapper, so they all report its line and the file is the only useful half.
    `test_assets.mjs` calls `test()` directly and gets a real one. The message is
    the part worth reading either way, which is why it comes first.
    """
    error: list[str] = []
    location, indent, in_error = "", None, False
    for line in lines[at + 1:]:
        if not line.strip():
            continue
        width = len(line) - len(line.lstrip())
        if indent is None:
            if width == 0:
                return ""                   # no diagnostic block at all
            indent = width
        elif width < indent:
            break                           # the block ended; the next test
        text = line.strip()
        key = re.match(r"^([a-z_]+):\s*(.*)$", text)
        if key:
            # `stack:` and `error:` are folded blocks and the stack is the noisy
            # one — every frame in it is node's own test runner. Only the error
            # is worth carrying, so a new key always closes the last block.
            in_error = key.group(1) == "error"
            if key.group(1) == "location":
                # keep the file and line; the absolute path in front is noise
                location = re.sub(r"^.*[\\/](tests[\\/])", r"\1",
                                  key.group(2).strip().strip("'\""))
            elif in_error and key.group(2).strip() not in ("|-", "|", ">-", ">"):
                error.append(key.group(2).strip().strip("'\""))
        elif in_error:
            error.append(text)
        if len(" ".join(error)) > 240:
            break
    said = re.sub(r"\s+", " ", " ".join(error)).strip()
    if location:
        said = f"{said}  [{location}]" if said else location
    return said[:400]


def test_browser_assets() -> None:
    """
    The pipeline was tested and the JavaScript was not, which is where the
    rotation model actually lives. Two bugs got as far as a browser before
    anyone noticed: a bounty rotation that stopped advancing once the anchor
    window had expired, and a list cap left lifted after debugging.

    Runs `tests/test_assets.mjs` under Node's own test runner. No packages: the
    site must stay installable-by-copying, so nothing here may need npm.
    """
    node = find_node()
    if not node:
        print("  skip browser tests (no Node found — the site does not need it)")
        return

    # `--test-reporter` arrived in Node 18. An older one would fail on the flag
    # rather than on anything real, and a CI run going red over the runner's
    # Node version teaches everyone to ignore it.
    try:
        raw = subprocess.run([node, "--version"], capture_output=True, text=True,
                             timeout=30).stdout.strip()
        major = int(re.sub(r"^v", "", raw).split(".")[0])
    except (OSError, ValueError, subprocess.SubprocessError):
        major = 0
    if major < 18:
        print(f"  skip browser tests (Node {raw or '?'} has no test runner; 18+ needed)")
        return

    for name in ("shared.js", "rotation.js", "model.js", "app.js", "plan.js"):
        # a parse error in app.js or plan.js is otherwise silent until the page
        # is opened, since nothing else ever reads them
        r = subprocess.run([node, "--check", os.path.join(ROOT, "assets", name)],
                           capture_output=True, text=True)
        check(f"{name}: parses", r.returncode, 0, (r.stderr or "").strip()[:200])

    # test_assets.mjs needs nothing but Node. test_pages.mjs drives a real
    # browser through Playwright and skips itself when that is not installed,
    # which is the normal case - it is a large download and Prime Hunter does not
    # need it. Its skips come back through TAP and are reported as skips here.
    r = subprocess.run([node, "--test", "--test-reporter=tap",
                        os.path.join("tests", "test_assets.mjs"),
                        os.path.join("tests", "test_model.mjs"),
                        os.path.join("tests", "test_pages.mjs")],
                       capture_output=True, text=True, cwd=ROOT)
    lines = (r.stdout or "").splitlines()
    seen = skipped = 0
    for i, line in enumerate(lines):
        m = re.match(r"^(ok|not ok) \d+ - (.+?)\s*$", line)
        if not m:
            continue
        seen += 1
        name, status = m.group(2), m.group(1)
        reason = re.search(r"#\s*SKIP\s*(.*)$", name)
        if reason and status == "ok":
            skipped += 1
            if skipped == 1:      # one line, not one per test
                print(f"  skip page tests ({reason.group(1).strip() or 'skipped'})")
            continue
        check("js: " + name, status, "ok", _tap_failure(lines, i) if status != "ok" else "")
    if not seen:
        check_true("browser tests ran", False, (r.stdout or r.stderr)[-400:])


def test_bundle_is_self_contained() -> None:
    """
    The single-file build must reference nothing on disk, and must carry both
    views. Local artwork paths from --with-images cannot travel inside one
    .html, and the view tabs would otherwise link to a plan.html that is not
    there.
    """
    import re
    # There is nothing to inline without a dataset, and CI runs the suite before
    # the build - so on a cold runner this used to fail twice and say only
    # "missing data/prime-data.js". It passed at all in CI because a warm source
    # cache let the offline-build test write one first, which made a green run
    # depend on a cache surviving rather than on the code being right. The
    # bundler is still exercised there: the workflow's Assemble step runs it for
    # real, after the build, and a broken one fails the publish.
    if not os.path.exists(os.path.join(ROOT, "data", "prime-data.js")):
        print("  skip bundle (no dataset - run tools/build_data.py first)")
        return
    r = subprocess.run([sys.executable, "tools/bundle.py"],
                       cwd=ROOT, capture_output=True, text=True)
    check("bundle: exits 0", r.returncode, 0, r.stderr[-300:])
    out = os.path.join(ROOT, "dist", "warframe-prime-hunter.html")
    if not os.path.exists(out):
        check_true("bundle: file written", False)
        return
    html = read_text(out)
    local = {m for m in re.findall(r'(?:src|href)="(?!data:|https?:|#)([^"]+)"', html)
             if "${" not in m}
    check("bundle: no local file references", local, set())
    check("bundle: no local artwork paths", html.count('"assets/img/'), 0)

    # The whole dataset is inlined into a <script> block, so anything HTML would
    # read as the end of that block is a way out of it and into live markup.
    # The guard was a literal replace of lowercase "</script>", but HTML matches
    # the close tag case-insensitively and ends on "</script" followed by
    # whitespace, "/" or ">". Item names come from wiki.warframe.com with only
    # whitespace normalised, so this was one public wiki edit from running - and
    # the standalone is copied beside the tracker on the same origin.
    sys.path.insert(0, os.path.join(ROOT, "tools"))
    import bundle as bundle_mod

    escapes = ("</script>", "</ScRiPt>", "</SCRIPT>", "</script >",
               "</script/>", "</script\t>", "</script\n>")
    check("bundle: every spelling of the close tag is escaped",
          [s for s in escapes if "</" in bundle_mod.guard_text(f'x = "{s}";')], [],
          "case-sensitivity here is a way out of the script block")

    # ...and it must not maul text that does not end a block, or the inlined
    # source stops being the source.
    keep = ("</scriptfoo>", "<script>", "a </ b", "</style>")
    check("bundle: leaves anything that is not a close tag alone",
          [s for s in keep if bundle_mod.guard_text(s) != s], [])

    # The built file does contain close tags - one per block it deliberately
    # opens. The property is that there are no *extra* ones: an unescaped
    # sequence from the dataset would end its block early and leave the rest of
    # the payload being parsed as markup, so opens and closes must balance.
    opens = len(re.findall(r"<script(?=[\s>])", html, re.IGNORECASE))
    closes = len(re.findall(r"</script(?=[\s/>])", html, re.IGNORECASE))
    check("bundle: every close tag is one the bundler opened", (opens, closes),
          (opens, opens),
          "an extra close tag ends the block early and the rest is markup")

    # The rewrite ran, rather than the bundler merely exiting 0. bundle.py
    # raises SystemExit when the tag is missing, so `bundle: exits 0` above
    # already covers a tag that moved - this covers the opposite mistake, a
    # rewrite that matched and produced the wrong thing.
    built = re.findall(
        r'<meta http-equiv="Content-Security-Policy" content="([^"]*)"\s*/?>', html)
    check("bundle: exactly one CSP meta tag", len(built), 1)
    if built:
        d = {p.split()[0]: p for p in built[0].split(";") if p.strip()}
        check("bundle CSP: inline scripts and styles are allowed, since all of them are",
              [k for k in ("script-src", "style-src")
               if "'unsafe-inline'" not in d.get(k, "")], [],
              "the standalone is nothing but inline blocks; 'self' alone blanks it")
        check("bundle CSP: nothing else was widened",
              [k for k, p in d.items()
               if k not in ("script-src", "style-src") and "unsafe" in p], [])
    check_true("bundle: carries the collection view", 'id="view-collection"' in html)
    check_true("bundle: carries the planner view", 'id="view-planner"' in html)
    check_true("bundle: planner search came across", 'id="addSearch"' in html)
    check("bundle: tabs switch instead of navigating", html.count('data-view="'), 2)
    check_true("bundle: both page scripts inlined",
               "wfprimes.plan.v1" in html and "wfprimes.collected.v1" in html)
    # both pages read the rotation model from a third script. Leaving it out of
    # the bundle is not a visible break until a bounty is ranked, so it is
    # asserted here rather than trusted to the eye.
    # both pages read the rotation model and the store/chrome helpers from two
    # shared scripts. Leaving either out of the bundle is not a visible break
    # until something is ranked or saved, so it is asserted rather than eyed.
    check_true("bundle: the shared rotation model came across",
               "window.WFPrimeRotation" in html)
    check_true("bundle: the shared store and chrome came across",
               "window.WFPrimeShared" in html)
    check_true("bundle: the shared data model came across",
               "window.WFPrimeModel" in html)
    check_true("bundle: the modules are inlined before the pages that read them",
               max(html.index("window.WFPrimeRotation"), html.index("window.WFPrimeShared"))
               < html.index("WFPrimeShared;"))

    # Merging two whole pages means every id below the header arrives twice, and
    # `getElementById` then answers every caller with the collection's copy. That
    # is not a crash and not visible on the tab you land on: it left the planner
    # tab with an empty footer - the element holding the licence and the Content
    # Policy attribution - and a backup dialog that opened inside a display:none
    # ancestor, rendering at 0x0 while making the rest of the page inert.
    #
    # Only the markup is scanned. The inlined scripts contain `id="..."` inside
    # template literals, which are not elements, and counting those would make
    # this assertion mean something other than what it says.
    markup = html[:html.index("<script>")]
    ids = re.findall(r'\sid="([^"]+)"', markup)
    twice = sorted(name for name, n in collections.Counter(ids).items() if n > 1)
    check("bundle: no element id appears twice", twice, [],
          "shared chrome must be emitted once, not once per page")

    # And the shared chrome sits outside both views, which is what makes one copy
    # enough: a modal inside the hidden view is a modal nobody can see, and it
    # renders at 0x0 while making the rest of the page inert.
    #
    # Depth-counted rather than compared by index. "After the planner view
    # starts" is the obvious check and it is not the claim: chrome emitted
    # *inside* the planner is also after it starts, and the first draft of this
    # assertion passed that mutation happily. Both views are <div>s and the
    # bundle's markup comes from two pages a test already holds to being
    # well-formed XML, so the tags balance.
    def ends_at(where: int) -> int:
        """Index just past the </div> that closes the div opening at `where`."""
        depth = 0
        for tag in re.finditer(r"</?div\b[^>]*>", markup[where:]):
            depth += -1 if tag.group(0).startswith("</") else 1
            if depth == 0:
                return where + tag.end()
        raise AssertionError("unbalanced <div> in the built file")

    after_views = max(ends_at(markup.index('<div id="view-collection">')),
                      ends_at(markup.index('<div id="view-planner"')))
    for name in ("siteFoot", "dataDlg"):
        check_true(f"bundle: {name} is outside both views",
                   markup.index(f'id="{name}"') > after_views,
                   "inside a view it is unreachable from the other tab")


def main() -> int:
    online = "--online" in sys.argv
    groups = [
        ("parsers", [test_rarity_from_intact, test_split_rate, test_normalise_part,
                     test_relic_key, test_parse_prime_page]),
        ("join", [test_normalise_sources, test_no_source_cap]),
        ("bounties", [test_bounty_rotation_pools, test_derive_bounty_rotation,
                      test_bounty_family_split, test_live_event_bounties,
                      test_only_fissures_worth_going_to_are_shipped]),
        ("built payload", [test_built_payload, test_parts_are_digital_extremes_own_numbers]),
        ("integration", [test_offline_build,
                         test_the_scheduled_task_can_actually_be_registered,
                         test_a_blocked_host_is_routed_around,
                         test_a_source_cannot_send_more_than_its_ceiling,
                         test_a_source_is_not_asked_inside_its_own_window,
                         test_an_impossible_304_is_treated_as_stale,
                         test_artwork_prefers_digital_extremes,
                         test_what_the_build_writes_is_what_the_site_ships,
                         test_the_feed_log_keeps_a_day_and_survives_a_runner,
                         test_the_worldstate_is_judged_on_its_own_timestamp,
                         test_a_live_feed_asks_de_then_wfcd_then_its_own_cache,
                         test_fissures_read_from_the_first_party_worldstate,
                         test_resurgence_reads_from_the_first_party_worldstate,
                         test_the_rotation_letter_is_read_then_cross_checked,
                         test_bounties_and_events_read_from_the_first_party_worldstate,
                         test_an_unreadable_export_index_degrades_instead_of_crashing,
                         test_cold_failure_is_fatal,
                         test_unreachable_sources_are_tagged,
                         test_an_optional_source_cannot_fail_the_build,
                         test_no_writer_leaves_orphans,
                         test_launchers_are_runnable,
                         test_runs_on_the_other_platform,
                         test_a_pre_refined_relic_reward_keeps_its_refinement,
                         test_no_source_file_carries_a_control_byte,
                         test_the_guard_refuses_shell_writes_to_source,
                         test_markup_is_xml_well_formed,
                         test_server_serves_only_the_site,
                         test_serving_a_page_starts_one_upstream_check_not_one_each,
                         test_a_check_that_dies_still_lowers_the_flag,
                         test_serving_a_page_never_writes_the_builders_cache,
                         test_the_ci_probe_asks_about_the_source_that_refuses,
                         test_our_invented_buckets_each_still_behave_as_one_thing,
                         test_the_server_caps_connections_not_just_requests,
                         test_the_schedulers_outpace_the_banner_they_prevent,
                         test_a_refresh_clears_the_stale_banner,
                         test_the_wiki_can_still_be_built_from_the_docs,
                         test_the_wiki_token_is_confined_to_the_job_that_pushes,
                         test_bundle_is_self_contained]),
        ("browser", [test_browser_assets]),
        ("online", [lambda: test_clone_and_build(online)]),
    ]
    for title, tests in groups:
        print(f"\n{title}")
        for t in tests:
            try:
                t()
            except Exception:                                    # noqa: BLE001
                FAILURES.append((t.__name__, traceback.format_exc(limit=3)))
                print(f"  ERROR {getattr(t, '__name__', t)}")
                traceback.print_exc(limit=3)

    print("\n" + "-" * 60)
    if FAILURES:
        print(f"{PASSED} passed, {len(FAILURES)} FAILED\n")
        for name, why in FAILURES:
            print(f"  {name}\n    {why}\n")
        return 1
    print(f"{PASSED} passed")

    # There is deliberately no check that the documentation agrees with this
    # number, because the documentation no longer states one. It used to: the
    # README carried a figure, the wiki republished it, and this compared the
    # two on any complete run. That was removed on 2026-08-25 along with every
    # written count.
    #
    # The reason is that the figure was never load-bearing and the upkeep was.
    # A count answers no question a reader actually has - it does not say what
    # is covered, only how finely it was sliced - and it went stale on every
    # commit that added a test, which meant three documents to re-edit for a
    # number nobody acts on. What matters is the line above: everything passed,
    # or something did not. Do not reintroduce a count here or in the docs.

    if not online:
        print("(clone-and-build skipped — re-run with --online for the full set)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
