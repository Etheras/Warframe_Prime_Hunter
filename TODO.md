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

**Added 2026-09-01.** Nine entries from the independent security re-review dated
2026-08-28, each re-checked against the working tree before being written down —
they have their own section, and it sits first because security does.

**Swept the same day.** Seven entries shipped and were deleted: the four akimbo
Primes whose second sub-weapon could not be recorded, the availability filter that
hid items with a second source, the drawer that threw away the focus, the
Profit-Taker phase costed at four stages, the missing fourth run mode on the
collection page, the two pages naming different nodes for one folded group, and the
clocks that stopped dead in a background tab. The reasoning moved to `PROJECT.md`,
which is what the rule at the top of this file asks for.

---

## How to read this file

**Every open item is a `###` heading.** Grep for one, or scan the headings — that
is the index, and it is the only one.

**There used to be a summary table above each family**, one row per entry with a
size and a status. It was deleted on 2026-09-08 at the owner's direction, and the
reason is worth keeping because it took three separate incidents to see:

> A backlog with two places to say "done" will disagree with itself.

It did, repeatedly. Rows outlived their own entries by days — the wiki-permissions
test, the 404 page and `gunzip_capped` all sat "open" in a table for a week after
being fixed in the prose below. A sweep on the morning of 2026-09-08 removed
twenty such rows; **by that afternoon a fresh one had already appeared**, saying
the vault-filter switch was undecided after it had been declined and its entry
closed. The index was not failing to keep up — it was structurally unable to,
because closing an entry and closing its row are two acts and only one of them
is where the reader is looking.

So there is no index. The reasoning for anything shipped lives in `PROJECT.md §7`;
what is still open lives here, once.

**Two standing cautions, kept from that section because they are about this file
rather than about any entry.**

- **A `TODO.md` entry is not evidence.** Check it against the code before
  planning around it. Three entries have described work that had already
  shipped, and on 2026-09-08 one nearly cost a re-implementation of a working
  feature — the ranking already re-ranked on a fissure refresh, and both this
  file and the comment beside the code said it did not.
- **This file no longer claims that nothing is wrong on screen.** It said so on
  2026-08-24 and a sweep the next day found two things that were; it said so
  again on 2026-08-25 and the cadence sweep found six mission types costed at a
  third to a fifth of what the wiki says. Twice wrong is enough. What is true is
  narrower: every defect anyone has actually identified is either fixed or has an
  entry below.

### One refactor

Done on 2026-08-24 — the three slices of state moved into `shared.js` and both
drifts it had cost went with them (`PROJECT.md §7`). One residue, deliberately
left: the planner's wishlist lists only the parts you are missing, so a completed
part's button leaves the list and the counter has nowhere to wrap. Correcting a
mis-click there still means opening the item on the collection page — a property
of a worklist, not of the click, and worth deciding on its own merits.

### Citrine Prime ships unattended on 2026-09-23 — on the 24th, find what the pipeline missed

