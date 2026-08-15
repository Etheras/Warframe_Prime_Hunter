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

---

## Defects found by the documentation sweep of 2026-08-15

Four of these were introduced on 2026-08-14 by changes that were themselves right;
none was caught by the suite. They are grouped because they share one cause: a
capability landed and the sentences explaining why it was absent stayed where they
were.

### The page says it cannot see fissures, on a row showing a fissure

**The sharpest of the five, because both halves are on screen at once.** Verified
on one planner row:

| Element | Says |
|---|---|
| `.tag.fissure` badge | `Meso fissure 39m` — *"A Meso fissure is running here, closing 12:13 PM."* |
| `.est` marker, the next item along | `+relic if fissure` — *"Only if this node is a fissure — **nothing here knows that**."* |

Three places carry the old claim, all in `plan.js`:

1. the `+relic if fissure` tooltip (`"nothing here knows that"`),
2. `RUN_BLURB.bonus`, shown under *How this works* — *"Nothing here knows which
   nodes carry a fissure: they move every hour or two and **this data is refreshed
   daily**"*. The scheduler has run hourly since 2026-08-14 and the build fetches
   `/pc/fissures`,
3. the block comment above `fissureBonus` — *"because nothing here can know
   that… Fetching the live list was considered and rejected."* It was fetched, in
   the commit before.

**The decision is not in question — the reason given for it is.** Keeping fissures
out of the score is right and `PROJECT.md §7` argues it properly: a fissure lasts an
hour or two, the ranking is built from tables that move a few times a year, and a
list that reshuffles hourly on an expired fact is one you stop trusting. What the
page must say is *"we can see this and deliberately do not score it"*, not *"we
cannot see this"* — the second is false and the badge beside it proves so.

Worth noting how this survived: the commit that deleted the decisions table
identified this exact defect, rewrote the sentence in `TODO.md`, and left the
identical sentence in the product. A doc and a string can drift apart even when one
person fixes both in the same hour.

### The two pages can name different nodes for the same folded group

`pickNode(group, first)` takes the fissure test as an argument. `plan.js` passes it;
`app.js` calls `pickNode(group)` with nothing. So with a fissure live at a member
that is not the lowest-level one, the planner names that node and the collection
view names another — and since the picked node *becomes* the row, the level, planet
and demand badges differ too.

Verified against the real Gaia group with a fissure planted at Cinxia: planner
`Cinxia`, collection `Gaia`.

Both `app.js` and `PROJECT.md` claimed in as many words that the two pages **cannot**
disagree about which of a group to name. `PROJECT.md` now records the defect
instead; the comment in `app.js` still makes the claim.

Two ways out, and the first is better: pass the same predicate from `app.js`, or
drop the guarantee and say the collection view deliberately ignores the hour. The
first keeps a promise the project has made in three places.

### Choosing *Stay for the fissure bonus* leaves the collection page blank

`plan.html` offers four run modes; `index.html`'s `#f-runmode` offers three; the
setting is one shared key. Verified:

| Stored `runMode` | Collection dropdown | Ani (Survival) row |
|---|---|---|
| `reset` | "Reset as soon as it drops" | 4 rounds · 22.8% per run |
| `bonus` | **blank** — `selectedIndex: -1` | **5 rounds** · 28.9% per run |

So the collection view silently costs every endless node an extra round while its
own control shows nothing selected, and it never adds the bonus relic that fifth
round is for — that part is planner-only. Whoever touches the box next writes a
different mode back and changes the planner too.

Add the option to `index.html`. If the bonus genuinely does not belong on the
collection page, the fix is to say so on the control rather than to omit the value
it is already using.

### A Profit-Taker phase is costed at four bounty stages

`objectivesOf` returns `{count: 4, unit: "stage"}` for anything DE files under
`Bounty`, and DE files the heist there. Each phase is one activity you replay on its
own, so its rate is divided by four and it sinks accordingly. Confirmed against the
live model: `objectivesOf` → `4 stages` for `PROFIT-TAKER - PHASE 1`.

**Its own entry specified this and the entry was marked done** — *"Effort: one
objective per run"* was step 4 of four, and the other three shipped. Everything else
about the heist is right: no rotation, not on the bounty clock, `Old Mate` badge,
four independently replayable phases (`PROJECT.md §7`).

