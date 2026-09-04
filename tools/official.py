"""
Parsers for Digital Extremes' own published data.

Nothing here touches the network and nothing here needs an LLM — the drop table
is a machine-generated HTML document with a completely regular row structure,
and the Public Export is plain JSON behind an LZMA envelope. Both are parsed
with a small state machine so a scheduled task can refresh the site unattended.

Two sources:

  * https://www.warframe.com/droptables
      The authoritative drop table. Every mirror (including the one Prime Hunter
      falls back to) is generated from this page, so it is always first to
      change when something is vaulted or unvaulted.

  * https://origin.warframe.com/PublicExport/index_en.txt.lzma
      DE's official item manifest, refreshed on every game build. It knows
      about a new Prime the moment it ships — before wiki editors get to it.
"""

from __future__ import annotations

import html as _html
import lzma
import os
import re
import sys
import time
from datetime import datetime, timezone

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import limits  # noqa: E402  (local module, sits beside this file)

# ── drop table ────────────────────────────────────────────────────────────

_ROW = re.compile(r"<tr\b[^>]*>(.*?)</tr>", re.S | re.I)
_CELL = re.compile(r"<(th|td)\b[^>]*>(.*?)</\1>", re.S | re.I)
_TAGS = re.compile(r"<[^>]+>")
_RELIC_HDR = re.compile(r"^(Lith|Meso|Neo|Axi|Requiem|Omnia)\s+(\w+)\s+Relic\s*\((\w+)\)$", re.I)
# A relic *reward* row names a refinement only when the relic arrives already
# refined - "Lith Q3 Relic (Radiant)" rather than the usual "Lith Q3 Relic".
# Eighty rows across the table do, every one of them Radiant: Elite Sanctuary
# Onslaught, the six Void Storms, and the four Profit-Taker phases. Refining a
# relic yourself costs 100 Void Traces and moves a blocked rare from roughly 50
# expected openings to 10, so which of the two you are being handed is not a
# detail. It used to be parsed off and thrown away.
_RELIC_ITEM = re.compile(
    r"^(Lith|Meso|Neo|Axi|Requiem|Omnia)\s+(\w+)\s+Relic\b"
    r"(?:\s*\((Intact|Exceptional|Flawless|Radiant)\))?", re.I)
_NODE_HDR = re.compile(r"^(.+?)/(.+?)\s*\((.+?)\)$")
_ROT_HDR = re.compile(r"^Rotation\s+(\w+)$", re.I)
# Sub-headings *inside* a bounty: which stage, or which completion. Anything
# matching this belongs to the bounty above it rather than starting a new one.
_SUBHEAD = re.compile(r"^((final\s+)?stage\b|first completion$|subsequent completions$)",
                      re.I)

# section id -> (kind, label used as the "planet" column for non-mission rows)
SECTIONS = {
    "missionRewards": ("mission", None),
    "relicRewards": ("relic", None),
    "keyRewards": ("key", "Keys & Special"),
    "transientRewards": ("transient", "Rotating / Event"),
    "cetusRewards": ("bounty", "Cetus (Plains of Eidolon)"),
    "solarisRewards": ("bounty", "Fortuna (Orb Vallis)"),
    "deimosRewards": ("bounty", "Necralisk (Cambion Drift)"),
    "zarimanRewards": ("bounty", "Chrysalith (Zariman)"),
    "entratiLabRewards": ("bounty", "Entrati Labs (Deimos)"),
    "hexRewards": ("bounty", "Hex (Höllvania)"),
    "relicByAvatar": ("enemy", "Enemy drops"),
}

# order matters: sections are sliced between consecutive ids on the page
SECTION_ORDER = [
    "missionRewards", "relicRewards", "keyRewards", "transientRewards",
    "sortieRewards", "cetusRewards", "solarisRewards", "deimosRewards",
    "zarimanRewards", "entratiLabRewards", "hexRewards", "modByAvatar",
    "modByDrop", "blueprintByAvatar", "blueprintByDrop", "resourceByAvatar",
    "resourceByDrop", "sigilByAvatar", "additionalItemByAvatar", "relicByAvatar",
]


def _text(fragment: str) -> str:
    return re.sub(r"\s+", " ", _html.unescape(_TAGS.sub("", fragment))).strip()


def _rows(section: str):
    """Yield (is_header, [cell texts]) for each <tr> in a section."""
    for m in _ROW.finditer(section):
        cells = _CELL.findall(m.group(1))
        if not cells:
            continue
        texts = [_text(c[1]) for c in cells]
        if not any(texts):
            continue  # blank spacer row
        yield any(c[0].lower() == "th" for c in cells), [t for t in texts if t]


