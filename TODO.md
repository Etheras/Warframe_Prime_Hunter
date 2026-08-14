# TODO

Everything still outstanding in VorFrame. **Only unfinished work belongs here** —
when something ships, delete its entry rather than ticking it, and record *why* it
was done that way in `PROJECT.md` if the reasoning matters. Settled design
decisions are not TODOs and live in `PROJECT.md §7`.

Roughly ordered by what is worth doing first. Each entry should make sense to
someone who has never seen this project before; if it needs conversation context to
understand, it needs rewriting.

Entries marked **[settled]** are not open work. They are questions that have been
asked and answered, kept only so the answer is not lost and the question is not
raised again from scratch. Everything else is genuinely outstanding.

---

## Decided — the batch being built now

**All ten answered by the owner on 2026-08-14.** This table is the plan of record.
Work through it in the order below, committing each step on its own, so an
interruption costs one step rather than the batch. Delete a row when it ships and
move its reasoning into `PROJECT.md`.

| # | Decision | Status |
|---|---|---|
| 7 | **Already done** — `serve.py` has served from a strict allowlist for some time; `.cache/`, `tools/`, `.git/` and directory listings all 404 already. The entry was stale, not open. Verified by calling `allowed()` directly. | ✅ nothing to do |
| 6 | **(a)** `serve.py` says who is reading. It already decorates the data file with `VORFRAME_UPSTREAM` and knows the peer address; add `owner` to that payload and let `staleBanner` read it instead of sniffing `location.hostname`. | ✅ done |
| 8 | **Rename to `Warframe Prime Hunter`.** Owner expects to change it again, so leave a map of every place the name lives — see *Renaming, and where the name lives* below. Needs a `localStorage` migration for the six keys. | ⬜ |
| 4 | **(c) a fixed 50% penalty on Railjack caches.** Deliberately rough. The owner's reason is the one that matters: *"caches on a Railjack is insanely out-of-order and out-of-place"*. | ✅ done |
| 3 | **(b) default to per objective.** Still overridden by any effort minutes set. | ✅ done |
| 10 | **(b) model it, and more besides.** Keep DE's refinement on pre-refined rewards; price the **Void Traces** they save; model the **endless-fissure bonus relic**; and reduce the value of a relic handed over at a *higher* refinement than the plan wants. | 🟡 **refinement done.** Traces are counted and shown, not scored — they need a player fact, like Mastery Rank. The fissure bonus is verified and deferred to decision 1, where it belongs: it is a reward for *cracking*, and no run mode here is long enough to reach it |
| 2 | **(a), modelled properly**, and **the same treatment for every other "final boss"-shaped bounty**, not just Profit-Taker. | ✅ **done.** Profit-Taker's four phases are in, badged *Old Mate*, off the bounty clock. Swept every bounty, key, enemy and transient source for others: the only one is **Hemocyte**, which is already event-gated and now badged as an enemy rather than a place — see *Plague Star and Profit-Taker are the same shape* |
| 1 | **(a) split the two loops.** *Where to go* ranks on wanted relics per run; *How to crack them* on openings needed. The left column's headline becomes a **count**, not a percentage — accepted knowingly. | ✅ done |
| 9 | **(a)(ii) a seventh availability bucket**, and **(b)(ii) auto-include Railjack when it is the only route.** Owner wants to review all of #9 — **mock it up first.** | ⬜ mockup |
| 5 | **Cannot be answered on paper** — it is a visual change and needs seeing. **Mock it up.** | ⬜ mockup |

**Yours to do elsewhere, not here:** four corrections belong on
[`wiki.warframe.com/w/Prime`](https://wiki.warframe.com/w/Prime) rather than in this
code — Gotva Prime's redundant `(S)`, the years-stale `(R)` markers, the `(V)` markers
the item API disagrees with, and the Isolation Vault rotation contradiction. All four
are written up under *Should be fixed on the wiki, not here*, and the app already
works around each one.

**Blocked on the game, not on you:** the Ghoul Purge and Plague Star detection cannot
be verified until one of them next runs. Nothing to decide; just a thing to catch.

---

## A round is not a universal unit of effort

The planner costs every mission in "rounds" and assumes one round means the same
everywhere. It does not, and these three are the same flaw seen from different
angles — worth tackling together, because fixing the last one properly subsumes the
other two.

### 1. Nine rotation-bearing mission types are still unverified

Swept 2026-08-10. Of the 31 mission types in the data, 9 carry no rotation at all so
the cycle never applies, 11 are confirmed A→A→B→C against the wiki (Defense,
Survival, Interception, Excavation, Defection, Infested Salvage, Alchemy, Sanctuary
Onslaught, Void Cascade, Void Flood, Void Armageddon), and Disruption is modelled
explicitly. That leaves nine assumed AABC without confirmation:

`Caches`, `Key`, `Legacyte Harvest`, `Rush`, `Skirmish`, `Special`, `Spy`,
`The Circuit`, `The Perita Rebellion`.

`Bounty` was the tenth and is now settled — it is not a round-based cycle at all, see
*Bounty rotation is a wall clock* below.

The wiki also names two more exceptions we do not currently see in relic sources —
**The Index** (A-B-B, with C once after an hour) and **Arbitrations** (A-A-B-B-C-C-C-C)
— so deviation is clearly not rare.

### 2. Several of those modes are not round-based at all

`Spy`, `Caches` and `Key` carry rotations, but the rotation does not advance per
*round* — a Spy mission has three vaults, Caches counts what you found. You collect
several tiers inside a **single mission**. We cost a three-vault Spy run as three
rounds of Defense.

### 3. Mission length **[answered 2026-08-14 — both halves]**

Four rounds of Disruption used to score four times a bounty that may take just as
long in real minutes, and single-reward missions sank however fast they were. Both
halves of the fix are now in:

- **Real minutes**, per objective per mission type, under *Effort — optional*.
- **Objective count as the default**, so the flaw above is gone before anyone
  types anything. Measured against one player's own timings, costing per *run* is
  out by up to 9.6× across mission types while costing per *objective* is out by
  2.4× — an objective takes 2.5–6 minutes almost everywhere. Four times closer for
  free, and an objective count is a fact about the mission rather than an estimate
  of anybody's play, so there is no shipped number to argue with.

Both are documented in `PROJECT.md §7`. What remains is not a modelling gap but an
ordinary unknown: **nine mission types are still assumed A→A→B→C** (entry 1 above)
and **three of them are not round-based at all** (entry 2), so their objective
counts are inherited rather than checked. Those two entries are the real remainder
of this heading.

## Everything else

### Only recommend what can actually be run today

**The rule, set 2026-08-13.** A source belongs in the ranking only if it can be
run *now*:

- **Permanent content** — always shown.
- **Recurring often enough to plan around** (roughly monthly or better, e.g.
  Nightmare missions) — modelled, but **shown only while it is actually live**.
- **Anything we cannot deterministically tell is live** — omitted. Not shown
  greyed out, not shown with a caveat. Omitted.

The planner exists to answer "where do I go next". A node you cannot enter is
not a worse answer than the right one, it is not an answer.

**The case that exposed it: `Hemocyte`.** It ranked *first* in a mockup at 0.74
wanted relics per run, carrying 11 live relics. It is not a mission at all — it
is an enemy, and the wiki is explicit: *"They only appear on the Advanced and The
Steel Path variants of the Plague Star Bounty, with a total of four spawning
during the final stage."* Plague Star is a **re-run event**, last seen years ago.
So the top recommendation in the list was content nobody can reach.

The fix is already half-built: `meta.bounties.events` detects a live Plague Star
from the worldstate, and the Plague Star *bounty* is already gated on it.
`Hemocyte` must be gated on the same window.

**Everything else in the same position, needing a verdict each:**

| Source | Relics | What it is | Verdict |
|---|---|---|---|
| `Hemocyte` (enemy) | 11 | Plague Star final stage only | **exclude** unless Plague Star is live — gate on the window we already compute |
| `Faceoff: …` ×4 | 22 each | **permanent.** Höllvania, Update 38.0 (2024-12-13). Nodes *Lower Vehrvod* (vs AI) and *Vehrvod District* (PvPvE) with Steel Path variants | **keep** — but it is PvPvE, worth flagging like Railjack |
| `Another Betrayer`, `Family Reunion`, `Hot Mess`, `Recover The Orokin Archive`, `Sunkiller`, `Table For Two`, `The Aftermath`, `Time's Up` | 22 each | **quest missions.** All eight share one identical reward table, and "Sunkiller" is a New War track rather than a node — these are quest stages, not farmable nodes | **exclude** — one-time story content, cannot be ground |
| `Void Storm (…)` ×6 | 7–8 each | **permanent.** Roll through the Proxima like Void Fissures; *"upon mission completion, you'll be rewarded with your earned Relic reward"* | **keep** |

Checked against both wikis, because the two disagree in places and the older one
is not always stale. Two corrections came out of it: a search confidently
identified the eight quest missions as **Steel Path Incursions**, and the wiki
disproves it — Incursions award *"5 Steel Essence (unaffected by any boosters)"*
and no relics at all. Faceoff was assumed to be event content and is not.

All four identified, and **this entry is now closed**. The exclusions are
implemented — the build tags every unreachable row with `access` (`quest`,
`unmodelled`, `event:X`) and both pages filter on it — and the labelling landed on
2026-08-14: a `.demand` badge says **PvPvE** on Faceoff and **Railjack** on the
Proxima nodes, on both pages, from one definition in `rotation.js`. Kept here only
because the reasoning above is the record of how each of the four was decided.

### Our four invented "mission types" leak into the ranking

`Bounty`, `Key`, `Special` and `Enemy` are ours, not DE's — one bucket per
droptable section (`official.py`). DE's own mission type is the parenthesised
word in `Planet/Node (Type)`, and the wiki lists 35 of them; ours match 24.

That matters because the planner presents all of them as places to go:

- **`Enemy`** is not a destination. It is an enemy that drops relics wherever it
  spawns — see the Hemocyte case above.
- **`Key`** is not a mission type. It is an extra key-gated objective attached to
  an existing mission, and nobody runs one exclusively for it.
- **`Special`** is a bag holding Void Storms, Faceoff and Duviri tables together.
- Three of DE's own labels are not wiki mission types either: `Caches` (a reward
  stream *inside* a Railjack mission), `The Circuit` and `The Perita Rebellion`
  (single activities whose "type" is their own name).

