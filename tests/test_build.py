#!/usr/bin/env python3
"""
VorFrame's test suite. Standard library only, like everything else here.

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
output here so there is still one command to run. Node is optional -- VorFrame
itself never needs it -- so they are skipped where it is not installed.

Every test here exists because of a bug that actually happened. The comment on
each says which.
"""

from __future__ import annotations

import datetime
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import traceback

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "tools"))

import build_data  # noqa: E402
import catalogue  # noqa: E402
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


# ─────────────────────────────────────────────────────────────────────────────
# the built dataset, if one is present
# ─────────────────────────────────────────────────────────────────────────────

def test_built_payload() -> None:
    path = os.path.join(ROOT, "data", "vorframe-data.json")
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
    check_true("payload: ducat values present", len(withd) > len(parts) * 0.9,
               "Baro's price per spare part; deterministic, so it should be near-total")
    check("payload: ducats are the known values",
          sorted({p["ducats"] for p in withd}), [15, 25, 45, 65, 100])

    # part names must be normalised, since saved progress is keyed on them
    raw = [p["name"] for i in D["items"] for p in (i.get("parts") or [])
           if p["name"] != "Blueprint" and p["name"].endswith(" Blueprint")]
    check("payload: part names normalised", raw, [])


# ─────────────────────────────────────────────────────────────────────────────
# integration
# ─────────────────────────────────────────────────────────────────────────────

def test_offline_build() -> None:
    """
    A rebuild from the warm cache must succeed and be deterministic. This is the
    path --if-changed takes on every scheduled run.
    """
    if not os.path.isdir(os.path.join(ROOT, ".cache")):
        print("  skip offline build (no warm cache)")
        return
    r = subprocess.run([sys.executable, "tools/build_data.py", "--offline"],
                       cwd=ROOT, capture_output=True, text=True)
    check("offline build: exits 0", r.returncode, 0, r.stderr[-400:])

    first = read_json(os.path.join(ROOT, "data", "vorframe-data.json"))
    subprocess.run([sys.executable, "tools/build_data.py", "--offline"],
                   cwd=ROOT, capture_output=True, text=True)
    second = read_json(os.path.join(ROOT, "data", "vorframe-data.json"))
    for d in (first, second):
        d["meta"].pop("generated", None)
    check("offline build: deterministic", first == second,  True,
          "two builds from the same cache must agree")


def test_cold_failure_is_fatal() -> None:
    """
    The warm/cold policy: a refresh that fails with nothing cached is critical,
    because the alternative is silently publishing a site with most of the game
    missing. It must exit non-zero unless --allow-degraded is passed.
    """
    tmp = tempfile.mkdtemp(prefix="vorframe-cold-")
    try:
        for d in ("tools", "data"):
            os.makedirs(os.path.join(tmp, d), exist_ok=True)
        for f in os.listdir(os.path.join(ROOT, "tools")):
            if f.endswith(".py"):
                shutil.copy(os.path.join(ROOT, "tools", f), os.path.join(tmp, "tools", f))
        # no .cache and no network: every fetch is a cold miss
        env = dict(os.environ, VORFRAME_TEST_NO_NETWORK="1",
                   http_proxy="http://127.0.0.1:9", https_proxy="http://127.0.0.1:9")
        r = subprocess.run([sys.executable, "tools/build_data.py", "--offline"],
                           cwd=tmp, capture_output=True, text=True, env=env, timeout=180)
        check_true("cold build: refuses to write a thin site", r.returncode != 0,
                   "a cold failure must not silently produce a partial dataset")
        wrote = os.path.exists(os.path.join(tmp, "data", "vorframe-data.js"))
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
    tmp = tempfile.mkdtemp(prefix="vorframe-clone-")
    try:
        r = subprocess.run(["git", "clone", "--depth", "1", ROOT, tmp],
                           capture_output=True, text=True, timeout=300)
        check("clone: succeeds", r.returncode, 0, r.stderr[-300:])

        # a fresh clone must not carry the dataset -- it is gitignored on purpose
        check("clone: ships no dataset",
              os.path.exists(os.path.join(tmp, "data", "vorframe-data.js")), False,
              "DE's data is rebuilt on demand, never committed")
        check("clone: ships no artwork",
              os.path.isdir(os.path.join(tmp, "assets", "img")), False)

        r = subprocess.run([sys.executable, "tools/build_data.py"],
                           cwd=tmp, capture_output=True, text=True, timeout=900)
        check("clone: build succeeds", r.returncode, 0, r.stdout[-600:] + r.stderr[-600:])

        built = os.path.join(tmp, "data", "vorframe-data.json")
        check_true("clone: dataset written", os.path.exists(built))
        if os.path.exists(built):
            D = read_json(built)
            check_true("clone: catalogue is populated", len(D["items"]) > 100)
            check_true("clone: relics are populated", len(D["relics"]) > 500)
            check("clone: no degraded sources", D["meta"].get("degraded"), [])
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