def rarity_from_intact(pct: float | None) -> str | None:
    """
    Work out a relic reward's slot rarity from its unrefined drop chance.

    DE's own rarity words are relative to each table's spread rather than the
    relic's structure, so they are not usable here: the 25.33% common slot is
    written "Uncommon", and the rare slot is "Rare" at Intact but "Uncommon"
    once Radiant lifts it to 10%. The chances themselves are unambiguous —
    every standard relic is 3 x 25.33% common, 2 x 11% uncommon, 1 x 2% rare.
    """
    if pct is None:
        return None
    if pct >= 20:
        return "Common"
    if pct >= 6:
        return "Uncommon"
    return "Rare"


def _split_rate(cell: str):
    """
    'Uncommon (11.06%)' -> ('Uncommon', 11.06)

    Deliberately does not enumerate rarity words. DE uses more of them than is
    documented anywhere - 'Ultra Rare (1.01%)' appears on Defense tables - and a
    fixed alternation silently dropped the chance for every row it did not
    recognise. Take the percentage wherever it appears and treat whatever
    precedes it as the label.
    """
    m = re.search(r"([\d.]+)\s*%", cell or "")
    if not m:
        return None, None
    rarity = (cell[:m.start()] or "").strip(" () ").strip() or None
    try:
        return (rarity.title() if rarity else None), float(m.group(1))
    except ValueError:
        return (rarity.title() if rarity else None), None


def _slice_sections(page: str) -> dict[str, str]:
    """Cut the page into {section id: html} using the <h3 id=...> anchors."""
    marks = []
    for sid in SECTION_ORDER:
        i = page.find(f'id="{sid}"')
        if i >= 0:
            marks.append((i, sid))
    marks.sort()
    out = {}
    for n, (i, sid) in enumerate(marks):
        j = marks[n + 1][0] if n + 1 < len(marks) else len(page)
        out[sid] = page[i:j]
    return out


