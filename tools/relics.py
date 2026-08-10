#!/usr/bin/env python3
"""
Turning drop tables into "which relic holds what, and where does it drop".

The join half of the old build_data.py: it takes the payloads sources.py
fetched and produces the two structures the site runs on - relic contents and
relic sources.
"""

from __future__ import annotations

import re
from collections import defaultdict

import official
from sources import DROP_FILES, log

# what a relic is called: Lith A1 Relic, Axi V14 Relic, ...
RELIC_RE = re.compile(r"^(Lith|Meso|Neo|Axi|Requiem|Omnia)\s+([A-Za-z0-9]+)\s+Relic\b", re.I)

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


