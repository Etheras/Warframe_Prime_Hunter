"""
Parsers for Digital Extremes' own published data.

Nothing here touches the network and nothing here needs an LLM — the drop table
is a machine-generated HTML document with a completely regular row structure,
and the Public Export is plain JSON behind an LZMA envelope. Both are parsed
with a small state machine so a scheduled task can refresh the site unattended.

Two sources:

  * https://www.warframe.com/droptables
      The authoritative drop table. Every mirror (including the one VorFrame
      falls back to) is generated from this page, so it is always first to
      change when something is vaulted or unvaulted.

  * https://origin.warframe.com/PublicExport/index_en.txt.lzma
      DE's official item manifest, refreshed on every game build. It knows
      about a new Prime the moment it ships — before wiki editors get to it.
"""

from __future__ import annotations

import html as _html
import lzma
import re

# ── drop table ────────────────────────────────────────────────────────────

_ROW = re.compile(r"<tr\b[^>]*>(.*?)</tr>", re.S | re.I)
_CELL = re.compile(r"<(th|td)\b[^>]*>(.*?)</\1>", re.S | re.I)
_TAGS = re.compile(r"<[^>]+>")
_RELIC_HDR = re.compile(r"^(Lith|Meso|Neo|Axi|Requiem|Omnia)\s+(\w+)\s+Relic\s*\((\w+)\)$", re.I)
_RELIC_ITEM = re.compile(r"^(Lith|Meso|Neo|Axi|Requiem|Omnia)\s+(\w+)\s+Relic\b", re.I)
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
    """
    try:
        raw = lzma.LZMADecompressor(format=lzma.FORMAT_ALONE).decompress(blob)
    except lzma.LZMAError:
        patched = blob[:5] + b"\xff" * 8 + blob[13:]
        raw = lzma.LZMADecompressor(format=lzma.FORMAT_ALONE).decompress(patched)

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

    This is what lets VorFrame list a Prime that shipped today, before the
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