def parse_droptables(page: str):
    """
    Parse DE's drop table page.

    Returns (relic_contents, relic_sources, aya_sources); the first two are in
    exactly the shape the mirror path produces, so the rest of the build stays
    source-agnostic:

        relic_contents["Axi A1"] = {tier, code, rewards: {item: {rarity, chances}}}
        relic_sources["Axi A1"]  = [{kind, planet, node, mode, rotation, chance, rarity}]
        aya_sources              = [{kind, planet, node, mode, rotation, chance}]

    Aya is not a relic, so it never reached the site before. It matters because
    one Aya buys one relic *of your choosing* from Varzia, which is worth more
    than a random relic off a drop table. Collected here because it appears in
    the same rows, keyed nowhere - just a flat list of places it drops.
    """
    sections = _slice_sections(page)
    relic_contents: dict[str, dict] = {}
    relic_sources: dict[str, list] = {}
    aya_sources: list[dict] = []

    def add_source(item_cell, entry):
        # "Aya" exactly - not "Ayatan Amber Star" or the Ayatan sculptures,
        # which are Maroo's treasures and have nothing to do with Prime Vault
        if item_cell.strip().lower() == "aya":
            aya_sources.append({k: v for k, v in entry.items() if k != "rarity"})
            return
        m = _RELIC_ITEM.match(item_cell)
        if not m:
            return
        key = f"{m.group(1).title()} {m.group(2).upper()}"
        # Only where DE names one. Absent means "the ordinary Intact relic",
        # which is the overwhelming majority, and a field carried on every row
        # to say the usual thing would be noise in the payload.
        if m.group(3):
            entry = dict(entry, refinement=m.group(3).title())
        relic_sources.setdefault(key, []).append(entry)

    # ---- relic contents -------------------------------------------------
    cur = None
    for is_head, cells in _rows(sections.get("relicRewards", "")):
        if is_head:
            m = _RELIC_HDR.match(cells[0])
            cur = (f"{m.group(1).title()} {m.group(2).upper()}", m.group(3).title()) if m else None
            continue
        if not cur or len(cells) < 2:
            continue
        name, (rarity, chance) = cells[-2], _split_rate(cells[-1])
        relic, state = cur
        rec = relic_contents.setdefault(relic, {
            "tier": relic.split()[0], "code": relic.split()[1], "rewards": {},
        })
        slot = rec["rewards"].setdefault(name, {"rarity": rarity, "chances": {}})
        if rarity:
            slot["rarity"] = rarity
        slot["chances"][state] = chance

    # Replace DE's chance-relative rarity words with the slot rarity implied by
    # the unrefined odds (see rarity_from_intact).
    for rec in relic_contents.values():
        for slot in rec["rewards"].values():
            derived = rarity_from_intact((slot.get("chances") or {}).get("Intact"))
            if derived:
                slot["rarity"] = derived

    # ---- star chart missions -------------------------------------------
    node = rotation = None
    for is_head, cells in _rows(sections.get("missionRewards", "")):
        if is_head:
            head = cells[0]
            rot = _ROT_HDR.match(head)
            if rot:
                rotation = rot.group(1).upper()
                continue
            m = _NODE_HDR.match(head)
            if m:
                node = (m.group(1).strip(), m.group(2).strip(), m.group(3).strip())
                rotation = None
            continue
        if not node or len(cells) < 2:
            continue
        rarity, chance = _split_rate(cells[-1])
        add_source(cells[-2], {
            "kind": "mission", "planet": node[0], "node": node[1], "mode": node[2],
            "rotation": rotation, "chance": chance, "rarity": rarity,
        })

    # ---- bounties, keys, dynamic locations ------------------------------
    for sid in ("keyRewards", "transientRewards", "cetusRewards", "solarisRewards",
                "deimosRewards", "zarimanRewards", "entratiLabRewards", "hexRewards"):
        kind, label = SECTIONS[sid]
        group = rotation = stage = None
        for is_head, cells in _rows(sections.get(sid, "")):
            if is_head:
                head = cells[0]
                rot = _ROT_HDR.match(head)
                if rot:
                    rotation = rot.group(1).upper()
                    continue
                # DE nests stages under each bounty:
                #
                #     Level 5 - 15 Cetus Bounty
                #       Rotation A
                #         Stage 1
                #         Stage 2, Stage 3 of 4, and Stage 3 of 5
                #         Final Stage
                #
                # Each of those is a sub-heading, not a new bounty. Matching only
                # "^Stage" missed "Final Stage", so it became a group of its own
                # and 61 source rows were filed under a phantom node of that name,
                # detached from the bounty they belong to.
                #
                # Profit-Taker Phase 3 nests one level deeper, and broke the same
                # way: its table is split into "First Completion" (a guaranteed
                # Gravimag, once ever) and "Subsequent Completions" (everything
                # after, and the only one carrying relics). Both were read as
                # bounties in their own right, so the planner offered a node
                # called "Subsequent Completions", which is not a place.
                if _SUBHEAD.match(head):
                    stage = head
                    continue
                group = head
                rotation = None
                stage = None
                continue
            if not group or len(cells) < 2:
                continue
            rarity, chance = _split_rate(cells[-1])
            add_source(cells[-2], {
                "kind": kind, "planet": label, "node": group,
                "mode": "Bounty" if kind == "bounty" else ("Key" if kind == "key" else "Special"),
                "rotation": rotation, "chance": chance, "rarity": rarity,
                # which stage of the bounty pays this, so the planner can say
                # "you have to finish the whole thing" rather than implying a
                # reward you can take and leave
                "stage": stage,
            })

    # ---- relics dropped by enemies --------------------------------------
    enemy = None
    for is_head, cells in _rows(sections.get("relicByAvatar", "")):
        if is_head:
            enemy = cells[0]
            continue
        if not enemy or len(cells) < 2:
            continue
        rarity, chance = _split_rate(cells[-1])
        add_source(cells[-2], {
            "kind": "enemy", "planet": "Enemy drops", "node": enemy, "mode": "Enemy",
            "rotation": None, "chance": chance, "rarity": rarity,
        })

    return relic_contents, relic_sources, aya_sources


# ── bounty rotation pools ─────────────────────────────────────────────────

# "Level 15 - 25 Ghoul Bounty" -> (15, 25). The live worldstate identifies a
# bounty by its enemy level range and nothing else, so this is the join key.
_GROUP_LEVELS = re.compile(r"Level\s+(\d+)\s*-\s*(\d+)")

BOUNTY_SECTIONS = [sid for sid, (kind, _) in SECTIONS.items() if kind == "bounty"]