def test_no_writer_leaves_orphans() -> None:
    """
    Every writer must either overwrite a fixed name or prune what it no longer
    references. assets/img/ once kept 110 files and 5.7 MB for items that had
    left the catalogue, and nothing noticed.
    """
    import artwork as art
    D_path = os.path.join(ROOT, "data", "vorframe-data.json")
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
    for path in sorted(glob.glob(os.path.join(ROOT, "*.sh"))):
        name = os.path.basename(path)
        raw = read_bytes(path)
        check(f"{name}: no CR anywhere", raw.count(b"\r"), 0,
              "a CRLF shell script will not run on macOS or Linux")
        check_true(f"{name}: has a shebang", raw.startswith(b"#!"))

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
    """
    import glob

    # 1. A launcher without its opposite number is a feature that only half the
    #    users have. Both are meant to do exactly the same thing.
    cmds = {os.path.splitext(os.path.basename(p))[0]
            for p in glob.glob(os.path.join(ROOT, "*.cmd"))}
    shs = {os.path.splitext(os.path.basename(p))[0]
           for p in glob.glob(os.path.join(ROOT, "*.sh"))}
    check("launchers: every .cmd has a .sh", sorted(cmds - shs), [])
    check("launchers: every .sh has a .cmd", sorted(shs - cmds), [])

    # 2. Case. NTFS does not care, ext4 does: a link written as Assets/App.js
    #    works on the machine it was written on and 404s on the server. Every
    #    local path the two pages reference must match the disk exactly.
    for page in ("index.html", "plan.html"):
        markup = read_text(os.path.join(ROOT, page))
        refs = [m for m in re.findall(r'(?:src|href)="(?!data:|https?:|#)([^"]+)"', markup)
                if "${" not in m]
        check_true(f"{page}: references something", len(refs) > 0)
        for ref in refs:
            target = os.path.join(ROOT, *ref.split("/"))
            exists = os.path.exists(target)
            # os.path.exists is case-insensitive on Windows, so ask the
            # directory what it actually calls the file
            cased = exists and os.path.basename(ref) in os.listdir(os.path.dirname(target))
            check(f"{page}: {ref} exists, spelled that way", (exists, cased), (True, True),
                  "a case mismatch is invisible on Windows and fatal on Linux")

    # 3. Backslashes in a URL are not a path separator, they are a character.
    for name in ("app.js", "plan.js", "rotation.js", "shared.js", "model.js"):
        code = read_text(os.path.join(ROOT, "assets", name))
        check(f"{name}: no backslash paths in URLs",
              bool(re.search(r'(?:src|href)\s*=\s*["\'][^"\']*\\\\', code)), False)

    # 4. Python floor. README promises 3.8, and every annotation in the tools is
    #    written in the 3.10 style, which only parses on 3.8 because of the
    #    __future__ import. Losing that line is a syntax error for anyone on an
    #    older interpreter and no error at all here.
    for path in sorted(glob.glob(os.path.join(ROOT, "tools", "*.py")) +
                       glob.glob(os.path.join(ROOT, "tests", "*.py"))):
        src = read_text(path)
        modern = re.search(r"->\s*[\w.\[\]]+\s*\|\s*None|:\s*(?:dict|list|set|tuple)\[", src)
        if modern:
            check_true(f"{os.path.basename(path)}: postponed annotations",
                       "from __future__ import annotations" in src,
                       "3.10-style hints need this line to parse on 3.8")

    # 5. Constructs newer than the floor, which fail at runtime rather than at
    #    import and so survive every check that only compiles the file.
    for path in sorted(glob.glob(os.path.join(ROOT, "tools", "*.py"))):
        src = re.sub(r'"""ory.*?"""', "", read_text(path), flags=re.S)
        for bad, why in ((r"\.removeprefix\(", "str.removeprefix is 3.9+"),
                         (r"\.removesuffix\(", "str.removesuffix is 3.9+"),
                         (r"\bfunctools\.cache\b", "functools.cache is 3.9+"),
                         (r"\bzoneinfo\b", "zoneinfo is 3.9+"),
                         (r"^\s*match\s+.+:\s*$", "match statements are 3.10+")):
            check(f"{os.path.basename(path)}: {why}",
                  bool(re.search(bad, src, re.M)), False)

    # fromisoformat only learned to read a trailing Z in 3.11, and the
    # worldstate writes nothing else, so the Z has to be replaced by hand
    build = read_text(os.path.join(ROOT, "tools", "build_data.py"))
    for m in re.finditer(r"fromisoformat\((.{0,60})", build):
        check_true("fromisoformat: the Z is replaced first", "replace(" in m.group(1),
                   "a bare Z only parses on 3.11+")

    # 6. Absolute paths from whichever machine last touched the file.
    for path in sorted(glob.glob(os.path.join(ROOT, "tools", "*.py")) +
                       glob.glob(os.path.join(ROOT, "*.sh")) +
                       glob.glob(os.path.join(ROOT, "*.cmd"))):
        src = read_text(path)
        # tests/ is allowed one: it is where Node is looked for by force
        found = re.findall(r"[\"'][A-Za-z]:[\\/]{1,2}Users[\\/]{1,2}", src)
        check(f"{os.path.basename(path)}: no absolute local paths", found, [])

    # 7. Artwork filenames come from DE's item data and are written to disk. A
    #    colon or a question mark in one is legal on Linux and unopenable on
    #    Windows, so the whole cache would fail there and nowhere else.
    payload = os.path.join(ROOT, "data", "vorframe-data.json")
    if os.path.exists(payload):
        illegal = re.compile(r'[<>:"|?*\\]')
        bad = []
        for item in read_json(payload)["items"]:
            name = os.path.basename(str(item.get("image") or ""))
            if name and illegal.search(name):
                bad.append(name)
        check("artwork: every filename is legal on Windows", bad[:5], [])


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

    for path in ("index.html", "plan.html", "assets/app.js", "assets/plan.js",
                 "assets/rotation.js", "assets/shared.js", "assets/model.js",
                 "assets/styles.css", "data/vorframe-data.js",
                 "assets/img/AshPrime.png"):
        check_true(f"serves {path}", serve.allowed(path))

    for path in (".git/config", ".git/HEAD", ".git/objects/info/packs",
                 ".cache/api_items.gz", ".cache/state.json", "tools/serve.py",
                 "tests/test_build.py", ".gitignore", "PROJECT.md",
                 "dist/vorframe.html", "assets/img/sub/nested.png"):
        check(f"refuses {path}", serve.allowed(path), False)

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
    check_true("CSP has no unsafe-eval", "unsafe-eval" not in serve.CSP)
    check_true("CSP denies framing", "frame-ancestors 'none'" in serve.CSP)
    # With artwork local the CDN is not merely unused, it is disallowed - so a
    # visitor's address cannot reach a third party even by accident.
    import artwork as art
    if art.have_local_images():
        payload = read_text(os.path.join(ROOT, "data", "vorframe-data.js"))
        if "cdn.warframestat.us" not in payload:
            check("CSP forbids the CDN when artwork is local",
                  "cdn.warframestat.us" in serve.build_csp(), False)

    # inline handlers and style attributes are exactly what that policy blocks
    for name in ("index.html", "plan.html"):
        markup = read_text(os.path.join(ROOT, name))
        check(f"{name}: no inline style attributes", 'style="' in markup, False)
    for name in ("assets/app.js", "assets/plan.js", "assets/rotation.js",
                 "assets/shared.js", "assets/model.js"):
        code = read_text(os.path.join(ROOT, name))
        check(f"{name}: emits no inline style attributes", 'style="' in code, False)
        check(f"{name}: emits no inline event handlers",
              bool(re.search(r'\son(?:error|click|load|change)="', code)), False)


def find_node() -> str | None:
    """
    Node, if this machine has it.

    Looked for rather than assumed. It is not required to run VorFrame - the
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
    # which is the normal case - it is a large download and VorFrame does not
    # need it. Its skips come back through TAP and are reported as skips here.
    r = subprocess.run([node, "--test", "--test-reporter=tap",
                        os.path.join("tests", "test_assets.mjs"),
                        os.path.join("tests", "test_model.mjs"),
                        os.path.join("tests", "test_pages.mjs")],
                       capture_output=True, text=True, cwd=ROOT)
    seen = skipped = 0
    for line in (r.stdout or "").splitlines():
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
        check("js: " + name, status, "ok")
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
    r = subprocess.run([sys.executable, "tools/bundle.py"],
                       cwd=ROOT, capture_output=True, text=True)
    check("bundle: exits 0", r.returncode, 0, r.stderr[-300:])
    out = os.path.join(ROOT, "dist", "vorframe.html")
    if not os.path.exists(out):
        check_true("bundle: file written", False)
        return
    html = read_text(out)
    local = {m for m in re.findall(r'(?:src|href)="(?!data:|https?:|#)([^"]+)"', html)
             if "${" not in m}
    check("bundle: no local file references", local, set())
    check("bundle: no local artwork paths", html.count('"assets/img/'), 0)
    check_true("bundle: carries the collection view", 'id="view-collection"' in html)
    check_true("bundle: carries the planner view", 'id="view-planner"' in html)
    check_true("bundle: planner search came across", 'id="addSearch"' in html)
    check("bundle: tabs switch instead of navigating", html.count('data-view="'), 2)
    check_true("bundle: both page scripts inlined",
               "vorframe.plan.v1" in html and "vorframe.collected.v1" in html)
    # both pages read the rotation model from a third script. Leaving it out of
    # the bundle is not a visible break until a bounty is ranked, so it is
    # asserted here rather than trusted to the eye.
    # both pages read the rotation model and the store/chrome helpers from two
    # shared scripts. Leaving either out of the bundle is not a visible break
    # until something is ranked or saved, so it is asserted rather than eyed.
    check_true("bundle: the shared rotation model came across",
               "window.VorFrameRotation" in html)
    check_true("bundle: the shared store and chrome came across",
               "window.VorFrameShared" in html)
    check_true("bundle: the shared data model came across",
               "window.VorFrameModel" in html)
    check_true("bundle: the modules are inlined before the pages that read them",
               max(html.index("window.VorFrameRotation"), html.index("window.VorFrameShared"))
               < html.index("VorFrameShared;"))


def main() -> int:
    online = "--online" in sys.argv
    groups = [
        ("parsers", [test_rarity_from_intact, test_split_rate, test_normalise_part,
                     test_relic_key, test_parse_prime_page]),
        ("join", [test_normalise_sources, test_no_source_cap]),
        ("bounties", [test_bounty_rotation_pools, test_derive_bounty_rotation,
                      test_bounty_family_split, test_live_event_bounties]),
        ("built payload", [test_built_payload]),
        ("integration", [test_offline_build, test_cold_failure_is_fatal,
                         test_no_writer_leaves_orphans,
                         test_launchers_are_runnable,
                         test_runs_on_the_other_platform,
                         test_markup_is_xml_well_formed,
                         test_server_serves_only_the_site,
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
    if not online:
        print("(clone-and-build skipped — re-run with --online for the full set)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
