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

**Swept against the code on 2026-08-26.** Every row below was checked to still be
true; the cadence row changed shape and the Mastery Rank row shipped.
Titles are given verbatim so they can be grepped — each one is a `###` heading
further down, where the reasoning lives.

**A row was added on 2026-08-26 and deleted on 2026-08-27**, in the same two days
that produced it: *The standalone runs both pages' wiring twice, and it shows*
came from the first session that ever drove the built single file in a browser
rather than reading it as text, and it named seven defects confined to `dist/`.
All seven shipped, the reasoning is in `PROJECT.md §7`, and the page tests now
open `dist/warframe-prime-hunter.html` and press its buttons — which is the part
worth keeping, because the gap was never any one of the seven.

**A row added in its place lasted a few hours**: the two pages restored a
self-contradictory backup differently from each other, found while proving that
fix. It is settled and gone too — neither page corrects such a file now, both
report it in the same words, and `PROJECT.md §7` has why the reasoning behind the
old behaviour was wrong about its own cause.

**Neither is what those two days left behind.** That is a cadence rather than a
backlog row: a security audit and a feature-usability audit, monthly, both
baselined 2026-08-27 and both next due 2026-09-27, postponed a month whenever no
commits have landed. It lives in `PROJECT.md §2` and has no entry here, because a
recurring obligation is not outstanding work — it is due on a date, and that date
is written where the rule is.

*Size* is honest rather than optimistic: **small** is a few lines and one file,
**session** is an afternoon including the test, **large** touches the pipeline, the
payload and both pages.

**This file no longer claims that nothing is wrong on screen.** It said so on
2026-08-24 and a sweep the next day found two things that were; it said so again on
2026-08-25 and the cadence sweep of 2026-08-26 found six mission types costed at a
third to a fifth of what the wiki says they cost, two of them the largest modes in
the dataset. The claim has now been wrong twice running, which is enough. **What is
true is narrower and worth stating instead:** every defect anyone has actually
identified is either fixed or has an entry below. Whether the ranking is *right*
turns on the open question in *A round is not a universal unit of effort*, and
until that is settled nobody should write the reassuring sentence again.

Four defects shipped that day and their entries are gone, with the reasoning in
`PROJECT.md §7`: both Onslaught nodes ranked at twice their true rate; 38 live
nodes costed as endless when they are not; the *Still needed* panel counting
relics the reader's own switches had turned off; and an opt-in gate standing in
front of the only route six Primes have.

That family is closed. The last of it was not a wrong number but an unreachable
one: **Spy nodes and the eleven pre-refined nodes never appeared in the rows
either page rendered**. The planner's ranking can now be expanded in place, which
puts all 92 places on screen — Elite Sanctuary Onslaught at #38, and Pago and Bode
the first Spy nodes either page has ever shown.

**Both lists can now be seen whole** — the drawer got the same treatment the same
day, so Spy nodes and the pre-refined eleven are reachable on either page.

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
| Nine rotation-bearing mission types are still unverified | **session, and start here** — the wiki half is done; what is left is one decision that re-costs 75+ live nodes |
| A run's fixed cost is not priced, so Capture wins everything | session — measured, and the largest distortion with an agreed unit |
| `RUN_OVERHEAD` is two *rewards* on a node where a reward is two zones | small — no effect today, left open on purpose |
| Our four invented "mission types" leak into the ranking | session |
| What the misses are worth, in Ducats | session |
| A concentrated farm finishes a relic sooner than a diluted one | session — needs a size chosen by hand |

**The first row is the one to take next**, and it is a decision rather than a
measurement: the sweep is finished and the numbers are in the entry. It also gates
the second — *"the largest distortion"* is only meaningful once the unit the
ranking divides by means the same thing on every row.

### Interface