Useful find while checking: the wiki splits missions into **Endless** (Defense,
Survival, Interception, Excavation, Defection, Disruption, Alchemy, Infested
Salvage, Legacyte Harvest, Void Cascade/Flood/Armageddon) and **Standard**
(Assassination, Capture, Exterminate, Hijack, Mobile Defense, Rescue, Sabotage,
**Spy**). That is exactly the round-based-or-not split the model has been
reverse-engineering, from a source, and it independently confirms Spy is not
endless.

### Plague Star and Profit-Taker are the same shape, modelled two ways

**Raised by the owner 2026-08-14, and they are right that something is off.**
Both are gated multi-stage activities that end in a boss dropping relics. Here
is what is actually different, and only one of the three differences is ours.

| | Profit-Taker | Plague Star |
|---|---|---|
| Available | **permanent**, no timer, since 2019 | **a recurring Operation** — only on the board when DE runs it |
| Reached from | Eudico's back room, Fortuna | the Cetus bounty board |
| Gate | Solaris United Rank 5, plus one sequential clear | none beyond the event running |
| Shape | four independent flat tables, no rotation, off the clock | one bounty, rotation A, on the board |
| Boss relics live in | **the phase table itself** | **a separate enemy table** (`Hemocyte`) |

The first four differences are real and the two are modelled correctly *because*
of them: Profit-Taker is permanent so it gets a badge, Plague Star is not so it
gets an event gate. **To answer the question directly: Profit-Taker is always
active once unlocked. There is no timer on it.**

**The last row is the problem, and it is ours.** DE files Profit-Taker's boss
rewards inside the bounty table and Plague Star's boss rewards in the enemy
table — the same game structure, published two ways. We follow the publication
rather than the structure, so when Plague Star next runs the planner will list
**two rows for one trip**: `Level 15 - 25 Plague Star` at 1.14%, and `Hemocyte`
at 12.91% with eleven relics, from `planet: "Enemy drops"`, a place that does
not exist.

`Hemocyte` is the only enemy in DE's entire relic table, so this is a list of
one — but a list of one that reads as a phantom destination scoring ten times
the real node beside it.

**Half-fixed now:** the row carries an `Enemy` badge saying it is not a place,
that four spawn in the Plague Star final stage, and that the two rows are one
trip. That stops it lying without pretending to be finished.

**The rest, when Plague Star next runs.** Folding the enemy rows into the bounty
they ride needs a probability structure the model does not have. DE publishes
`Hemocyte Relic Drop Chance: 20.00%` and then 12.91% per relic within that, and
four spawn per run — so a run is worth `4 × 0.20 = 0.8` relic rolls, not the one
roll currently assumed. Getting that right is arithmetic; getting it *checked*
needs the event live, which is the same blocker as the detection below. Do both
in the same sitting.

### Profit-Taker turns out to fit the model exactly **[done 2026-08-14]** — decision 2

