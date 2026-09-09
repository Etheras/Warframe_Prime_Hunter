#!/usr/bin/env python3
"""
warframe.market — what a spare Prime part is worth in Platinum.

A third source tier, and the first that is neither Digital Extremes nor WFCD.
Two endpoints, joined on Digital Extremes' own internal paths:

  * `/v1/tools/ducats`  the prices. One row per tradeable item, carrying
    `wa_price` (warframe.market's own weighted average), `median`, `volume`,
    `ducats` and `plat_worth`. Identifies the item by an internal id and by
    nothing else, which is why the second endpoint is needed at all.
  * `/v2/items`         the key. Maps that internal id to `gameRef`, the path
    Digital Extremes themselves use for the item.

**Why `gameRef` rather than a name.** Names are the join this project has been
bitten by: the drop table says "Chassis Blueprint", the item API says "Chassis",
and warframe.market says `ash_prime_neuroptics_blueprint` where DE's ingredient
list says `AshPrimeHelmetComponent`. That is three spellings of one part, none
of them derivable from another. `gameRef` is DE's own path, which both sides
already hold, so the join is an identity rather than a guess — the same
discipline as the `/StoreItems` rule this project already trusts.

**Measured before it was wired in, and cross-checked rather than spot-checked.**
Against the live endpoints on 2026-09-08:

  * **583 of 585 part specs joined — 99.7%**, and every one of them carries a
    price. The naive-slug attempt this replaced managed 417 of 586.
  * The two misses are Galariak Prime and Sagek Prime, which warframe.market do
    not list **at all** — no slug, no id. So the join reaches 100% of what they
    publish, and the gap is release lag rather than a spelling we failed to
    handle. Nothing to fix here when they appear.
  * **Ducats agree on 579, with zero disagreements.** That is the part worth
    having: DE publish a ducat value per part and so does warframe.market, from
    different pipelines, so comparing them tests the join with a number the join
    itself does not use. A mis-join would have to be wrong about the part and
    right about its ducats to survive it.

**Two different counts, which is what made this look wrong.** The join total and
the ducat cross-check are different subsets and were both written as "579" until
2026-09-09: 583 specs join, and 579 of those carry a ducat value on *both*
sides, which is what can be compared. Re-measured on 2026-09-09 — 583/585 and
579 agreeing, zero disagreeing — so what moved was the catalogue, not the
method. Keep them spelled differently; one number doing two jobs is what sent an
audit looking for a defect that was not there.

**It is a tie-break and a badge, never the ranking.** The owner: *"Ducats are
only listed for the users'/client's convenience to see. Never intended for them
to affect something on our sorting."* Both figures may order rows that are
already equal and may never move one above another. `PROJECT.md §7`.

**Hard rule 10 is satisfied and it is worth saying why.** Platinum is tradeable:
these are player-to-player prices, earned by playing. Nothing here reads what DE
sell for money — no Prime Access, no Regal Aya, no bought Platinum. The test is
*"can this be earned, or must it be bought?"*, and a trade price is the market
rate for something a player farmed.
"""

from __future__ import annotations

import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import sources    # noqa: E402  (local module, sits beside this file)


def _rows(doc) -> list:
    """The list out of whichever envelope this endpoint uses.

    `/v2/items` answers `{apiVersion, data: [...], error}` and
    `/v1/tools/ducats` answers `{payload: {previous_hour: [...], previous_day:
    [...]}}`. Both are read defensively rather than indexed: an enrichment
    source that changes shape must degrade to "no prices", never abort a build
    that has every relic and every item in hand.
    """
    if isinstance(doc, list):
        return doc
    if not isinstance(doc, dict):
        return []
    if isinstance(doc.get("data"), list):
        return doc["data"]
    payload = doc.get("payload")
    if isinstance(payload, dict):
        # `previous_day`, deliberately. It is a daily aggregate, which is what
        # makes a once-a-day poll honest rather than merely cheap - see
        # `WM_MAX_AGE` in sources.py. `previous_hour` is the same shape and
        # noisier, and nothing here wants an hourly number.
        for key in ("previous_day", "previous_hour"):
            if isinstance(payload.get(key), list):
                return payload[key]
    return []


def prices_by_path(items_doc, ducats_doc) -> dict[str, dict]:
    """`{DE path: {plat, median, volume}}`, keyed on `gameRef`.

    **No `ducats`, deliberately**, and this line claimed one until 2026-09-09.
    warframe.market publish a ducat value per row and it is read here — but only
    to be *compared* with DE's, in the cross-check above, never to be carried.
    A part's ducat value in the payload is Digital Extremes' own, from
    `ExportRecipes_en.json`. Emitting a second one beside it would put two
    sources for one number into the same record, which is a drift generator
    rather than a redundancy: the day they disagree, nothing decides.

    Both documents are optional and either being absent yields `{}` — the badge
    disappears and the tie-break stops firing, which is the whole of the damage.

    Rounded to two decimals because that is what warframe.market publish and
    what the drawer shows; carrying float noise into the payload would make the
    tie-break compare digits no reader can see.
    """
    by_id: dict[str, str] = {}
    for row in _rows(items_doc):
        if not isinstance(row, dict):
            continue
        ref, ident = row.get("gameRef"), row.get("id")
        if ref and ident:
            by_id[str(ident)] = str(ref)

    out: dict[str, dict] = {}
    for row in _rows(ducats_doc):
        if not isinstance(row, dict):
            continue
        ref = by_id.get(str(row.get("item")))
        if not ref:
            continue
        plat = row.get("wa_price")
        if not isinstance(plat, (int, float)):
            continue
        rec = {"plat": round(float(plat), 2)}
        # Kept because they are the reader's answer to "is that price real?" —
        # a weighted average over three trades is not the same claim as one
        # over three hundred, and the drawer says so.
        for src, dst in (("median", "median"), ("volume", "volume")):
            val = row.get(src)
            if isinstance(val, (int, float)):
                rec[dst] = round(float(val), 2) if dst == "median" else int(val)
        out[ref] = rec
    return out


def price_for(prices: dict[str, dict], spec: dict | None) -> dict | None:
    """The price row for one part spec, trying both of DE's paths for it.

    `path` first, then `altPath` — the recipe that builds a component. Both are
    needed and neither is redundant: 426 parts are found under the first and 153
    only under the second, because a Warframe component is traded as its
    blueprint. See `official.prime_part_specs`.
    """
    if not prices or not spec:
        return None
    for key in ("path", "altPath"):
        ref = spec.get(key)
        if ref and ref in prices:
            return prices[ref]
    return None


def fetch_prices(offline: bool = False) -> dict[str, dict]:
    """Both documents, then the join. `{}` whenever anything is missing.

    `optional=True` on both, and that is the load-bearing flag rather than a
    default: `MISSING` aborts a build, and refusing to publish a whole catalogue
    because a Platinum badge could not be filled in is exactly the wrong trade —
    the same mistake that took CI down when the bounty rotation was added.

    `chosen_maxage` is the rule 11 mechanism. warframe.market declare no
    `Cache-Control` on either endpoint, so the window is ours to pick and is
    picked once, in `sources.py`, with the argument written beside it.
    """
    items = sources.fetch_json(sources.WM_ITEMS, "wm_items", offline,
                               critical=False, optional=True,
                               chosen_maxage=sources.WM_MAX_AGE)
    ducats = sources.fetch_json(sources.WM_DUCATS, "wm_ducats", offline,
                                critical=False, optional=True,
                                chosen_maxage=sources.WM_MAX_AGE)
    if not items or not ducats:
        return {}
    return prices_by_path(items, ducats)