| Entry | Size |
|---|---|
| One Cambion Drift tier labels a different letter from the rest of its family | small to check, unknown to fix — 16 against 1, so margin rather than a wrong answer |
| Parts, quantities and Ducats are all published first party | session — the largest remaining WFCD dependency in the data; do it after the worldstate |
| The page tests flake in a full run and pass on their own | session — cause not established; the gate before every push should not do this |
| Running the tests rebuilds `data/` underneath you | small — but mind the test ordering that depends on it |
| A backend refresh finds new fissures and the ranking does not move | session — the deliberate half of this is the hard half |
| Relics you already own are invisible to the planner, vaulted or not | session — needs a decision on input first; three shapes weighed in the entry |
| The rest of the player facts the header could hold | session — the rank itself shipped 2026-08-26 |
| The Void Trace cap past rank 30 is our extrapolation, not the wiki's | small — an unchecked number already on screen |
| A priority flag on the farm list | session |

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
| Expected openings for everything, not for the worst one — measured, and it costs traces | nothing — *are you trace-limited?* was answered at 500 on 2026-08-25; this is now ordinary work |

*Nine rotation-bearing mission types* used to sit in this table waiting on "wiki
checking; tedious, not blocked". **The wiki checking was done on 2026-08-26** and
the entry moved up to *Model and ranking*, because what it is waiting on now is the
owner, not the wiki. Seven mission types that carry no rotation confirmation at all
are still unverified and are still tedious, but they are no longer what blocks it.

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

**Both blocking questions were answered from the wiki on 2026-08-25**, and a third
was added and answered with them. The seven that remain are still unverified.

- **`Spy` — vault 1/2/3 pays rotation A/B/C.** Not the AABC cycle. The wiki's
  *Mission Rewards* page is explicit that vault *names* do not correspond to
  rotation and that what counts is how many vaults you have hacked so far; the
  *Spy* page says the same, that rotations are determined only by the number of
  vaults successfully hacked. It also files Spy under **Standard**, not Endless,
  which is the round-based-or-not split the model had been reverse-engineering.
  **This is what unblocked the cap**: on a capped three-vault run the third vault
  *is* rotation C, so Pago, Bode, Valac, Aegaeon, Amalthea and Dione keep the
  rotation they hold all their value in. The fear that capping would zero them
  came from assuming A, A, B, and it was the right fear for that assumption.
- **`Caches` — a Railjack mission pays two cache rewards, not three.** The first
  is for completing a Point of Interest and pays **rotation A**; the second is for
  hacking an Abandoned Derelict Cache and pays **rotation B**. Separate tables,
  rolled independently — not a cycle at all. Our own data agrees exactly: all 38
  live `Caches` nodes are Proxima, and the 28 rotation-bearing ones publish
  precisely A and B and nothing else.

**Both of those shipped in `d8b4484`** and this entry is no longer open on them —
`FIXED_LENGTH` in `rotation.js` carries `Spy: {count: 3, pays: [A,B,C]}` and
`Caches: {count: 2, pays: [A,B]}`. The line here used to read *"the recorded
design is wrong on the count — it says `{Caches: {count: 3}}` and it should be
2"*, and stayed after the code was corrected; it is the count that was fixed, not
the sentence. What is still open in this entry is the **cadence sweep** below.
- **The 10 un-rotated `Caches` nodes are Earth and Saturn Proxima**, which the
  wiki shows with a single undifferentiated cache table and no A/B labelling.
  Their `rot -` in our data matches. Costing them *one run* is already right and
  they need no change.
- **`Special` — Faceoff pays one each of rotation A and B at the end of a match**,
  win or lose. So it is the same fixed-length, fixed-letters shape, and it is
  **not dormant**: see the correction in the entry below.

What this changes about the design: the table needs the **letters**, not just a
count, because the letters are what rescue the six Spy nodes. Three shapes, not
two: `Spy` 3 objectives paying A,B,C; `Caches` 2 objectives paying A,B; Faceoff
one match paying A+B.

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

