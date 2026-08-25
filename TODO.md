# TODO

Everything still outstanding in Warframe Prime Hunter. **Only unfinished work
belongs here** —
when something ships, delete its entry rather than ticking it, and record *why* it
was done that way in `PROJECT.md` if the reasoning matters. Settled design
decisions are not TODOs and live in `PROJECT.md §7`.

Roughly ordered by what is worth doing first. Each entry should make sense to
someone who has never seen this project before; if it needs conversation context to
understand, it needs rewriting.

Entries marked **[settled]** are not open work. They are questions that have been
asked and answered, kept only so the answer is not lost and the question is not
raised again from scratch. Everything else is genuinely outstanding.

**Swept 2026-08-15.** Ten entries headed *[done]* were deleted and their reasoning
moved into `PROJECT.md` — the ten decisions of 2026-08-14, the rename runbook, the
`serve.py` allowlist, the banner's owner flag, the cache penalty, pre-refined
relics, Profit-Taker, and the reachability rule. Keeping a shipped entry "for the
argument it settles" is exactly what the rule above forbids, and the argument is
worth more in the document people read to understand the code.

**Added 2026-08-24.** Fifteen entries from two outside reviews, each checked against
the code before being written down — they have their own section below, kept
together because the corrections only make sense beside the claims they correct.

**Swept the same day.** Seven entries shipped and were deleted: the four akimbo
Primes whose second sub-weapon could not be recorded, the availability filter that
hid items with a second source, the drawer that threw away the focus, the
Profit-Taker phase costed at four stages, the missing fourth run mode on the
collection page, the two pages naming different nodes for one folded group, and the
clocks that stopped dead in a background tab. The reasoning moved to `PROJECT.md`,
which is what the rule at the top of this file asks for.

---

## What is open, at a glance

**Swept against the code on 2026-08-24.** Every row below was checked to still be
true; two entries had shipped and were rewritten to what is actually left of them.
Titles are given verbatim so they can be grepped — each one is a `###` heading
further down, where the reasoning lives.

*Size* is honest rather than optimistic: **small** is a few lines and one file,
**session** is an afternoon including the test, **large** touches the pipeline, the
payload and both pages.

**Two things are currently wrong on screen**, both found on 2026-08-25 and both
measured against that day's build or the one before. This paragraph said *"Nothing
is currently wrong on screen"* until they were checked. A third — both Onslaught
nodes ranked at exactly twice their true rate — was found and **fixed** the same
day; `PROJECT.md §7` has the reasoning.

- The planner runs an **endless-mission optimiser over missions that are not
  endless**: 28 of the 38 live `Caches` nodes are costed at six caches and 6 of the
  21 live `Spy` nodes at four vaults, against three of each. The row then prints
  *"Worth staying six rounds"* for a run that ends after three. Entry: *Several of
  those modes are not round-based at all*.
- The *Still needed* panel counts relics the reader's own switches have turned off.
  Live today on all three **Lex Prime** parts. Entry: *A part you cannot reach
  still reads as one you can*, whose own correction claimed the opposite.

All three were the same family: **a round is not a universal unit of effort**, the
heading two of them sit under. The unit the ranking divides by was assumed in three
different ways and checked in none — one is now checked, and the two below are the
rest of it.

The seven entries this list opened with were genuinely wrong on screen; they
shipped later the same day and have been deleted rather than ticked, with the
reasoning in `PROJECT.md §7` — *A part can be a whole Prime*, *Availability
buckets*, *Profit-Taker is four places*, *Nodes that are the same bet are one row*,
the run-mode table and the fissure section — plus a new focus rule in `STYLE.md §6`.

### Sentences that are no longer true

| Entry | Where | Size |
|---|---|---|
| Two comments describe things that no longer exist | `index.html`, `build_data.py` | small |
| `npm test` silently drops a whole suite | `package.json` | small |

### The worldstate is already cached, and barely read

**Mostly read now.** The sweep of 2026-08-24 took the rotation letter per tier, the
stage counts and the bounty levels; `PROJECT.md §7` records what that corrected.
What is left of the entry is two fields and a warning about one of them.

| Entry | What is left | Size |
|---|---|---|
| The worldstate publishes far more than the two fields we read | `type` (with a trap in it) and `rewardPoolDrops` as a cross-check | session |
| Baro's actual stock is published, and never read | *back in 6 days* on the label; what he is really selling | session |

### Model and ranking

| Entry | Size |
|---|---|
| A run's fixed cost is not priced, so Capture wins everything | session — measured, and the largest known distortion |
| `RUN_OVERHEAD` is two *rewards* on a node where a reward is two zones | small — no effect today, left open on purpose |
| Our four invented "mission types" leak into the ranking | session |
| What the misses are worth, in Ducats | session |
| A concentrated farm finishes a relic sooner than a diluted one | session — needs a size chosen by hand |

### Interface

| Entry | Size |
|---|---|
| A Mastery Rank field in the header | session |
| A priority flag on the farm list | session |
| A part you cannot reach still reads as one you can | session — **live on three Lex Prime parts today**, not hypothetical |
| The endless-fissure bonus is only stated on the collecting side | small |
| The Railjack opt-in gate stands in front of your only option | small |
| The node list is the top eight and a hover, not a table | small |
| The meta line is now 6.68:1, and the floor is 7:1 | small — a decision, not a fix |

### One refactor

Done on 2026-08-24 — the three slices of state moved into `shared.js` and both
drifts it had cost went with them (`PROJECT.md §7`). One residue, deliberately
left: the planner's wishlist lists only the parts you are missing, so a completed
part's button leaves the list and the counter has nowhere to wrap. Correcting a
mis-click there still means opening the item on the collection page — a property
of a worklist, not of the click, and worth deciding on its own merits.

### Cannot be finished today — and why

| Entry | Waiting on |
|---|---|
| Plague Star and Profit-Taker are the same shape, modelled two ways | Plague Star to run |
| The Ghoul and Plague Star detection has never seen a live event | either event to run — the `tag` half can be done now |
| Void Traces: the exchange rate that would let them be scored | one answer from the player: *are you trace-limited?* |
| Expected openings for everything, not for the worst one | the line above — the same trade decides its sign |
| Radiant or Intact is all a recruiting-chat squad can agree on | a decision about a third sidebar option |
| Nine rotation-bearing mission types are still unverified | wiki checking; tedious, not blocked |
| Several of those modes are not round-based at all | the two mapping questions in the row above — **measured, and wrong on screen** in the meantime: 59 of 242 live nodes |