**Revisited 2026-08-14 against [the wiki's Heist page](https://wiki.warframe.com/w/Heist#Profit-Taker_Orb_Heist)
and DE's own table, and the original objection does not survive either.**

What was written here before: that the four phases are not independent, and that
Phase 3's first/subsequent split makes it unmodellable. Both are wrong.

- **The phases are independent.** The wiki: *"The Heist must initially be
  accomplished in sequence for the first time before being able to freely replay
  each stage."* After one clear you pick any phase you like — which is exactly
  four things to choose between.
- **The split costs us nothing.** DE's table gives Phase 3 two sections. *First
  Completion* is a Gravimag at 100% and **carries no relics at all**, so for a
  relic planner it is not a source. *Subsequent Completions* is the steady state.
  There is no "once ever" to express, because the thing that happens once is not
  something we track.

What is actually there, from the drop table:

| Node | Level | Rotation | Relics |
|---|---|---|---|
| `PROFIT-TAKER - PHASE 1` | 40–60 | none | Lith Q3 15%, Lith A12 12.5% |
| `PROFIT-TAKER - PHASE 2` | 40–60 | none | Lith K12 15%, Meso Y2 12.5% |
| `PROFIT-TAKER - PHASE 3` | 40–60 | none | Meso D8 15%, Neo C7 12.5% |
| `PROFIT-TAKER - PHASE 4` | 50–60 | none | Neo A16 17.14%, Axi S20 14.29% |

Eight relic rows, not six. Every one is awarded **already Radiant**, which the
model throws away — see *Some nodes hand you the relic already refined* below.

**No rotation on any of them** — one fixed table each. That is the flat
`rot.none` case `runValue` already handles: one reward per run, `rounds: null`,
scored exactly like a Capture. The reason it looked hard is that it was filed
under `Bounty`, and bounties are the one thing on a clock.

**What it needs, and none of it is new machinery:**

1. Drop the `access: unmodelled` tag from the four nodes.
2. A **gate badge**, the same shape as `Railjack` and `PvPvE`: Solaris United
   **Rank 5 (Old Mate)**, plus one sequential clear of all four. A standing
   requirement, not a reason to hide it — the same call already made for Railjack.
3. Do **not** put it on the bounty clock. It is reached from Eudico's backroom,
   not the bounty board, and has no rotation to be on.
4. Effort: one objective per run. Phase 2 has a stated 4–5 minute timer, which is
   the only published duration of the four.

### Void Traces are counted but not scored — the rest of decision 10

The refinement itself is modelled (entry below). Two pieces of decision 10 are
deliberately **not** scored, and this records why and what would settle each.

**1. The 100 Void Traces.** Confirmed against
[the wiki](https://wiki.warframe.com/w/Void_Relic): refining costs **25 / 50 /
100** traces for Exceptional / Flawless / Radiant, less whatever the relic has
already had spent on it. A node handing over a Radiant relic is therefore worth
up to 100 traces on top of the relic, and the owner is right that this is not
nothing — traces come in at 6–30 a fissure run.

It is shown on the row and left out of the score, because **what 100 traces are
worth depends on how many you have**, and that is a fact about the player this
app cannot see. Same call as Mastery Rank: a player fact we do not know
annotates rather than moves the ranking.

**The exchange rate that would settle it, if a trace count is ever collected.**
Traces buy refinement, so their value is the refinement uplift they buy on the
relic you would have spent them on next:

```
value of 100 traces  ≈  best over relics r in the plan of
                        ( value(r, Radiant) − value(r, r.chosenRefinement) )
```

That is derived from the player's own plan rather than invented, and it goes to
zero exactly when it should — when nothing in the plan wants refining. It needs
one number from the player: **are you trace-limited?** Which is the same header
slot the Mastery Rank field wants (see *A Mastery Rank field in the header*).

**2. The endless-fissure bonus relic.** The owner's recollection checks out, and
more precisely than stated. From
[Void Fissure](https://wiki.warframe.com/w/Void_Fissure):

| Stay | You are given |
|---|---|
| 5 rotations | one random **Exceptional** relic of the mission's tier |
| 10 rotations | one random **Flawless** relic |
| every 5th after 15 | one random **Radiant** relic |

A rotation is 5 waves of Defense, 5 minutes of Survival, 1 Interception round or
200 Cryotic of Excavation.

**Three things stop it being modelled here, and none of them is difficulty:**

- **It is a reward for cracking, not for collecting.** You are in a fissure
  because you are opening relics. The bonus lands in the *other* loop, which is
  exactly what decision 1 is about to separate — so it belongs to that work, not
  to this entry, and building it before the split would put it in the wrong
  column.
- **No run this planner models is long enough.** The run modes stop at 4
  rotations (`reset`, `full`) or 6 (`aabcaa`). Only `aabcaa` reaches the first
  bonus at all, and only just. That is a real finding about the run modes rather
  than a reason to skip: a fourth mode, "stay for the bonus", would be the
  honest way to offer it.
- **The relic is random of the tier**, so its value is the *average* over the
  live relics of that tier the plan wants — computable, but a different quantity
  from everything else on the row, which is about a specific relic at a specific
  node.

**Built 2026-08-14 as a fourth run mode**, *Stay for the fissure bonus*, after
the owner confirmed the reading. Five rotations, then restart — the second bonus
is twice as far for one refinement step better, which is a worse trade every
time.

It is priced as what it is: a **random** relic of the tier, so its worth is the
mean over every live relic in the best tier, most of which are worth nothing to
the plan. On a two-Prime list that came to *Meso, 3 of 9 live relics wanted,
8.07% at Exceptional*. It is the same bonus at every endless node, so it does
not reorder endless nodes against each other — what it changes is **endless
versus short**, which is the question the mode exists to answer. On that list
Mithra went from third at 15.96% over four rotations to first at 16.57% over
five, overtaking the single-objective missions.

Railjack is excluded: its fissures are Void Storms, which are their own nodes
with their own tables and no rotations to stay for.

**The app does not know which nodes are fissures, and deliberately does not
try.** The owner asked how this is calculated; the honest answer is that it is
not. A fissure is an overlay that moves every hour or two, and this dataset is
refreshed daily — so a fetched list (`/pc/fissures` exists) would be stale
within hours and wrong more often than right. **A confidently wrong fissure map
is worse than an honest assumption**, because the whole point of the ranking is
to be trusted without checking.

So the bonus is added to every endless node **equally**, the row says *"+relic
if fissure"* in amber, and the tooltip leads with the assumption rather than
burying it. That is safe precisely because it is node-independent: a constant
added to every endless node cannot reorder them against each other, so the only
comparison it affects is *endless versus short* — and that one holds whatever
the fissure map happens to look like.

**What would change this:** if the app ever refreshed often enough to hold a
live fissure list — a running `serve.py` could poll it the way it already polls
upstream freshness — then the bonus could be conditioned per node and the mode
could name which nodes are fissures right now. That is a real feature, and it is
the same shape as the freshness check that already exists. Not worth it on a
daily build.

**What is still deferred to decision 1:** the bonus is a reward for *cracking*
relics, and it currently sits on the collecting side because that is where the
run modes live. When the two loops split, it should be stated on the cracking
side too — *given you are opening these relics anyway, is it worth staying to
rotation 5?* — rather than only as a modifier on where to go.

### Some nodes hand you the relic already refined **[done 2026-08-14]** — decision 10

Found 2026-08-14 while checking the Profit-Taker tables, and it is worth more
than the thing that led to it.

DE's drop table names a refinement on a relic reward when the relic arrives
**pre-refined**. Ordinary mission rows say `Lith Q3 Relic`; these say
`Lith Q3 Relic (Radiant)`. There are **80 such reward rows**, every one of them
Radiant, in exactly three places:

| Where | Rows |
|---|---|
| **Elite Sanctuary Onslaught** | 28 |
| **Void Storms** — the Railjack fissures, six planets | 44 |
| **Profit-Taker**, all four phases | 8 |

`sources.py` parses the relic name and drops the parenthesis. A source record
carries `{kind, planet, node, mode, rotation, chance, rarity, stage, access}` and
no refinement, so every node in the app looks like it hands out an Intact relic.

**Why that matters more than it sounds.** Refining a relic to Radiant costs 100
Void Traces, and by this project's own numbers it moves a blocked rare from ~50
expected openings to ~10 (`PROJECT.md §7`). A node that hands it over Radiant has
done that for free. Today the planner will rank such a node as though it gave you
the Intact relic, and then advise you to go and refine it.

It also lands on the entry above: `bestRefinement` picks one refinement per relic
because *"you can't hold the same relic two ways"* — which stops being true when
one node gives you a Radiant copy and another an Intact one.

**Built 2026-08-14.** `official.py` keeps the refinement where DE names one — 80
rows, all Radiant, across 11 nodes and nowhere else — and the planner values
those sources at the refinement they actually hand over rather than at the one
`bestRefinement` would have chosen.

It cuts both ways, which is the part worth remembering: a Radiant copy is a gain
when the plan wanted Radiant and a **loss** when the plan wanted the common,
because Radiant trades commons for rares (25.33% → 16.67%). Elite Sanctuary
Onslaught reads `pre-refined` in amber for exactly that reason on a list blocked
on a common. The trace saving is shown and not scored — see the entry above.

### Rank the two loops apart **[done 2026-08-14]** — decision 1

Built, and documented in `PROJECT.md §7`. *Where to go* ranks on wanted relics
per objective and leads with a count; *How to crack them* ranks on openings to
finish and leads with that; each heading names its own quantity. The percentage
stayed on the node row one line down, because the two genuinely disagree.

Two things the live data showed once it was in, both worth keeping:

- **Meso V15 pays 37% per opening and needs 5.9 openings**, while three relics at
  20% per opening finish in 5.0 — the old hit-rate sort put V15 first and was
  answering the wrong question.
- **The node order changed more than expected.** Ranking on count promotes nodes
  with many wanted relics at modest chances over nodes with a few good ones, so
  Disruption and long Survivals rose. That is the intended behaviour and it is
  also the thing to watch: if it ever feels wrong, the cause will be that you
  wanted the *value* question, and that number is still on the row.

**One piece is still owed to this entry**, carried over from decision 10: the
endless-fissure depth bonus is a reward for *cracking*, and it currently only
appears as a modifier on the collecting side. It should also be stated on the
cracking side — *given you are opening these relics anyway, is it worth staying
to rotation 5?* See *Void Traces are counted but not scored*.

### The original entry, for the reasoning

**Settled 2026-08-13.** Collecting relics and cracking relics are two different
activities with two different bottlenecks, and a single score covering both
answers neither. The owner's actual pattern makes the split concrete: relics get
stacked on weekdays when there is no time, and cracked in bulk at the weekend.

- **Where to go** ranks on **relics per run** — how fast a node fills the stack.
  It knows nothing about what a relic is worth once opened.
- **What to crack** ranks on **openings needed** for the scarcest thing still
  wanted. It knows nothing about where the relic came from.

The current score multiplies the two together, which is why "≈N runs to finish"
could never be given an honest label.

**Half the ingredient landed on 2026-08-14** and the rest did not, deliberately.
Every node row now derives *relics per run* and *what share of runs drop one*
alongside the combined score, taken from the same run the score is built from
(`PROJECT.md §7`) — so the number "Where to go" would need to rank on already
exists and is on screen. What has **not** changed is which of them orders the list:
the ranked number is still the combined score, because the owner's instruction for
that corner was "% on top, like they used to". Splitting the ranking means the big
number on the left column becomes a relic *count*, not a percentage, and that is
the decision still to make.

### Railjack caches are halved **[done 2026-08-14]**

**Option (c), a flat 50%.** One named constant, `CACHE_PENALTY` in
`rotation.js`, applied by the planner and nowhere else. The row says **halved**
in amber with the reasoning on hover, because a score moved by a judgement and
not saying so is the thing this project keeps refusing to do.

**The relic count on the same row is untouched**, deliberately: what a run hands
you is a fact, the penalty is only what we think it is worth going for, and a
fact bent to suit an opinion would be a lie. A Veil Proxima cache now reads
`3.65% per run` beside `0.32 relics · 28.93% of runs` — the second pair is what
DE's numbers say and does not move.

It is the **only** judgement of its kind in the model; everything else is
arithmetic on published numbers. That is why it is one constant in one place
rather than a fudge spread through the scoring.

Kept below for the argument it settles, and because the second half of the
original entry — whether they should be ranked *at all* — was answered with
"yes, but lower" rather than "no".

### The original entry, for the reasoning

Of the two things once listed here against the same 38 Proxima nodes, the labelling
half shipped on 2026-08-14: `Skirmish` and `Caches` now both carry a **Railjack**
badge, and Faceoff a **PvPvE** one, from a single definition in `rotation.js`.

What is left is the ranking. **Railjack caches are a poor recommendation on their
own:** three hidden caches inside a boarded base, for the worst relics-per-run in
the whole list — nobody runs Railjack for them. Keeping them ranked at all is
questionable; at minimum they should not appear above ordinary star-chart nodes.
Left in for now, deliberately, until there is a rule rather than a hunch.

Note that the effort weights now give a *mechanism* for this without a special
case — a Railjack cache run costed honestly in minutes sinks on its own — but
only for a player who fills the box in, so it is not an answer to the default.

**And it is not as simple as demoting them.** Six Primes — Cernos, Hikou, Nyx,
Scindo, Valkyr and Venka — can *only* be farmed on Railjack, and four of those
six come from `Caches` specifically (`PROJECT.md §7`). For their owners the worst
rows in the list are the only rows in the list. Any rule that sinks caches has to
leave them reachable for the people who have no alternative.

### A part you cannot reach still reads as one you can

Narrower than the entry above, and left open deliberately.

The *Still needed* panel says **"1 relic dropping"** against a part whose only
relic drops somewhere the current options exclude — a Railjack node with Railjack
off, or an event node. It is true and it is misleading in the same breath: the
relic does drop, and you are not being sent anywhere for it.

The whole-list case is handled — an empty ranking now names the switch and counts
what is behind it (`PROJECT.md §7`). The **partial** case is not: three parts
reachable and one only on Railjack still shows four identical-looking rows. The
count of blocked places is already computed per plan; making it per *part* is the
work, and the honest wording for the row is the part that needs thought — "1
relic dropping, nowhere you have switched on" is accurate and clumsy.

**A correction to how this was first written up.** It was described as "three
parts reachable and one on Railjack", as though those six Primes were a mixed
case. They are not, and the reason matters:

> Nyx and Valkyr predate Railjack. Their original relics are **vaulted** — that
> is the legacy route, and it is not a route. Railjack is not one source among
> several; it has been the **only** current source for years.

So there is no mix to display. Whichever of the six you look at, every reachable
route is Railjack, and the badge says so. The mixed case the entry above describes
is real but hypothetical — nothing in today's data is in it. Written down anyway,
because the display question is the same either way and the data can change.

**And it is tolerable by design.** A handful of very legacy relics sitting vaulted
behind a current Railjack source is exactly the shape this project is happy with:
the app is about what is farmable now, and it says what "now" costs you.

### A Mastery Rank field in the header

**Specified by the owner 2026-08-14, alongside the decision *not* to gate anything
by rank.** Those two go together and the order matters: the field is for saying
what a node asks of you, never for hiding it.

The shape asked for:

- **A Mastery Rank number the player fills in**, stored locally like everything
  else, empty until they do.
- **Sitting next to the site name and logo**, in the header — not in the planner
  sidebar. It is an account fact, true on both pages, so it does not belong to
  either one's options.
- **A plain `−` / `+` pair** either side of the number. Ranks move one at a time
  and rarely; a spinner or a free text box is more machinery than the job needs.
  The materials rows in the collection view are the nearest existing pattern.

Range: 0 to 30, then **Legendary ranks** above that, which the wiki writes `LR1`,
`LR2` and so on with no published cap. Simplest honest handling is to keep one
integer and render anything over 30 as `LR<n−30>`.

**What it is for, given it gates nothing.** The worldstate publishes `minMR` per
bounty tier and it matches the wiki exactly — MR1 at level 10–30 up to MR10 at
100–100 (see *The worldstate publishes far more than the two fields we read*). So
a node can say **"asks MR5"** the same way one says **"Railjack"** or
**"PvPvE"** — a demand badge, shown when the player's rank is below it and silent
when it is not.

That restraint is deliberate and the wiki is the reason: *"These can still be
played, when an eligible squad member selects one."* The rank stops you
**selecting** a bounty, not running one. Hiding a tier from someone whose friend
can start it would be exactly the wrong answer, so the field informs and never
filters.

**Still open:** whether an unfilled field should be treated as "rank unknown, say
nothing" (safe, and the default everything else in this project takes) or should
prompt once. And whether the same header slot should hold the other things the
app would like to know about the player — Solaris United standing, if
Profit-Taker comes in under decision 2, and the Steel Path.

The Steel Path is the interesting precedent there. It had a sidebar checkbox for
one afternoon and it was removed on measurement: every Steel Path table carrying
a relic is a Faceoff variant identical to its ordinary twin, so the option moved
the ranking by two duplicate rows and asked a question for nothing
(`PROJECT.md §7`). If a header of player facts is ever built, the Steel Path
belongs in it as a *fact* — feeding badges, not filters — rather than back in the
sidebar as an option. Same shape as this field, same reasoning.

### How Railjack should be presented — decision 9

The badges landed on 2026-08-14 and they are the floor, not the answer: a node row
says `RAILJACK`, and a card whose every route is Railjack says `RAILJACK ONLY`.
Two things are still presented awkwardly, and both are judgement calls.

**a. Those six Primes sit in the *Farmable now* bucket, which is true and unhelpful.**
The sidebar sorts by availability, one bucket per item, precedence
`founder → resurgence → farmable → baro → special → vaulted`. Cernos, Hikou, Nyx,
Scindo, Valkyr and Venka land in *Farmable now* alongside 100-odd star-chart
Primes, and only the badge distinguishes them. There is no way to ask "what needs
a ship?" or to exclude them from a list you are shopping from.

- (i) leave it — one badge, no new bucket, and the availability filter keeps
  meaning exactly one thing
- (ii) a **seventh bucket**, `Railjack only`, ranked just above `farmable` — the
  six leave *Farmable now*, which is arguably more honest than it sounds: they are
  not farmable on the star chart at all
- (iii) not a bucket but a **cross-cutting filter**, the way *Hide vaulted* works —
  buckets stay as they are and a `Needs a Railjack` toggle hides or isolates them

(iii) is the most flexible and the least disruptive to a rule the project has kept
carefully. (ii) is the most honest and the most likely to surprise someone.

**b. The planner makes you opt in to your only option.** Put one of the six on
the farm list with *Include Railjack* off and the ranking is empty. It now names
the switch and counts what is behind it, which is a large improvement on silence —
but an opt-in gate in front of a thing with no alternative is still a strange
shape. Options:

- (i) leave it — the message is clear, and the checkbox means one thing
- (ii) **auto-include a Railjack node when it is the only route to something on
  your list**, badged as now, with the summary saying why it appeared despite the
  setting. Keeps the checkbox honest for everything else
- (iii) turn the checkbox into three states — off / only when it is the only
  route / always

(ii) reads best and is the smallest change: the information to do it already
exists, since `railjackOnly` answers exactly that question per item.

**c. Steel Path variants are exact duplicates, and both are ranked.** Demonstrated
2026-08-14 by weighting effort so Faceoff rose to the top: the list showed
*Faceoff: Single Squad*, *Faceoff: Single Squad (Steel Path)*, *Faceoff: Squad VS
Squad* and *Faceoff: Squad VS Squad (Steel Path)* — four rows, all at 4.7% per
minute, filling half the visible eight. They are not merely similar; each Steel
Path table is the same 22 relics at the same 8.33% as its ordinary twin.

That duplication is also **why the Steel Path has no checkbox** — an option that
moves two identical rows is not worth asking about, so the badge carries it
instead (`PROJECT.md §7`). Which leaves the duplication itself unanswered, and
it is this sub-decision.

This is the same class of problem as the entry above and wants deciding with it:

- (i) leave both ranked — honest, and wasteful of the eight slots that exist
- (ii) **collapse identical twins into one row** with a note that a Steel Path
  version exists and pays the same. Needs a rule for "identical", which here is
  cheap: same relic set, same chances
- (iii) show the Steel Path variant only when its table is actually *better*,
  which today is never

Worth noting the same shape may appear elsewhere as DE adds Steel Path variants
of existing content, so a rule beats a special case for Faceoff.

### Railjack is the only activity that locks anyone in

Swept 2026-08-14, at the owner's suggestion, across every gated activity in the
data — not just Railjack. For each item: which activities do its still-live,
still-reachable relics belong to?

| Activity | live relics it touches | items locked to it alone |
|---|---|---|
| **Railjack** (Proxima + 28 named nodes) | 34 | **6** — Cernos, Hikou, Nyx, Scindo, Valkyr, Venka |
| Railjack (Void Storms) | 29 | 0 |
| Sanctuary Onslaught | 29 | 0 |
| Faceoff (PvPvE) | 22 | 0 |
| Bounties (landscape) | 26 | 0 |
| Isolation Vault | 15 | 0 |
| Zariman | 15 | 0 |
| Höllvania / 1999 | 15 | 0 |
| Ascension | 15 | 0 |
| The Perita Rebellion | 8 | 0 |
| Duviri | 7 | 0 |
| Enemy drops | 11 | 0 |

**Nothing else needs a new category.** Every other gated activity is one route
among several for everything it carries, so a badge on the node row already says
all there is to say. Railjack is the single case where the gate is the whole
answer, which is why it — and only it — earns an item-level badge.

Two things worth keeping from the sweep:

- **Zero items are stranded entirely.** No item's live relics are all
  unreachable, so `access: quest` and `access: unmodelled` never orphan anything.
  That is the design working: quest content is out of scope — this tracks
  farmable parts from relics, not every way a Prime has ever entered the game —
  and excluding it costs nobody a route.
- The classifier used for this sweep is throwaway. If a second activity ever
  locks someone in, the honest move is to promote `railjackOnly` to a general
  `onlyFrom(activity)` rather than add a second special case beside it.

### The Ghoul and Plague Star detection has never seen a live event

The bounty clock and the event gating both shipped on 2026-08-12
(`PROJECT.md §7`). One part of it is unverified and cannot be verified on demand:
**neither the Ghoul Purge nor Plague Star was running when it was written**, so the
shape the worldstate gives those events was never observed.

The detection is deliberately loose because of that — a keyword scan across both
`/pc/events` and `/pc/syndicateMissions`, matching on several fields, so an
unexpected shape degrades to "not running" rather than crashing. And a missed
detection is a nuisance rather than a dead end: the *include event nodes* checkbox
still forces those bounties back into the ranking.

**There is a better key than keywords, and it was there all along.** Every event
in `/pc/events` carries a **`tag`** — the two running on 2026-08-12 were tagged
`HeatFissure` (Thermia Fractures) and `WaterFight` (Dog Days). A tag is a stable
machine identifier; a description is prose DE can reword. Match on `tag` first and
keep the keyword scan as the fallback. This still cannot be *confirmed* for Ghoul
Purge or Plague Star without one of them running — their tags are unobserved — but
it means the first sighting yields a permanent answer rather than another guess.

**Also useful when one runs:** `activation`/`expiry` are already used, but events
carry `node` (`"Orb Vallis (Venus)"`), `maximumScore`, `interimSteps` and
`rewards[]` too. Capture the whole entry, not just the window.

**What to do when one of them next runs:** refresh the data, check the build log
says `limited-time events running - Ghoul Purge` (or `Plague Star`), and confirm
the bounty appears in the planner without the checkbox. If it does not, capture the
raw worldstate entry — that is the fixture this cannot be written against today.
Plague Star matters most: it carries 26 relics, more than any other bounty.

### The worldstate publishes far more than the two fields we read

Swept 2026-08-14, at the owner's suggestion, and it changes several entries below.
We fetch `/pc/syndicateMissions` and `/pc/events` already, use two fields, and
throw the rest away. What is in there, per bounty job:

| Field | What it is | What it would fix |
|---|---|---|
| `uniqueName` | ends `…Tier<X>Table<Y>Rewards` | **`Table<Y>` is the rotation letter, published per tier.** See the entry below — this is the whole of it |
| `standingStages[]` | its length is the **stage count**, and it varies: 3, 4 or 5 by tier | `objectivesOf` hard-codes 4 stages for every bounty. Tier A is 3, Tier D is 5 |
| `enemyLevels[]` | e.g. `[40, 60]` | **every bounty node in our data has `lvl: null`** — 13 of them — so bounties can never win the level tie-break |
| `minMR` | **Minimum Mastery Rank**, 0 to 10 — see the caveat below | "Only recommend what can be run today" has never considered mastery at all |
| `type` | `"Cull the Enemy"`, `"Reclaim What's Ours"` | a real name instead of `Level 20 - 40 Cetus Bounty` |
| `rewardPoolDrops[]` | `{item, rarity, chance, count}`, **live** | a cross-check against DE's static table, which is how the letter is currently derived at all |

And on `/pc/events`, a **`tag`** field — `HeatFissure`, `WaterFight` — a stable
machine identifier instead of the keyword scan described two entries down.

None of this needs a new request. It is in the response we already cache.

**`minMR` is Minimum Mastery Rank**, the account-wide progression rank — earned by
levelling frames, weapons and Intrinsics and passing a test per rank, capped at 30
before Legendary ranks. Checked against
[the wiki's Bounty page](https://wiki.warframe.com/w/Bounty), which matches the
worldstate tier for tier:

| Bounty level | Wiki | `minMR` |
|---|---|---|
| 5–15 | no mastery lock | 0 |
| 10–30 | MR 1 | 1 |
| 20–40 | MR 2 | 2 |
| 30–50 | MR 3 | 3 |
| 40–60 | MR 5 | 5 |
| 100–100 | **MR 10 and The Steel Path unlocked** | 10 |
| 50–70 Narmer | no requirement | 0 |

**Two caveats that stop this being a filter.** First, the wiki: *"These can still be
played, when an eligible squad member selects one."* The rank gates **selecting** a
bounty, not running it — so excluding a tier outright would be wrong for anyone
playing with friends. Second, the 100–100 tier carries a **second** gate the
worldstate does not publish at all: The Steel Path must be unlocked.

So this is not a candidate for the exclusion rule. It is a candidate for a **demand
badge** — the same shape as `Railjack` and `PvPvE`, saying what a node asks of you
before you get there — and it would need the player's own rank, which is the first
thing this project would have to ask about itself rather than derive. Worth noting
that the same question is open for Profit-Taker, which needs Solaris United Rank 5.

### Read each bounty's rotation letter directly — **the worldstate already says it**

**Answered 2026-08-14.** The letter does not need deriving per tier. DE publishes
it in each job's `uniqueName`, and a reading of the cached worldstate for the
window ending `2026-08-12T20:25:13.214Z` matches our own derivation exactly:

| Job | `uniqueName` tail | Our derived letter |
|---|---|---|
| Ostrons tiers A–E, Solaris tiers A–E, Entrati tiers A/B/C/E | `Tier*Table**A**Rewards` | `standard: A` (16 of 16 votes) |
| Isolation Vault chambers A, B, C | `VaultBountyTier*Table**B**Rewards` | `vault: B` (6 of 6 votes) |

Two independent methods, 22 votes, no disagreement. That settles what `Table<Y>`
means.

**And it answers the open question below outright.** Entrati's *Reclaim What's
Ours* (level 30–40, our `Level 30 - 40 Cambion Drift Bounty`, the tier that
publishes only rotations **AB**) came back `TierDTable**B**Rewards` — on **B**,
while every other Entrati tier in the same window was on **A**. So the tier is
not inheriting the family letter and it is not falling back to A. It runs its own
letter, and DE says which, every window.

The two readings recorded below — *"the tier falls back to A whenever the board is
on C"* versus *"the tier runs its own two-letter cycle"* — no longer need choosing
between. Neither is load-bearing once the letter is read rather than inferred.

**What is left is the work**, not the question: parse `Tier<X>Table<Y>` out of
`uniqueName`, key it by the tier's `enemyLevels` to reach our node names, and keep
`derive_bounty_rotation`'s reward-matching as the fallback for a worldstate that
cannot be read. Only Aya is affected today, on one node, which is still why this
is written down rather than done.

### The old version of that entry, kept for the evidence

The letter is currently derived once per *family* — one for the standard bounties,
one for the Isolation Vaults — and every bounty in that family is assumed to be on
it, walking A→B→C. Most are. Three Cambion Drift tiers are not, because DE's table
does not give them three rotations at all:

| Bounty | Rotations DE publishes |
|---|---|
| `Level 30 - 40 Cambion Drift Bounty` | A, B |
| `Level 40 - 60 Cambion Drift Bounty` | A |
| `Level 100 - 100 Cambion Drift Bounty` | A |

The single-rotation ones are handled correctly — one table, nothing to wait for. The
two-rotation one is not: when the board is on C, it is scored at the average of A and
B, which is certainly wrong, because it is demonstrably offering one specific table.

Three readings of the live worldstate, against what that tier was actually offering:

| Bounty window ends | Board is on | That tier offered |
|---|---|---|
| 2026-08-11T21:55Z | C | its A table |
| 2026-08-12T07:55Z | A | its A table |
| 2026-08-12T10:25Z | B | its B table |

Two readings fit all three: the tier falls back to A whenever the board is on C, or
the tier runs its own two-letter cycle that happens to line up. They only diverge
about eight hours after the last reading above, so neither is confirmed.

**Superseded by the entry above** — DE names the letter in `uniqueName`, so none of
this has to be inferred from reward matching. Kept because the three readings are
real observations and would be the check on any implementation.

Tiers whose rotations are indistinguishable (several pay the same handful of
resources in all three) keep the family letter as a fallback.

### Renaming, and where the name lives — decision 8

**Decided: `Warframe Prime Hunter`.** The owner expects to change it again, so
the point of this entry is no longer "should we" but **"make the next one
cheap"** — the map below is the deliverable, and it should be kept accurate as
the project grows rather than re-derived each time.

**Audited 2026-08-14.** The name appears in 30 tracked files. Almost all of it is
prose — comments, headings, `--help` text, the browser title — which is a
find-and-replace and nothing more. Four uses are **not** prose, and those are the
ones that cost something:

| Where | What | Cost of changing it |
|---|---|---|
| `assets/shared.js` | six `localStorage` keys, `vorframe.collected.v1` and friends | **loses every user's data unless migrated.** One read-old-write-new pass on first load, then the old keys can be dropped a release later |
| `tools/build_data.py` → `data/vorframe-data.js` | the global `window.VORFRAME_DATA`, plus `VORFRAME_UPSTREAM` from `serve.py` | mechanical: one writer, one reader per page, all in this repo |
| `tools/bundle.py` | output filename `dist/vorframe.html` | mechanical, but it is the thing people are told to download |
| `tools/sources.py` | HTTP `User-Agent: VorFrame/1.0` | mechanical, and worth updating out of politeness to the APIs |

Plus the file names `data/vorframe-data.{js,json}`, which are referenced by both
pages, `.gitignore`, `serve.py`, the bundler and the GitHub workflow.

**The rule until then:** do not add a *fifth*. New storage keys, new globals, new
filenames and new URLs should not carry the name. Prose can say VorFrame as much
as it likes — prose is free to change.

**The backup format is already safe, and better than it looks.** The export writes
`vorframe: 3`, but `parseBackup` never reads it — it accepts anything carrying a
`collected` array and reads the rest by section name. So a renamed app restores an
old file with no migration at all. The only branded thing in that path is the
error message *"this doesn't look like a VorFrame backup"*, which is prose.

### Serving to a network exposes the folder, read-only **[done — the entry was stale]**

**Checked 2026-08-14 and there was nothing to do.** Both holes described below
were closed at some point after this was written, and nobody deleted the entry.
`serve.py` does not serve the folder at all: it serves an **allowlist** —
`index.html`, `plan.html`, five asset files, the data file, and flat files under
`assets/img/`. Everything else is a 404, including the two things named here:

```
.cache/state.json    refused        tools/serve.py   refused
.cache/api_events.gz refused        .git/config      refused
TODO.md              refused        directory listing refused
```

`temp_mockup.html` is refused too, except to a loopback peer. Kept below as the
reasoning about what is and is not sensitive, which is still worth having.

### The original entry, for the reasoning

Raised 2026-08-11 while planning a Raspberry Pi deployment.

**Corrected the same day** — the original version of this entry claimed a visitor
could overwrite your collection through the Backup box. That is wrong, and worth
recording so nobody reasons from it again:

- Ticks live in `localStorage`, scoped to origin *and browser profile and device*.
  A visitor gets their own empty tracker. Your collection never reaches the server,
  so there is nothing there for anyone to read or change.
- `serve.py` accepts no writes. It is `SimpleHTTPRequestHandler`, which implements
  GET and HEAD only — POST, PUT, DELETE and PATCH all return `501` — and the server
  writes nothing to disk while running.

What is genuinely exposed is **read access to the whole VorFrame folder**, including
`.cache/` with its raw copies of DE's responses, plus directory listings. All of it
is public game data, so the honest summary is "keep private files out of the folder"
rather than anything about credentials.

Worth doing anyway, cheaply:

1. ~~**Turn off directory listing**~~ — done, via the allowlist.
2. ~~**Do not serve `.cache/`**~~ — done, via the allowlist.

Both were small and both are in. What remains true and worth keeping is the
framing: nothing served is sensitive, so this was housekeeping rather than a
security fix, and an allowlist was the right shape because it fails closed —
anything added to the folder later is refused until someone names it.

### The banner guesses who is reading it from the hostname **[done 2026-08-14]**

**Option 1 was built, as recommended.** `serve.py` stamps `owner` onto the
`VORFRAME_UPSTREAM` payload it already attaches to the data file — per request,
not in the cached freshness body, since it is the one part that differs between
peers — and `staleBanner` reads it. The hostname guess survives only as the
fallback for when there is no server to ask, which is exactly the two cases it
was ever right about: a `file://` copy, and a published static host.

Kept below because the reasoning is the record of why option 1 beat the others.

### The original entry, for the reasoning

`staleBanner()` decides whether to add "Double-click `refresh-data.cmd` to update it"
by checking whether `location.hostname` is localhost. That is a guess standing in for
identity, and it is wrong in two directions:

- Browse **your own** server by its LAN address (`http://192.168.1.169:8777`) and you
  are treated as a guest, so you get the warning without the fix.
- Open the **single-file build** or any `file://` copy and the hostname is empty, which
  currently counts as owner — reasonable, since you must have the folder to have the
  file, but it is luck rather than reasoning.

It errs toward saying less, so nobody is misled — a guest is never told to run
something they do not have. Worth fixing properly all the same.

**Suggested fix, in order of preference:**

1. **Let the server say so.** It already decorates `data/vorframe-data.js` with
   `window.VORFRAME_UPSTREAM` before serving, and it knows the peer address —
   `self.client_address[0]` in the request handler. Adding `owner: <peer is loopback>`
   to that payload replaces the guess with the actual answer, costs nothing, and needs
   no new request. The page then reads the flag instead of sniffing its own URL.
2. **Make it explicit.** A `serve.py --guest` flag for anyone deliberately serving to
   other people, which suppresses every maintenance instruction regardless of address.
   Useful alongside 1 rather than instead of it.
3. **Say nothing to anyone.** Drop the instruction entirely and let the banner state
   the problem only. Simplest, and defensible — but it loses the one prompt that
   actually gets the data refreshed.

Option 1 is the real fix; the plumbing for it is already there.

### The rotation label sits at 3.48:1 contrast — decision 5

Measured 2026-08-10 while checking the new amber. `.spot-meta` renders in
`--txt-faint`, which is below AA (4.5:1) and well below the 7:1 `STYLE.md §3`
requires. It is deliberately dimmed as secondary information, so raising it changes
the visual hierarchy on both pages — worth doing, but it is a design decision rather
than a straight fix. The amber non-standard label deliberately matches this same brightness, so it
shares the problem by design (`STYLE.md §1`).

## Settled — answered, kept so the answer is not lost

### The planner cannot say how many missions to run **[settled]**

**Deliberately parked.** Each relic row estimates the *openings* needed, but not the
missions — that would be openings divided by how often the relic drops at the chosen
node. It is a probability, not a plan: the number would be an expectation with a very
wide spread, and reading it as "this many runs" would mislead more than it helps. Low
value, kept only so nobody proposes it again without a better idea.

Separately and still worth doing: the node list shows the top 8 with the next 20 on
hover, rather than a full browsable table.

### Collection does not sync between devices **[settled]**

**Backup/Import is the answer for now**, and it is complete — it carries the
collection, per-part progress, materials, the farm list, filters and planner options.
Automatic sync would need a server and an account, which is exactly what this project
avoids. Revisit only if a serverless option appears that keeps the data local.

### Prime Resurgence is the only non-first-party source **[settled]**

Everything else comes from Digital Extremes directly. DE's own `worldState.php`
returns 404 on both `content.` and `origin.warframe.com`, so the live Resurgence
rotation comes via the WarframeStat proxy. **There is no first-party route to find** —
nothing to do here until DE publishes one. Documented in `PROJECT.md §6` and left
open only so the search can resume if that changes.

### Enemy levels are missing for 31% of live-relic nodes **[partly reopened]**

Levels come from DE's `ExportRegions_en.json` (269 nodes, `minEnemyLevel` /
`maxEnemyLevel`), joined after stripping the `Event:` prefix. The gap is entirely
Railjack/Proxima nodes, which DE's export omits.

**This is fine as it stands.** Unknown levels sort last rather than being guessed at,
which is the correct behaviour — a made-up level would silently distort the tie-break
that levels exist to serve. Kept as a note so the 69% figure is not mistaken for a
join bug.

**Reopened in part, 2026-08-14.** The Railjack half stands — DE's export genuinely
omits Proxima. But **all 13 bounty nodes also have `lvl: null`**, and that half is
not a gap in the data at all: `/pc/syndicateMissions` publishes `enemyLevels` for
every live bounty tier, `[5, 15]` through `[100, 100]`, and it is the same number
already sitting in our own node names (`Level 40 - 60 Cetus Bounty`). Two routes to
it, both free. Bounties currently lose every level tie-break by default.

### Event nodes cannot be tied to their event **[settled]**

DE's drop table says only `Event: <planet>/<node>`, never which event, and the live
worldstate does not link an event back to a drop-table node. The node only exists on
the star chart while that event is running.

**So event nodes are excluded from the ranking entirely**, with an opt-in checkbox for
when you know one is live. Without a first-party mapping there is nothing better to
do: showing them by default sends you to missions you cannot find. Revisit only if DE
publishes the link.

### Relic inventory **[settled]** — do not re-propose without a better input method

This is the single biggest inaccuracy in the planner: every score is *per reward
drop*, so it ignores the stack of relics you could already be cracking. The blocker
is data entry, not value. The game offers no export, and typing in a relic
collection by hand is unreasonable when a long-standing account holds hundreds, most
of them vaulted and irrelevant.

What would unblock it: only the **currently-live relics** can affect a plan, so a
future attempt should ask about those alone — one screen of counters, re-asked when
the drop tables change. Any design that needs the vaulted ones is the wrong design.

---

## Should be fixed on the wiki, not here

These are places where VorFrame knowingly disagrees with
[`wiki.warframe.com/w/Prime`](https://wiki.warframe.com/w/Prime), the page the Prime
catalogue is parsed from.

**The policy is to keep our data faithful to that source and push corrections
upstream**, rather than entrenching a workaround in code. So each entry below is a
wiki edit waiting to happen. Where the app cannot wait, the local workaround is
named so it can be removed once the wiki is corrected.

### Gotva Prime is marked `(S)` but is a Baro Ki'Teer item

Its own wiki page says so outright — *"potentially sold by Baro Ki'Teer in the
Concourse section of the Tenno Relay"* — and it already carries `(B)`, so the `(S)`
is simply redundant.
**Local workaround:** `statusOf()` ranks Baro above Special, which puts it in the
right bucket. Remove that ranking once the `(S)` is dropped from the Prime page.

### The `(R)` Prime Resurgence markers are years out of date

The page still lists the December 2021 debut rotation and carries an `{{UpdateMe}}`
tag.
**Local workaround:** the markers are parsed and then ignored entirely — Resurgence
status comes from the live worldstate instead. Nothing here needs changing even if
the wiki is fixed, since the worldstate is simply a better source, but the page is
misleading anyone reading it directly.

### `(V)` vaulted markers are trusted less than the item API

Where the two disagree, the API's `vaulted` field wins. Worth spot-checking which is
actually right before deciding whether this is a wiki problem or one of ours.

### The wiki contradicts itself about Isolation Vault rotations

[`Isolation Vault`](https://wiki.warframe.com/w/Isolation_Vault) says the vault drop
tables *"rotate once every Fass/Vome cycle (2.5 hours or 150 minutes) in a ABCABC…
pattern"*. [`Cambion Drift`](https://wiki.warframe.com/w/Cambion_Drift) describes the
same tables as *"AAA AAA BBB CCC, repeating"* across a run's stages — a per-stage
rule, not a clock.

Our own readings of the live worldstate back the first one: all three vault chambers
sat on the same letter at the same moment, matched DE's published pool for that
letter exactly, and advanced together at the 150-minute boundary. Two builds either
side of one changeover saw B → C across all six vault tiers.

**No local workaround** — the app follows the clock, which is what the evidence
supports. The second page is what needs correcting.

### Not wiki issues

Recorded here only so they are not mistaken for one:

- `normalise_part()` reconciles two APIs with each other (`Chassis` versus
  `Chassis Blueprint`). Nothing to do with the wiki.
- Reward rarity is derived from the unrefined drop chance because **DE's** own
  rarity words are chance-relative and shift with refinement. A Digital Extremes
  data quirk.
- Item categories are read from the wiki deliberately — see `PROJECT.md §7`.