def bounty_rotation_pools(page: str) -> dict[str, dict[str, dict[str, set[str]]]]:
    """
    {section id: {bounty: {rotation letter: {every reward name in it}}}}

    The whole pool, not just the relics — non-relic rewards are most of what
    distinguishes one rotation from another, and this table exists to be
    matched against the live worldstate rather than shown to anyone.

    A bounty's rotation letter is wall-clock state: one letter is live for
    everyone, it advances A -> B -> C every 150 minutes, and a run pays the
    stages of whichever letter is up. So the letter cannot be read off the drop
    table alone; the table only says what each letter *would* pay. Naming the
    live one is `build_data.derive_bounty_rotation`'s job, and this is the half
    of the comparison DE publishes.
    """
    out: dict[str, dict[str, dict[str, set[str]]]] = {}
    sections = _slice_sections(page)
    for sid in BOUNTY_SECTIONS:
        group = rotation = None
        for is_head, cells in _rows(sections.get(sid, "")):
            head = cells[0]
            if is_head:
                rot = _ROT_HDR.match(head)
                if rot:
                    rotation = rot.group(1).upper()
                    continue
                if _SUBHEAD.match(head):
                    continue          # stages all sit inside one rotation
                group = head
                rotation = None
                continue
            if not group or rotation is None or len(cells) < 2:
                continue
            out.setdefault(sid, {}).setdefault(group, {}) \
               .setdefault(rotation, set()).add(cells[-2])
    return out


def group_levels(group: str) -> list[int] | None:
    m = _GROUP_LEVELS.search(group or "")
    return [int(m.group(1)), int(m.group(2))] if m else None


# ── public export ─────────────────────────────────────────────────────────

def decode_index(blob: bytes) -> dict[str, str]:
    """
    Decode index_en.txt.lzma into {'ExportWarframes_en.json': '<hash>'}.

    DE writes LZMA-alone streams whose declared size trips Python's strict
    decoder, so the size field is blanked and the end marker is trusted.

    Blanking that size field is exactly what removes the decoder's own idea of
    how large the output should be, which is why the ceiling below is not
    optional: this is a ~500-byte input, decoded twice, with the one field that
    would otherwise bound it deliberately overwritten with 0xff.
    """
    ceiling = limits.cap_for("export_index")
    try:
        raw = limits.unlzma_capped(blob, ceiling, "export_index")
    except lzma.LZMAError:
        patched = blob[:5] + b"\xff" * 8 + blob[13:]
        raw = limits.unlzma_capped(patched, ceiling, "export_index")

    out = {}
    for line in raw.decode("utf-8", "replace").splitlines():
        line = line.strip()
        if "!" in line:
            name, _, tag = line.partition("!")
            out[name] = tag
    return out


def load_export(blob: bytes) -> dict:
    """DE's export files carry a BOM and stray control characters."""
    import json
    text = blob.decode("utf-8-sig", "replace")
    text = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f]", "", text)
    return json.loads(text)


# productCategory -> the section name used on the wiki Prime page
PRODUCT_CATEGORY = {
    "Suits": "Warframe",
    "SpaceSuits": "Archwing",
    "LongGuns": "Primary",
    "Pistols": "Secondary",
    "Melee": "Melee",
    "SpaceGuns": "Archgun",
    "SpaceMelee": "Melee",
    "SentinelWeapons": "Robotic Weapon",
    "Sentinels": "Companion",
}

_SKIP = re.compile(r"\b(Prime Access|Glyph|Sigil|Noggle|Scene|Emblem|Poster|Display)\b", re.I)


def node_levels(exports: dict[str, dict]) -> dict[str, list]:
    """
    "Planet/Node" -> [minEnemyLevel, maxEnemyLevel] from DE's region export.

    Covers the regular star chart only: Railjack/Proxima nodes and temporary
    Event: variants are simply not in the export, so the planner has to treat
    an unknown level as unknown rather than guessing.
    """
    out: dict[str, list] = {}
    payload = exports.get("ExportRegions_en.json") or {}
    for rows in payload.values():
        if not isinstance(rows, list):
            continue
        for n in rows:
            if not isinstance(n, dict):
                continue
            system, name = n.get("systemName"), n.get("name")
            lo, hi = n.get("minEnemyLevel"), n.get("maxEnemyLevel")
            if system and name and lo is not None:
                out[f"{system}/{name}"] = [lo, hi]
    return out


def collect_prime_items(exports: dict[str, dict]) -> list[dict]:
    """
    Every Prime in DE's official item data, as
    [{name, category, uniqueName, productCategory}].

    This is what lets Prime Hunter list a Prime that shipped today, before the
    wiki page has been edited.
    """
    found: dict[str, dict] = {}
    for payload in exports.values():
        if not isinstance(payload, dict):
            continue
        for rows in payload.values():
            if not isinstance(rows, list):
                continue
            for row in rows:
                if not isinstance(row, dict):
                    continue
                # DE tags some entries with an internal marker: "<ARCHWING> Odonata Prime"
                name = re.sub(r"^<[^>]*>\s*", "", (row.get("name") or "")).strip()
                if " Prime" not in f" {name}" or _SKIP.search(name):
                    continue
                pc = row.get("productCategory")
                cat = PRODUCT_CATEGORY.get(pc)
                if not cat:
                    continue
                uniq = row.get("uniqueName") or ""
                # skip the internal store/blueprint duplicates
                if "/StoreItems/" in uniq:
                    continue
                found.setdefault(name, {
                    "name": name, "category": cat,
                    "uniqueName": uniq, "productCategory": pc,
                })
    return sorted(found.values(), key=lambda r: r["name"])