### Not work

The availability precedence asks for something that is **already true** — see its
entry. *Conditioning the fissure bonus on a live fissure* was **[settled] against**
and then done anyway on 2026-08-24, at the owner's direction — the entry is gone
and `PROJECT.md §7` records both the reversal and what it cost.
Six answered questions sit under **Settled**; the one that was partly reopened had
its open half closed on 2026-08-24, and what remains of it is a note explaining why
Railjack levels are absent on purpose. Four wiki edits sit under **Should be fixed
on the wiki, not here** — those are edits to `wiki.warframe.com`, not to this
repository.

---

## Defects found by the documentation sweep of 2026-08-15

Five entries, of which **four shipped on 2026-08-24** and were deleted — the two
pages naming different nodes for one folded group, the collection page's missing
fourth run mode, the Profit-Taker phase costed at four bounty stages, and the three
strings claiming the page could not see fissures. That last one was rewritten while
the refresh interval was being changed, because the change made it wronger: the
sentence said the data was *"refreshed daily"* and it is now re-read every ten
minutes. The decision it justified is unchanged and now argued from what is
actually true — see `PROJECT.md §7`.

The one below is what is left of the group, and it is the cause the group was made
for: a capability landed and the sentences explaining why it was absent stayed where
they were.

### Two comments describe things that no longer exist

Cheap, and each one will mislead somebody. **This entry named three until
2026-08-25**; the `tools/schedule.ps1` one has since been repaired on its own —
`.DESCRIPTION` no longer mentions a strip or the planner, so that bullet has been
deleted rather than left to send the next reader looking for a defect that is gone.

- `index.html`, the materials hint — *"nothing here feeds the farm advice. Forma
  will, once the planner lands."* The planner landed, and the Forma row **is** what
  the planner reads.
- `tools/build_data.py`, above `FISSURE_TIERS` — justifies keeping `Omnia` as *"the
  most useful line of the lot"*, which was about a per-tier strip that no longer
  exists. The reason to keep Omnia now is simply that a node with an Omnia fissure
  is a node with a fissure.

### `npm test` silently drops a whole suite

Found 2026-08-25. `package.json`'s `test` script names two of the three `.mjs`
suites:

```
"test": "node --test tests/test_assets.mjs tests/test_pages.mjs"
```

`tests/test_model.mjs` is missing, so `npm test` runs a whole suite fewer than it
looks like it does, and says nothing about it. Drift rather than a hole — `python
tests/test_build.py` is the documented command and it runs all three — but the
failure mode is the bad one: a green run that quietly checked less than the reader
believes, with no skip line to give it away. One line.

---

## Brought in by two outside reviews, 2026-08-24

Two documents arrived on 2026-08-24: a **code review** of four points, and a
**logic and model roadmap** of eleven. Every claim in both was checked against the
code and the live dataset before being written down here, because several of them
were wrong about what this app currently does — and a proposal argued from a
misreading needs re-arguing, not implementing. Where that happened the correction
is kept with the entry rather than quietly dropped.

Two of the fifteen turned out to be defects with symptoms you could see on screen,
and **those two and two more shipped on 2026-08-24**, so their entries are gone and
the reasoning is in `PROJECT.md`: compound weapons tracking their sub-weapon
(*A part can be a whole Prime*), the availability filter reading every bucket
(*Availability buckets*), the drawer keeping its focus (`STYLE.md §6`), and the
clocks catching up on `visibilitychange` (the fissure section). Three of the
fifteen were already covered by entries elsewhere here. Two are settled against,
one of them by measurement taken while checking it. What is below is the rest.

| Source | Asked for | Verdict |
|---|---|---|
| roadmap 2 | a toggle between score per objective and per run | **shipped** — `#p-sort` at `plan.html:111`, wired at `plan.js:1424`. Row kept only because it was the stated blocker on *The node list is the top eight*, which is now unblocked |
| roadmap 5 | read Baro's live stock from `/pc/voidTrader` | open, with a trap in the "disable the box" half |
| roadmap 3 | reorder the availability precedence | **the stated goal is already true**; the order as written empties the Founder bucket |
| review 2 | one `State` controller in `shared.js` | **shipped** on 2026-08-24 — `makeState()` at `shared.js:92`, exported at `:466`. The *One refactor* section above already said so; this row did not |
| review 3 | a priority flag on the farm list | open, but not via `stillNeed` |
| roadmap 10 | Ducat value of the non-wanted drops | open; measured at a 1.9× spread |
| roadmap 7 | expected openings for *all* parts, not the worst one | **measured: changes 5.4% of live cases, for 4.5% fewer openings at double the trace price** |
| roadmap 8 | restrict squad refinements to Intact/Radiant | **misreads the option**; the missing case is public radshare |
| roadmap 11 | reward concentrated farms over diluted ones | open, and the only one here nothing observable can check |
| roadmap 9 | score Void Traces on ESO and Void Storms | already an entry above; one correction to it |
| roadmap 1 | condition the fissure bonus on a live fissure | **[settled] against** — the observation behind it is already an entry above |

### Baro's actual stock is published, and never read

`flags.baro` comes from a wiki marker — `[[Baro Ki'Teer|B]]`, `tools/catalogue.py:159`
— and it means *he sells this sometimes*, not *he is here now*. Eight items carry
it. `/pc/vaultTrader` is fetched for Resurgence (`tools/sources.py:46`);
`/pc/voidTrader`, which carries his arrival, departure and current inventory, is not
fetched at all.

**The proposal has two halves and only one is safe.** Disabling the checkbox while
he is away changes what the flag means, and he is present roughly two days in
fourteen: a box that is dead twelve days out of every fourteen is a filter that
mostly does nothing, and eight items would move between buckets twice a fortnight
under a reader who has not touched anything. That is the same instability the
fissure decision rejects for the ranking (`PROJECT.md §7`).

The half that is clearly worth having is the one the bounty clock already
demonstrates: **say when**. *Baro Ki'Teer (B) — back in 6 days* on the label, and
while he is actually here, mark the items he is really selling — which is the only
thing on this list that today's static flag genuinely cannot tell you. That is a
live fact stated where it is read, not a live fact moving things around.

See also the worldstate entry below: the responses already cached carry more than
is read, and this would be a third endpoint rather than a third use of one.

### The availability precedence, and what reordering it would actually cost

Today: `founder → resurgence → farmable → baro → special → vaulted`
(`assets/model.js:118`, argued in `PROJECT.md §7`, pinned by a test in
`tests/test_model.mjs`).

