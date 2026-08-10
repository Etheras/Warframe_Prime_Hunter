#!/usr/bin/env python3
"""
Parsing wiki.warframe.com/w/Prime, the catalogue of every Prime that exists.

This is the only editorial source in the pipeline; everything else is machine
generated. It is parsed rather than trusted: markers like (V)/(R) are read but
overridden by DE's own data where the two disagree - see TODO.md, "Should be
fixed on the wiki, not here".
"""

from __future__ import annotations

import re

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




# ── shared vocabulary ──────────────────────────────────────────────────────
# Kept here rather than in sources.py: these describe the game, not the network.

# Sections of the wiki Prime page we turn into categories, in display order.
CATEGORY_ORDER = [
    "Warframe", "Primary", "Secondary", "Melee", "Archgun", "Companion",
    "Archwing",
]

# VorFrame is about relics. These categories contain no item that any relic can
# ever drop - verified by exact match against every relic reward, 0 of 148 - so
# they are dropped from the catalogue entirely rather than shown as permanently
# "vaulted", which was true but useless.
#
#   Cosmetic, Extractor, Emote   Prime Access / Accessories only
#   Exalted                      intrinsic to the frame that wields it
#   Robotic Weapon               comes with its Prime sentinel
#
# Excalibur Prime also has no relic parts, but it is a Warframe and Founder-only
# rather than a different kind of thing, so it stays and reads as unobtainable.
NON_RELIC_CATEGORIES = {
    "Cosmetic", "Emote", "Extractor", "Robotic Weapon", "Exalted",
}

# Wiki name -> WarframeStat name, where the two databases disagree.
NAME_ALIASES = {
    "Kavasa Prime Collar": "Kavasa Prime Kubrow Collar",
    "Odonata Prime": "Odonata Prime",
}

TIER_ORDER = {"Lith": 0, "Meso": 1, "Neo": 2, "Axi": 3, "Requiem": 4, "Omnia": 5}
REFINEMENTS = ["Intact", "Exceptional", "Flawless", "Radiant"]