def worldstate_age(doc: dict, now: float | None = None) -> float | None:
    """
    How old the worldstate says it is, in seconds. `None` if it does not say.

    DE stamp every document with `Time`, a unix timestamp of when they generated
    it, and that is a fact about the **content** rather than about our transport.
    Everything else this project knows about freshness is about transport — did
    the request fail, how old is the file we wrote — and transport cannot see an
    edge cache serving a stale object behind a `200`. DE sit behind Akamai, so
    that is not a hypothetical shape.

    Measured 2026-08-28: a successful fetch returned a document **36 seconds**
    old, against a declared `Cache-Control: max-age=23`. So a healthy answer is
    seconds old, and anything approaching an hour has been through something.
    """
    stamp = (doc or {}).get("Time")
    if not isinstance(stamp, (int, float)) or stamp <= 0:
        return None
    at = time.time() if now is None else now
    return max(0.0, at - float(stamp))


def prime_part_specs(exports: dict[str, dict]) -> dict[str, list[dict]]:
    """
    What each Prime is built from, from Digital Extremes' own manifests:
    `{prime name: [{"name", "itemCount", "ducats", "sub"}]}`.

    The component list, how many of each you need and what Baro pays for a
    spare all used to come from `api.warframestat.us/items`. DE publish all
    three, across two manifests that had never been read:

      * `ExportRecipes_en.json` gives each blueprint's `ingredients[]` with an
        `ItemType` and an `ItemCount`, and its own `primeSellingPrice`.
      * `ExportResources_en.json` turns an ingredient path into a name. That is
        the part that makes this tractable: the ingredient is
        `AshPrimeHelmetComponent` and the part a reader knows is *Neuroptics*,
        which is a rename rather than a substring, and DE publish the rename.

    Measured across the whole catalogue before it was wired in, because a
    spot-check is how the artwork change once reported 166 of 167 with the miss
    in the probe: **583 parts, every name, count and ducat value agreeing with
    what we already shipped, and no disagreements at all.**

    Six items have no recipe — Excalibur, Lato and Skana Prime, Gotva Prime, War
    Prime and Kavasa Prime Collar. Five of them have no parts either, so only
    Kavasa loses anything, and DE publish nothing about it in any manifest. That
    one keeps the WFCD list, which is the documented precedence: first party for
    what DE publish, WFCD for what they do not.

    `sub` marks an ingredient that is itself a Prime in the catalogue — Aklex
    Prime is built from two Lex Primes, which DE express the same way WFCD do,
    as the same ingredient listed twice at one each.
    """
    by_path = {p["uniqueName"]: p["name"]
               for p in collect_prime_items(exports) if p.get("uniqueName")}

    # ingredient path -> (display name, ducats). Only rows carrying a
    # `primeSellingPrice` are parts; the rest are Orokin Cells and the like,
    # which are build materials rather than anything a relic pays out.
    named: dict[str, tuple[str, int]] = {}
    for row in ((exports.get("ExportResources_en.json") or {}).get("ExportResources") or []):
        path, price = row.get("uniqueName"), row.get("primeSellingPrice")
        if path and row.get("name") and price is not None:
            named[path] = (str(row["name"]), price)

    out: dict[str, list[dict]] = {}
    for rec in ((exports.get("ExportRecipes_en.json") or {}).get("ExportRecipes") or []):
        owner = by_path.get(rec.get("resultType"))
        if not owner or owner in out:
            continue
        # The blueprint is the recipe itself, and its ducat value is the
        # recipe's own `primeSellingPrice`.
        parts = [{"name": "Blueprint", "itemCount": 1,
                  "ducats": rec.get("primeSellingPrice"), "sub": False}]
        for ing in (rec.get("ingredients") or []):
            path = ing.get("ItemType")
            count = ing.get("ItemCount") or 1
            if path in by_path:                       # a whole Prime, not a part of one
                label, ducats, sub = by_path[path], None, True
            elif path in named:
                raw_name, ducats = named[path]
                sub = False
                # "Ash Prime Neuroptics" -> "Neuroptics". Sliced off the front
                # only when it really is the front, so a part whose name does
                # not repeat the item's survives whole.
                label = (raw_name[len(owner):].strip()
                         if raw_name.lower().startswith(owner.lower() + " ") else raw_name)
            else:
                continue                              # a build material, not a part
            prev = next((p for p in parts if p["name"] == label), None)
            if prev:
                prev["itemCount"] = (prev["itemCount"] or 1) + count
            else:
                parts.append({"name": label, "itemCount": count,
                              "ducats": ducats, "sub": sub})
        out[owner] = parts
    return out