The roadmap asks for `farmable → resurgence → baro → vaulted → special → founder`,
to *"move Other Sources to the second-to-last position"*. **It is already there** —
`special` is fifth of six, with `vaulted` last as the fallback. The stated goal
needs no change.

The order as literally written does change something, and it is not good. `vaulted`
is not a fallback in that list, it is a **check**, placed fourth — and all three
Founder items carry `flags.vaulted`. Simulated over the current 167:

| Order | Founder bucket | Items moved |
|---|---|---|
| current | 3 | — |
| as written | **0** | Excalibur, Lato and Skana Prime → Vaulted |
| `farmable → resurgence → baro → founder → special → vaulted` | 3 | **none** |

So the intended reading is a no-op on today's data — no item is both farmable and
resurgent, or both founder and anything else — and the literal reading silently
empties a bucket whose whole point is that those three can never come back. If the
order is changed at all, change it to the third row, update `PROJECT.md §7` and the
test with it, and know that nothing on screen will move.

### A priority flag on the farm list

Nothing distinguishes a vaulted part you may never see again from a permanently
farmable one: `bestRefinement` weighs each wanted reward by `Math.min(e.qty, e.stillNeed)`
and nothing else, so the scarcest thing sets the bottleneck whether or not it is the
thing you care about.

**Not via `stillNeed`, though**, which is what the review proposes. That number
feeds two different things in `model.js` — the value of an opening, *and* the
`openings` count that the crack list ranks on ("openings per part cleared"). Inflate
it and the app starts claiming you need three of a part you need one of, and the
second list becomes a lie. A separate multiplier applied to **value only**, leaving
`openings` honest, is the shape that does not corrupt anything.

The control is the other half. The crosshair is a two-state `role="checkbox"`
(`STYLE.md §6`: green owned, teal queued), and a third state needs either a
different control or a modifier — plus a line in `STYLE.md`, since a new colour with
a new meaning is exactly what that document exists to arbitrate.

### What the misses are worth, in Ducats

The data is already here and already tested: `ducats` on **582 of 590** parts, all
in `{15, 25, 45, 65, 100}`, pinned by `test_build.py`. **Nothing in the ranking
reads it** — this entry said "nothing reads it" until 2026-08-25, but the
collection drawer has shown a per-part Ducat badge since 2026-08-11
(`assets/app.js:863`). It is the scoring side that is untouched.

Measured across the 34 currently-dropping relics, the expected Ducats of one Intact
opening runs **17.3 to 33.4, mean 21.4** — a 1.9× spread. Real, and small. Two notes
for whoever implements it:

- the join needs the same `normalise_part` the pipeline already applies. Reward rows
  are named `Nyx Prime Chassis Blueprint` while the part is `Chassis`; without that
  step 38 of 180 live reward rows miss and the numbers come out ~20% low.
- **the tie-break framing is the weak half of the proposal.** Nodes that are the
  same bet are already folded into one row by `ROT.signature`, so exact ties between
  *different* relic tables are not the common case. The strong half is the one the
  review states second: this is the value of the **misses**, and the misses are most
  of what a run hands you.

It is not free of the argument that keeps traces out of the score, either: Ducats
buy from Baro, and what a Ducat is worth depends on whether you want anything he is
selling.

### Expected openings for everything, not for the worst one — measured, and it costs traces

The review is mathematically right. `bestRefinement` minimises the **worst single**
expected-openings figure among the wanted rewards, and the expectation of getting
*all* of them is strictly greater than the largest individual expectation. The
correct quantity is the unequal-coupon-collector expectation, exactly computable by
inclusion–exclusion over the wanted rewards.

**So it was computed, and compared against what ships.** Over the 34 live relics and
1,145 (relic, wishlist) combinations:

| | |
|---|---|
| cases where the advice differs | **62 of 1,145 — 5.4%** |
| what the change always is | **Flawless → Radiant**, every single time |
| improvement where it differs | median **0.46 openings, 4.5%** (e.g. Lith C7, 10.3 → 9.8) |
| what it costs | **50 more Void Traces** per relic — Flawless is 50, Radiant is 100 |

Over all 763 relics including vaulted, the disagreement rate is the same, 4.4%, and
the direction never varies. Squad odds do not change it either, since `squadOdds` is
monotone in `p`.

**So the honest summary is: correct, and worth about half an opening at double the
trace price, on one relic in twenty.** Which makes it the same trade as the entry
above — what 100 traces are worth to this player — and it should not be implemented
before that question has an answer, because the answer decides its sign.

### Radiant or Intact is all a recruiting-chat squad can agree on

**The review misreads the option.** The box is labelled **4-man premade** and its
tooltip says so; a coordinated group *can* all run Exceptional, and the option
already unlocks Disruption's rotation A, which needs the squad to under-defend
conduits on a schedule. Restricting it to Intact and Radiant would make it describe
something it does not claim to be.

The gap it is pointing at is real, and it is a **missing option, not a restriction
of this one**: a public radshare from recruiting chat, where you get four rolls but
the refinement is not yours to choose — squad odds *forced to Radiant*. That is the
common case for anyone without a premade, and the app currently has no way to say
it. Whether the sidebar has room for a third state of one question is the design
call; `PROJECT.md §7` is deliberately hostile to options that change two rows.

It also overlaps with the pre-refined nodes: a relic handed over Radiant by ESO or a
Void Storm is already at the radshare refinement, and `sourceValue` already values
those at the refinement given rather than the one chosen.

### A concentrated farm finishes a relic sooner than a diluted one

Measured, because the size of the effect decides whether it is worth pricing. Across
the **274** live relic-dropping nodes, the number of currently-dropping relics a node
carries runs from **1 to 28** — two nodes drop one, 58 drop seven, 54 drop fifteen,
and Elite Sanctuary Onslaught drops 28. The spread the proposal wants to reward is
real and large.

But most of it is already priced: a node is scored on the relics **you want**, so a
28-relic table gets no credit for the 24 you do not. What is left is genuinely
second-order — variance, and the option value of finishing one relic, crossing it
off and re-optimising against a shorter list.

Which makes this the **one proposal here that nothing observable can check**. It
would move the ranking by an amount chosen by hand, in a direction no measurement
confirms. If it is wanted it needs a stated size and a paragraph in `PROJECT.md §7`
beside the Railjack cache penalty — which is described there as *the one deliberate
thumb on the scale*, and that sentence would have to stop being true.

### Void Traces on ESO and the Void Storms — one correction to the entry above