This is the same shape as the wider bug below and wants fixing with it: **`objectivesOf`
hard-codes four stages for every bounty**, while `/pc/syndicateMissions` publishes
`standingStages[]` per tier, whose length is 3, 4 or 5. Do both at once.

### Three comments describe things that no longer exist

Cheap, and each one will mislead somebody:

- `tools/schedule.ps1`, `.DESCRIPTION` — *"the fissure **strip** on the planner"*.
  The strip was replaced by per-row badges six hours before that file was last
  touched. This one is user-facing: it is what `Get-Help` prints.
- `index.html`, the materials hint — *"nothing here feeds the farm advice. Forma
  will, once the planner lands."* The planner landed, and the Forma row **is** what
  the planner reads.
- `tools/build_data.py`, above `FISSURE_TIERS` — justifies keeping `Omnia` as *"the
  most useful line of the lot"*, which was about a per-tier strip that no longer
  exists. The reason to keep Omnia now is simply that a node with an Omnia fissure
  is a node with a fissure.

---

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

Their objective counts are inherited rather than checked, which is the practical
cost of the gap.

### Several of those modes are not round-based at all

`Spy`, `Caches` and `Key` carry rotations, but the rotation does not advance per
*round* — a Spy mission has three vaults, Caches counts what you found. You collect
several tiers inside a **single mission**. We cost a three-vault Spy run as three
rounds of Defense.

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

The `Bounty` bucket is the one currently doing damage, because `objectivesOf` keys
off it — see *A Profit-Taker phase is costed at four bounty stages*.

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

Related, and on the same row: the page now carries a badge saying *this is a fissure
for 40 more minutes* and a marker saying *+relic if fissure*. A reader can join those
two; the page does not. Worth doing in the same sitting as the tooltip fix at the top
of this file, since that marker is being rewritten anyway.

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

So there is no mix to display. Whichever of the six you look at, every reachable
route is Railjack, and the badge says so. The mixed case this entry describes is
real but hypothetical — nothing in today's data is in it. Written down anyway,
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
app would like to know about the player — Solaris United standing for the
Profit-Taker phases, the Steel Path, and the trace count the entry above wants.

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

**c. Nodes that are the same choice — shipped 2026-08-14.** Folding is built and
documented in `PROJECT.md §7`; what remains of it is the divergence bug at the top
of this file. Ranking Railjack `Caches` lower than ordinary star-chart nodes was
answered separately with "yes, but lower" — the flat 50% penalty, also in
`PROJECT.md §7`.

One caveat from that argument is worth keeping here, because it constrains anything
further: **any rule that sinks caches has to leave them reachable for people with no
alternative.** Four of the six Railjack-only Primes come from `Caches` specifically.
For their owners the worst rows in the list are the only rows in the list.

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

Swept 2026-08-14, at the owner's suggestion, and it changes several entries above.
We fetch `/pc/syndicateMissions` and `/pc/events` already, use two fields, and
throw the rest away. What is in there, per bounty job:

| Field | What it is | What it would fix |
|---|---|---|
| `uniqueName` | ends `…Tier<X>Table<Y>Rewards` | **`Table<Y>` is the rotation letter, published per tier.** See the entry below — this is the whole of it |
| `standingStages[]` | its length is the **stage count**, and it varies: 3, 4 or 5 by tier | `objectivesOf` hard-codes 4 stages for every bounty. Tier A is 3, Tier D is 5 — and Profit-Taker is not a bounty at all |
| `enemyLevels[]` | e.g. `[40, 60]` | **every bounty node in our data has `lvl: null`** — 13 of them — so bounties can never win the level tie-break |
| `minMR` | **Minimum Mastery Rank**, 0 to 10 — see the caveat below | the demand badge the header field above wants |
| `type` | `"Cull the Enemy"`, `"Reclaim What's Ours"` | a real name instead of `Level 20 - 40 Cetus Bounty` |
| `rewardPoolDrops[]` | `{item, rarity, chance, count}`, **live** | a cross-check against DE's static table, which is how the letter is currently derived at all |