# ── the live worldstate, read from Digital Extremes directly ───────────────
#
# `api.warframe.com/cdn/worldState.php` is first party and carries every feed we
# used to take from the WFCD proxy. It publishes the game's own vocabulary rather
# than a normalised one, so these turn it into the shape `build_fissures` already
# consumes — the same shape WFCD produce, deliberately, so the two are
# interchangeable and either can be the fallback for the other.
#
# Nothing here is copied from WFCD. The mapping is derived from DE's own export:
# `ExportRegions_en.json` names every node, and the tier names are the five the
# game itself shows.

# `Modifier` on a mission, `ActiveMissionTier` on a storm. Requiem and Omnia are
# included because the payload's own allowlist decides what survives, and it is
# better for that decision to sit in one place than to be pre-filtered here.
VOID_TIERS = {
    "VoidT1": "Lith",
    "VoidT2": "Meso",
    "VoidT3": "Neo",
    "VoidT4": "Axi",
    "VoidT5": "Requiem",
    "VoidT6": "Omnia",
}


def node_names(exports: dict[str, dict]) -> dict[str, str]:
    """`SolNode196` -> `"Charybdis (Sedna)"`, from DE's own region export.

    The format is WFCD's, because matching it is the point: the payload and both
    pages already speak it, and a second spelling would be a second thing to keep
    in step.

    Proxima is **not** in here and cannot be: `ExportRegions_en.json` carries no
    `CrewBattleNode*` rows at all, which is the same gap that leaves Railjack
    enemy levels unknown. Callers get nothing for a storm node rather than a
    guess.
    """
    out: dict[str, str] = {}
    payload = exports.get("ExportRegions_en.json") or {}
    for rows in payload.values():
        if not isinstance(rows, list):
            continue
        for row in rows:
            uniq = str(row.get("uniqueName") or "")
            name = str(row.get("name") or "").strip()
            system = str(row.get("systemName") or "").strip()
            if uniq and name:
                out[uniq] = f"{name} ({system})" if system else name
    return out


def _worldstate_instant(value) -> str | None:
    """DE wrap every time as `{"$date": {"$numberLong": "<ms>"}}`."""
    try:
        ms = int(((value or {}).get("$date") or {}).get("$numberLong"))
    except (TypeError, ValueError):
        return None
    return datetime.fromtimestamp(ms / 1000, timezone.utc).isoformat(
        timespec="milliseconds").replace("+00:00", "Z")


# DE's syndicate tag -> the name this project already uses for it, which is the
# name WFCD published and therefore the one `SYNDICATE_SECTION` is keyed on.
# A naming table, not a data table: four entries, and changing one changes only
# what we call a thing.
SYNDICATE_TAGS = {
    "CetusSyndicate": "Ostrons",
    "SolarisSyndicate": "Solaris United",
    "EntratiSyndicate": "Entrati",
    "ZarimanSyndicate": "The Holdfasts",
}


def syndicate_missions_from_worldstate(doc: dict) -> list[dict]:
    """DE's raw worldstate -> the bounty boards, in the shape the build consumes.

    **DE publish two windows at once** — the one running now and the one after
    it — as separate rows per syndicate. That is not a quirk to flatten: it is
    what `_one_window` upstream already exists to pick between, and merging them
    would silently average two different rotation letters into nonsense.

    `rewardPool` is deliberately absent, because DE do not publish it. They give
    the reward *table path* and WFCD resolved that into reward names. The letter
    is read from the path either way — see `rotation_letter` — so nothing that
    matters is lost; what goes is the independent cross-check, which is why the
    one that replaces it compares the jobs in a window against each other
    instead. `PROJECT.md §7` has the reasoning and the owner's decision.

    Isolation Vault bounties come through with **no `jobType` at all**, which is
    DE's own signal and a cleaner one than the level-matching this project uses
    to split the vault family. Passed through untouched rather than acted on:
    changing how the family is decided is its own change.
    """
    out = []
    for row in (doc.get("SyndicateMissions") or []):
        name = SYNDICATE_TAGS.get(str(row.get("Tag") or ""))
        jobs_in = row.get("Jobs") or []
        if not name or not jobs_in:
            continue
        jobs = []
        for job in jobs_in:
            lo, hi = job.get("minEnemyLevel"), job.get("maxEnemyLevel")
            jobs.append({
                "uniqueName": job.get("rewards") or "",
                "enemyLevels": [lo, hi] if lo is not None and hi is not None else [],
                "minMR": job.get("masteryReq"),
                "type": str(job.get("jobType") or "").rsplit("/", 1)[-1],
                # WFCD's `standingStages` is DE's `xpAmounts`: one entry per
                # stage, and its length is the stage count the planner costs a
                # bounty by. Same list, different name — and a bounty costed at
                # the wrong number of stages is the exact defect this project
                # has already shipped once.
                "standingStages": list(job.get("xpAmounts") or []),
                # No rewardPool: DE publish a table path, not a list of names.
                "rewardPool": [],
            })
        out.append({
            "syndicate": name,
            "activation": _worldstate_instant(row.get("Activation")),
            "expiry": _worldstate_instant(row.get("Expiry")),
            "jobs": jobs,
        })
    return out