**The cadence sweep is done, 2026-08-26.** All eleven were read off
[`Mission Rewards`](https://wiki.warframe.com/w/Mission_Rewards), whose table gives
the reward criteria and the indices that pay each letter, and spot-checked against
the individual mission pages. What the model charges was measured with the `node:vm`
probe against the shipped `rotation.js`, not read off the source:

| Mode | Wiki reward criteria | Per reward | We charge | Live nodes |
|---|---|---|---|---|
| Defense | waves cleared — 3, 6, 9, 12 | **3** | 1 | **38** |
| Survival | minutes — 5, 10, 15, 20 | **5 min** | 1 | **37** |
| Void Cascade | retired Exolizers — 4, 8, 12, 16 | **4** | 1 | 1 |
| Void Flood | sealed Void Ruptures — 3, 6, 9, 12 | **3** | 1 | 1 |
| Void Armageddon | waves — 3, 6, 9, 12 | **3** | 1 | 1 |
| Defection | squads saved — 2, 4, 6, 8 | **2** | 1 | 3 |
| Sanctuary Onslaught | zones cleared — 2, 4, 6, 8 | 2 | **2** ✓ | 2 |
| Interception | rounds — 1, 2, 3, 4 | 1 | 1 ✓ | 16 |
| Excavation | artifacts — 1, 2, 3, 4 | 1 | 1 ✓ | 11 |
| Infested Salvage | manifests — 1, 2, 3, 4 | 1 | 1 ✓ | 1 |
| Alchemy | crucibles — 1, 2, 3, 4 | 1 | 1 ✓ | 1 |

Four of the eleven are genuinely one-for-one. Onslaught is already correct. **Six
are not**, and two of those six are the largest modes in the dataset — Defense and
Survival are 38 and 37 live nodes, more than any other.

**But the number is not the decision, and this is why it is not a one-line fix.**
The model's unit is inconsistent with itself, and the sweep is what exposed it:

- The effort tooltip in `plan.html` defines an objective as *"A Defense round, a
  Spy vault, a bounty stage"* — the thing that **pays a reward**. Under that
  reading every row above is 1 by definition, and it is **Onslaught's `PER_REWARD`
  of 2 that is wrong**, not the other six.
- The Onslaught fix took the opposite reading: it charged the **player-visible
  sub-unit**, so a six-reward run became twelve zones. Under *that* reading Defense
  is a wave, and the six rows above are under-costed by 3×, 5×, 4×, 3×, 3× and 2×.

Both cannot hold. The reason it matters is that *per objective* is a **cross-mission
ranking** — it divides by this unit to compare a Defense node with an Excavation
node — so a unit that means "3 waves" on one row and "1 dig" on the next is not a
unit. *Per minute* is unaffected once effort weights are given, which is the
existing escape hatch and an argument for how much this is worth.

**Survival will not fit either reading**: its criterion is 5 *minutes*, not a
countable objective, so it has no player-visible atom to charge. Whatever is
decided for the other five, Survival needs its own answer.

**Not fixed here, deliberately** — picking a reading re-costs 75+ live nodes and
reorders the planner, which is the owner's call, not a sweep's. The wiki half of
this entry is now closed; what is left is the decision. The seven mission types
that carry no rotation confirmation at all are still unverified and unaffected by
it.

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

**Faceoff now sits at #1 for exactly this reason, and the owner has ruled it
stays — 2026-08-25.** Correcting its length moved it from #14 to the top: a match
pays one each of rotation A and B, 22 relics at 8.33%, so 1.83 wanted relics for
one objective. It is a one-objective mission ranked against one-objective
missions, which is what Capture already is, and singling Faceoff out would be
patching the symptom on one row. **Do not special-case it.** If the fixed cost of
entering a mission is ever priced, Faceoff and Capture move together or not at
all.


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

### A Radiant node is worth 25% more, and still nobody can see it

**Shipped 2026-08-25.** The owner's ruling replaced two failed attempts at
pricing Void Traces: traces are almost always tight, the planner must never talk
anyone into a lower-efficiency crack to save them, and a node handing the relic
over Radiant simply gets a flat **25%** on its ranked figure.
`M.RADIANT_BONUS`, applied by `M.radiantMultiplier` exactly where `CACHE_PENALTY`
is applied — to `score` and `rate`, never to `perRun` or `anyRun`. The toggle is
now **on by default**, because that is the common case. `PROJECT.md §7` has the
reasoning and both dead ends.

Measured over the live build, all eleven pre-refined nodes gain exactly 25% and
climb: **ESO #41 → #33**, Profit-Taker Phase 4 #62 → #58, the Void Storms #69–75
→ #62–68.

**And it is still invisible, for the third time.** The planner shows eight rows
and twenty more in the overflow tooltip — **28 places**. ESO is at #33. So no
pre-refined node is reachable through the interface at all, under either sort,
for any wishlist tried. Three separate page tests have now been written for this
family of change and all three were deleted for having no subject on screen.

**25% cannot fix that, and no sane number can.** The eighth visible row rates
0.809 against ESO's 0.342, so surfacing it by thumb alone would need **2.37×, a
+137% bonus** — which would no longer be a nudge but a decision to put these
nodes first regardless of what they pay.

**The real obstacle was cost, not value, and the answer was not a bigger number.**
ESO pays rotation C only, and rotation C on Onslaught is twelve zones — correct
arithmetic, and why it ranks where it does. Making the ranking expandable put it
on screen at **#38 of 92** without touching the constant, which is what the
"nobody can see it" half of this entry needed. Raising the bonus further would
have been treating the symptom.

**The per-run sort no longer undoes the thumbs.** Fixed 2026-08-25. Neither the
Radiant lift nor `CACHE_PENALTY` reached `perRun`, so ranking per run put a
halved Railjack cache node exactly where it would have sat unhalved. Both now go
through one multiplier, `n.adj`, which reaches `score`, `rate` and a new
`perRunAdj` — and `perRunAdj` is the key the per-run sort orders on.
`PROJECT.md §7` has it. `n.perRun` itself stays the raw count DE's tables imply
and is what the tooltip quotes, so the row's figures are adjusted and say which
thumbs are on them, while the fact underneath is not.

### Parts, quantities and Ducats are all published first party

**Found 2026-08-27 by the endpoint sweep**, and it is the largest remaining WFCD
dependency in the data rather than a nicety. Every part of every Prime — the
component list, how many of each you need, and what Baro pays for a spare — comes
from `api.warframestat.us/items` today, in the `components` array. Digital
Extremes publish all three.

**The sweep found it by counting rather than guessing.** `api.warframe.com`
exposes exactly one thing: `/cdn/worldState.php`. There is no index, no directory
listing, and ten plausible sibling paths are all 404 — going further would be
brute-forcing somebody's server, which `PROJECT.md §2` forbids. But DE's export
index is an **enumerable** first-party surface: it lists **sixteen** manifests and
we read five. The other eleven had never been looked at.

**The chain, verified end to end:**

| Manifest | Gives | Example |
|---|---|---|
| `ExportRecipes_en.json` | `ingredients[]` with `ItemType` + **`ItemCount`**, and **`primeSellingPrice`** | Ash Prime Blueprint → Helmet ×1, Chassis ×1, Systems ×1, Orokin Cell ×1; `primeSellingPrice: 45` |
| `ExportResources_en.json` | the display name of each component | `/Lotus/Types/Recipes/WarframeRecipes/AshPrimeHelmetComponent` → **"Ash Prime Neuroptics"** |

That second row is the one that makes this tractable. The ingredient is an
internal path — `AshPrimeHelmetComponent` — and the part we show is *Neuroptics*,
which is a real rename rather than a substring. `ExportResources_en.json` closes
it with DE's own display name, so nothing has to be guessed or hand-mapped.

`ItemCount` is our `itemCount`, the figure behind *"53 parts need more than one"*.
`primeSellingPrice` is our `ducats` — the field whose comment already says it is
*"a fixed game constant… so it needs no guessing"*, which is truer of DE's own
number than of a copy.

**What this does not replace, and why the other tiers stay.** DE's export carries
no `vaulted`, `vaultDate`, `releaseDate` or `tradable` — those are editorial or
derived, and stay with WFCD and the wiki. So the precedence after this lands is
the one asked for: first party for everything DE actually publish, WFCD for the
availability metadata they do not, and the wiki for categories and its own
markers.

**Do it after the worldstate adapters, not before.** Both are the same shape of
work and the worldstate is the one with a live outage behind it. Two cautions
when it is picked up: the part-name join must be checked against all 167 rather
than spot-checked — the artwork change reported 166 of 167 on a first pass and
the miss turned out to be the probe — and `normalise_part()` exists because WFCD
and the drop tables disagree about `Chassis` versus `Chassis Blueprint`, so a
third spelling arriving from DE needs to go through the same funnel rather than
around it.

### One Cambion Drift tier labels a different letter from the rest of its family

**Found 2026-08-27**, while implementing the rotation-letter cross-check, and
left alone because it does not change today's answer and the fix is not obvious.

With the three-table gate applied, the standard family reads **16 of 17** jobs as
`C`. The one dissenter is a job at levels `[25, 30]` whose reward-table path says
`TableA`, matched to *Level 25 - 30 Cambion Drift Bounty* — a group that does
publish all three tables, so the gate does not exclude it and its label is a
genuine claim.

**The suspicion is that it is filed in the wrong family.** Its rewards read as
Isolation Vault — Ayatan Amber Star, Carnis Mandible — while the family is
decided purely by matching `group_levels`, and an Isolation Vault bounty sharing
levels with a Cambion Drift tier would land in `standard` regardless of what it
actually is. If that is right, the vault family is under-counted by one and the
standard family carries a stray.

**Why it is not urgent.** Sixteen against one is not close, the cross-check
agrees on `C`, and the vote abstains on that job entirely rather than dissenting
— so nothing shipped is wrong today. What it costs is margin: a family decided
16–1 is one upstream change away from being decided 9–8.

Worth checking against a live window rather than the cached one, since a single
reading cannot tell a misfiled job from a genuinely different phase on Deimos.
If Deimos really does run its own rotation phase, the family split is too coarse
and that is a larger and more interesting problem than a misfiled bounty.

### The page tests flake in a full run and pass on their own

**Observed twice on 2026-08-27, in consecutive full runs, on two different
tests**, each of which then passed standalone:

```
FAIL js: the licence and privacy notice is at the foot of both pages, identically
FAIL js: the collection drawer can show more than its eight best places
```

Both pass immediately afterwards when `node --test tests/test_pages.mjs` is run
on its own — the second was confirmed at 47 of 47. So the failures are not about
what the tests assert; something about running them at the end of a full suite is
different.

**The cause is not established, and the obvious guess is wrong.** The first
thought was that `test_offline_build` rewrites `data/` while pages are reading it,
but the runner walks its groups in order and one test at a time, so those never
overlap. What is left is timing: the browser group runs last, after about half a
minute of builds and subprocesses, and Playwright work that is fine on an idle
machine can miss a wait on a busy one. That is a guess too, and it should be
treated as one until somebody measures it.

**Worth fixing rather than tolerating.** This suite is the gate before every push
— `PROJECT.md §2` says so — and a gate that fails one run in a few teaches people
to re-run rather than to read, which is exactly how a real failure gets waved
through. Start by capturing which assertion inside each test fails, since both
are multi-assertion and the runner currently reports only the test name.

### Running the tests rebuilds `data/` underneath you

**Found 2026-08-27**, after it caused the same confusion twice in one session.
`test_offline_build` runs `python tools/build_data.py --offline` — twice, to
check determinism — with `cwd=ROOT`, so it writes the repository's real
`data/prime-data.js`. Every full test run therefore replaces whatever was built
there with an offline rebuild.

Nothing is lost: `data/` is generated and gitignored. What is lost is **the
truth about freshness**, and silently. An offline build reads every source from
the cache without marking anything stale — correctly, because `--offline` is a
request for exactly that — so `meta.stale` comes back `[]` and `meta.staleSince`
`null` no matter what the network is doing. Load the page after a test run and
the banner is gone, whatever the real state of the feeds.

That cost two wrong readings here on one afternoon: a build stamped `stale: []`
was taken as evidence the API was healthy, and later a rebuilt-at-07:43 payload
with no stale markers was taken as the outage having ended. It had not; the test
suite had simply run in between. Both were caught, but only by going and
checking the endpoint by hand — which is the check the banner exists to save.

**The fix is to stop it writing there**, not to remember the footgun. Build into
a temp directory and compare, the way `test_clone_and_build` already does, or
save and restore `data/` around it. Watch the ordering: `test_built_payload` and
the bundle checks read `data/` and currently benefit from it existing, so
whatever replaces this has to leave a dataset behind or run after them.

Related in spirit to the rule about `localStorage` on 8777: a test that quietly
rewrites the owner's working state is a test that will mislead somebody, and it
has.

**It is not, however, a race.** The runner walks its groups strictly in order and
one test at a time, so `test_offline_build` finishes long before the browser group
starts and nothing reads `data/` while it is being written. That explanation was
written into this entry on 2026-08-27 and deleted the same hour, once the loop in
`main()` was actually read. It is recorded here only because it is a plausible
story that survives a glance and dies on inspection — see the separate entry on
the page tests flaking, which is the real observation it was invented to explain.

### A backend refresh finds new fissures and the ranking does not move

**Asked for 2026-08-27.** `watchFissures` re-reads `data/fissures.json` every ten
minutes, on load and on `visibilitychange`, and splices the new list into the
array both pages hold. The planner repaints its fissure **badges** from that.
*Where to go* does not re-rank.

**That is currently deliberate, which is what makes this more than a one-liner.**
`PROJECT.md §7` — *"Badges only, deliberately"* — the fold uses a live fissure to
choose which of several identical nodes to name, so re-running the ranking on a
refresh would rename and reorder rows under whoever is reading them, for a reason
that expires within the hour. It is the same call as never letting a fissure into
the score.

So this is a request to revisit a decision, not to fix an oversight, and it needs
an answer to the thing that decision was protecting: **what happens to the reader
mid-read?** Options worth weighing rather than one of them being assumed —
re-rank in place and accept rows moving; re-rank but hold the order until the
reader does something; or offer it, a *"3 new fissures — update the list"* affordance
that re-ranks when pressed, which is the only one that cannot move anything under
anyone. The last is more work and is probably right.

Whatever is chosen, the collection view's *Still needed* panel reads the same
list through the same `opts` and would need the same treatment, or the two go
back to disagreeing about what is reachable — which they did once already.

### Relics you already own are invisible to the planner, vaulted or not

**Raised by the owner 2026-08-27**, immediately after the Resurgence fix, and it
is the general case that fix is one instance of.

*How to crack them* is filtered by whether a relic can be **obtained**, which
quietly assumes the reader has none. Put a vaulted Prime on the farm list and the
crack list is empty — but a player who has been going for years has a stack of
vaulted relics sitting in their inventory, and *"which of these do I crack, and
at what refinement"* is exactly the question that list answers. The relic being
unobtainable says nothing about whether you are holding one.

Prime Resurgence was the case where obtainability and ownership happened to
coincide: those relics are vaulted **and** currently buyable, so including them
was right on the obtainability test alone and shipped that day. The wider case
does not have that excuse and needs a real answer.

**The blocker is that the app does not know what relics you hold.** It tracks
Primes and parts, not relic inventory — and *Relic inventory* is **[settled]**
under this file's own heading, declined because entering a stack of relics by
hand is more work than the answer is worth. So this feature needs either that
decision revisited with a better input method, or a cheaper approximation.

Two cheaper shapes worth weighing before anything is built:

- **A switch, not an inventory.** The collection page already has a *Vaulted*
  availability filter; the planner could take the same idea — *"I have vaulted
  relics"* — and stop filtering the crack list on obtainability when it is on.
  No inventory, no data entry, and it matches how the collection view already
  lets the reader say what they are interested in.
- **Say it rather than hide it.** Keep the list filtered, but where a wanted
  Prime's relics are all vaulted, say so instead of showing nothing —
  *"3 relics, all vaulted; crack them if you have them"* — which is the same
  lesson the Resurgence fix taught, generalised. Cheapest of the three, and it
  removes the "looks broken" reading without pretending to know your inventory.

Whichever, the empty-state wording is the part to get right: an empty crack list
currently means *"cannot be obtained"* and is read as *"nothing to do"*, and
those are not the same sentence.

### The rest of the player facts the header could hold

**The Mastery Rank field itself shipped on 2026-08-26** — the reasoning is in
`PROJECT.md §7`, including the Void Trace cap it now derives. What is left of that
entry is the question it deliberately did not answer: **what else belongs in the
same slot.**

Three candidates, all the same shape — a fact about the player that feeds badges
rather than filters:

- **Solaris United standing**, for the Profit-Taker phases.
- **The Steel Path**, which is the interesting precedent. It had a sidebar
  checkbox for one afternoon and it was removed on measurement: every Steel Path
  table carrying a relic is a Faceoff variant identical to its ordinary twin, so
  the option moved the ranking by two duplicate rows and asked a question for
  nothing (`PROJECT.md §7`). If a header of player facts is built out, the Steel
  Path belongs in it as a *fact* — feeding badges, not filters — rather than back
  in the sidebar as an option.
- **The actual Void Trace balance.** The rank gives the *cap* and the planner now
  states it, but a cap is what you can hold and not what you have. The switch
  still asks the cruder question, and *Expected openings for everything* wants a
  real number.

**Not open any more:** whether an unfilled field should prompt once. It does not —
unset stays unset and says nothing, which is the default everything else in this
project takes, and the reason is stronger here than elsewhere: a guessed rank
would feed a trace cap that is simply wrong.

**Still not built, and still the point of the field:** the demand badge. The
worldstate publishes `minMR` per bounty tier and it matches the wiki exactly — MR1
at level 10–30 up to MR10 at 100–100 (see *The worldstate publishes far more than
the two fields we read*). A node could say **"asks MR5"** the same way it says
**"Railjack"**, shown only when the player's rank is below it. The rank is now on
hand to do it; nothing reads it yet.

### The Void Trace cap past rank 30 is our extrapolation, not the wiki's

Small, and shipped on screen since 2026-08-26, which is why it is written down
rather than left as a code comment.

[`Void Traces`](https://wiki.warframe.com/w/Void_Traces) gives the cap as
**`(Mastery Rank × 50) + 100`** and works two examples, MR13 = 750 and MR30 = 1600.
Both are asserted in `test_assets.mjs` against the page's own figures, so the
formula is solid **for ranks 0 to 30**.

Past 30 it is ours. The wiki's table stops at Gold Architect and says nothing about
Legendary ranks, so `traceCap` simply keeps counting — LR1 is rank 31 and reads
1650. That is the obvious continuation and it may well be right, but **nobody has
checked it**, and the number is displayed to the reader as though it were known.

Two ways it could be wrong: DE might cap storage at the MR30 value and let
Legendary ranks add nothing, or Legendary might scale on a different step. Either
would make the figure on a Legendary player's badge wrong in a way nothing here
would catch.

**What would settle it:** one Legendary player reading their own trace cap in game.
Failing that, a wiki page that states the Legendary case — worth re-checking
`Void Traces` and `Mastery Rank` on any later pass, since the absence may simply be
an unwritten section rather than a rule that does not exist.

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

### Prime Resurgence is the only non-first-party source **[settled — overturned 2026-08-27]**

**This answer was wrong and the work is open again**, above, under *The live
worldstate has a first-party route after all*. Kept here rather than deleted
because how it was wrong is the useful part.

It said: DE's own `worldState.php` returns 404 on both `content.` and
`origin.warframe.com`, so the live Resurgence rotation comes via the WarframeStat
proxy, and **"there is no first-party route to find"** — nothing to do until DE
publish one.

Both 404s were true and are still true. The conclusion drawn from them was not:
`https://api.warframe.com/cdn/worldState.php` serves the full worldstate, 127 KB,
and was doing so all along. **Two hosts failing was read as the question being
closed**, and it was written down as a settled answer, which is the form that
stops anyone looking again. Nobody had tried a third host until the owner did, on
the day the proxy went down and it mattered.

The shape to take from it: *"we tried and could not find one"* is a report about
the search, not about the world, and a `[settled]` tag on one of those is a claim
the evidence does not support. Two of the four entries under this heading are of
that kind.

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

### A third squad state for public radshares **[settled — declined]**

Raised by an outside review as *"Radiant or Intact is all a recruiting-chat squad
can agree on"*, and **declined by the owner on 2026-08-25**: the public-radshare
case is a niche this app will not model. Do not re-propose it.

The review itself misread the existing option. The box is **4-man premade** and says
so; a coordinated group can run any refinement, and it already unlocks Disruption's
rotation A, which needs the squad to under-defend conduits on a schedule.
Restricting it to Intact and Radiant would make it describe something it does not
claim to be.

What a third state *would* have modelled is narrower than it sounds — not the squad
odds, which the existing box already covers, but the loss of **refinement choice**:
a radshare gives you four rolls at a refinement that is not yours to pick. Measured
over the live set before the call was made, so the size of what is being given up
is on the record:

- Wanting **everything** from a relic: the model picks Radiant on **all 34** live
  relics, squad on or off. Forcing Radiant changes **nothing** — this is exactly
  the *"an option nobody's answer changes"* case `PROJECT.md §7` rejects.
- Wanting **one specific part**: it picks Intact on **88 of 180** combinations,
  because a common reward is likeliest Intact. There, forced Radiant costs 0.5
  openings with a premade and 2.1 without, plus 100 traces each.

So the effect is real but confined to single-part farming in public squads, and it
would add a third state to a sidebar question to say it. The trade was judged not
worth the control.

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
- **One item has no `releaseDate` and no `vaultDate`** — Kavasa Prime Collar, and
  it is the only one of the 167. Both fields come from the `warframestat.us` item
  API, which returns `null` for them, so this is an **upstream API gap and not a
  wiki one**: the wiki page has the answer and was checked on 2026-08-26.

  [`Kavasa Prime Kubrow Collar`](https://wiki.warframe.com/w/Kavasa_Prime_Kubrow_Collar)
  says it was released **alongside Trinity Prime and Dual Kamas Prime**, entered
  the vault on **29 August 2017**, and came back out between 26 May and 29
  September 2020. Both of its cohort are in our catalogue and agree exactly:
  `releaseDate` `2015-10-06` and `vaultDate` `2017-08-29` for each. So the two
  missing values are **known, and sourced** — `2015-10-06` and `2017-08-29`.

  **No local override has been added**, deliberately, because nothing today reads
  either field for this item: it is vaulted and not farmable, so `vaultSoon` —
  the only other reader — excludes it whatever the date says, and sort placement
  is handled without one (`byRelease` in `app.js` puts an undated item last, by
  rule rather than by the direction the comparison happens to run). Adding the
  override is a two-line change in `build_data.py` if the owner would rather have
  the field populated than empty; the argument against is `PROJECT.md §2`'s, that
  a hand-patched value is a thing nobody re-checks when upstream fixes it.
  **Worth revisiting if it ever becomes farmable**, because `vaultSoon` would
  then skip it silently.