And on `/pc/events`, a **`tag`** field — `HeatFissure`, `WaterFight` — a stable
machine identifier instead of the keyword scan described in the entry above.

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
badge**, and it would need the player's own rank — the first thing this project
would have to ask about itself rather than derive.

### Read each bounty's rotation letter directly — the worldstate already says it

**Answered 2026-08-14; the work is what is left.** The letter does not need deriving
per tier. DE publish it in each job's `uniqueName`, and a reading of the cached
worldstate for the window ending `2026-08-12T20:25:13.214Z` matches our own
derivation exactly:

| Job | `uniqueName` tail | Our derived letter |
|---|---|---|
| Ostrons tiers A–E, Solaris tiers A–E, Entrati tiers A/B/C/E | `Tier*Table**A**Rewards` | `standard: A` (16 of 16 votes) |
| Isolation Vault chambers A, B, C | `VaultBountyTier*Table**B**Rewards` | `vault: B` (6 of 6 votes) |

Two independent methods, 22 votes, no disagreement. That settles what `Table<Y>`
means.

**And it answers the tier that never fitted.** Entrati's *Reclaim What's Ours*
(level 30–40, our `Level 30 - 40 Cambion Drift Bounty`, the tier that publishes only
rotations **AB**) came back `TierDTable**B**Rewards` — on **B**, while every other
Entrati tier in the same window was on **A**. So the tier is not inheriting the
family letter and it is not falling back to A. It runs its own letter, and DE say
which, every window.

**The work:** parse `Tier<X>Table<Y>` out of `uniqueName`, key it by the tier's
`enemyLevels` to reach our node names, and keep `derive_bounty_rotation`'s
reward-matching as the fallback for a worldstate that cannot be read. Tiers whose
rotations are indistinguishable keep the family letter as a fallback. Only Aya is
affected today, on one node, which is why this is written down rather than done.

#### The observations that would check any implementation

Three readings of the live worldstate against what the two-rotation Cambion Drift
tier was actually offering. Without the `uniqueName` reading, two explanations fit
all three — the tier falls back to A whenever the board is on C, or it runs its own
two-letter cycle that happens to line up — and they only diverge about eight hours
after the last reading.

| Bounty window ends | Board is on | That tier offered |
|---|---|---|
| 2026-08-11T21:55Z | C | its A table |
| 2026-08-12T07:55Z | A | its A table |
| 2026-08-12T10:25Z | B | its B table |

DE's table gives `Level 30 - 40 Cambion Drift Bounty` rotations A and B only;
`Level 40 - 60` and `Level 100 - 100` publish A alone and are handled correctly, one
table with nothing to wait for.

### The meta line sits at 1.97:1, not 3.48:1 — decision 5

**Corrected 2026-08-14, and it is twice as bad as this entry had claimed since
2026-08-10.** The original measurement took `--txt-faint` as `#667080` and
ignored the alpha. The token is `#66708090` — the same colour at 56% — so what
reaches the eye is a blend with the panel behind it:

| | On `--panel` | |
|---|---|---|
| `#667080`, alpha ignored | **3.48:1** | what this entry said |
| `#66708090`, as shipped | **1.97:1** | what it actually is |
| `--txt-dim` `#96a1b3` | 6.68:1 | option (b) |
| `--odd` amber `#684321` | 2.00:1 | tracks the line, so shares the problem |

Confirmed against a rendered `.spot-meta` with `getComputedStyle`, not read off
the stylesheet — which is what `STYLE.md §3` says to do, and the reason the first
measurement went wrong. **That rule now has a second half: measure the element,
not the token, because a token can carry an alpha.**

The design argument is unchanged: the line is deliberately dimmed as secondary
information, so raising it changes the hierarchy on both pages. But 1.97:1 is a
weaker position to defend than 3.48:1 was.

**Mocked up in `temp_mockup.html`** — the same real row rendered three ways, with
every ratio measured live. Options as before: (a) leave it, (b) raise the whole
line to `--txt-dim`, (c) raise only the rotation label, which is the one part of
the line that is a control rather than context — but the amber has to move with
it or stop matching (`STYLE.md §1`).

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