def events_from_worldstate(doc: dict) -> list[dict]:
    """DE's raw worldstate -> the limited-time events, as the build reads them.

    **`Goals`, not `Events`.** DE's `Events` is the news feed — Discord invites,
    patch-note links, image URLs — 34 rows of it, and nothing this project wants.
    The in-game events WFCD publish as `events`, the Ghoul Purge and Plague Star
    among them, are `Goals`. Reading the field with the matching name would have
    produced a confident empty answer, which is the worst kind.
    """
    out = []
    for goal in (doc.get("Goals") or []):
        out.append({
            "tag": str(goal.get("Tag") or ""),
            "node": str(goal.get("Node") or ""),
            # An internal string path rather than prose; `find_live_events`
            # scans it alongside the tag, and the tag is what actually decides.
            "description": str(goal.get("Desc") or ""),
            "tooltip": "",
            "name": str(goal.get("Tag") or ""),
            "activation": _worldstate_instant(goal.get("Activation")),
            "expiry": _worldstate_instant(goal.get("Expiry")),
        })
    return out


def void_trader_from_worldstate(doc: dict) -> dict | None:
    """Baro Ki'Teer's visit — the window, and what he has while he is on it.

    `VoidTraders` carries an activation and an expiry, and a `Manifest` that is
    **empty between visits** and holds his stock while he is present (41 rows,
    measured 2026-09-04). The **window** is emitted rather than a computed "is
    he here": a build is up to ten minutes old and a page can be open for hours,
    so the page compares the window to its own clock, exactly as it does for
    fissure expiry. Deciding it here would freeze the answer at build time and
    be wrong twice a fortnight.

    `manifest` is the raw `ItemType` paths and is **for the build only** — it is
    stripped before `meta.baro` is written, because the payload has no use for
    forty rows of mods and ship decorations and DE's data is not ours to
    republish.
    """
    trader = (doc.get("VoidTraders") or [None])[0]
    if not isinstance(trader, dict):
        return None
    activation = _worldstate_instant(trader.get("Activation"))
    expiry = _worldstate_instant(trader.get("Expiry"))
    if not activation or not expiry:
        return None
    return {
        "activation": activation,
        "expiry": expiry,
        "node": str(trader.get("Node") or ""),
        "character": str(trader.get("Character") or ""),
        "manifest": [str(row.get("ItemType") or "")
                     for row in (trader.get("Manifest") or [])
                     if isinstance(row, dict) and row.get("ItemType")],
    }


def void_trader_from_proxy(doc: dict | None) -> dict | None:
    """The same trader, as WFCD republish him, in the same shape.

    The fallback half of the chain. DE 403 a datacentre address range, so on CI
    this is the route that actually answers — measured at 49 of 53 builds for
    the feeds that already had a fallback. Baro's shelf shipped without one on
    2026-09-04 and was empty on the deployed site for exactly that reason.

    WFCD spell it differently and the differences are the whole of this
    function: `inventory` rather than `Manifest`, `uniqueName` rather than
    `ItemType`, `location` ("Strata Relay (Earth)") rather than `Node`
    ("EarthHUB"), and ISO-8601 instants rather than millisecond stamps. The
    `uniqueName` values are the same `/Lotus/StoreItems/...` paths, which is what
    lets one join read either source.

    `node` deliberately keeps whatever the source called it rather than being
    normalised to DE's spelling: the page prints it, and WFCD's is the more
    readable of the two.
    """
    if not isinstance(doc, dict):
        return None
    activation, expiry = doc.get("activation"), doc.get("expiry")
    if not activation or not expiry:
        return None
    return {
        "activation": str(activation),
        "expiry": str(expiry),
        "node": str(doc.get("location") or ""),
        "character": str(doc.get("character") or ""),
        "manifest": [str(row.get("uniqueName") or "")
                     for row in (doc.get("inventory") or [])
                     if isinstance(row, dict) and row.get("uniqueName")],
    }