Already covered by *Void Traces: the exchange rate that would let them be scored*.
What this review adds is **where to inject it**, and the plumbing is in place:
`sourceValue` already computes the traces a pre-refined node saves you, per node, and
deliberately leaves the figure out of the score.

One correction. The review says the calculation needs nothing from the player. It
needs exactly one binary answer — *are you trace-limited?* — because a player sitting
on 8,000 traces values the saving at zero, and that is the whole reason the number is
shown rather than scored (`PROJECT.md §7`). The formula in the entry above is the
same one the review derives.

## A round is not a universal unit of effort

The planner costs every mission in "rounds" and assumes one round means the same
everywhere. It does not. The largest part of this was answered on 2026-08-14 —
effort is collected per objective and the default costs by objective count
(`PROJECT.md §7`) — and what is left is not a modelling gap but an ordinary
unknown.

### Nine rotation-bearing mission types are still unverified

Swept 2026-08-10. Of the 31 mission types in the data, 9 carry no rotation at all so
the cycle never applies, 11 are confirmed A→A→B→C against the wiki (Defense,
Survival, Interception, Excavation, Defection, Infested Salvage, Alchemy, Sanctuary
Onslaught, Void Cascade, Void Flood, Void Armageddon), and Disruption is modelled
explicitly. That leaves nine assumed AABC without confirmation:

`Caches`, `Key`, `Legacyte Harvest`, `Rush`, `Skirmish`, `Special`, `Spy`,
`The Circuit`, `The Perita Rebellion`.

`Bounty` was the tenth and is now settled — it is not a round-based cycle at all,
see *Bounty rotation is a wall clock* in `PROJECT.md §7`.

The wiki also names two more exceptions we do not currently see in relic sources —
**The Index** (A-B-B, with C once after an hour) and **Arbitrations** (A-A-B-B-C-C-C-C)
— so deviation is clearly not rare.

Their objective counts are **not** inherited rather than checked — this entry said
that until 2026-08-25, and it is too kind. They are not inherited from anywhere:
they are chosen per node by a run-length optimiser that assumes the mission is
endless, so the count is whatever staying happened to score best.

As of 2026-08-25 the gap has a concrete cost, and two of the nine are what
*Several of those modes are not round-based at all* is blocked on:

- **`Spy`** — do vaults 1/2/3 pay A/B/C, or the assumed A/A/B? Six live nodes —
  Pago, Bode, Valac, Aegaeon, Amalthea, Dione — publish rotation **C only**, so
  this answer alone decides whether capping a Spy run at its real three vaults
  preserves their value or zeroes it.
- **`Caches`** — does each of the three caches roll its own rotation, and do the
  ten un-rotated tables roll once per run or once per cache?

Answer those two and a measured, already-designed correction ships. The other seven
can wait.

**Amended 2026-08-25: the sweep above verified the wrong axis.** The eleven
"confirmed A→A→B→C against the wiki" were confirmed on the **letter sequence** and
never on the **cadence** — how many objectives buy one reward. At least two of the
eleven are not one-for-one, both checked on the wiki the same day:

- **Sanctuary Onslaught** pays one reward per **two zones**. See the entry below.
- **Void Cascade** — *"Retiring 4 purged Exolizers counts for one rotation"*, order
  AABC (`wiki.warframe.com/w/Void_Cascade`). Four objectives per reward, and we
  charge one.

So the paragraph above understates it a second time: the objective counts are
unchecked for the **confirmed eleven** as well as for the unverified nine.
Re-sweeping the eleven for cadence is the smaller half of this entry and is worth
doing first — it needs no code, only the wiki, and it has already turned up two.

### `RUN_OVERHEAD` is two *rewards* on a node where a reward is two zones

Small, and left open deliberately when the Onslaught divisor shipped on
2026-08-25 (`PROJECT.md §7`). `ROT.RUN_OVERHEAD` is 2 and is added to the reward
count when the model chooses how far to run a node — `rate: r.total / (rounds +
RUN_OVERHEAD)`, `rotation.js:363`. It prices getting in and out of a mission.

On Onslaught a "round" in that expression is a *reward*, which is two zones, so the
restart is being charged at four zones rather than two. The constant is deliberately
unit-free (`PROJECT.md §7`), and this is the first mission type where its unit is
demonstrably not the player's unit.

It changed nothing when the divisor shipped: `aabcaa` still wins on both Onslaught
nodes, so the run-length choice is unaffected and the ranked cost is now right
either way. That is why it was not resolved in the same pass — there was no
pressure to guess. It matters the moment a second cadence lands, since a mission
paying one reward per four objectives would be charged an eight-objective restart.

### A run's fixed cost is not priced, so Capture wins everything

**Measured by the owner from their own runs, 2026-08-24, and it is the largest
known distortion in the per-minute ranking.** Effort is collected per *objective*
and the cost of a run is `minutes-per-objective × objectives` — nothing else. So a
Capture costs exactly its 1.5 minutes and a six-round Survival exactly its 30, as
though walking in and walking out were free. They are not, and the error is not
spread evenly: it is a fixed cost, so it lands almost entirely on the short ones.

The owner's figures: a mission **start is about 20 seconds** and a mission **end
about 15**, so **35 seconds a run**, whatever the run is. Against their own
measured per-objective times:

| Mission type | min/obj | objectives | costed now | with +35s | cost rises | its rate falls |
|---|---|---|---|---|---|---|
| Capture | 1.5 | 1 run | 1.50 | 2.08 | **+38.9%** | **−28.0%** |
| Exterminate | 2.5 | 1 run | 2.50 | 3.08 | +23.3% | −18.9% |
| Sabotage | 5.5 | 1 run | 5.50 | 6.08 | +10.6% | −9.6% |
| Mobile Defense | 6 | 1 run | 6.00 | 6.58 | +9.7% | −8.9% |
| Defense | 3.5 | 6 rounds | 21.00 | 21.58 | +2.8% | −2.7% |
| Spy | 10 | 3 vaults | 30.00 | 30.58 | +1.9% | −1.9% |
| Survival · Interception · Disruption | 5 | 6 rounds | 30.00 | 30.58 | +1.9% | −1.9% |

A twenty-eight per cent correction on Capture against two per cent on Survival is
the whole of the complaint: **Capture wins by a large margin, and part of that
margin is an accounting error.**

**The shape asked for.** Two more fields in the effort panel, filled in by hand
like the rest — *minutes to start a mission* and *minutes to leave one* — kept
apart rather than summed into one, because they are two different waits and a
player timing themselves can measure them separately. Blank by default, on the
same principle as every other number in that panel. Added once per run:

