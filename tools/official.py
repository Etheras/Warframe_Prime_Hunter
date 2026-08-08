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
_RATE = re.compile(r"^(Common|Uncommon|Rare|Legendary|Very Common|Extremely Rare)?\s*\(?([\d.]+)\s*%\)?$", re.I)
_RELIC_HDR = re.compile(r"^(Lith|Meso|Neo|Axi|Requiem|Omnia)\s+(\w+)\s+Relic\s*\((\w+)\)$", re.I)
_RELIC_ITEM = re.compile(r"^(Lith|Meso|Neo|Axi|Requiem|Omnia)\s+(\w+)\s+Relic\b", re.I)
_NODE_HDR = re.compile(r"^(.+?)/(.+?)\s*\((.+?)\)$")
_ROT_HDR = re.compile(r"^Rotation\s+(\w+)$", re.I)

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


def _split_rate(cell: str):
    """'Uncommon (11.06%)' -> ('Uncommon', 11.06)"""
    m = _RATE.match(cell.strip())
    if not m:
        return None, None
    rarity = (m.group(1) or "").strip().title() or None
    try:
        return rarity, float(m.group(2))
    except ValueError:
        return rarity, None


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

    Returns (relic_contents, relic_sources) in exactly the shape the mirror
    path produces, so the rest of the build is source-agnostic:

        relic_contents["Axi A1"] = {tier, code, rewards: {item: {rarity, chances}}}
        relic_sources["Axi A1"]  = [{kind, planet, node, mode, rotation, chance, rarity}]
    """
    sections = _slice_sections(page)
    relic_contents: dict[str, dict] = {}
    relic_sources: dict[str, list] = {}

    def add_source(item_cell, entry):
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
        group = rotation = None
        for is_head, cells in _rows(sections.get(sid, "")):
            if is_head:
                head = cells[0]
                rot = _ROT_HDR.match(head)
                if rot:
                    rotation = rot.group(1).upper()
                    continue
                # "Stage 1", "Stage 2, Stage 3 of 4..." — a sub-heading, not a new group
                if re.match(r"^Stage\b", head, re.I):
                    continue
                group = head
                rotation = None
                continue
            if not group or len(cells) < 2:
                continue
            rarity, chance = _split_rate(cells[-1])
            add_source(cells[-2], {
                "kind": kind, "planet": label, "node": group,
                "mode": "Bounty" if kind == "bounty" else ("Key" if kind == "key" else "Special"),
                "rotation": rotation, "chance": chance, "rarity": rarity,
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

    return relic_contents, relic_sources


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