def rotation_letter(path: str) -> str | None:
    """The rotation letter a bounty's reward-table path states outright.

        /Lotus/Types/Game/MissionDecks/EidolonJobMissionRewards/TierATableCRewards
                                                                    ^^^^^^

    `Tier` is the level bracket and `Table` is the rotation; only the second is
    wanted, which is the trap in reading this by eye. Anything outside A/B/C is
    refused rather than passed through, because this feeds the letter the page
    counts down with and a stray value there is worse than none.
    """
    found = re.search(r"Table([A-Z])Rewards\b", str(path or ""))
    letter = found.group(1) if found else None
    return letter if letter in ("A", "B", "C") else None


def vault_trader_from_worldstate(doc: dict) -> dict | None:
    """DE's raw worldstate -> Varzia's stock, in the shape the build consumes.

    `build_resurgence_set` matches on `uniqueName` with a substring test, and
    DE's `ItemType` is the same path the proxy was republishing — so this is
    mostly a rename. Checked by running both through that function on the same
    day: the WFCD copy and DE's raw document produce **the same five Primes**.

    **`Manifest` only, never `EvergreenManifest`.** Counted on 2026-08-27, the
    evergreen 82 contain **no relics at all** — 42 mods and skins, 27 misc store
    items, 8 accessory packs, 4 Prime weapons sold outright, 1 character. They
    are bought rather than farmed, and `PROJECT.md §2` puts real-money purchases
    out of scope entirely. That is the reason, not the weaker one this comment
    first gave about the badge becoming noisy.

    And the packs in `Manifest` are read as a **signal, not a shopping list**:
    they cost Regal Aya and are ignored as products. What is taken from them is
    which Primes are unvaulted this rotation, because those are the Primes whose
    relics Varzia then sells for *farmed* Aya.

    `character` and `location` are absent from DE's document — `Node` is
    `TradeHUB1`, which their region export does not name — and are deliberately
    not invented. Nothing needs them: the drawer writes *Varzia* itself and
    already defaults the place to Maroo's Bazaar.
    """
    trader = (doc.get("PrimeVaultTraders") or [None])[0]
    if not isinstance(trader, dict):
        return None
    inventory = []
    for row in (trader.get("Manifest") or []):
        item = str(row.get("ItemType") or "")
        if not item:
            continue
        inventory.append({"uniqueName": item, "item": "",
                          "ducats": row.get("PrimePrice")})
    if not inventory:
        return None
    return {
        "inventory": inventory,
        "activation": _worldstate_instant(trader.get("Activation")),
        "expiry": _worldstate_instant(trader.get("Expiry")),
    }


def fissures_from_worldstate(doc: dict, names: dict[str, str]) -> list[dict]:
    """DE's raw worldstate -> the fissure list, in the shape the build consumes.

    Two sources inside the one document, and they are different missions rather
    than a flag on the same one: `ActiveMissions` is the star chart, `VoidStorms`
    is Railjack, with its tier under a different key.

    **Storms come back without a node name and that is deliberate.** DE publish
    no `CrewBattleNode*` in their region export, so there is nothing to resolve
    the id against; emitting the id itself would put `CrewBattleNode522` on a
    card, and inventing a name is worse. They are returned with `node: None` so a
    caller can count what it is missing rather than silently seeing a shorter
    list — `build_fissures` drops them, and the WFCD proxy remains the only route
    to a named storm.
    """
    out = []
    for entry in (doc.get("ActiveMissions") or []):
        tier = VOID_TIERS.get(str(entry.get("Modifier") or ""))
        ends = _worldstate_instant(entry.get("Expiry"))
        if not tier or not ends:
            continue
        out.append({
            "node": names.get(str(entry.get("Node") or "")),
            "tier": tier,
            "expiry": ends,
            "isHard": bool(entry.get("Hard")),
            "isStorm": False,
        })
    for entry in (doc.get("VoidStorms") or []):
        tier = VOID_TIERS.get(str(entry.get("ActiveMissionTier") or ""))
        ends = _worldstate_instant(entry.get("Expiry"))
        if not tier or not ends:
            continue
        out.append({
            "node": names.get(str(entry.get("Node") or "")),
            "tier": tier,
            "expiry": ends,
            "isHard": False,
            "isStorm": True,
        })
    return out