```
minutes = per(mode) × objectives + start + end
```

Both belong in `PLAN_OPTIONS` so a backup carries them; they are as expensive to
lose as the twenty numbers already there.

**Only the per-minute ranking can use them.** With the effort panel empty the list
is costed in objective *count*, and 35 seconds has no meaning in objectives — a
round is anything from a 45-second Defense wave to a five-minute Survival rotation.
So this changes the ranking exactly when minutes are given and does nothing before
that, which is the same bargain the rest of the effort model makes.

**It leaves two overheads in two units, and that wants thinking about.**
`ROT.RUN_OVERHEAD` already exists — two *rounds*, in `rotation.js` — and it is what
makes staying worth it when the model chooses how far to run a node. It is
deliberately unit-free so both pages reach the same answer and so that answer does
not move when somebody types into the effort panel (`PROJECT.md §7`). These new
fields are minutes, and they price the same real thing. The options, in order of
how much they disturb:

1. **Leave both.** The rounds figure decides *how to play* a node; the minutes
   figure decides *what it costs* once played. Two questions, two answers, and the
   pages still agree. Simplest, and slightly embarrassing to explain.
2. **Feed the minutes into the mode choice when they exist**, keeping the rounds
   figure as the fallback. More accurate, and it reintroduces exactly the
   divergence §7 argues against — the collection view has no effort panel, so the
   two pages would then disagree about how long a run is.
3. **Derive the rounds figure from the minutes** where both are known, so there is
   one number with one meaning. Most honest, most work, and it still has to answer
   what the collection view does.

**Decided by the owner, 2026-08-25: (1), and it is not a starting point.** Add the
two fields, charge a **flat overhead once per run**, and keep the objective-count
ranking **agnostic to it** — the overhead is the player's own number and lives on
the player's side of the model. Options (2) and (3) are closed, not deferred.

The reasoning, which is stronger than *"simplest"*: the two overheads are not two
units for one quantity, they are **two different quantities**.

- `RUN_OVERHEAD` is **comparative**. It exists only at `rotation.js:363`, where each
  candidate way of playing a node is scored `value / (rounds + 2)`, and it is
  discarded the moment a plan wins — nothing consumes it afterwards, and the export
  at `rotation.js:717` is read by no caller, only by a test asserting its value. Its
  absolute size barely matters; only the ratio between two plans at the same node
  does, which is why its own comment can admit it "over-charges the long ones and
  under-charges the short ones" without that being a defect.
- The start/end minutes are **absolute**. They are the real price of one run, and
  they are charged once, to the cost the ranking divides by.

So 35 seconds is not two rounds, and was never meant to be. `rotation.js:311`
already gives the reason the constant is kept in rounds: a minutes figure "could
only be applied where minutes have been given — and then the two pages would
disagree about how long a run is the moment somebody typed into the effort panel. A
choice about how to play a node should be a fact about the node."

**Rejected in the same decision:** folding `RUN_OVERHEAD` into `n.cost`
(`plan.js:587`) to price restarts in the default objective view "for free". It was
raised on 2026-08-25 on the grounds that two rounds *does* have meaning in
objectives where 35 seconds does not. It pushes a comparative constant into an
absolute price, and it makes the objective ranking silently change cost basis the
moment anyone types a minute into the effort panel. The paragraph above stands as
written: the objective view stays overhead-free, **by choice rather than by
impossibility**, and that is the correction this entry needed.

**What to check when it lands.** The collection view ranks per *run* and has no
effort panel, so it should be untouched — worth asserting, since "both pages agree"
is a rule here and this is a case where they legitimately differ. And the row's
`relics / min` label stays honest: the minutes it divides by become the true cost
of a run, which is what the label already claims.

### Several of those modes are not round-based at all

`Spy`, `Caches` and `Key` carry rotations, but the rotation does not advance per
*round* — a Spy mission has three vaults, Caches counts what you found. You collect
several tiers inside a **single mission**.