**Set by the owner on 2026-09-10.** The pipeline has never been watched meeting
a brand-new Prime, and the owner wants the first time to be unaided, so that
every flaw surfaces on its own instead of being papered over by hand. The goal
behind it: **the next Prime Access should need nobody's hand at all.** Citrine
Prime Access opens on **2026-09-23**
([DE's announcement](https://www.warframe.com/en/news/citrine-prime-access)).

**Do nothing on the 23rd.** No hand-dispatched run, no local build, no alias
added in advance. If a push lands that day for unrelated reasons, write down its
time — a push is a full build, and it blurs which mechanism delivered the items.

**What should appear, and what should not:**

| Item | Expected |
|---|---|
| Citrine Prime | Warframe |
| Steflos Prime | Primary — announced as a shotgun |
| Corufell Prime | announced only as a "heavy weapon": Melee if a heavy blade, Archgun if an arch-gun. Both are already mapped on both routes |
| Sphatika Prime Syandana, Alumeti Prime Sugatra, Prismatic Gem Prime Decoration, Spinele Prime Facial Accessory / Earpiece / Oculus | **absent** — Prime Access only, so bought rather than earned (hard rule 10), and cut by `NON_RELIC_CATEGORIES` |

**What runs unattended**, read from Task Scheduler on 2026-09-10. The first two
need this PC switched on, so record whether it was:

- *Warframe Prime Hunter data refresh*, every ten minutes: a local
  `build_data.py --if-changed`, then `gh workflow run publish.yml -f full=false`.
- *… (daily full rebuild)*, 18:07 local: `gh workflow run publish.yml -f full=true`.
- GitHub's own crons in `publish.yml`, which delivered about one tick in fifteen
  when measured — the comment in `tools/schedule.ps1` has the figures.

**Baselines, from the local build of 2026-09-10 18:02Z**, so a change on the 24th
can be attributed:

- `vaultSoon` flags the two oldest farmable releases: **Xaku Prime, Trumna Prime,
  Quassus Prime** (2024-11-13) and **Lavos Prime, Cedo Prime, Dual Zoren Prime**
  (2025-02-12). If the cadence comment beside `vaultSoon` in `build_data.py` is right — each
  Prime Access vaults the release from seven earlier — the first three go on the
  23rd.
- No item has `isNew`. Every part has an `itemCount`. Four parts have no `ducats`.
- **Plague Star also ends on the 23rd**, at 14:00Z — so rows that vanish that day
  have two possible causes. What separates them: **the event leaving changes
  nothing in the payload's items or relics at all.** DE list all three event
  bounties in their drop table year-round, so `relic_sources` keeps the Plague
  Star rows and no `farmableRelics`, `flags.farmable` or relic `sources` list
  moves. **The Ghoul Purge is the proof rather than the prediction**: it is not
  running now, and both Ghoul bounties still carry their relics in today's build.
  The whole expected delta is two things — `meta.bounties.events` **keeps** its
  `Level 55 - 65 Plague Star` key and loses `activation`, `expiry`, `tag` and
  `fee`, ending up the shape the Ghoul rows have today (it is built from
  `EVENT_BOUNTIES`, so the key cannot disappear); and the node leaves the ranked
  list unless *include event nodes* is ticked. **So an item that loses a farmable
  relic on the 24th is Citrine-day vaulting, and never the event.** For scale,
  measured 2026-09-17: 27 relics carry a Plague Star source, none exclusively —
  DE's 26 plus `Meso K8`, which reaches the node only through the Hemocyte fold.

**On the 24th, answer these — the deployed site first, because it is the one the
owner uses:**

```bash
curl -s https://etheras.github.io/Warframe_Prime_Hunter/data/prime-data.js | python -c "import json,sys;r=sys.stdin.read();d=json.loads(r[r.index('{'):r.rindex('}')+1]);[print(i['name'],i['category'],i['isNew'],bool(i.get('image')),i['farmableRelics'],[(p['name'],p['itemCount'],p.get('ducats'),p.get('plat')) for p in i['parts']]) for i in d['items'] if any(w in i['name'] for w in ('Citrine','Steflos','Corufell','Sphatika','Alumeti','Prismatic','Spinele'))]"
```

1. **Did all three arrive, in the right category, with none of the six
   accessories — and when?** `gh run list` and `data/feed-log.json` say which run
   carried them first (light or full; dispatch, cron or push) and how long after
   release.
2. **By which route?** `isNew: true` means DE's Public Export listed the item
   before the wiki page did — it is `fromExport`, in `build_data.py`. Did the wiki route take over
   later, and after how long?
3. **Are the parts right?** Names, quantities and Ducats against the wiki, and
   against the baseline above.
4. **Relics.** Are the new relics in `relics` with sources, is `farmableRelics`
   non-empty, and did the Primes vaulted that day go vaulted in the same build?
   Check against the `vaultSoon` baseline.
5. **Artwork and Platinum.** A picture, or the glyph fallback? When did `plat`
   appear? A missing `plat` is a supported state, so record the delay, not a
   defect.
6. **Local against deployed.** This machine reaches DE and the runner often does
   not — *Digital Extremes 403 the GitHub runner*, below. If the local
   `data/prime-data.json` carried them hours before the deployed one, that gap is
   the measurement.
7. **Run `python tests/test_build.py`** and record every red check. The likely
   candidates are `parts: only the items DE do not publish fall back` and the two
   `wiki coverage:` checks. Those fire if the wiki files Corufell under a section
   we do not know, or if a name needs `NAME_ALIASES`.
   **Read CI's own answer first.** Since 2026-09-11 every run ends with *Check the
   payload about to be published* — the same checks, against the payload that
   actually shipped — and it only warns until this entry has been read. Its
   `::warning::` on the runs of the 23rd is the deployed half of this question,
   and *The payload gate only warns* (below) is waiting on the answer.

**Suspected weak spots, from reading the code on 2026-09-10 — none of them seen
to fail yet:**

- **Delivery depends on DE answering the runner.** A light remote build only
  downloads when its fingerprint moves, and the fingerprint is DE's export hash
  plus the drop-table headers. If DE refuse the runner, the release may wait for
  the 18:07 full dispatch, or for the routes that do not depend on DE (the wiki
  page, WFCD's item data, the drop-table mirror) to catch up. If the lag turns
  out real, one candidate is to have the local `--if-changed` run, which does
  reach DE, dispatch `full=true` when it sees the export hash move. Not designed.
- **Parts from the drop-table fallback carry no quantity and no Ducats.**
  `catalogue.parts_from_droptables` builds `itemCount: None` with no `ducats`
  key, and `needOf` in `model.js` reads a missing quantity
  as 1, so a part that needs two would read as needing one. This only bites if
  DE's recipes and WFCD's list both miss the item.
- **A new weapon class disappears from the export route without a word.**
  `collect_prime_items` (in `official.py`) skips any `productCategory` missing
  from `PRODUCT_CATEGORY`, with no log line. Only the wiki route's category check
  would notice.
- **The Kavasa pin cannot tell "too new" from "broken".** The check `parts: only
  the items DE do not publish fall back` expects exactly `["Kavasa Prime Collar"]`,
  so a build that catches a Prime before DE's recipes arrive fails it. The owner
  chose on 2026-09-11 to exempt new Primes once the payload gate blocks; what
  "new" means is that entry's open question (*The payload gate only warns*).

**Then:** write each real flaw up as its own `###` entry, with its evidence, and
the owner decides which get fixed. Delete this entry once that is done: the
observation belongs in those entries, not here.

### The refresh task still runs every ten minutes, and `PROJECT.md §4` still argues for it

**Found 2026-09-15, preparing to clear.** Two things disagree with the 150-minute
cadence `tools/schedule.ps1` has defaulted to since 2026-09-09
(`$EveryMinutes = 150`, the bounty rotation — `PROJECT.md §7`, *The cadence is
the bounty rotation*; `README.md` says 150 too):

- **The registered task.** `Get-ScheduledTask` on this machine reads *Warframe
  Prime Hunter data refresh* as repeating every **PT10M**, from a start boundary
  of 2026-09-04T18:32. A new default reaches only a task registered after it,
  and this one predates it. So `gh run list` shows a dispatched light build
  every ten minutes — 144 a day where the default makes 9.6, each a local build
  asking DE and a CI build asking WFCD — and the deployed `data/feed-log.json`
  held 105 light builds in the 24 hours to 2026-09-15T19:22Z.
- **`PROJECT.md §4`**, *Install the ten-minute task*, still says the task runs
  `--if-changed` "every ten minutes", and keeps a *Why ten minutes* argument
  whose one reason, the fissure badges, `§7` records as expired on 2026-09-08.

**Leave the task alone until the Citrine test has been read on the 24th** — that
entry lists the ten-minute task among what runs unattended, so changing the
cadence first changes the experiment. Then it is the owner's call which side
moves: re-register at the default and rewrite `§4`, or keep ten minutes and say
so in `§7`.

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

## Security — the re-review of 2026-08-28

**The second independent security review of this project**, against commit
`16ee027` and compared against the commit the first one read. It found **no
Critical and no High**; both Highs from the first review were re-tested and
found fixed — the remote artwork filename that could escape `assets/img`, and
the stored DOM XSS through numeric fields with no CSP behind it. It filed five
Medium and four Low, none an observed compromise: the software supply chain,
resource limits, LAN mode, and two sentences that described the app
inaccurately.

**All nine are closed.** Each has shipped, or been examined and declined or
accepted, and `PROJECT.md §7` has the reasoning — the framing finding, for one,
is *accepted rather than unnoticed*. The one entry left below is kept for a
different reason: it has been filed twice, and a third review will file it
again.

### A backup import will read a file of any size **[settled — declined 2026-08-26]**

**Not open. Do not re-file it.** This is `L-09` from the first review, filed
again as `L-03` by the second, and the owner examined and declined it on
2026-08-26. The reasoning is in `PROJECT.md §7` under *Two security findings
examined and declined*, and it is worth reading rather than re-deriving: there
is no adversary in it, both import handlers already wrap `parseBackup` in
`try`/`catch`, every loop in the parser is linear so a hostile file buys nothing
a merely large one does not, and **the file picker is not a distinct surface**
— the same text pastes straight into `#dataArea` with no file at all, so a cap
on the picker would not remove the behaviour described.

The second review adds nothing the decline did not already answer. It repeats
the same evidence (`assets/shared.js` around the `FileReader`, `model.js`'s
parser), reaches the same severity, and suggests the same 5 MiB ceiling.

**It is kept here, rather than deleted, precisely because it has now been filed
twice.** A third review will file it again. The entry costs a paragraph and
saves the next reader the work of re-deciding it.

The one thing that came out of looking properly the first time was a *different*
gap — `filters` and `sort` adopted from a backup without validation. **Both
halves have now shipped and the entry is gone**, which is what the heading that
stood here was pointing at: it had a title, a rotted pointer sentence above it,
and no body at all, so a reader was sent to nothing.

Measured 2026-09-05 before deciding what belonged under it. The `filters` half
shipped on 2026-09-01 (`takeFilters` in `model.js`, typed key by key, pinned by
four tests). **The half that had not shipped was the planner's `sort`**, and it
was worse than "not validated": `SORTS[opts.sort] || SORTS.rate` is a bare read
on an object literal, so `sort: "constructor"` returned the `Object`
constructor and `scoreBlock` threw on `by.unit` — *Where to go* rendered
**empty**, not mis-ordered. The collection page had fixed the identical shape
the same day with `hasOwnProperty` and this file kept the bare read. Both are
guarded now and a page test carries three keys through a reload.
`PROJECT.md §7` has the reasoning.

---

## Findings of 2026-09-04

### Does a missed daily task really run on the next boot?

**Open, and it is a falsification test rather than work.** The whole
machine-is-off case for the daily full rebuild rests on Task Scheduler's
`-StartWhenAvailable`, which is set. What could be measured on 2026-09-05 was
measured and is in `PROJECT.md §7`: the setting does nothing for missed
*repetitions* (two twenty-minute gaps in `data/feed-log.json` prove it), and a
missed occurrence is **not** backfilled at registration (a probe registering a
daily trigger thirty minutes in the past waited fourteen minutes, never ran, and
put `NextRunTime` a day out). That second result **cuts against the fallback**:
`StartWhenAvailable` is not a blanket "run anything you missed". It is a
different scenario — a brand-new task has no last-run time for Task Scheduler to
judge a miss against, where a task that ran yesterday and was off through today
does — but it is a reason to actually check rather than assume.

**The power-off case itself was not reproduced and is documented rather than
measured.** The Task Scheduler service cannot be stopped to simulate it, this
machine had been up for twenty hours so nothing had been missed, and the
`Microsoft-Windows-TaskScheduler/Operational` log is disabled by default so
there is no history. A promising built-in task that looked like it had recovered
a missed noon run nine minutes after boot turned out to be **a mis-join between
two tasks sharing a name**.

**The test, and it costs one command.** The first morning the machine has been
off through 18:07:

```powershell
Get-ScheduledTaskInfo -TaskName 'Warframe Prime Hunter data refresh (daily full rebuild)'
```

`LastRunTime` shortly after that boot means the fallback works and this entry is
closed. `LastRunTime` on the previous day means it does not, the site went a day
without re-reading the wiki, and the honest sentence in `README.md` about `cron`
— *a missed day is simply missed* — applies to Windows too. **Size: nil** — read
one field. Do not close this from documentation; that is what put it here.

## Brought in by two outside reviews, 2026-08-24

### The availability precedence, and what reordering it would actually cost

Today: `founder → resurgence → farmable → baro → special → vaulted`
(`BUCKET_ORDER` in `assets/model.js`, argued in `PROJECT.md §7`, pinned by a test
in `tests/test_model.mjs`).

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
effort is collected per reward and the default costs by reward count
(`PROJECT.md §7`) — and what is left is not a modelling gap but an ordinary
unknown.

### `Skirmish`'s cadence is the last one still assumed, and only a run settles it

**Retitled 2026-09-16, because the old heading — *Seven rotation-bearing mission
types are still unverified* — outlived the work by a fortnight and read as open.**
Six of the seven are closed: `Legacyte Harvest` is verified on the wiki, `Rush`
shipped as a fix in `b60b219`, `Key` and `Special` turned out not to be mission
types at all and moved to *Our four invented "mission types" leak into the
ranking*, and `The Circuit` and `The Perita Rebellion` have entries of their own
below. **What is left is `Skirmish`, and only its cadence** — which of its nodes
pay on what cycle. No source states it: DE's tables list what each rotation
contains and never how often it comes round, and the wiki documents no Railjack
reward rotations at all. **Ten minutes in game settles it and nothing else will**
— complete a Proxima Skirmish and count the reward screens. The history below is
kept because the three node shapes it measured are the reason a plain reading of
the wiki is not enough.

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

**The unit question this exposed was settled on 2026-08-27 and is closed.** The
model was holding two readings at once — the effort tooltip called an objective
*"A Defense round, a Spy vault, a bounty stage"*, the thing that pays a reward,
while `PER_REWARD` charged Onslaught the player-visible sub-unit. The owner chose
**one reward draw, on every row**: the six rows above are therefore right as they
stand, `PER_REWARD` is emptied, and Onslaught comes back to its reward count —
Elite Sanctuary Onslaught moved #38 → #14. The unit is called *per reward* on
screen now. `PROJECT.md §7` has the reasoning, the rejected reading and why
Survival's five minutes made it unworkable.

**Checked against Digital Extremes' own drop tables on 2026-09-02, and the list
is now five rather than seven.** Read from `.cache/official_droptables.gz` — the
document the build actually parses — rather than from the wiki.

**Use the drop tables for this question, not the wiki.** The owner's correction,
and it cost a wrong finding to learn: the wiki describes The Circuit as
tier-based with no rotation cycle, while DE's own table publishes explicit
A/B/C rotations for that node. Both are true of different things — the in-game
progression really is tier-based, and DE structure the reward *tables* by
rotation anyway. The tables are what we parse, so the tables are what govern.

| Type | In DE's `Missions:` section | What that settles |
|---|---|---|
| `Key` | **0 nodes** | not a mission type — comes from `keyRewards.json` |
| `Special` | **0 nodes** | not a mission type — comes from `transientRewards.json` |
| `Skirmish` | 40 nodes: **24 with no rotation**, 16 with A,B,C | most of it is flat, and flat is already handled |
| `Legacyte Harvest` | 1 node, A,B,C — relics in all three | AABC not contradicted |
| `Rush` | 2 nodes, A,B,C — relics **only in C** | AABC not contradicted |
| `The Circuit` | 1 node, A,B,C — A pays credits and endo, B and C hold the relics | AABC not contradicted |
| `The Perita Rebellion` | 4 nodes, A,B,C — relics **only in A** | AABC not contradicted |

**Two of the seven were never mission types**, which is the finding worth
keeping: `Key` and `Special` have no nodes in the Missions section at all,
because they are read from different files entirely. Asking what rotation cycle
they follow is a category error, and it belongs to *Our four invented "mission
types" leak into the ranking* rather than here.

**Of the five that remain, DE's tables contradict none.** Every rotation-bearing
one publishes A, B and C, so the negative check passes everywhere. **What the
tables cannot settle is the cadence** — how many rounds until B — because they
list what each rotation contains and never how often it comes round. That is
the whole of what is still assumed, and it is structural rather than a gap
somebody forgot to close.

**And 24 of 40 `Skirmish` nodes publish no rotation at all**, which this entry
never noticed while calling Skirmish an AABC assumption. Those take `runValue`'s
flat path — one reward, no cycle — and are already correct. Only the 16
rotation-bearing ones are assuming anything.

**Then the wiki was read for the cadence the tables cannot state**, 2026-09-02,
which is the half of the question drop tables are structurally unable to answer.
Five types, five different outcomes:

| Type | What the wiki says | Standing |
|---|---|---|
| `Legacyte Harvest` | *"The order of the rotations is AABC"*, rewards offered every capture, endless | **verified** — no longer an assumption |
| `Rush` | a single-completion race paying **one** reward: 1/2/3 transports destroyed gives rotation A/B/C | **was a defect, shipped in `b60b219`** — `FIXED_LENGTH` charges it one run paying C; `PROJECT.md §7`, *`Rush` pays once* |
| `Skirmish` | the Railjack page documents no reward rotations at all; the *Empyrean* page says a completion grants **one major reward** | still unverified on cadence, but the evidence now points at fixed-length rather than AABC — see below |
| `The Circuit` | tier-based with weekly caps and no rotation cycle — while DE's table publishes A/B/C for the same node | **the two sources disagree**; see the note below |
| `The Perita Rebellion` | not endless, a 12-minute timer; rotation A every 3 Orders, B every Order, C on completion | structure differs from AABC, effect unmeasured |

**So one is verified, one was a defect and is now fixed, one is undocumented, and
two have sources that disagree.** Worth knowing before the next pass: reading five
wiki pages produced one confirmation and one bug, which is a better yield than this
entry had assumed when it called the work "tedious rather than hard".

#### Skirmish, looked at again 2026-09-05 — and the shapes are the news

The owner's reading was that the wiki settles this: the locations table names a
drop table per node and the rewards fold by planet, so *"seems clear cut to me"*.
**That is right about which table applies and does not reach the cadence**, which
is the only thing still assumed. Two pages read:

- `wiki.warframe.com/w/Railjack` — no rotations, no locations table, no rewards
  section at all. Not where any of it lives.
- `wiki.warframe.com/w/Empyrean` — rewards are listed per node, and the **only**
  mention of a rotation letter is for caches: *"Boarding these structures and then
  hacking a marked terminal will produce a 'Cache' (rotation B for Corpus Proxima
  nodes)"*, which is the `Caches` mode we already model separately at A then B.

**The one sentence that does bear on it** is about the mission rather than the
caches: *"Completing the mission's main objective (or one rotation of it, in case
of endless missions) grants a major reward."* Read plainly that is **one reward
per completion** for a Skirmish, which points at fixed-length rather than an AABC
cycle — the `Spy` and `Caches` shape, not the Defense shape.

**What stops that being enough is our own data.** The 16 rotation-bearing nodes
are not one shape but three, measured off the payload:

| shape | nodes |
|---|---:|
| A, B and C | 8 |
| A and B | 4 |
| **B only** | 4 |

A node whose relics sit **only in rotation B** is hard to explain under any cycle
that starts at A, and it is equally hard to explain under "one major reward per
completion". Until those three shapes have a story, changing the model would be
swapping one assumption for a better-dressed one. **What would settle it is a
run**: complete a Proxima Skirmish and count the reward screens. Ten minutes in
game against a wiki that does not say.

**And 22 of the 38 nodes are already right** whatever the answer — they publish no
rotation, take `runValue`'s flat path, and are not waiting on this.

### `The Perita Rebellion` is a time box, and the model has no clock for it

**Tried, measured and reverted on 2026-09-02.** Written down because the obvious
fix is wrong in a way that only shows up once it is built, and the next reader
will otherwise reach for it exactly as this session did.

**Asked by the owner 2026-09-05 — *"it seems pretty well documented, what is
holding us back?"* — and the answer is that documentation is not what is
missing.** The wiki describes the structure completely; what it explicitly
declines to give is the one number the model needs. A run pays rotation A **every
3 Orders until a 12-minute clock stops**, so the number of A draws is a function
of how fast the player is, and the wiki says there is no typical or maximum
count. `FIXED_LENGTH` takes a count, not a rate. Modelling it as "just another
`special` non-AABC" is exactly the one-letter cycle measured below, which
**halves the default case** — 2 A draws to 1 — because `reset` means *run to the
last round that pays* and with a cycle of 1 that is round one. The blocker is a
missing number that the mission structurally does not have, not a missing page.

**What it actually is.** A 12-minute mission, not endless and not fixed-length:
*"Players are given 12 minutes to complete as many objectives, called Orders, as
they can before facing down the boss enemy."* Every 3 Orders pays rotation A,
every Order pays rotation B, finishing pays rotation C — and DE's tables put
**relics only in rotation A**. So a run yields as many A draws as the player is
fast enough to earn, and the wiki declines to give a typical or maximum count.

**Why AABC is wrong here.** It does not merely mislabel rounds: it makes rotation
A *run out*. Rounds 1 and 2 pay A, then the cycle turns to B and C, so `reset`
stops at two draws believing no more are reachable. In the mission they keep
coming every three Orders until the clock stops.

**Why the obvious fix is worse.** A one-letter cycle —
`{ plan: () => "A", cycle: 1 }`, the shape Disruption's *holding rotation B*
plan already uses — was built and measured:

| | before | with the one-letter cycle |
|---|---|---|
| randoms (the default) | 2 rounds, **2** A draws | 1 round, **1** A draw |
| 4-man premade | 6 rounds, 4 A draws | 6 rounds, 6 A draws |

`reset` means *run to the last round that pays*, and with a cycle of 1 that is
round 1 — so the default case halves. The premade case improves and the common
case regresses, which is a bad trade and not a close one.

**What it would actually need.** A count of A draws per run, which is a function
of player speed inside a fixed clock. `FIXED_LENGTH` wants exactly that number
and nobody has it: the wiki says there is none, and inventing one is what
`PROJECT.md §2` calls picking a number the mission cannot have. The honest model
is closer to *"one run, N draws, where N is effort"* — which is the effort-weight
machinery rather than the rotation machinery, and no mission currently uses it
that way.

**So it stays as it is**, mislabelled but not visibly wrong: 4 nodes, 2 rounds,
2 A draws. The error is in what the rounds are *called*, and the count it lands
on is plausible. Left alone deliberately, not overlooked.

### `The Circuit` may be two different modes wearing one name

**Half settled in game by the owner, 2026-09-05:** *"Normal `The Circuit` doesn't
appear to have a rotation that drops endo, relics, or anything. Only the weekly
caps. Observed in-game. Haven't run Steel Path `The Circuit` yet."*

So the wiki is right about the normal node and **DE's table is publishing a
rotation the mission does not run** — which is the first time a first-party table
has been contradicted by observation rather than by another document, and worth
saying plainly because this project's default is that DE's tables win.

**What that leaves.** Steel Path Circuit is unrun, and it is the half that could
still carry a rotation — the two are separate progressions with separate reward
tables. Our data has **one** Circuit node with rotations and a live relic, so
whichever it is, it is one node. Until Steel Path is checked, the honest state is
*normal Circuit contradicted, Steel Path unknown*, and nothing should change on
one observation covering half the case.

The original framing, kept because the disagreement is the entry: the wiki calls
The Circuit tier-based with weekly-capped rewards and no rotation cycle; DE's
`Missions:` table publishes a `Duviri/The Circuit (The Circuit)` node with explicit
rotations A, B and C, where A pays credits and endo and B and C each hold the
same seven Lith relics.

Both descriptions are sourced and they do not fit together. **The owner's
reading is that these are two different game modes sharing a name** — which
would explain it completely, and is the kind of thing only a player can confirm.
Until then nothing here should be changed on the strength of either source.

Worth recording so the next reader does not repeat it: a session read the wiki
first, concluded The Circuit "never pays rotation A", and filed a defect. It
does pay rotation A — credits and endo, no relics — and a round paying something
unwanted is ordinary rather than broken. **The drop tables are what the build
parses, so the drop tables are what govern**; the wiki describes the game, and
for this node the two are describing different things.

There is also a third table, `Duviri Circuit`, under **Dynamic Location
Rewards** rather than Missions — Yao Shrub, Dracroot, Kovnik and other Duviri
resources, and no relics whatever. It is not what the build reads and should not
be mistaken for it.

**No code change came out of the table sweep**, which was the honest result
there. The wiki sweep found one, `Rush` above, and it shipped in `b60b219`.

### Our four invented "mission types" leak into the ranking

`Bounty`, `Key`, `Special` and `Enemy` are ours, not DE's — one bucket per
droptable section (`official.py`). DE's own mission type is the parenthesised
word in `Planet/Node (Type)`, and the wiki lists 35 of them; ours match 24.

**Confirmed from the drop tables on 2026-09-02, rather than inferred.** Parsing
DE's `Missions:` section gives 384 nodes, and **`Key` and `Special` have zero
nodes among them** — they are read from `keyRewards.json` and
`transientRewards.json`, which are separate files with no `(Type)` in them at
all. So these are not mission types DE publish under a different name; there is
no DE row behind them to disagree with. That is the strongest form this entry's
claim can take, and it also removed two names from *`Skirmish`'s cadence is the
last one still assumed*, where asking their rotation cycle turned out to be a
category error.

That matters because the planner presents all of them as places to go:

- **`Enemy`** is not a destination. It is an enemy that drops relics wherever it
  spawns — the Hemocyte, the only one. **Resolved 2026-09-15**: the build folds
  it into Advanced Plague Star (`fold_event_enemies`), so a normal build ships no
  `Enemy` row at all.
- **`Key`** is not a mission type. It is an extra key-gated objective attached to
  an existing mission, and nobody runs one exclusively for it. **Measured
  2026-09-15**: all 240 live-relic `Key` rows are quest missions, tagged `quest`
  and never ranked — so today it leaks nowhere, by the data rather than by design.
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

**Checked through on 2026-09-02, and every consequence named above is already
handled.** The entry is an architecture complaint whose symptoms have each been
answered separately, which is worth stating plainly because it reads like a list
of live defects and is not one:

| Claim | Standing |
|---|---|
| `Enemy` is not a destination | handled — it carries a badge saying so, keyed on `kind` |
| `Key` is not a mission type, and nobody runs one for its own sake | handled — **all 240 `Key` sources carry `access: "quest"`**, so `notADestination` excludes them and they never rank |
| `Special` is a bag of Void Storms, Faceoff and Duviri | handled — Faceoff has a `FIXED_LENGTH` entry, and Void Storms publish no rotation so they never reach it |
| `Bounty` carries two units | handled by `isHeist`, and **there is no better signal to key on** |

**The `isHeist` regex is not a plaster over a missing field — the field does not
exist.** DE file the phases as ordinary bounty groups named
`Level 40 - 60 PROFIT-TAKER - PHASE 1`, checked against their tables. The name is
the only thing distinguishing a heist from a bounty in the source, so matching on
it is reading the signal DE provide rather than guessing at one. Anyone planning
to "do this properly" should know that first.

**What was actually missing was anything holding those four facts in place**, and
that shipped: `test_our_invented_buckets_each_still_behave_as_one_thing` asserts
each of them. Every one would otherwise fail *silently in the ranking* — a `Key`
row without `access` would rank as a destination carrying 22 relics, and a
renamed heist would go back to four stages a phase.

**So what is left is the architecture and nothing else**: the bucket names are
ours, `objectivesOf` keys off them, and a future member that behaves differently
would be mis-costed until somebody noticed. That is a real risk and not an urgent
one, and it is now a guarded risk rather than an unguarded one.

### Digital Extremes 403 the GitHub runner, so the deployed worldstate goes stale

**Measured 2026-09-01, at the owner's question — "has DE succeeded at some point
today, and should the refresh run at a specific time?"** Eighteen builds sampled
from the CI logs, ten pushes and eight of the ten-minute scheduled runs, spread
across the whole clock. **One reached DE.**

| Time (UTC) | Feeds came from |
|---|---|
| 18:49 | **worldstate** — DE, all three feeds |
| 18:32, 18:03, 17:48, 17:32, 15:26, 15:24, 15:07, 13:53, 13:52 | proxy |
| 09:58, 09:17, 09:04, 07:38, 05:23, 01:36, 00:18, 20:56 | proxy |

**So the answer to "a specific time" is no, and the data says why.** The single
success sits *between* two failures seventeen minutes either side, and the
failures cover every part of the clock from 00:18 to 20:56. There is no window.
That fits the documented cause exactly — Akamai refuses an address *range*, so
what decides it is which runner IP the job happens to draw, not when it asks. A
cron time cannot choose an IP. **And do not reach for retries**: the entry below
already records that this is a refusal rather than a hiccup.

**Found 2026-08-27, from the banner on the deployed site**, which the owner asked
about:

> **Live data is an older copy.** Some live data could not be refreshed, so it is
> from a copy made 78 minutes ago.

**The banner is right, and nothing here is broken.** It is reporting a real
refresh failure and reporting it accurately, which is what it is for. From the CI
log of the successful build:

```
~ de_worldstate: refresh failed (HTTP Error 403: Forbidden) - reusing the cached copy (69 min old)
```

So the deployed site is serving a worldstate copy that was already 69 minutes old
when the build ran, and the reader saw it nine minutes after that. Everything else
refreshed: the item database, the export manifests, the drop tables and the wiki
page all came down in the same run.

**It is intermittent, not permanent**, and the evidence is in the failure itself:
the cache it fell back on was 69 minutes old, so the build 69 minutes earlier
*did* fetch successfully from the same runner. Something rejects some requests and
not others.

**Why, researched 2026-08-28 rather than guessed.** `api.warframe.com` sits
behind **Akamai**, and Akamai's edge blocks datacentre and VPN address ranges. A
[DigitalOcean community
report](https://www.digitalocean.com/community/questions/403-forbidden-access-denied-please-help-warframe-blocking-digitalocean-or-vice-versa)
of the same symptom carries the giveaway header:

```
HTTP/1.1 403 Forbidden
Server: AkamaiGHost
```

GitHub's runners are Azure datacentre IPs, which is the same category. Two more
observations fit and neither was arranged: the same request succeeds from the
owner's residential connection, and an attempt to read
`forums.warframe.com` from this session's own cloud IP was **also** 403ed while
researching this. It is the network path being refused, not the request.

**That is also why it is intermittent.** Akamai's rules are applied per edge PoP
and per address, so one runner draws an IP that passes and the next does not.
Nothing about our request changes between builds.

**Two things follow, and the first corrects a claim in our own docs.**

*`PROJECT.md §8` item 7 says wiki images "return HTTP 403 to anything that isn't a
real browser session".* The **403 was observed**; *"isn't a real browser session"*
is an interpretation laid on top of it, and today's evidence points elsewhere — at
the edge refusing an address range rather than at anything sniffing the request.
That distinction is not academic: if it were user-agent detection, a different UA
would fix it, and **it will not**. Changing the origin might. The observation
stands; the explanation attached to it should be treated as unproven.

*Probing for other endpoints is not an option, and is already settled.* `§2` and
the endpoint sweep both say so: `api.warframe.com` exposes exactly one path, ten
plausible siblings were checked and 404, and going further is brute-forcing
somebody's server. A 403 from an edge appliance is a refusal, and the answer to a
refusal is not more requests. **Do not add retries** — every request is somebody
else's bandwidth (`§2`), and retrying an Akamai block just spends it.

**The real defect is ours, and it is not the 403.** All three WFCD fallbacks —
`vault_trader`, the bounty boards, the fissures — fire only when the worldstate
yields **nothing usable**. A stale cached copy is "usable", so on this build the
403 was absorbed by the cache and **no fallback ran**: the site published
69-minute-old fissures while a fresh copy of the same document sat unused at the
proxy. The log even reads *"19 fissures from Digital Extremes"*, which was true of
the copy and not of the hour. Fissures last a couple of hours, so this is the feed
where an hour of staleness costs the most.

**Our half is fixed, 2026-08-28.** The owner's ruling: **Digital Extremes, then
WFCD, then the stale copy — always, in that order, not conditional.** A reused
copy is no longer treated as a first-party answer, so a 403 now falls through to
the proxy instead of being absorbed by the cache, and the banner reports what
reached the payload rather than what `fetch` had to try. `from_chain` in
`build_data.py` holds the order in one place and a test asserts it;
`PROJECT.md §7` has the reasoning.

**Verified on the runner, which is the only place it can be.** The owner's point,
and it was right: every earlier check was an offline build on a machine DE answer
normally, which is no evidence at all about CI. Two consecutive builds on
2026-08-27 each met a real 403 and each fell through cleanly — both detectors
firing independently, all three feeds served by WFCD — and the deployed
`prime-data.js` reports `"stale": []` with `"feeds"` naming the proxy. The
symptom the owner saw is gone from the live site.

**So the defect is closed and the condition is not.** Two things follow that were
not visible before, and they are why this entry stays open.

- **The 403 is frequent, not occasional.** Two builds out of two, ten minutes
  apart. The earlier guess of "intermittent" came from a single log line and a
  69-minute-old cache; the truth is closer to "usually". **On CI the first-party
  path is mostly aspirational and WFCD is doing the real work.**
- **Which means the deployed site's live feeds now depend on WFCD being up.**
  That is a genuine shift and it is not free: all four WFCD endpoints were 404
  for three days from 2026-08-24, which is the outage that prompted moving to DE
  in the first place. The chain would have fallen to `cache` throughout — correct
  behaviour, correctly reported, and still an hour-old fissure list. First party
  first is right; first party *unavailable* is now the normal case on CI.

**What is left, in order of what it would buy:**

- **Whether to ask DE.** Their forums are the documented channel, and an
  allowlisted runner is the only thing that would restore the first-party path
  from CI. It is not a nicety, measured from the deployed `data/feed-log.json`:
  DE answered **11 of 181** builds on 2026-09-09, and on 2026-09-15 — light
  builds no longer asking — **1 of 5** full builds, the other four falling
  through to the proxy. That window's four `offline` rows are the test leak
  fixed that day, not builds.
- **Whether the local scheduled refresh has been masking it.** `schedule.ps1`
  runs where the fetch works. Worth knowing how much of the published freshness
  has been coming from there rather than from CI.

**Do not add retries**, whatever else is decided. A 403 from an edge appliance is
a refusal rather than a hiccup, and `PROJECT.md §2` is explicit that every request
is somebody else's bandwidth. Retrying an address-range block just spends it.

**And do not re-propose moving the fetch — that was costed and declined on
2026-09-16 [settled].** Relaying the worldstate from the owner's machine, and
letting that machine publish the site, were both worked out in detail and both
turned down: they commit data to the repository and put a desktop on the
critical path for a site meant to build itself. `PROJECT.md §7` has the full
reasoning and the measurements behind it, including the finish of the
alternative-host search — **there is no second host for the worldstate**, so
there is no URL-level fix left to find.

**What is still open is this entry's own subject**: the published site's live
feeds come from the proxy on ~94% of builds and the stale-data banner says so.
The agreed direction is to close each first-party-only gap on its own terms
rather than the delivery, which `EVENT_FEES` now does for the event-bounty fee.

**And that list is now known to be finished [settled 2026-09-16].** "Which other
fields does only DE publish" was the open question here, and it was answered by
diffing a fully proxied payload against a first-party one built the same day:
**the bounty fee was the only structural difference.** Everything else — the
event `tag` included, which a comment had wrongly called first-party-only —
arrives on both routes. So there is no second gap of this shape waiting to be
found, and the remaining cost of the 403 is **freshness, not missing fields**:
a proxied build says the same things, from a copy of the world that is minutes
rather than seconds old. Re-run that diff if DE add a field; do not re-derive it
from reading the parsers, which is how the wrong answer was reached the first
time.

### The page tests flake in a full run and pass on their own

**Observed twice on 2026-08-27, in consecutive full runs, on two different
tests**, each of which then passed standalone:

```
FAIL js: the licence and privacy notice is at the foot of both pages, identically
FAIL js: the collection drawer can show more than its eight best places
```

**A third on 2026-09-04, and this one named a cause the others did not:**

```
FAIL js: the search sits at the centre of the bar, whatever is beside it
  page.goto: net::ERR_NO_BUFFER_SPACE at http://127.0.0.1:55152/index.html
```

**A fourth on 2026-09-16**, in a `node --test tests/test_pages.mjs` run of its
own rather than inside the full suite — which is the first time the pattern this
entry is named after has not held:

```
FAIL js: the collection view names the node that is a fissure, as the planner does
```

It then passed twice: alone, and in a full pages run of 84. Worth two notes for
whoever measures this. The suite had **just grown by one page test**, which was
read at the time as fitting the resource explanation rather than the timing one —
more page loads in the same run, nothing changed about that test. The
measurement below weakens that reading: the suite grew by two more tests the same
day and still peaks at 4% of the port range. And it is a **fissure** test, so before
calling it this flake, rule out the other one: a test planting a fissure on only
one of the two sources fails exactly when `data/fissures.json` happens to hold a
live fissure that is not the planted one, and reads identically to this. That
file is rewritten every ten minutes by the refresh task on this machine.

Passed on the next full run, 602 of 602. `ERR_NO_BUFFER_SPACE` is the OS refusing
a socket, not a missed wait — it is **ephemeral port or non-paged pool
exhaustion on Windows**, which is what a long session of builds, subprocesses and
short-lived servers produces. That is consistent with "the browser group runs
last, after half a minute of everything else" without being the timing guess
below, and it is the first evidence pointing at a resource rather than at
Playwright. It happened in a session that had also run the suite half a dozen
times and driven a preview server, so the machine was unusually far through its
port range.

**Measured 2026-09-16, and the port half of that does not hold.** Sampling
`Get-NetTCPConnection` every 400 ms across a full `node --test
tests/test_pages.mjs`:

| | loopback sockets at peak |
|---|---|
| one pages run (85 tests) | **663**, of which 647 `TIME_WAIT` |
| three runs back to back | **971** |

This machine's range is the Windows default — `netsh int ipv4 show dynamicport
tcp` gives 49152 + 16384 ports, with `TcpTimedWaitDelay` unset, so 120 s. That
puts one run at **4% of the range** and three stacked runs at **6%**. Sockets do
accumulate across runs, which the second row confirms, but "unusually far through
its port range" is not something this suite does to itself — it would take
roughly fifty consecutive runs inside one `TIME_WAIT` window.

**And it did not reproduce**: three consecutive runs, 255 tests, zero failures.

So the **ephemeral-port** explanation is ruled out at this scale and should not
be chased again. The **non-paged pool** half of the same sentence is untested and
is what remains of the resource reading, along with anything outside the suite
holding sockets — a preview server, a browser pane, another build. The method
above is the cheap way to check it: sample while running, and compare the peak
against `netsh`, rather than reasoning from the error name.

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
through.

**The diagnostic gap is closed, which was step one.** The runner parsed TAP's
`ok`/`not ok` lines and threw the rest away, so a failure said *which test* and
never *which claim* — and both flaking tests carry a dozen assertions each. That
is why it could be observed twice and diagnosed neither time. `_tap_failure` now
reads the `error:` block underneath and reports it:

```
js: the collection drawer can show more than its eight best places
  got 'not ok', wanted 'ok'
     the drawer still opens on the top eight 8 !== 9  [tests\test_pages.mjs:269:42]
```

One caveat worth knowing: the `location` is where `test()` was called, so every
`test_pages.mjs` entry reports the `page_test` wrapper's line and only the file
name is useful. The message is the part that matters.

**Two candidate causes were removed on 2026-08-27, and it is still not proven
which — or whether either — was it.**

- No page test closed its browser context, so a full run finished holding fifty
  live Chromium profiles, accumulating while the browser group ran last on an
  already-busy machine. Contexts are now closed as each test ends.
- `test_offline_build` rewrote `data/` on every run, which the page tests then
  read. The runner walks its groups in order so they never *overlap* — that was
  checked and is why this was dismissed once — but "does not overlap" is not
  "does not interact": the browser group was reading a payload rebuilt seconds
  earlier by another process. It is snapshotted and restored now, so the page
  tests see the same bytes every run.

**Evidence, such as it is: six consecutive clean full runs, plus a dozen
incidental ones the same day.** The flake needed two consecutive runs to appear
once, so that is meaningfully more than it took to find — and it is still absence
of evidence rather than evidence of absence, which is why this entry stays open.

**What to do if it recurs.** The output will now name the assertion, which is the
thing nobody had before. Both theories above are dead at that point, and the next
suspect is the one the original entry named and could not test: timing under
load, in a group that runs last after half a minute of subprocesses.

**It recurred on 2026-09-09, and this time the output named it.** In a full run,
`js: the server decides who is told how to fix stale data` failed with `got 'not
ok', wanted 'ok'`; the page suite on its own passed 78 of 78 moments later, and
the next full run was clean. Both earlier theories were fixed by then, so this is
the recurrence the paragraph above was waiting for: the suspect is timing under
load, and that test is where to start.

### The `.mjs` fixtures still spell the Plague Star node the way the build stopped spelling it

**Found 2026-09-17, while checking whether anything depended on the live event.**
`tests/test_assets.mjs` builds its bounty fixture with
`"Level 15 - 25 Plague Star"` as a `meta.bounties.events` key, and four tests read
it back under that name. Since the fold of 2026-09-15 the build emits that key as
`Level 55 - 65 Plague Star` and never the 15–25 one — `test_build.py` asserts as
much against the real table, *"nothing still carries the 15-25 name it is folded
out of"*.

**Nothing is broken and no test is weakened**: the fixture is self-consistent, the
name is arbitrary to what those four assert (`isEventNode`, `liveRotation`,
`demandsOf`), and 15–25 is still DE's own label — the input the rename consumes,
which is why `EVENT_ENEMY_FOLDS` and three checks in `test_build.py` keep it
deliberately. The cost is only that a fixture reads as a specimen of payload
shape, so the next person to copy one out of it copies a key the build cannot
produce.

**Two ways to settle it, and they are not equal.** Renaming the fixture key makes
it match what ships, and loses nothing because no test there is about the name.
Leaving it and saying so in a comment keeps the fixture as a record of the older
shape, which nothing else needs. **Not decided** — it is cosmetic, and the file is
also the one place the old shape is still written down.

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

**Not a candidate: the rank-gate badge.** A node saying **"asks MR5"** beside
**"Railjack"** was built on 2026-08-27 and reverted the same day at the owner's
direction — **[settled]**, with the reasoning under *The worldstate publishes far
more than the two fields we read*.

### The worldstate publishes far more than the two fields we read

Swept 2026-08-14, at the owner's suggestion. **Most of it was read on 2026-08-24**
and the reasoning is in `PROJECT.md §7`; what is below is what is left.

| Field | What it is | State |
|---|---|---|
| `uniqueName` | ends `…Tier<X>Table<Y>Rewards` | **read.** The letter, per tier — and the tiers disagreed |
| `standingStages[]` | its length is the stage count: 3, 4 or 5 by tier | **read.** `objectivesOf` no longer assumes four |
| `enemyLevels[]` | e.g. `[40, 60]` | **filled**, from the group's own name — all 13 bounty nodes carry levels now |
| `tag` on `/pc/events` | `HeatFissure`, `WaterFight` | **recorded when seen.** Still unobserved for our two events — see below |
| `minMR` | Minimum Mastery Rank, 0 to 10 | **declined 2026-08-27 [settled].** Built as a demand badge and reverted the same day — see below |
| `type` | **not what this row said.** DE publish `jobType`, a path — `VenusHelpingJobResource` | **blocked 2026-08-27** — the readable name is WFCD's mapping table, and rule 9 gates it. Owner's call |
| `rewardPoolDrops[]` | **not published by DE at all.** `rewards` is a table *path* | **declined 2026-08-27 [settled]** — the cross-check would compare our join against WFCD's join of the same two sources |

**`type` is the one with a trap in it.** Our node names are the join key between
DE's drop table and the worldstate, and they are what `ROT.signature` folds on and
what `nodeKey` matches fissures against. Renaming them is not a display change. If
this is done at all it wants to be an annotation beside the name, not a
replacement — and it overlaps with *Our four invented "mission types" leak into the
ranking*, which is the same problem one level up.

**Both rows above were written about a feed this project no longer reads, and
checking them on 2026-08-27 changed both answers.** They describe
`api.warframestat.us/pc/syndicateMissions`; bounties moved to DE's own worldstate
earlier the same day. A whole DE job is six fields and no more:

```json
{ "jobType": "/Lotus/Types/Gameplay/Venus/Jobs/VenusHelpingJobResource",
  "rewards": "/Lotus/Types/Game/MissionDecks/VenusJobMissionRewards/VenusTierATableCRewards",
  "masteryReq": 0, "minEnemyLevel": 5, "maxEnemyLevel": 15,
  "xpAmounts": [430, 430, 430] }
```

**`rewardPoolDrops` does not exist — declined. [settled]** DE publish `rewards` as
a **table path**, not a list of drops. WFCD's `rewardPoolDrops` is WFCD joining
that path against DE's drop tables — the same two sources this project already
holds and already joins itself, which is how the rotation letter is read. So the
"cross-check against DE's static table" would be checking our join of DE against
WFCD's join of DE. It confirms nothing that a disagreement could not equally
blame on the third party. `official.py` sets `rewardPool: []` and says so.

**`type`: the deep dive is done, 2026-09-08, and the answer is that it is
flavour.** The owner asked for it directly — *"deep dive between DE, WFCD and the
Warframe wiki to see what this name refers to"* — and the three sources say:

| source | what it has |
|---|---|
| **Digital Extremes** | the path only: `/Lotus/Types/Gameplay/Venus/Jobs/VenusHelpingJobResource` |
| **wiki.warframe.com** | **the titles, but never the ids.** `Orb_Vallis/Quotes` lists the Orb Vallis bounties as sections — *Agent Down, Archaeology, Blood Relics, Bury Them, Courier Ambush, Dirt Unit, Distract and Divert* — matching WFCD's values exactly. Searching for the internal id finds **one** hit, on *World State/Example*, a page quoting a raw worldstate dump |
| **WFCD** | `data/languages.json` (715 KB, MIT) maps the lowercased path to a display value |

**And the name is the bounty's in-game title.** `VenusHelpingJobResource` is
**"Dirt Unit"** — an Orb Vallis bounty, as the owner read straight off the path:
*"the naming makes me think it's a Bounty from Orb Vallis."* It is, and `Venus`
is how DE spell Orb Vallis internally. It says nothing about the mission type,
the rotation, or what pays a relic — this entry previously quoted *"Reclaim
What's Ours"*, a different job's title and the only example to hand.

**The wiki corroborates the titles independently, which is worth more than the
title itself.** This entry first recorded that the wiki had no mapping; that was
a claim about *searching for the id*, and the owner found the page that shows
the other half. `Orb_Vallis/Quotes` carries the bounty names as sections and they
match WFCD's values exactly. So if these titles were ever wanted, WFCD's table
could be **checked** rather than trusted — which is the difference between
vendoring a fact and vendoring an assertion.

So the recommendation to **leave it** is now evidenced rather than asserted:
adopting it would be a second rule 9 vendoring, of a 715 KB localisation table,
to put a flavour name beside a node — where the node name is already the join key
between DE's drop table, the worldstate, `ROT.signature` and `nodeKey`, and the
flavour name would be an annotation nothing reads.

**Two things worth keeping from the dive.** `languages.json` also maps the reward
*table* paths (`venustieratablearewards` to a list of reward names), which is
WFCD's join of DE's drop tables — the same `rewardPoolDrops` cross-check this
file already declined, and seeing it confirms why: it would check our join of DE
against theirs. And the readable-name option below stays available; it is simply
worth less than it looked.

**The three ways forward are unchanged**, and only the owner can pick:

1. **Leave it.** The recommendation, now with the measurement behind it.
2. **Derive a kind from DE's identifier ourselves**, by rule rather than by
   table. **This entry said `VenusHelpingJobResource` "has no kind in it" and
   that was wrong** — the kind is the last segment, `Resource`. Corrected
   2026-09-08 after the owner pointed at the wiki page and the paths were read
   properly.

   What is actually true is more awkward than either version. **There are two
   naming conventions**, measured over the 53 job paths:

   | shape | count | example | kind |
   |---|---:|---|---|
   | `<landscape><theme>job<kind>` | **26** | `venushelpingjobresource` | `resource`, spelled out |
   | `<kind>bounty<abbrev>` | **27** | `attritionbountycap` | abbreviated — `cap`, `ext`, `lib`, `sab` |

   So the Orb Vallis and Cambion Drift families give the kind cleanly and the
   Plains of Eidolon family needs an abbreviation map. Deterministic and ours
   either way, and no rule 9 question — but it is a small table of our own for
   half the cases, which is worth knowing before calling it "by rule".
3. **Vendor WFCD's table**, the same process as `tools/proxima_nodes.py`. 715 KB
   for flavour text, against 42 lines for names nothing else could supply.

**One thing in `jobType` is worth having whatever is decided about names.**
Isolation Vault bounties arrive with **no `jobType` at all**, which is DE's own
signal for the vault family and cleaner than the level-matching used today.
`official.py` notes it and deliberately does not act on it, because changing how
the family is decided is its own change with its own risk to the rotations.

**And `type` never reached the payload anyway.** It was read into the job record
and dropped one step later, where the group row copies `letter`, `stages` and
`minMR` and nothing else — so no build has ever emitted one, while
`read_bounty_jobs`' docstring said it did. Measured: 0 of 24 groups carried a
`type`, against 20 of 23 DE jobs carrying a `jobType`. The dead field and the
wrong docstring are both gone; restoring it is four lines if option 2 or 3 wins.

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

So this is not a candidate for the exclusion rule.

**It was built as a demand badge on 2026-08-27 and reverted the same day, at the
owner's direction. [settled] — do not re-propose.** The rank field had just
shipped, which lifted the only blocker this entry named, and that turned out to
be the wrong reason to build it. The owner's reasoning, which is better than the
entry's:

- **Nobody it would help is here.** The tool is a relic-farm planner; a player
  below MR 5 is not the reader. All six gated relic-bearing nodes are Isolation
  Vaults at MR 5, so the badge would show for a reader who almost certainly does
  not exist and never for anyone else.
- **It is the player's own job.** Whether you can enter a mission is something
  you look up in game, in the place that will tell you authoritatively. A badge
  here restates it less reliably and one step further from the truth.
- **The strip has to earn every entry.** `Railjack`, `Steel Path` and `Old Mate`
  each say something the reader cannot work out from the row. A rank gate almost
  nobody is behind does not.

What that leaves is a general rule worth keeping past this entry: *the blocker
lifting is not the same as the case being made.* This one had been waiting on the
rank field for so long that its arrival read as permission.

Two pieces of the reverted work are worth knowing about if anything ever does
read the rank, because both cost a measurement to find:

- **`minMR` sits on `meta.bounties.groups[node]`, not on the source row**, even
  though the worldstate calls it a job field. Nineteen of twenty-four groups
  carry one; none of the 96 bounty source rows does. Reading `source.minMR`
  returns nothing and fails silently.
- **`wireMastery` is `once()`-guarded**, so a single `onChange` callback is
  dropped for whichever page runs second in the single-file build. Anything that
  needs a repaint on a rank change needs a subscriber list, not a callback.

### The payload gate only warns — make it block after Citrine, with new Primes exempt

**Owner's decision, 2026-09-11** (`PROJECT.md §7`, *The published payload is
checked after the build*). The built-payload group now runs on CI after the build
as *Check the payload about to be published*, and ends in `|| echo "::warning::…"`,
so a failure annotates the run and publishes anyway. Warn-only is deliberate and
temporary: some of its checks are expected to trip on a brand-new Prime (the
Citrine Prime entry above), and a gate that blocked on the 23rd would stop the
release that test exists to watch.

Still to do, on or after 2026-09-24:

1. **Drop the `|| echo`**, so a failure fails the run and blocks the deploy.
2. **Exempt a Prime in its first days** from whatever the 23rd showed actually
   trips. Predicted: `parts: only the items DE do not publish fall back` (a Prime
   can arrive before its recipe is in our copy of DE's export) and `platinum:
   every Prime-part reward row carries plat` (no misses allowed, and
   warframe.market is read at most daily). **"New" is not defined yet**: `isNew`
   is only set when DE's export lists an item before the wiki does, so it may
   never be true for Citrine.
3. **Decide the two that are not release lag.** `wiki coverage:` fires on a name
   or section the build cannot place — a real gap, so exempting it would hide a
   flaw rather than a delay. `bounties: … the three shapes DE actually ships`
   asserts exactly `[3, 4, 5]`, so a change DE make to bounty length would block
   the site.

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

### The Plague Star reward tables are a run out of date

[`Operation: Plague Star`](https://wiki.warframe.com/w/Operation:_Plague_Star)
renders its *Bounty Rewards* from `Module:DropTables/data`, and its relics are not
the ones DE list now. Checked 2026-09-15 with the event live: Stage 1 shares
**1 relic of 10** with DE's drop table (Lith A12), and Stages 2–3 share **3 of
21**. Every non-relic row and every percentage matches on both, which is the
shape of a table copied from an earlier run and not refreshed. Neither source
has a table for the Steel Path tier: DE's worldstate gives it its own,
`PlagueStarTableSteelPathRewards`, and DE do not publish that one (`PROJECT.md
§7`, *The Hemocyte is folded into Advanced Plague Star*).

**Re-verified 2026-09-16 against DE's live table**, fetched that day rather than
from our week-old cache, and the original figures hold exactly: Stage 1 shares
**1 of 10** (Lith A12), Stages 2–3 share **3 of 21** (Axi A21, Lith A12,
Lith K12). Two things that pass adds:

- **The wiki has three reward tables where DE publish four stage groups** —
  Stage 1; *Stage 2, Stage 3 of 4, and Stage 3 of 5*; *Stage 4 of 5* (26
  relics, the largest); and Final Stage. So it is not only stale values: a
  whole group is unaccounted for, and the rendered tables carry **no stage
  captions at all**, which is why nothing on the page says which is which.
- **Overlap cannot align them.** Matching each wiki table against every DE
  stage by shared relics scores 0–3 everywhere, so the tables no longer
  identifiably correspond to any particular stage. That is worth knowing before
  anyone tries a row-by-row patch: there is nothing to patch *against*.

**The diagnosis is confirmed rather than assumed.** Every non-relic reward and
every percentage matches DE exactly — Augur Message 25%, Endo x300 25%, Kuva
x100 23.86%, Naramon Lens 14.77%, then ten slots at 1.14% — while the relic
names in those slots are from an earlier run. The shape is intact and the
contents are old, which is a regenerate job, not an edit. The page says so
itself: *"Readers can update `Module:DropTables/data` and cross reference with
official drop tables"*.

**Written down in this much detail because it stops being checkable on
2026-09-23.** Plague Star runs a fortnight a year, and when it ends DE's table
for it goes with it — so this is not a note that someone must act on by then, it
is the evidence itself, captured while there was something to capture. Until the
next run, this entry *is* the record; re-deriving it will not be possible.

**No local workaround** — the build reads DE's table, never this module.

**One trap for anyone re-running the comparison.** The wiki renders relic names
with a **non-breaking space** (`Axi\xa0C10`), so a `^(Lith|Meso|Neo|Axi) ` match
silently finds zero relics and reads as "the wiki lists none" rather than as a
parsing failure. Normalise `\xa0` first.

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
