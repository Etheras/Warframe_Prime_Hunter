"""Railjack node ids to names, because Digital Extremes publish only the ids.

DE's worldstate carries `VoidStorms` — the Railjack fissures — as rows like
`{"Node": "CrewBattleNode522", "ActiveMissionTier": "VoidT1", ...}` and nothing
else: no region, no system, no name. `ExportRegions_en.json` has no
`CrewBattleNode` row at all, and neither does any other manifest DE publish;
every cached file was decompressed and searched on 2026-09-08 and the ids appear
in exactly one place, the worldstate itself. `wiki.warframe.com` names the nodes
but has **zero** occurrences of `CrewBattleNode` site-wide, so it cannot supply
the join either.

So this mapping is not derivable from any first-party source. It exists because
people wrote it down, and the copy below comes from one of them, with the
owner's approval and under its licence — see NOTICE.md and the notice at the
foot of this file. `PROJECT.md §7` has the reasoning and what it is worth.

**Two reconciliations, deliberate, and this file is where they are recorded.**
The names are rewritten into *our* node-key form and, where the two disagree,
DE's own drop tables win — because a fissure only reaches a reader if its name
matches the node the planner is ranking, and the planner's names come from DE.

    | id                | source name          | here                       |
    |-------------------|----------------------|----------------------------|
    | CrewBattleNode542 | `Lu-yan (Veil)`      | `Lu-Yan (Veil Proxima)`    |
    | CrewBattleNode543 | `Sambir Cloud (Veil)`| `Sabmir Cloud (Veil Proxima)` |

The first is case. The second is a genuine spelling split — `Sabmir` is how it
appears in the drop tables this project reads, and it is the spelling on every
row the planner renders. No judgement is offered about which is correct in the
abstract; matching ours is what makes the row work.

The `(<Region> Proxima)` suffix is the other half of that: `nodeKey` on both
pages builds `"<node> (<planet>)"` and the drop tables give the planet as
`Veil Proxima`, so a bare `(Veil)` would name a node nothing could match.

**What it is worth, measured 2026-09-08.** Storms run two per region across six
regions, and every relic-bearing Proxima node this project tracks is in Veil —
so **two of the twelve live storms land on a node the planner ranks**, and
before this they carried no badge at all because they were dropped for having no
name. The other ten are named for the fissure list and are not places this tool
sends anyone.

--------------------------------------------------------------------------
The mapping below is derived from `data/solNodes.json` in
`WFCD/warframe-worldstate-data` <https://github.com/WFCD/warframe-worldstate-data>,
used under the MIT licence, which is reproduced in full as that licence requires:

    The MIT License (MIT)

    Copyright (c) 2016 Matej Voboril

    Permission is hereby granted, free of charge, to any person obtaining a copy
    of this software and associated documentation files (the "Software"), to deal
    in the Software without restriction, including without limitation the rights
    to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
    copies of the Software, and to permit persons to whom the Software is
    furnished to do so, subject to the following conditions:

    The above copyright notice and this permission notice shall be included in all
    copies or substantial portions of the Software.

    THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
    IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
    FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
    AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
    LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
    OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
    SOFTWARE.

Only the Railjack subset is taken — 42 of their 452 nodes — and only the name of
each. Their `enemy` and `type` fields are not used and are not reproduced.
--------------------------------------------------------------------------
"""

from __future__ import annotations

# `CrewBattleNode<id>` -> the node key both pages build with `nodeKey`.
PROXIMA_NODES: dict[str, str] = {
    "CrewBattleNode501": "Mordo Cluster (Saturn Proxima)",
    "CrewBattleNode502": "Sover Strait (Earth Proxima)",
    "CrewBattleNode503": "Bifrost Echo (Venus Proxima)",
    "CrewBattleNode504": "Arva Vector (Neptune Proxima)",
    "CrewBattleNode505": "Ruse War Field (Veil Proxima)",
    "CrewBattleNode509": "Iota Temple (Earth Proxima)",
    "CrewBattleNode510": "Gian Point (Veil Proxima)",
    "CrewBattleNode511": "Beacon Shield Ring (Venus Proxima)",
    "CrewBattleNode512": "Orvin-Haarc (Venus Proxima)",
    "CrewBattleNode513": "Vesper Strait (Venus Proxima)",
    "CrewBattleNode514": "Falling Glory (Venus Proxima)",
    "CrewBattleNode515": "Luckless Expanse (Venus Proxima)",
    "CrewBattleNode516": "Nu-gua Mines (Neptune Proxima)",
    "CrewBattleNode518": "Ogal Cluster (Earth Proxima)",
    "CrewBattleNode519": "Korm's Belt (Earth Proxima)",
    "CrewBattleNode521": "Enkidu Ice Drifts (Neptune Proxima)",
    "CrewBattleNode522": "Bendar Cluster (Earth Proxima)",
    "CrewBattleNode523": "Mammon's Prospect (Neptune Proxima)",
    "CrewBattleNode524": "Sovereign Grasp (Neptune Proxima)",
    "CrewBattleNode525": "Brom Cluster (Neptune Proxima)",
    "CrewBattleNode526": "Khufu Envoy (Pluto Proxima)",
    "CrewBattleNode527": "Seven Sirens (Pluto Proxima)",
    "CrewBattleNode528": "Obol Crossing (Pluto Proxima)",
    "CrewBattleNode529": "Profit Margin (Pluto Proxima)",
    "CrewBattleNode530": "Kasio's Rest (Saturn Proxima)",
    "CrewBattleNode531": "Fenton's Field (Pluto Proxima)",
    "CrewBattleNode533": "Nodo Gap (Saturn Proxima)",
    "CrewBattleNode534": "Lupal Pass (Saturn Proxima)",
    "CrewBattleNode535": "Vand Cluster (Saturn Proxima)",
    "CrewBattleNode536": "Peregrine Axis (Pluto Proxima)",
    "CrewBattleNode538": "Calabash (Veil Proxima)",
    "CrewBattleNode539": "Numina (Veil Proxima)",
    "CrewBattleNode540": "Arc Silver (Veil Proxima)",
    "CrewBattleNode541": "Erato (Veil Proxima)",
    "CrewBattleNode542": "Lu-Yan (Veil Proxima)",
    "CrewBattleNode543": "Sabmir Cloud (Veil Proxima)",
    "CrewBattleNode550": "Nsu Grid (Veil Proxima)",
    "CrewBattleNode551": "Ganalen's Grave (Veil Proxima)",
    "CrewBattleNode552": "Rya (Veil Proxima)",
    "CrewBattleNode553": "Flexa (Veil Proxima)",
    "CrewBattleNode554": "H-2 Cloud (Veil Proxima)",
    "CrewBattleNode555": "R-9 Cloud (Veil Proxima)",
}