**Measured 2026-08-25 by driving the shipped model over the 2026-08-24 build, and
it is worse than this entry used to say** (*"we cost a three-vault Spy run as three
rounds of Defense"* — we do not; we cost some of them as four, and Caches as six).
There is no mission-type test anywhere in the run-length chooser: `rotation.js:356`
picks `["reset", "aabcaa"]` for everything, so a plan optimiser that assumes you
may choose to stay picks lengths these missions cannot have.

| Mission type | live nodes | costed at | reality |
|---|---|---|---|
| `Caches` | 28 of 38 | **6 caches** | 3 |
| `Spy` | 6 of 21 | **4 vaults** | 3 |

59 of the 242 live mission nodes are priced as endless when they are not. Two
consequences beyond the cost. On a real three-objective run the AABC cycle never
reaches rotation C, so the model banks a reward the run cannot collect. And
`plan.js:786` pushes the hardcoded string *"Worth staying six rounds"* whenever the
chosen mode is `aabcaa`, so a three-cache Railjack run is told to stay for six —
while the line above it (`plan.js:766`) says "over N **rounds**" even for a vault
mission.

`Key` and `Special` are the same defect but **dormant**: neither has a live relic
source on today's build, so nothing in the ranking shows it. That is a property of
today's data, not a fix.

The comment at `rotation.js:392` asserts the opposite of what the code does —
*"Spy and Caches need no special case: their rotation is the count of vaults opened
or caches found"*. True of the unit, false of the count: `objectivesOf`
(`rotation.js:420`) renames the unit and keeps the arithmetic.

**Cap the length; do not touch the mapping.** Whether Spy's vaults 1/2/3 yield
A/B/C rather than the AABC cycle's A/A/B belongs to *Nine rotation-bearing mission
types are still unverified*, and under the wiki rule that answer comes from
`wiki.warframe.com` rather than from us. Three vaults and three caches are numbers
this file already states; the mapping is not.

**Held for the wiki, by the owner's decision of 2026-08-25 — and the reason is
that the two cannot be separated after all.** The length and the letters are two
different expressions in `rotation.js`, so capping the length looked like the safe
half. It is not, because of what the live data turns out to be:

| Live nodes | What they publish | Reached by a capped 3-objective A,A,B run? |
|---|---|---|
| 28 `Caches` | rotations A and B | yes — ranked rate **rises** 9–14% |
| 15 `Spy` | rotation B only | yes — already costed at 3, unchanged |
| 6 `Spy` | **rotation C only** | **no — they would score zero** |
| 10 `Caches` | no rotation at all | n/a — costed "one run", leave them |

The six are **Pago** (Kuva Fortress), **Bode** (Ceres), **Valac** (Europa),
**Aegaeon** (Event: Saturn), **Amalthea** (Jupiter) and **Dione** (Saturn). They
hold *all* of their value in rotation C, so capping the length while the letter map
still yields A, A, B deletes the only rotation they pay from: Pago falls from 128th
to 230th of 234, and the row prints *"rot C has 61.92% you want, out of reach
here"* about a mission whose third vault is exactly where that reward lives. That
is worse than the defect. **Capping `Caches` alone was offered and declined**: it
would have fixed 28 of the 34 mis-costed rows today, but it splits one arithmetic
correction across two commits and two mental models.

**What the wiki has to answer**, and it is two questions, not one:

1. Which rotation does each **Spy vault** pay — 1/2/3 = A/B/C, or the AABC cycle's
   A/A/B? The six C-only nodes are the whole of what is blocked on this.
2. The same for a **Railjack cache** run: does each of the three caches roll its own
   rotation, and do the 10 un-rotated `Caches` tables roll once per run or once per
   cache? The second half decides whether those ten stay at "one run".

Until both are answered, `rotation.js` is not touched. Anything that makes the six
Spy nodes keep their value without an answer — collecting each published rotation
once, for instance — **is** the mapping decision wearing a different hat, because
value depends only on the multiset of letters. Taking it is allowed; recording it
as having avoided the question is not.

**Also found while measuring, and it must be covered by the same fix.** A `Spy`
node that is a fissure right now takes the `bonus` branch at `rotation.js:356` and
is run to **five vaults** with a free endless-fissure relic attached. It is dormant
only because the shipped build has zero live fissures; a Spy fissure is ordinary
and it is one refresh away. The free relic is for staying in an *endless* fissure,
and a Spy mission has nothing to stay in.

**`CACHE_PENALTY` is re-derived in the same commit as the cap** — owner's decision,
2026-08-25 — rather than left to a follow-up, because the constant was calibrated
while these same nodes were being costed at six caches instead of three. Note which
way it actually moves before re-deriving it: per *run* the two corrections compound
(Beacon Shield Ring 1.4116 → 0.8026 → 0.4013 after halving), but per *objective*,
which is what the list is ordered on, the cap **raises** these rows — the cost falls
faster than the value, so Beacon Shield Ring goes 0.2353 → 0.2675 and moves up from
217th to 208th. The penalty does less work after the fix, not more. For any node
with rotation C empty — all 28 — the rate multiplier is `2(2a+b)/(4a+b)`, which is
1.0 when the value is all in rotation A and 2.0 when it is all in B. It cannot
lower a Caches node's per-objective rate; it can double it. `PROJECT.md §7` quotes
a live worked example that will move whatever is decided, so it is re-measured in
that commit rather than left.

**The design is worked out, so it is not re-derived when the answer arrives.**
Declare the objective count beside the unit — one table, `{ Spy: {count: 3, unit:
"vault"}, Caches: {count: 3, unit: "cache"} }` — replacing the unit-only
`OBJECTIVE_UNIT` at `rotation.js:416`, and read it in three places: the mode list at
`rotation.js:356` (which is where the missing mission-type test goes, and it drops
`bonus` for these types in the same expression), a `"fixed"` branch in `scorePlan`,
and a new first case in `objectivesOf` *before* the `n.rounds` test so a node whose
plan banked nothing is still three vaults rather than "one run". Two shapes were
considered and rejected: a `Math.min` clamp after plan selection (it divorces the
cost from the draws, so `counts` keeps naming rotations the run no longer reaches,
and it cannot stop the `bonus` branch), and an entry in `ROT_PATTERN` (`runValue`
returns `nonStandard: !!ROT_PATTERN[mission]`, which both pages read as *"this is
Disruption"* — a Spy row would start explaining conduits). `ROT_PATTERN` answers
what an objective pays; this answers how many objectives there are.

Consequences to carry into that commit: `RUN_MODES` gains `"fixed"`;
`assertCoverage` gains a `fixed length` line and drops those types from `assumed
AABC`; `plan.js:766` must stop saying "over N **rounds**" for a vault mission and
use `objectivesText`, as must the meta chip at `plan.js:806` — which today
contradicts the tooltip on its own row; the `aabcaa` branch's hardcoded *"Worth
staying six rounds"* becomes unreachable for these types but should be read off
`n.rounds` anyway; and `app.js:1055` hardcodes `${s.rounds} rounds`, so the
collection page would say rounds where the planner says vaults — the one place this
change touches **both pages**, which the "both pages agree" rule makes mandatory.
`app.js` inherits the value correction automatically since it calls the same
`runValue`, so it needs a browser pass, not an edit to its arithmetic.

The test that currently covers this hands the function its answer —
`tests/test_assets.mjs:312` passes `{ mode: "Spy", rounds: 3 }` by hand, so it has
never seen the 4 the model actually produces. Repair that first, by driving
`runValue` and handing its *result* to `objectivesOf`; spread the result first, or
`runValue`'s own `mode` (the run mode) silently overwrites the mission type.

Useful find while checking: the wiki splits missions into **Endless** (Defense,
Survival, Interception, Excavation, Defection, Disruption, Alchemy, Infested
Salvage, Legacyte Harvest, Void Cascade/Flood/Armageddon) and **Standard**
(Assassination, Capture, Exterminate, Hijack, Mobile Defense, Rescue, Sabotage,
**Spy**). That is exactly the round-based-or-not split the model has been
reverse-engineering, from a source, and it independently confirms Spy is not
endless.

## Everything else

### Our four invented "mission types" leak into the ranking

`Bounty`, `Key`, `Special` and `Enemy` are ours, not DE's — one bucket per
droptable section (`official.py`). DE's own mission type is the parenthesised
word in `Planet/Node (Type)`, and the wiki lists 35 of them; ours match 24.

That matters because the planner presents all of them as places to go:

- **`Enemy`** is not a destination. It is an enemy that drops relics wherever it
  spawns — the Hemocyte, and it now carries a badge saying so.
- **`Key`** is not a mission type. It is an extra key-gated objective attached to
  an existing mission, and nobody runs one exclusively for it.
- **`Special`** is a bag holding Void Storms, Faceoff and Duviri tables together.
- Three of DE's own labels are not wiki mission types either: `Caches` (a reward
  stream *inside* a Railjack mission), `The Circuit` and `The Perita Rebellion`
  (single activities whose "type" is their own name).

The `Bounty` bucket is the one that has already cost something, because
`objectivesOf` keys off it: the four Profit-Taker phases were charged four bounty
stages each until 2026-08-24, when the heist was given a case of its own
(`PROJECT.md §7`). That fix names one node pattern rather than fixing the label, so
`Bounty` still carries two units — the effort row takes the unit of whichever node
has the most objectives so a one-run heist cannot relabel a form that is mostly
stages. A plaster on exactly the problem this entry describes.

### Plague Star and Profit-Taker are the same shape, modelled two ways

**Raised by the owner 2026-08-14, and they are right that something is off.**
Both are gated multi-stage activities that end in a boss dropping relics. Four of
the five differences are real and the models follow them correctly — Profit-Taker
is permanent so it gets a badge, Plague Star is a recurring Operation so it gets an
event gate (`PROJECT.md §7`).

**The fifth is ours.** DE file Profit-Taker's boss rewards inside the bounty table
and Plague Star's boss rewards in the enemy table — the same game structure,
published two ways. We follow the publication rather than the structure, so when
Plague Star next runs the planner will list **two rows for one trip**:
`Level 15 - 25 Plague Star` at 1.14%, and `Hemocyte` at 12.91% with eleven relics,
from `planet: "Enemy drops"`, a place that does not exist.

`Hemocyte` is the only enemy in DE's entire relic table, so this is a list of
one — but a list of one that reads as a phantom destination scoring ten times
the real node beside it.

**Half-fixed:** the row carries an `Enemy` badge saying it is not a place, that four
spawn in the Plague Star final stage, and that the two rows are one trip. That stops
it lying without pretending to be finished.

**The rest, when Plague Star next runs.** Folding the enemy rows into the bounty
they ride needs a probability structure the model does not have. DE publish
`Hemocyte Relic Drop Chance: 20.00%` and then 12.91% per relic within that, and
four spawn per run — so a run is worth `4 × 0.20 = 0.8` relic rolls, not the one
roll currently assumed. Getting that right is arithmetic; getting it *checked*
needs the event live, which is the same blocker as the detection below. Do both
in the same sitting.

### Void Traces: the exchange rate that would let them be scored

The refinement model is built and the traces are shown on the row and left out of
the score, for a reason `PROJECT.md §7` records: what 100 traces are worth depends
on how many you have, and that is a fact about the player this app cannot see.

**What would settle it, if a trace count is ever collected.** Traces buy refinement,
so their value is the refinement uplift they buy on the relic you would have spent
them on next:

```
value of 100 traces  ≈  best over relics r in the plan of
                        ( value(r, Radiant) − value(r, r.chosenRefinement) )
```

That is derived from the player's own plan rather than invented, and it goes to
zero exactly when it should — when nothing in the plan wants refining. It needs
one number from the player: **are you trace-limited?** Which is the same header
slot the Mastery Rank field wants, below.

### The endless-fissure bonus is only stated on the collecting side

The bonus itself shipped as a fourth run mode (`PROJECT.md §7`). What is still owed
is where it is *said*.

It is a reward for **cracking** relics, and it currently appears only as a modifier
on *Where to go*, because that is where the run modes live. It should also be stated
on the cracking side — *given you are opening these relics anyway, is it worth
staying to rotation 5?*

The row half of this is done. The bonus is only applied to nodes carrying a
fissure now, so the marker says *+free relic* rather than *+relic if fissure*, and
it sits beside the badge that says why. What is still owed is the *cracking* side:
nothing in the relic list mentions the bonus at all, so a reader deciding what to
crack has no reason to stay.

**The scoring stays as it is.** Feeding the live fissure list into the score is the
obvious next move and is the wrong one — it would reorder the ranking hourly on a
fact that has expired by the time anyone acts on it. The flat constant is safe
precisely because it is node-independent: it cannot reorder endless nodes against
each other, so the only comparison it moves is *endless versus short*, which holds
whatever the fissure map looks like.

### A part you cannot reach still reads as one you can

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

So there is no mix to display **for those six**. Whichever of them you look at,
every reachable route is Railjack, and the badge says so.

**The mixed case is not hypothetical, though, and this entry claimed it was until
2026-08-25.** Running the shipped predicates (`notADestination`, `isRailjack`,
`isEventNode`) over every part of the 2026-08-24 build, with the two opt-in boxes
off, puts three parts in it right now — all on **Lex Prime**:

| Part | Row says | Reachable | The one that is not |
|---|---|---|---|
| `Blueprint` | 2 relics dropping | 1 | Neo V9 |
| `Barrel` | 3 relics dropping | 2 | Meso N11 |
| `Receiver` | 3 relics dropping | 2 | Axi V10 |

22 further parts are the all-blocked case already described above. The cause is
one filter disagreeing with another: the *Still needed* count at `plan.js:1243`
tests `!vaulted` alone, while the node loop at `plan.js:415-417` applies all three
of `notADestination`, `opts.railjack` and `opts.event`.

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
app would like to know about the player — Solaris United standing for the
Profit-Taker phases, the Steel Path, and the trace count the entry above wants.

The Steel Path is the interesting precedent there. It had a sidebar checkbox for
one afternoon and it was removed on measurement: every Steel Path table carrying
a relic is a Faceoff variant identical to its ordinary twin, so the option moved
the ranking by two duplicate rows and asked a question for nothing
(`PROJECT.md §7`). If a header of player facts is ever built, the Steel Path
belongs in it as a *fact* — feeding badges, not filters — rather than back in the
sidebar as an option. Same shape as this field, same reasoning.

### The Railjack opt-in gate stands in front of your only option

**What is left of *decision 9*.** That entry asked three questions and two of them
have been answered in code: the badges landed on 2026-08-14, the **seventh bucket**
shipped — `Railjack only`, six items, `assets/app.js` takes them out of `farmable`
and `index.html` gives them their own checkbox with a tooltip saying it is not the
planner's *Include Railjack* box (`PROJECT.md §7`) — and node folding shipped the
same day. Only this one is still open, so the rest has been deleted rather than
ticked.

Put one of the six on the farm list with *Include Railjack* off and the ranking is
empty. It now names the switch and counts what is behind it, which is a large
improvement on silence — but an opt-in gate in front of a thing with no alternative
is still a strange shape. Options:

- (i) leave it — the message is clear, and the checkbox means one thing
- (ii) **auto-include a Railjack node when it is the only route to something on
  your list**, badged as now, with the summary saying why it appeared despite the
  setting. Keeps the checkbox honest for everything else
- (iii) turn the checkbox into three states — off / only when it is the only
  route / always

(ii) reads best and is the smallest change: the information to do it already
exists, since `ROT.railjackOnly` answers exactly that question per item and the
collection view already calls it to build the bucket.

One caveat carried over from the cache-penalty argument, because it constrains
anything further here: **any rule that sinks caches has to leave them reachable for
people with no alternative.** Four of the six Railjack-only Primes come from
`Caches` specifically, which is the one mission type carrying a deliberate 50%
penalty (`PROJECT.md §7`). For their owners the worst rows in the list are the only
rows in the list.

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

Swept 2026-08-14, at the owner's suggestion. **Most of it was read on 2026-08-24**
and the reasoning is in `PROJECT.md §7`; what is below is what is left.

| Field | What it is | State |
|---|---|---|
| `uniqueName` | ends `…Tier<X>Table<Y>Rewards` | **read.** The letter, per tier — and the tiers disagreed |
| `standingStages[]` | its length is the stage count: 3, 4 or 5 by tier | **read.** `objectivesOf` no longer assumes four |
| `enemyLevels[]` | e.g. `[40, 60]` | **filled**, from the group's own name — all 13 bounty nodes carry levels now |
| `tag` on `/pc/events` | `HeatFissure`, `WaterFight` | **recorded when seen.** Still unobserved for our two events — see below |
| `minMR` | Minimum Mastery Rank, 0 to 10 | **carried in the payload, unused.** Needs the player's own rank, which is the header field below |
| `type` | `"Cull the Enemy"`, `"Reclaim What's Ours"` | open — a real name instead of `Level 20 - 40 Cetus Bounty` |
| `rewardPoolDrops[]` | `{item, rarity, chance, count}`, **live** | open — a cross-check against DE's static table |

**`type` is the one with a trap in it.** Our node names are the join key between
DE's drop table and the worldstate, and they are what `ROT.signature` folds on and
what `nodeKey` matches fissures against. Renaming them is not a display change. If
this is done at all it wants to be an annotation beside the name, not a
replacement — and it overlaps with *Our four invented "mission types" leak into the
ranking*, which is the same problem one level up.

Neither of the remaining two needs a new request. Both are in the response we
already cache.

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
badge**, and it would need the player's own rank — the first thing this project
would have to ask about itself rather than derive.

### The meta line is now 6.68:1, and the floor is 7:1 — what is left of decision 5

**Option (b) shipped, and this entry is what remains of it.** `.spot-meta` was
raised from `--txt-faint` to `--txt-dim`, and `--odd` was raised with it from
`#684321` to `#d29455` so the amber keeps sitting at the same brightness as the
line it annotates rather than reading as a highlight (`STYLE.md §1`). Re-measured
2026-08-24 against `--panel`:

| | Was | Now |
|---|---|---|
| `.spot-meta` | **1.98:1** | **6.68:1** |
| `.est` amber, `--odd` | 2.00:1 | **6.73:1** |
| `.spot-score` label — *relics / min* | 1.98:1 | **1.98:1**, unchanged |

So the big correction landed and two things are left, both small.

**The line is still under the floor.** `STYLE.md §3` asks for WCAG AAA, 7:1, and
6.68 is not 7. The gap is a rounding error rather than a legibility problem, so the
honest options are to nudge the two tokens the last 5% or to write the exception
into `STYLE.md` and stop calling it a debt.

**`.spot-score`'s own text was never in scope and is now the worst thing on the
row.** The gold number reads at 8.82:1 and `.spot-alt` beneath it at 6.68:1, but
the unit label between them — *relics / min*, the words that say what the biggest
number on the row actually measures — is still `--txt-faint` at 1.98:1. That is a
stronger case than the meta line ever was, because it is the label on the ranked
quantity.

Every figure above was measured on the rendered element rather than read off the
stylesheet, which is what `STYLE.md §3` requires and the reason the original
measurement was out by half. **`temp_mockup.html` argued the decision that has now
been taken and can go.**

### The node list is the top eight and a hover, not a table

`#planNodes` renders `ranked.slice(0, 8)` and folds everything after it into a
single `+N more places` chip whose tooltip lists the next twenty as plain text —
node, planet, mode, rounds and rate, one line each (`assets/plan.js`). Beyond
twenty-eight there is no way to see a place at all.

Eight is the right default and should stay: `STYLE.md §5` is emphatic that a long
list condenses to a count with the detail on hover, and the whole point of the
ranking is that the top of it is the answer. What is missing is the way *out* of
the default — somewhere to see the ranking whole when you want to plan around a
planet you can actually reach, or to check that something you expected is in there
at all.

A tooltip is the wrong container for that: it cannot be scrolled, sorted or
searched, and it is already carrying twenty rows of tabular text through a control
that exists to hold a sentence. Expanding in place — the chip becoming *show all N*
— keeps one list and one ranking, and needs no new page.

Worth doing after the sort toggle rather than before it, since a browsable list
whose order cannot be changed is half a feature.

## Settled — answered, kept so the answer is not lost

### The planner cannot say how many missions to run **[settled]**

**Deliberately parked.** Each relic row estimates the *openings* needed, but not the
missions — that would be openings divided by how often the relic drops at the chosen
node. It is a probability, not a plan: the number would be an expectation with a very
wide spread, and reading it as "this many runs" would mislead more than it helps. Low
value, kept only so nobody proposes it again without a better idea.

The node list being a top eight rather than a table used to be a sentence at the
foot of this entry, which was the wrong place for it — it is open work, not a
settled answer. It has its own entry above.

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

**Reopened in part on 2026-08-14, and that half closed on 2026-08-24.** All 13
bounty nodes had `lvl: null` and lost every level tie-break by default. They now
carry levels, read from the group's own name — `Level 40 - 60 Cetus Bounty` is a
bounty fought at 40-60, so it needs no network and works on a mirror build. The
worldstate publishes the same numbers as `enemyLevels`, which is how the two were
checked against each other.

**The Railjack half stands and is still fine.** DE's export genuinely omits
Proxima, and an unknown level sorting last is the correct behaviour — a made-up one
would silently distort the tie-break that levels exist to serve.

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

These are places where Warframe Prime Hunter knowingly disagrees with
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
- The five non-relic categories are dropped from the catalogue by us, not by the
  wiki, which lists them correctly — see `PROJECT.md §9`.
